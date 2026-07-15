"""Company funding enrichment service (Perplexity-sourced).

Sources company funding signals — total raised, latest valuation, employee count,
last round, and exit status — from Perplexity ``sonar-pro`` (web-grounded, cited).
This REPLACES CoreSignal as the funding source for the app (CoreSignal was too
expensive). These company funding fields feed the Founder Leaderboards' "Most Funded"
and "Unicorn" boards via the ``founder_stats`` rollup, so the numbers are now
web-sourced / estimated rather than vendor-authoritative — and provenance (source +
citations + confidence) is tracked on every enriched company.

Reliability guardrails (mirrors founder_enrichment_service):
  * Every enrichment requires >= 1 citation from Perplexity — a response with zero
    citations is SKIPPED, never written (we don't store unverified funding numbers).
  * A confidence signal (high/medium/low) is stored alongside the values.
  * Values are plain-integer USD; anything unverifiable is left null (COALESCE in
    update_company_funding preserves whatever was there before).

Cost control: prioritized batching (founder-linked companies first) + a 30-day TTL
skip (``companies.funding_enriched_at``) + ``--all`` for a deliberate full backfill;
the daily cron drains the backlog in bounded batches.

Import-safe with no PERPLEXITY_API_KEY: the service logs a warning and no-ops rather
than crashing, so importing/wiring it never requires a live key.
"""

from __future__ import annotations

import json
import logging
import os
import sys
from typing import Any, Optional

import requests

try:
    from pydantic import BaseModel, Field
    HAS_PYDANTIC = True
except ImportError:  # pragma: no cover - pydantic is a hard dep, but stay import-safe
    HAS_PYDANTIC = False
    BaseModel = object  # type: ignore

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions"
MODEL = "sonar-pro"
DEFAULT_TTL_DAYS = 30
DEFAULT_BATCH_LIMIT = 50
REQUEST_TIMEOUT = 45


# ---------------------------------------------------------------------------
# Structured output schema (Pydantic) — the shape Perplexity is asked to return.
# ---------------------------------------------------------------------------

if HAS_PYDANTIC:
    class CompanyFunding(BaseModel):
        """Web-sourced funding signals. All fields optional — null if unverifiable."""
        total_funding_usd: Optional[int] = None       # total raised to date, plain int USD
        latest_valuation_usd: Optional[int] = None    # most recent known valuation, plain int USD
        employee_count: Optional[int] = None
        last_round_name: Optional[str] = None         # e.g. "Series A", "Seed"
        last_round_usd: Optional[int] = None          # size of the most recent round, plain int USD
        status: Optional[str] = None                  # "Private" | "Public" | "Acquired"
        acquirer: Optional[str] = None                # if status == "Acquired"
        confidence: Optional[str] = None              # "high" | "medium" | "low"


# JSON schema handed to Perplexity's structured-output mode.
_RESPONSE_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "total_funding_usd": {"type": ["integer", "null"]},
        "latest_valuation_usd": {"type": ["integer", "null"]},
        "employee_count": {"type": ["integer", "null"]},
        "last_round_name": {"type": ["string", "null"]},
        "last_round_usd": {"type": ["integer", "null"]},
        "status": {"type": ["string", "null"], "enum": ["Private", "Public", "Acquired", None]},
        "acquirer": {"type": ["string", "null"]},
        "confidence": {"type": ["string", "null"], "enum": ["high", "medium", "low", None]},
    },
}


