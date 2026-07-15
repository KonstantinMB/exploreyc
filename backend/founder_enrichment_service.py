"""Founder enrichment service (Script 2 — supplementary).

Uses Perplexity ``sonar-pro`` (web-grounded, cited) to add off-YC signals — social
following, education, awards, notable exits, angel investments, prior roles — as
*labeled, cited, confidence-scored* extras on top of the authoritative founder data.

Reliability guardrails (spec §6.3, load-bearing):
  * Every enriched field requires >= 1 citation — uncited values are DROPPED, not stored.
  * Each field carries a confidence signal.
  * Enrichment NEVER drives the authoritative leaderboards (serial/funded/exits/unicorns).
    It is supplementary only; a "most-followed" board would be explicitly web-sourced.

Cost control: prioritized batching + a 30-day TTL cache (``founder_enrichment.enriched_at``)
+ ``--all`` for a deliberate full backfill; the daily cron drains the backlog in bounded
batches.

Import-safe with no PERPLEXITY_API_KEY: the service logs a warning and no-ops rather than
crashing, so importing/wiring it never requires a live key.
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
DEFAULT_BATCH_LIMIT = 25
REQUEST_TIMEOUT = 45


# ---------------------------------------------------------------------------
# Structured output schema (Pydantic) — the shape Perplexity is asked to return.
# ---------------------------------------------------------------------------

if HAS_PYDANTIC:
    class EducationItem(BaseModel):
        institution: Optional[str] = None
        degree: Optional[str] = None
        field: Optional[str] = None
        year: Optional[int] = None

    class NotableExit(BaseModel):
        company: Optional[str] = None
        outcome: Optional[str] = None   # e.g. "acquired by Google", "IPO"
        year: Optional[int] = None

    class PriorRole(BaseModel):
        organization: Optional[str] = None
        role: Optional[str] = None

    class FounderEnrichment(BaseModel):
        """Web-sourced supplementary signals. All fields optional — only cited ones kept."""
        twitter_followers: Optional[int] = None
        linkedin_followers: Optional[int] = None
        education: list[EducationItem] = Field(default_factory=list)
        awards: list[str] = Field(default_factory=list)
        notable_exits: list[NotableExit] = Field(default_factory=list)
        angel_investments_count: Optional[int] = None
        notable_prior_roles: list[PriorRole] = Field(default_factory=list)
        bio_long: Optional[str] = None


# JSON schema handed to Perplexity's structured-output mode.
_RESPONSE_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "twitter_followers": {"type": ["integer", "null"]},
        "linkedin_followers": {"type": ["integer", "null"]},
        "education": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "institution": {"type": ["string", "null"]},
                    "degree": {"type": ["string", "null"]},
                    "field": {"type": ["string", "null"]},
                    "year": {"type": ["integer", "null"]},
                },
            },
        },
        "awards": {"type": "array", "items": {"type": "string"}},
        "notable_exits": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "company": {"type": ["string", "null"]},
                    "outcome": {"type": ["string", "null"]},
                    "year": {"type": ["integer", "null"]},
                },
            },
        },
        "angel_investments_count": {"type": ["integer", "null"]},
        "notable_prior_roles": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "organization": {"type": ["string", "null"]},
                    "role": {"type": ["string", "null"]},
                },
            },
        },
        "bio_long": {"type": ["string", "null"]},
        # Per-field confidence + whether the model claims a citation for each field.
        "confidence": {"type": "object"},
        "field_citations": {"type": "object"},
    },
}

# Fields that must be dropped when uncited (spec §6.3). bio_long is prose flavor and
# also requires a citation to be stored.
_CITEABLE_FIELDS = (
    "twitter_followers", "linkedin_followers", "education", "awards",
    "notable_exits", "angel_investments_count", "notable_prior_roles", "bio_long",
)


class FounderEnrichmentService:
    """Perplexity-backed supplementary enrichment for founders."""

    def __init__(self):
        self.api_key = os.environ.get("PERPLEXITY_API_KEY")
        self.model = MODEL
        if not self.api_key:
            logger.warning(
                "PERPLEXITY_API_KEY not set — founder enrichment disabled (no-op)."
            )

    def is_enabled(self) -> bool:
        return bool(self.api_key)

    # -- prompt -------------------------------------------------------------

    @staticmethod
    def _build_query(full_name: str, title: Optional[str], company: Optional[str],
                     batch: Optional[str]) -> str:
        who = full_name
        ctx = ", ".join(x for x in [title, f"at {company}" if company else None,
                                    f"YC {batch}" if batch else None] if x)
        subject = f"{who} ({ctx})" if ctx else who
        return (
            f"Verified public stats for {subject}: X/Twitter followers, LinkedIn "
            f"followers, education, notable exits, awards, angel investments, notable "
            f"prior roles. Only include facts you can cite with a source URL. For each "
            f"field, include a confidence level (high/medium/low) in a `confidence` "
            f"object and whether it is backed by a citation in a `field_citations` "
            f"object. If a fact cannot be cited, omit it."
        )

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

    # -- guardrails ---------------------------------------------------------

    @staticmethod
    def _drop_uncited(parsed: dict[str, Any], citations: list[str]) -> dict[str, Any]:
        """Keep only fields the model claims a citation for AND that have a value.

        Uncited or empty fields are dropped, never stored (spec §6.3). With no
        citations at all, every citeable field is dropped.
        """
        field_citations = parsed.get("field_citations") or {}
        confidence = parsed.get("confidence") or {}
        kept: dict[str, Any] = {"confidence": {}}

        have_any_citation = bool(citations)
        for field in _CITEABLE_FIELDS:
            value = parsed.get(field)
            if value in (None, [], "", 0):
                continue
            # Require the model to flag a citation for the field AND that some source
            # URL exists in the response's citation list.
            cited = bool(field_citations.get(field)) and have_any_citation
            if not cited:
                continue
            kept[field] = value
            if field in confidence:
                kept["confidence"][field] = confidence[field]
        return kept

    # -- public: enrich one founder ----------------------------------------

    def enrich_founder(self, founder: dict[str, Any]) -> Optional[dict[str, Any]]:
        """Enrich a single founder dict ({id, full_name, slug, latest_batch,
        company_name, ...}). Returns the storable enrichment payload, or None."""
        if not self.is_enabled():
            return None

        query = self._build_query(
            founder.get("full_name") or "",
            founder.get("title"),
            founder.get("company_name"),
            founder.get("latest_batch"),
        )
        result = self._call_perplexity(query)
        if not result:
            return None

        parsed, citations = result["parsed"], result["citations"]

        # Optional Pydantic normalization pass — best-effort; failure is non-fatal.
        if HAS_PYDANTIC:
            try:
                normalized = FounderEnrichment(**{
                    k: parsed.get(k) for k in FounderEnrichment.model_fields
                    if parsed.get(k) is not None
                })
                parsed.update(json.loads(normalized.model_dump_json()))
            except Exception as e:  # noqa: BLE001
                logger.debug("Pydantic normalization skipped: %s", e)

        kept = self._drop_uncited(parsed, citations)
        if len(kept) <= 1:  # only the (empty) confidence key survived
            logger.info("enrich_founder %s: no citeable fields; nothing stored",
                        founder.get("slug"))
            return None

        payload = {**kept}
        payload["citations"] = citations
        payload["model"] = self.model
        payload["raw_response"] = result["raw"]
        return payload

    # -- public: batch / backfill ------------------------------------------

    def enrich_batch(self, db, limit: int = DEFAULT_BATCH_LIMIT,
                     ttl_days: int = DEFAULT_TTL_DAYS, include_all: bool = False) -> dict[str, Any]:
        """Enrich a prioritized batch of founders. No-ops gracefully without a key.

        include_all backfills the whole table (``--all``); otherwise TTL-fresh rows
        (enriched < ttl_days ago) are skipped by the DB query.
        """
        if not self.is_enabled():
            logger.info("Founder enrichment disabled (no PERPLEXITY_API_KEY) — skipping.")
            return {"enriched": 0, "skipped": 0, "disabled": True}

        try:
            candidates = db.get_founders_for_enrichment(
                limit=limit, stale_days=ttl_days, include_all=include_all
            )
        except Exception as e:  # noqa: BLE001
            logger.error("enrich_batch: could not select founders: %s", e)
            return {"enriched": 0, "skipped": 0, "error": str(e)}

        enriched = 0
        skipped = 0
        for founder in candidates:
            payload = self.enrich_founder(founder)
            if payload is None:
                skipped += 1
                continue
            try:
                db.upsert_founder_enrichment(founder["id"], payload)
                enriched += 1
            except Exception as e:  # noqa: BLE001
                logger.warning("enrich_batch: upsert failed for founder %s: %s",
                               founder.get("id"), e)
                skipped += 1

        summary = {"enriched": enriched, "skipped": skipped,
                   "candidates": len(candidates), "disabled": False}
        logger.info("enrich_batch: %s", summary)
        return summary


# Singleton accessor (mirrors get_perplexity_service()).
_founder_enrichment_service: Optional[FounderEnrichmentService] = None


def get_founder_enrichment_service() -> FounderEnrichmentService:
    global _founder_enrichment_service
    if _founder_enrichment_service is None:
        _founder_enrichment_service = FounderEnrichmentService()
    return _founder_enrichment_service


def main() -> None:
    """CLI: enrich a prioritized batch. `--all` backfills the whole table."""
    from database_factory import get_database

    include_all = "--all" in sys.argv[1:]
    limit = DEFAULT_BATCH_LIMIT
    for arg in sys.argv[1:]:
        if arg.startswith("--limit="):
            limit = int(arg.split("=", 1)[1])

    db = get_database()
    svc = get_founder_enrichment_service()
    result = svc.enrich_batch(db, limit=limit, include_all=include_all)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
