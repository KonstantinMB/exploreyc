"""Regression guards for all-source embeddings / vector search.

These are source-level assertions (not live-DB) because pgvector isn't available
in the unit-test environment. They lock in the two invariants that matter:

  1. embedding generation + all-source retrieval are NOT restricted to source='yc'
  2. the YC-denominated market-size metric IS still restricted to source='yc'

so a future edit can't silently re-scope either one and re-trigger the
market-size over-counting bug.
"""

import re
from pathlib import Path

DB_PG = Path(__file__).parent / "database_postgres.py"
MAIN = Path(__file__).parent / "main.py"


def _method_body(src, name):
    """Return the text of a `def name(...)` block up to the next top-level def."""
    lines = src.splitlines()
    start = next(i for i, l in enumerate(lines) if re.match(rf"\s*(async )?def {name}\b", l))
    indent = len(lines[start]) - len(lines[start].lstrip())
    body = [lines[start]]
    for l in lines[start + 1:]:
        at_top = l.strip() and (len(l) - len(l.lstrip())) <= indent
        if at_top and re.match(r"\s*(@app|(async )?def )", l):
            break
        body.append(l)
    return "\n".join(body)


def test_generation_covers_all_sources():
    src = DB_PG.read_text()
    gen = _method_body(src, "get_companies_for_embedding")
    assert "source = 'yc'" not in gen, "embedding generation must not be YC-only"
    without = _method_body(src, "get_companies_without_embeddings")
    assert "source = 'yc'" not in without


def test_retrieval_has_source_filter_and_dedup():
    src = DB_PG.read_text()
    body = _method_body(src, "find_similar_companies_by_embedding")
    assert "source_filter" in body, "retrieval must accept a source_filter"
    assert "AND source = %s" in body, "YC-scoped branch must filter by source"
    assert "DISTINCT ON" in body, "all-source branch must dedupe by dedupe_key"


def test_market_size_denominator_stays_yc_only():
    src = DB_PG.read_text()
    yc_count = _method_body(src, "get_yc_company_count")
    assert "WHERE source = 'yc'" in yc_count, "market-size denominator must stay YC-only"


def test_hero_callsites_pass_source_filter_yc():
    src = MAIN.read_text()
    # The 5 hero/validator paths (3 embedding + 2 text-search fallbacks) must all
    # pin source_filter="yc"; the all-source endpoint (below) must NOT.
    assert src.count('source_filter="yc"') == 5, "expected exactly 5 YC-scoped hero calls"


def test_all_source_endpoint_is_not_yc_scoped():
    src = MAIN.read_text()
    assert '@app.post("/api/companies/similar")' in src
    body = _method_body(src, "companies_similar")
    assert "find_similar_companies_by_embedding" in body
    assert 'source_filter="yc"' not in body, "all-source semantic search must not be YC-scoped"