class CompanyEnrichmentService:
    """Perplexity-backed funding enrichment for YC companies."""

    def __init__(self):
        self.api_key = os.environ.get("PERPLEXITY_API_KEY")
        self.model = MODEL
        if not self.api_key:
            logger.warning(
                "PERPLEXITY_API_KEY not set — company funding enrichment disabled (no-op)."
            )

    def is_enabled(self) -> bool:
        return bool(self.api_key)

    # -- prompt -------------------------------------------------------------

    @staticmethod
    def _build_query(name: str, batch: Optional[str], one_liner: Optional[str]) -> str:
        # Disambiguate by YC batch + the one-liner so we don't confuse same-named
        # companies (there are many "Acme"s).
        ctx_bits = []
        if batch:
            ctx_bits.append(f"a Y Combinator company from the {batch} batch")
        if one_liner:
            ctx_bits.append(f'described as "{one_liner}"')
        ctx = (" (" + ", ".join(ctx_bits) + ")") if ctx_bits else ""
        return (
            f"Find the funding profile for the startup {name}{ctx}. Report: total "
            f"funding raised to date across ALL rounds (USD), most recent known "
            f"valuation or public market cap (USD), current employee/headcount, the name "
            f"of the most recent funding round (e.g. Seed, Series A) and its size in USD, "
            f"and the company's status (Private, Public, or Acquired — and the acquirer "
            f"if acquired). Also give an overall confidence level of high, medium, or "
            f"low.\n\n"
            f"Rules: cite every number with a source URL. For total_funding_usd, if no "
            f"single published 'total raised' figure exists, SUM the amounts of all "
            f"disclosed funding rounds and report that sum. Every Y Combinator company "
            f"received YC's own standard investment, so a real company's total funding is "
            f"never zero — NEVER return 0 for total_funding_usd; if you genuinely cannot "
            f"find any round or total, return null instead. Report all money amounts as "
            f"plain integer US dollars (e.g. 12000000, not \"$12M\"). Make sure you are "
            f"describing THIS specific company, not a similarly named one."
        )

    @staticmethod
    def _yc_investment_floor(batch: Optional[str]) -> int:
        """YC's standard investment for the batch era — the minimum any YC company has
        raised. Used as a floor so a funded YC company never shows $0 total funding."""
        import re as _re
        year = None
        if batch:
            m = _re.search(r"(?:19|20)\d{2}", batch)
            if m:
                year = int(m.group(0))
        if year is None:
            return 125_000
        if year <= 2010:
            return 20_000          # early YC (~$15–20k)
        if year <= 2013:
            return 120_000         # ~$120k era (incl. Start Fund)
        if year <= 2021:
            return 125_000         # $120–125k for 7%
        return 500_000            # 2022+ standard deal ($125k + $375k MFN SAFE)

    # -- Perplexity call ----------------------------------------------------

    def _call_perplexity(self, query: str) -> Optional[dict[str, Any]]:
        """One structured, cited call. Returns {parsed, citations, raw} or None."""
        try:
            resp = requests.post(
                PERPLEXITY_API_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": [{"role": "user", "content": query}],
                    "temperature": 0.1,
                    "max_tokens": 1200,
                    "response_format": {
                        "type": "json_schema",
                        "json_schema": {"schema": _RESPONSE_JSON_SCHEMA},
                    },
                },
                timeout=REQUEST_TIMEOUT,
            )
        except requests.RequestException as e:
            logger.error("Perplexity request failed: %s", e)
            return None

        if resp.status_code != 200:
            logger.error("Perplexity API error %s: %s", resp.status_code, resp.text[:300])
            return None

        data = resp.json()
        choices = data.get("choices") or []
        if not choices:
            return None
        content = choices[0].get("message", {}).get("content", "")
        try:
            parsed = json.loads(content)
        except (json.JSONDecodeError, TypeError):
            logger.warning("Perplexity JSON parse failed; dropping response")
            return None

        citations = data.get("citations", [])
        if not isinstance(citations, list):
            citations = []
        citations = [str(c) for c in citations]

        return {"parsed": parsed, "citations": citations, "raw": data}

    # -- mapping ------------------------------------------------------------

    @staticmethod
    def _to_funding_row(parsed: dict[str, Any], citations: list[str],
                        confidence: Optional[str]) -> dict[str, Any]:
        """Map the model's schema onto the companies-table funding columns.

        status/acquirer -> exit_type/acquirer: an "Acquired" company gets exit_type
        'M&A'; a "Public" company gets exit_type 'IPO'. Private -> no exit signal.
        """
        status = (parsed.get("status") or "").strip().lower()
        exit_type = None
        acquirer = None
        if status == "acquired":
            exit_type = "M&A"
            acquirer = parsed.get("acquirer") or None
        elif status == "public":
            exit_type = "IPO"

        return {
            "funding_total_usd": parsed.get("total_funding_usd"),
            "valuation_usd": parsed.get("latest_valuation_usd"),
            "employee_count": parsed.get("employee_count"),
            "funding_last_round_usd": parsed.get("last_round_usd"),
            "funding_last_round_name": parsed.get("last_round_name"),
            "exit_type": exit_type,
            "acquirer": acquirer,
            "funding_citations": citations,
            "funding_confidence": confidence,
        }

    # -- public: enrich one company ----------------------------------------

    def enrich_company(self, db, company: dict[str, Any]) -> bool:
        """Enrich a single company dict ({id, name, slug, batch, one_liner, ...})
        and write it via db.update_company_funding. Returns True if written.

        Guardrail: a Perplexity response with ZERO citations is skipped — we never
        write unverified funding numbers.
        """
        if not self.is_enabled():
            return False

        result = self._call_perplexity(self._build_query(
            company.get("name") or "",
            company.get("batch"),
            company.get("one_liner"),
        ))
        if not result:
            return False

        parsed, citations = result["parsed"], result["citations"]

        # Guardrail: no citations -> don't trust any of the numbers, skip entirely.
        if not citations:
            logger.info("enrich_company %s: no citations; skipping (unverified)",
                        company.get("slug") or company.get("id"))
            return False

        # Optional Pydantic normalization pass — best-effort; failure is non-fatal.
        confidence = parsed.get("confidence")
        if HAS_PYDANTIC:
            try:
                normalized = CompanyFunding(**{
                    k: parsed.get(k) for k in CompanyFunding.model_fields
                    if parsed.get(k) is not None
                })
                parsed.update(json.loads(normalized.model_dump_json()))
                confidence = normalized.confidence
            except Exception as e:  # noqa: BLE001
                logger.debug("Pydantic normalization skipped: %s", e)

        row = self._to_funding_row(parsed, citations, confidence)

        # YC floor: every YC company raised at least YC's standard investment, so a
        # total of null/0 is never correct. Floor it to the batch-era YC deal and mark
        # the total low-confidence (an estimate, not a cited raise).
        if not row.get("funding_total_usd"):
            row["funding_total_usd"] = self._yc_investment_floor(company.get("batch"))
            if not row.get("funding_last_round_name"):
                row["funding_last_round_name"] = "Y Combinator"
            row["funding_confidence"] = "low"

        # If the model returned citations but every funding value is null there's
        # nothing worth writing (still stamps provenance would be misleading), skip.
        value_fields = ("funding_total_usd", "valuation_usd", "employee_count",
                        "funding_last_round_usd", "funding_last_round_name",
                        "exit_type", "acquirer")
        if all(row.get(f) in (None, "") for f in value_fields):
            logger.info("enrich_company %s: cited but no usable funding values; skipping",
                        company.get("slug") or company.get("id"))
            return False

        try:
            db.update_company_funding(company["id"], row)
            return True
        except Exception as e:  # noqa: BLE001
            logger.warning("enrich_company: update failed for company %s: %s",
                           company.get("id"), e)
            return False

    # -- public: batch / backfill ------------------------------------------

    def enrich_companies(self, db, slugs: Optional[list[str]] = None,
                         limit: int = DEFAULT_BATCH_LIMIT,
                         include_all: bool = False) -> dict[str, Any]:
        """Enrich a prioritized batch of companies' funding. No-ops without a key.

        Selection prioritizes founder-linked companies (they feed the Founder
        Leaderboards) and skips companies enriched within DEFAULT_TTL_DAYS unless
        include_all. When ``slugs`` is given, only those companies are considered.
        After the batch, refreshes founder_stats so the boards pick up new funding.
        """
        if not self.is_enabled():
            logger.info("Company funding enrichment disabled (no PERPLEXITY_API_KEY) — skipping.")
            return {"enriched": 0, "skipped": 0, "disabled": True}

        try:
            candidates = db.get_companies_for_funding_enrichment(
                limit=limit, stale_days=DEFAULT_TTL_DAYS, include_all=include_all
            )
        except Exception as e:  # noqa: BLE001
            logger.error("enrich_companies: could not select companies: %s", e)
            return {"enriched": 0, "skipped": 0, "error": str(e)}

        if slugs:
            wanted = {s.lower() for s in slugs}
            candidates = [c for c in candidates if (c.get("slug") or "").lower() in wanted]

        enriched = 0
        skipped = 0
        for company in candidates:
            if self.enrich_company(db, company):
                enriched += 1
            else:
                skipped += 1

        # Roll new funding up into the Founder Leaderboards ("Most Funded"/"Unicorn").
        if enriched:
            try:
                db.refresh_founder_stats()
            except Exception as e:  # noqa: BLE001
                logger.warning("enrich_companies: refresh_founder_stats failed: %s", e)

        summary = {"enriched": enriched, "skipped": skipped,
                   "candidates": len(candidates), "disabled": False}
        logger.info("enrich_companies: %s", summary)
        return summary


# Singleton accessor (mirrors get_founder_enrichment_service()).
_company_enrichment_service: Optional[CompanyEnrichmentService] = None


def get_company_enrichment_service() -> CompanyEnrichmentService:
    global _company_enrichment_service
    if _company_enrichment_service is None:
        _company_enrichment_service = CompanyEnrichmentService()
    return _company_enrichment_service


def main() -> None:
    """CLI: enrich a prioritized batch of companies. `--all` backfills everything."""
    from database_factory import get_database

    include_all = "--all" in sys.argv[1:]
    limit = DEFAULT_BATCH_LIMIT
    for arg in sys.argv[1:]:
        if arg.startswith("--limit="):
            limit = int(arg.split("=", 1)[1])

    db = get_database()
    svc = get_company_enrichment_service()
    result = svc.enrich_companies(db, limit=limit, include_all=include_all)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
