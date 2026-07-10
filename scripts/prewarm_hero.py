#!/usr/bin/env python3
"""
Nightly offline pre-warm for the hero answer box.

Computes deterministic verdicts for popular startup ideas using the same
build_verdict() pipeline as /api/hero-answer, then asks gpt-4.1-mini to
rewrite the summary into 2-3 punchy sentences grounded ONLY in the returned
company names.  Results are written to idea_answer_cache with a 48-hour TTL
so the hero endpoint serves rich prose instantly on cache hit.

OFFLINE ONLY — never on the hot path. Requires DATABASE_URL and OPENAI_API_KEY.
Depends on company embeddings being present (Task 12 re-embed must have run).

Run:
    python scripts/prewarm_hero.py
"""

import os
import sys
import hashlib
import logging

# Add backend/ to path so we can import backend modules directly
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from openai import OpenAI
from database_factory import get_database
from hero_service import build_verdict
from idea_filter import get_search_text_for_embedding
from embedding_service import get_embedding_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Popular idea strings — ~40 spanning common YC themes.
# The first 4 are the homepage example chips and MUST always be included so
# the hero box is warm on every deployment.
# ---------------------------------------------------------------------------
POPULAR = [
    # Homepage chips (always first)
    "AI code review for developers",
    "Vertical SaaS for dentists",
    "Fintech for freelancers",
    "AI agents for customer support",

    # AI / LLM devtools
    "AI-powered documentation generator for APIs",
    "LLM observability and evaluation platform",
    "AI pair programmer for data scientists",
    "Automated prompt engineering and testing tool",
    "AI-powered code migration between frameworks",

    # Developer tools / infrastructure
    "Developer productivity analytics for engineering teams",
    "Infrastructure cost optimization for AWS",
    "Open source database change management tool",
    "Internal developer portal for platform teams",
    "API testing and mocking platform for backend engineers",

    # B2B SaaS
    "Procurement automation for mid-market companies",
    "Contract lifecycle management for startups",
    "Employee onboarding automation for HR teams",
    "Vertical SaaS for veterinary clinics",
    "Fleet management software for logistics companies",

    # Fintech
    "B2B payments infrastructure for emerging markets",
    "Revenue-based financing for e-commerce sellers",
    "Expense management for distributed remote teams",
    "Cross-border payroll for global startups",
    "Embedded insurance for gig economy workers",

    # Healthtech
    "AI medical scribe for primary care physicians",
    "Mental health platform for college students",
    "Remote patient monitoring for chronic disease",
    "Prior authorization automation for healthcare providers",
    "Pharmacy benefit management for small employers",

    # AI agents
    "AI agent for sales development representatives",
    "Autonomous AI agent for legal research",
    "AI agent for e-commerce returns and refunds",

    # Climate / sustainability
    "Carbon accounting software for SMBs",
    "EV fleet charging management platform",
    "Sustainable supply chain traceability tool",

    # Education
    "AI tutoring platform for K-12 math",
    "Upskilling platform for manufacturing workers",

    # Security / data
    "Data loss prevention for SaaS applications",
    "Security compliance automation for SOC 2",
]

# ---------------------------------------------------------------------------
# GPT-4.1-mini prose rewrite prompt
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = (
    "Rewrite the verdict in 2-3 punchy sentences. "
    "Only mention the companies listed. Never invent companies."
)


def make_cache_key(idea: str) -> str:
    """Identical formula to /api/hero-answer endpoint."""
    return hashlib.sha1(idea.lower().encode()).hexdigest()


def main() -> None:
    db = get_database()
    emb = get_embedding_service()
    client = OpenAI()  # reads OPENAI_API_KEY from env

    # Portfolio total — same logic as /api/hero-answer
    if hasattr(db, "count_companies"):
        portfolio_total = db.count_companies()
    else:
        portfolio_total = 6000  # safe fallback for non-Postgres environments

    logger.info("portfolio_total=%d, warming %d ideas", portfolio_total, len(POPULAR))

    success = 0
    failures = []

    for idea in POPULAR:
        try:
            # 1. Embed using same query/doc symmetry as the live endpoint
            vec = emb.generate_embedding_for_idea(get_search_text_for_embedding(idea))

            # 2. Similarity search — identical params to live endpoint
            similar = db.find_similar_companies_by_embedding(vec, limit=12, min_similarity=0.32)

            # 3. Deterministic verdict (no LLM)
            verdict = build_verdict(idea, similar, portfolio_total)

            # 4. One gpt-4.1-mini call to produce punchy prose
            company_names = ", ".join(c["name"] for c in verdict.get("closest", []))
            user_msg = f"Verdict: {verdict.get('summary', '')}\nCompanies: {company_names}"

            response = client.chat.completions.create(
                model="gpt-4.1-mini",
                temperature=0.3,
                max_tokens=180,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_msg},
                ],
            )
            prose = response.choices[0].message.content.strip()

            # 5. Cache key must match /api/hero-answer exactly
            key = make_cache_key(idea)

            # 6. Store prose INSIDE answer_json so get_idea_answer_cache() returns it.
            #    get_idea_answer_cache() returns only answer_json; the endpoint does
            #    {**cached, "cached": True} — so prose must live in the dict itself.
            #    Also pass prose= so the dedicated column is populated for analytics.
            cached_payload = {**verdict, "prose": prose}
            db.set_idea_answer_cache(key, cached_payload, ttl_hours=48, prose=prose)

            logger.info("prewarmed [%s]: %s", key[:8], idea)
            success += 1

        except Exception as exc:
            logger.error("FAILED [%s]: %s", idea, exc)
            failures.append((idea, str(exc)))

    logger.info("done — %d/%d prewarmed", success, len(POPULAR))
    if failures:
        logger.warning("%d failures:", len(failures))
        for idea, err in failures:
            logger.warning("  %s → %s", idea, err)
        sys.exit(1)


if __name__ == "__main__":
    main()
