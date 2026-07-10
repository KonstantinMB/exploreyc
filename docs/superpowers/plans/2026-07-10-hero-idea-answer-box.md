# Hero Idea Answer Box — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing YC vector search into an instant, deterministic "answer box" in the homepage hero that tells a visitor, in <300ms, whether their startup idea is already crowded in YC and who the closest players are.

**Architecture:** Keep the OpenAI-embedding + pgvector core, but (1) fix retrieval quality (HNSW + richer document text + automated backfill), (2) add a pure-Python deterministic "verdict" layer that turns retrieved companies into a crisp answer + market meter with **zero per-query LLM calls**, (3) cache answers with a TTL and protect the public endpoint with a restart-safe rate limiter, and (4) use `gpt-4.1-mini` **offline only** in a nightly pre-warm job to write richer prose for popular/example queries (cached, never on the hot path).

**Tech Stack:** FastAPI (Python 3.11), Postgres/Supabase + pgvector, OpenAI `text-embedding-3-small` (embeddings) + `gpt-4.1-mini` (offline prose only), React 19 + Vite + TypeScript + Tailwind + Framer Motion, Upstash Redis (rate limit + cache, with in-memory fallback).

## Global Constraints

- Backend monolith lives in `backend/main.py`; DB via factory (`database_factory.py` → `database_postgres.py` for prod Postgres, `database.py` for local SQLite). **Vector search is Postgres-only.**
- Embeddings: OpenAI `text-embedding-3-small`, **1536 dims** (`EMBEDDING_DIMENSIONS`). Never change the dimension without a re-embed + index rebuild.
- **Query/document embedding symmetry is load-bearing:** the user's idea and the company document must both be embedded with **no prefix** and both passed through `get_search_text_for_embedding()` (`backend/idea_filter.py:60`). Any asymmetry destroys cosine ranking.
- **The live hero request path makes ZERO LLM chat calls.** Only OpenAI *embedding* calls (cached) + pgvector + Python are allowed on the hot path.
- Offline prose uses `gpt-4.1-mini` and reuses the existing `OPENAI_API_KEY`. No new provider dependency.
- Frontend theme: monospace/hacker, YC orange `#FB651E` (hover `#E65C00`), Framer Motion for entrance/hover, existing primitives in `frontend/src/components/ui/`.
- Workflow: PR-based, **never push to master directly**. Commit messages end with the `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer.
- **GATED steps (require explicit user go — cost money or touch production):** applying the Supabase migration to prod, running the paid full re-embed of ~6k companies, enabling the nightly pre-warm cron, and any deploy. These are marked `🚧 GATED` in the plan and must NOT be executed autonomously.

---

## File Structure

**Backend**
- `supabase/migrations/20260710000000_hero_vector_upgrade.sql` (NEW) — swap IVFFlat→HNSW; create `idea_answer_cache` table with TTL column.
- `backend/hero_service.py` (NEW) — pure functions: `build_verdict(idea, similar_companies, portfolio_total)` → deterministic answer + market meter + signals. Unit-testable, no I/O.
- `backend/embedding_service.py` (MODIFY) — add `generate_embeddings_batch(texts)` (multi-input OpenAI call).
- `backend/database_postgres.py` (MODIFY) — add `build_company_embedding_text()`, `get_idea_answer_cache()`/`set_idea_answer_cache()` (TTL), `update_company_embeddings_batch()`; set `hnsw.ef_search` in `find_similar_companies_by_embedding`; add `get_companies_for_embedding()` returning richer fields.
- `backend/ratelimit.py` (NEW) — Upstash Redis sliding-window limiter with in-memory fallback.
- `backend/main.py` (MODIFY) — new `POST /api/hero-answer`; wire embedding backfill into `_run_daily_scrape`; use `ratelimit` for the hero endpoint.
- `scripts/generate_embeddings.py` (MODIFY) — richer document text + batched generation.
- `scripts/prewarm_hero.py` (NEW) — offline `gpt-4.1-mini` prose for popular queries → cache.
- `.github/workflows/daily-cron.yml` (MODIFY) — add gated pre-warm job.

**Frontend**
- `frontend/src/components/HeroAnswerBox.tsx` (NEW) — the hero input + instant answer render.
- `frontend/src/lib/api.ts` (MODIFY) — `heroAnswer()` + response types.
- `frontend/src/pages/HomePage.tsx` (MODIFY) — mount `HeroAnswerBox` in the hero block.

**Tests (pytest-style at repo root, matching `test_digest_render.py`)**
- `test_hero_service.py` (NEW) — deterministic verdict unit tests.
- `test_embedding_batch.py` (NEW) — batch embedding shape/symmetry test (mocked OpenAI).

---

## Phase 1 — Retrieval quality (foundation)

### Task 1: Richer, symmetric embedding document text

**Files:**
- Modify: `backend/database_postgres.py` (add `build_company_embedding_text`, `get_companies_for_embedding`)
- Modify: `scripts/generate_embeddings.py:79-96` (use the new builder + batching in Task 3)
- Test: `test_embedding_batch.py`

**Interfaces:**
- Produces: `DatabasePostgres.build_company_embedding_text(company: dict) -> str` — concatenates, in order, `name`, `one_liner`, `long_description`, `industry`, `subindustry`, `tags` (joined), `industries` (joined); drops falsy fields; returns a single space-joined string. Callers then pass the result through `get_search_text_for_embedding()` (same filter the query uses) before embedding.
- Produces: `DatabasePostgres.get_companies_for_embedding(only_missing: bool, limit: int) -> list[dict]` — returns rows with `id, name, one_liner, long_description, industry, subindustry, tags, industries`; when `only_missing=True` filters `embedding IS NULL AND source='yc'`, else all `source='yc'`.

- [ ] **Step 1: Write the failing test**

```python
# test_embedding_batch.py
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))
from database_postgres import DatabasePostgres

def test_build_company_embedding_text_includes_all_signal_fields():
    text = DatabasePostgres.build_company_embedding_text({
        "name": "Litmus",
        "one_liner": "Async work trials for engineers",
        "long_description": "Run a real work trial on every candidate.",
        "industry": "B2B", "subindustry": "Recruiting",
        "tags": ["hiring", "devtools"], "industries": ["B2B", "HR Tech"],
    })
    for needle in ["Litmus", "Async work trials", "work trial", "B2B", "Recruiting", "hiring", "HR Tech"]:
        assert needle in text

def test_build_company_embedding_text_skips_missing_fields():
    text = DatabasePostgres.build_company_embedding_text({"name": "X", "one_liner": None, "tags": []})
    assert text.strip() == "X"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m pytest test_embedding_batch.py::test_build_company_embedding_text_includes_all_signal_fields -v` (or `python3 test_embedding_batch.py` if pytest absent)
Expected: FAIL — `build_company_embedding_text` not defined.

- [ ] **Step 3: Implement `build_company_embedding_text` as a `@staticmethod`**

```python
# backend/database_postgres.py — add inside class DatabasePostgres
@staticmethod
def build_company_embedding_text(company: dict) -> str:
    """Assemble the document text that gets embedded for a company.

    Order matters less than coverage: include every field that carries
    semantic signal about *what the company does*. The result MUST be run
    through get_search_text_for_embedding() by the caller before embedding,
    exactly like the user's query, to preserve query/document symmetry.
    """
    def _join(v):
        if isinstance(v, (list, tuple)):
            return " ".join(str(x) for x in v if x)
        return str(v) if v else ""
    parts = [
        company.get("name") or "",
        company.get("one_liner") or "",
        company.get("long_description") or "",
        company.get("industry") or "",
        company.get("subindustry") or "",
        _join(company.get("tags")),
        _join(company.get("industries")),
    ]
    return " ".join(p for p in (s.strip() for s in parts) if p)
```

- [ ] **Step 4: Add `get_companies_for_embedding`**

```python
# backend/database_postgres.py — add inside class DatabasePostgres
def get_companies_for_embedding(self, only_missing: bool = True, limit: int = 10000) -> List[Dict]:
    where = "WHERE source = 'yc'"
    if only_missing:
        where += " AND embedding IS NULL"
    with self.get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                f"""
                SELECT id, name, one_liner, long_description,
                       industry, subindustry, tags, industries
                FROM companies
                {where}
                ORDER BY id DESC
                LIMIT %s
                """,
                (limit,),
            )
            return [dict(r) for r in cur.fetchall()]
```

- [ ] **Step 5: Run test to verify it passes**

Run: `python3 -m pytest test_embedding_batch.py -k build_company -v`
Expected: PASS (both `build_company_embedding_text` tests).

- [ ] **Step 6: Fix the stale migration comment (documentation truth)**

Edit `supabase/migrations/20260316000000_add_idea_validator.sql:27` comment to read: `'... Generated from: name + one_liner + long_description + industry + subindustry + tags + industries (AI-stopword-filtered)'`.

- [ ] **Step 7: Commit**

```bash
git add backend/database_postgres.py test_embedding_batch.py supabase/migrations/20260316000000_add_idea_validator.sql
git commit -m "feat(embeddings): richer symmetric document text + selection helper"
```

### Task 2: Batched embedding generation

**Files:**
- Modify: `backend/embedding_service.py`
- Test: `test_embedding_batch.py`

**Interfaces:**
- Produces: `EmbeddingService.generate_embeddings_batch(texts: list[str], use_cache: bool = True) -> list[list[float]]` — one OpenAI call per chunk of ≤256 inputs; validates each vector is 1536-dim; caches by text hash; preserves input order.

- [ ] **Step 1: Write the failing test (mock OpenAI)**

```python
# test_embedding_batch.py (append)
from unittest.mock import patch, MagicMock
from embedding_service import EmbeddingService

def test_generate_embeddings_batch_preserves_order_and_dims():
    svc = EmbeddingService.__new__(EmbeddingService)   # bypass __init__/env
    svc._cache = {}
    fake = MagicMock()
    fake.data = [MagicMock(embedding=[float(i)] * 1536) for i in range(3)]
    svc.client = MagicMock()
    svc.client.embeddings.create.return_value = fake
    out = svc.generate_embeddings_batch(["a", "b", "c"], use_cache=False)
    assert len(out) == 3 and all(len(v) == 1536 for v in out)
    assert out[0][0] == 0.0 and out[2][0] == 2.0
```

- [ ] **Step 2: Run to verify it fails** — Run: `python3 -m pytest test_embedding_batch.py -k batch_preserves -v` → FAIL (`generate_embeddings_batch` missing).

- [ ] **Step 3: Implement**

```python
# backend/embedding_service.py — add inside class EmbeddingService
def generate_embeddings_batch(self, texts, use_cache: bool = True):
    """Embed many texts with as few OpenAI calls as possible (≤256/call)."""
    results = [None] * len(texts)
    pending_idx, pending_txt = [], []
    for i, t in enumerate(texts):
        t = (t or "").strip()
        if not t:
            results[i] = [0.0] * EMBEDDING_DIMENSIONS
            continue
        cached = self._get_from_cache(t) if use_cache else None
        if cached is not None:
            results[i] = cached
        else:
            pending_idx.append(i); pending_txt.append(t)
    CHUNK = 256
    for start in range(0, len(pending_txt), CHUNK):
        chunk = pending_txt[start:start + CHUNK]
        resp = self.client.embeddings.create(input=chunk, model=EMBEDDING_MODEL)
        for j, item in enumerate(resp.data):
            emb = item.embedding
            if len(emb) != EMBEDDING_DIMENSIONS:
                raise RuntimeError(f"Unexpected dims {len(emb)}")
            gi = pending_idx[start + j]
            results[gi] = emb
            if use_cache:
                self._save_to_cache(pending_txt[start + j], emb)
    return results
```

- [ ] **Step 4: Run to verify it passes** — Run: `python3 -m pytest test_embedding_batch.py -v` → PASS all.

- [ ] **Step 5: Commit**

```bash
git add backend/embedding_service.py test_embedding_batch.py
git commit -m "feat(embeddings): batched multi-input generation"
```

### Task 3: Rewrite the generation script (richer text + batching)

**Files:**
- Modify: `scripts/generate_embeddings.py`

**Interfaces:**
- Consumes: `build_company_embedding_text` (Task 1), `get_companies_for_embedding` (Task 1), `generate_embeddings_batch` (Task 2), `update_company_embeddings_batch` (Task 4), `get_search_text_for_embedding` (`idea_filter`).

- [ ] **Step 1: Replace the per-company loop**

```python
# scripts/generate_embeddings.py — core loop (replace lines ~77-110)
from idea_filter import get_search_text_for_embedding
companies = db.get_companies_for_embedding(only_missing=(not FULL_REEMBED), limit=100000)
print(f"🚀 Embedding {len(companies)} companies (full={FULL_REEMBED})")
BATCH = 200
for start in range(0, len(companies), BATCH):
    chunk = companies[start:start + BATCH]
    texts = [get_search_text_for_embedding(db.build_company_embedding_text(c)) for c in chunk]
    vectors = embedding_service.generate_embeddings_batch(texts)
    pairs = [(c["id"], v) for c, v in zip(chunk, vectors)]
    updated = db.update_company_embeddings_batch(pairs)
    print(f"  [{start+len(chunk)}/{len(companies)}] wrote {updated}")
```

Add near the top: `FULL_REEMBED = "--full" in sys.argv` (import `sys`). Remove the old `time.sleep(0.2)` per-company throttle.

- [ ] **Step 2: Manual smoke (no prod writes)** — Run against a scratch/staging `DATABASE_URL` only: `python3 scripts/generate_embeddings.py` and confirm it prints batch progress without errors. **Do NOT run against prod here — that is the 🚧 GATED re-embed (Task 12).**

- [ ] **Step 3: Commit**

```bash
git add scripts/generate_embeddings.py
git commit -m "feat(embeddings): batched richer re-embed script with --full flag"
```

### Task 4: Batch write-back + HNSW-aware similarity query

**Files:**
- Modify: `backend/database_postgres.py`

**Interfaces:**
- Produces: `update_company_embeddings_batch(pairs: list[tuple[int, list[float]]]) -> int` — `executemany` of `UPDATE companies SET embedding=%s::vector WHERE id=%s`; returns count.
- Modifies: `find_similar_companies_by_embedding` to run `SET LOCAL hnsw.ef_search = 60` in the same transaction before the SELECT (raises recall on the new HNSW index; harmless if the index is still IVFFlat).

- [ ] **Step 1: Add batch write-back**

```python
# backend/database_postgres.py — add inside class DatabasePostgres
def update_company_embeddings_batch(self, pairs) -> int:
    if not pairs:
        return 0
    rows = [("[" + ",".join(map(str, emb)) + "]", cid) for cid, emb in pairs]
    with self.get_connection() as conn:
        with conn.cursor() as cur:
            cur.executemany(
                "UPDATE companies SET embedding = %s::vector WHERE id = %s", rows
            )
        conn.commit()
    return len(rows)
```

- [ ] **Step 2: Raise recall at query time**

In `find_similar_companies_by_embedding` (`database_postgres.py:871`), inside the `with conn.cursor()` block, **before** the main `cur.execute(...)`, add:

```python
            cur.execute("SET LOCAL hnsw.ef_search = 60")
```

- [ ] **Step 3: Commit**

```bash
git add backend/database_postgres.py
git commit -m "feat(vector): batch embedding write-back + hnsw ef_search tuning"
```

### Task 5: HNSW migration 🚧 (file now, apply GATED)

**Files:**
- Create: `supabase/migrations/20260710000000_hero_vector_upgrade.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration: Hero vector upgrade — HNSW index + idea answer cache
-- Date: 2026-07-10

-- Swap IVFFlat for HNSW: far better recall at query time, healthy under
-- incremental inserts. Build cost is trivial at ~6k rows.
DROP INDEX IF EXISTS idx_companies_embedding;
CREATE INDEX IF NOT EXISTS idx_companies_embedding_hnsw
ON companies USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Deterministic answer cache with TTL (idea_answer_cache).
CREATE TABLE IF NOT EXISTS idea_answer_cache (
    id           BIGSERIAL PRIMARY KEY,
    query_key    TEXT NOT NULL UNIQUE,      -- normalized idea text
    answer_json  JSONB NOT NULL,            -- full HeroAnswer payload
    prose        TEXT,                      -- optional gpt-4.1-mini prose (offline)
    hit_count    INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at   TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_idea_answer_cache_expires ON idea_answer_cache (expires_at);
```

- [ ] **Step 2: 🚧 GATED — apply to production**

Do NOT run autonomously. When the user gives the go, apply via Supabase MCP `apply_migration` (or the Supabase SQL editor). HNSW build on ~6k rows is seconds.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260710000000_hero_vector_upgrade.sql
git commit -m "feat(vector): HNSW index + idea_answer_cache migration"
```

### Task 6: Automated embedding backfill in the daily scrape

**Files:**
- Modify: `backend/main.py` (`_run_daily_scrape`, `backend/main.py:1612`)

**Interfaces:**
- Consumes: `get_companies_for_embedding(only_missing=True)`, `build_company_embedding_text`, `generate_embeddings_batch`, `update_company_embeddings_batch`.

- [ ] **Step 1: Append a backfill step at the end of `_run_daily_scrape`**

```python
# backend/main.py — inside _run_daily_scrape, after the scrape/snapshot completes
    try:
        if hasattr(db, "get_companies_for_embedding"):
            from idea_filter import get_search_text_for_embedding
            missing = db.get_companies_for_embedding(only_missing=True, limit=2000)
            if missing:
                texts = [get_search_text_for_embedding(db.build_company_embedding_text(c)) for c in missing]
                vectors = embedding_service.generate_embeddings_batch(texts)
                n = db.update_company_embeddings_batch([(c["id"], v) for c, v in zip(missing, vectors)])
                logger.info(f"Daily embedding backfill: embedded {n} new companies")
    except Exception as e:
        logger.error(f"Daily embedding backfill failed (non-fatal): {e}")
```

- [ ] **Step 2: Verify import** — confirm `embedding_service` is already imported/instantiated in `main.py` (it is, for the validator). Reuse that singleton; do not create a second one.

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat(cron): auto-embed newly scraped companies in daily scrape"
```

---

## Phase 2 — The deterministic answer box

### Task 7: `hero_service.build_verdict` (the deterministic brain)

**Files:**
- Create: `backend/hero_service.py`
- Test: `test_hero_service.py`

**Interfaces:**
- Produces: `build_verdict(idea: str, similar: list[dict], portfolio_total: int) -> dict` returning keys:
  - `meter`: one of `"open" | "emerging" | "competitive" | "crowded"`
  - `headline`: str (≤120 chars, e.g. `"Competitive — 14 YC companies overlap"`)
  - `summary`: str (2-3 sentence computed verdict naming the closest companies, recency, hiring momentum, dominant industries)
  - `closest`: list of `{id, name, slug, batch, similarity}` (top 3, similarity 0-1)
  - `total_similar`: int
  - `top_industries`: list of `{name, count}` (top 3)
  - `recent_share`: float (fraction of `similar` in the 3 most recent batches present)
  - `hiring_share`: float (fraction of `similar` with `is_hiring`)
  - `market_size_percentage`: float (`total_similar / portfolio_total * 100`, rounded 2dp)
  - Each `similar` item is expected to carry: `id, name, slug, batch, industry, is_hiring, similarity_score`.

- [ ] **Step 1: Write failing tests**

```python
# test_hero_service.py
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))
from hero_service import build_verdict

def _co(name, sim, batch="Summer 2026", industry="B2B", hiring=False, cid=1, slug=None):
    return {"id": cid, "name": name, "slug": slug or name.lower(), "batch": batch,
            "industry": industry, "is_hiring": hiring, "similarity_score": sim}

def test_open_space_when_no_matches():
    v = build_verdict("quantum toothbrush", [], portfolio_total=6000)
    assert v["meter"] == "open"
    assert v["total_similar"] == 0
    assert "first" in v["summary"].lower() or "no " in v["summary"].lower()

def test_crowded_meter_and_names_closest():
    sims = [_co(f"C{i}", 0.7 - i*0.01, cid=i) for i in range(14)]
    v = build_verdict("ai code review", sims, portfolio_total=6000)
    assert v["meter"] == "crowded"
    assert v["total_similar"] == 14
    assert [c["name"] for c in v["closest"]] == ["C0", "C1", "C2"]
    assert "C0" in v["summary"]

def test_meter_thresholds():
    assert build_verdict("x", [_co("A", .6)], 6000)["meter"] == "emerging"
    assert build_verdict("x", [_co(f"n{i}", .6, cid=i) for i in range(6)], 6000)["meter"] == "competitive"

def test_market_size_percentage():
    v = build_verdict("x", [_co("A", .6)], portfolio_total=200)
    assert v["market_size_percentage"] == 0.5
```

- [ ] **Step 2: Run to verify fail** — Run: `python3 -m pytest test_hero_service.py -v` → FAIL (module missing).

- [ ] **Step 3: Implement `backend/hero_service.py`**

```python
"""Deterministic 'verdict' builder for the homepage hero answer box.

Pure functions only — NO I/O, NO LLM calls. Turns a list of pgvector-retrieved
similar companies into a crisp, computed answer + market meter. This is what
makes the hero instant and free per query.
"""
from typing import List, Dict
from collections import Counter

# Meter thresholds by count of similar YC companies above the similarity floor.
_OPEN, _EMERGING, _COMPETITIVE = 0, 1, 5   # 0 → open, 1-4 → emerging, 5-9 → competitive, 10+ → crowded


def _meter(n: int) -> str:
    if n <= _OPEN:
        return "open"
    if n < _COMPETITIVE:
        return "emerging"
    if n < 10:
        return "competitive"
    return "crowded"


def _rank_batches(similar: List[Dict]) -> List[str]:
    # Order batches by rough recency using the year in the batch label; newest first.
    def key(b: str):
        parts = (b or "").split()
        year = int(parts[-1]) if parts and parts[-1].isdigit() else 0
        season = {"Winter": 0, "Spring": 1, "Summer": 2, "Fall": 3}.get(parts[0], 0) if parts else 0
        return (year, season)
    uniq = sorted({c.get("batch") or "" for c in similar if c.get("batch")}, key=key, reverse=True)
    return uniq


def build_verdict(idea: str, similar: List[Dict], portfolio_total: int) -> Dict:
    n = len(similar)
    meter = _meter(n)
    ordered = sorted(similar, key=lambda c: c.get("similarity_score") or 0, reverse=True)
    closest = [
        {"id": c.get("id"), "name": c.get("name"), "slug": c.get("slug"),
         "batch": c.get("batch"), "similarity": round(c.get("similarity_score") or 0, 3)}
        for c in ordered[:3]
    ]
    inds = Counter((c.get("industry") or "").strip() for c in similar if c.get("industry"))
    top_industries = [{"name": k, "count": v} for k, v in inds.most_common(3)]

    recent_batches = set(_rank_batches(similar)[:3])
    recent_share = round(sum(1 for c in similar if (c.get("batch") or "") in recent_batches) / n, 2) if n else 0.0
    hiring_share = round(sum(1 for c in similar if c.get("is_hiring")) / n, 2) if n else 0.0
    market_size = round((n / portfolio_total * 100), 2) if portfolio_total else 0.0

    if n == 0:
        return {
            "meter": meter, "total_similar": 0, "closest": [], "top_industries": [],
            "recent_share": 0.0, "hiring_share": 0.0, "market_size_percentage": market_size,
            "headline": "Open field — no close YC matches",
            "summary": ("No YC company is doing something close to this. That can mean genuine "
                        "first-mover space — or that it lives outside YC's portfolio. Worth a deeper look."),
        }

    names = ", ".join(f'{c["name"]} ({c["batch"]})' for c in closest)
    label = {"emerging": "Emerging", "competitive": "Competitive", "crowded": "Crowded"}[meter]
    headline = f"{label} — {n} YC compan{'y' if n == 1 else 'ies'} overlap"
    recency_clause = (f" {int(recent_share*100)}% are from the latest batches" if recent_share >= 0.4 else "")
    hiring_clause = (f" and {int(hiring_share*100)}% are hiring" if hiring_share >= 0.3 else "")
    ind_clause = (f" Most cluster in {top_industries[0]['name']}." if top_industries else "")
    summary = (f"{n} YC compan{'y' if n == 1 else 'ies'} overlap with this idea. "
               f"Closest: {names}.{(' This space is active —' + recency_clause + hiring_clause + '.') if (recency_clause or hiring_clause) else ''}"
               f"{ind_clause}").replace("  ", " ").strip()
    return {
        "meter": meter, "total_similar": n, "closest": closest, "top_industries": top_industries,
        "recent_share": recent_share, "hiring_share": hiring_share,
        "market_size_percentage": market_size, "headline": headline, "summary": summary,
    }
```

- [ ] **Step 4: Run to verify pass** — Run: `python3 -m pytest test_hero_service.py -v` → PASS all 4.

- [ ] **Step 5: Commit**

```bash
git add backend/hero_service.py test_hero_service.py
git commit -m "feat(hero): deterministic verdict + market meter (pure, tested)"
```

### Task 8: Answer cache (TTL) in the DB layer

**Files:**
- Modify: `backend/database_postgres.py`
- Modify: `backend/database.py` (SQLite no-op stubs so local dev doesn't crash)

**Interfaces:**
- Produces: `get_idea_answer_cache(query_key: str) -> dict | None` (returns `answer_json` if a non-expired row exists, and increments `hit_count`).
- Produces: `set_idea_answer_cache(query_key: str, answer_json: dict, ttl_hours: int = 24, prose: str | None = None) -> None` (upsert on `query_key`, sets `expires_at = NOW() + ttl`).

- [ ] **Step 1: Implement in `database_postgres.py`**

```python
# backend/database_postgres.py — add inside class DatabasePostgres
def get_idea_answer_cache(self, query_key: str):
    with self.get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT answer_json FROM idea_answer_cache "
                "WHERE query_key = %s AND expires_at > NOW()", (query_key,))
            row = cur.fetchone()
            if not row:
                return None
            cur.execute("UPDATE idea_answer_cache SET hit_count = hit_count + 1 WHERE query_key = %s", (query_key,))
            conn.commit()
            return row["answer_json"]

def set_idea_answer_cache(self, query_key: str, answer_json: dict, ttl_hours: int = 24, prose: str = None) -> None:
    with self.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO idea_answer_cache (query_key, answer_json, prose, expires_at)
                VALUES (%s, %s, %s, NOW() + (%s || ' hours')::interval)
                ON CONFLICT (query_key) DO UPDATE
                  SET answer_json = EXCLUDED.answer_json, prose = EXCLUDED.prose,
                      expires_at = EXCLUDED.expires_at, created_at = NOW()
                """,
                (query_key, json.dumps(answer_json), prose, str(ttl_hours)))
            conn.commit()
```

- [ ] **Step 2: Add SQLite no-op stubs in `database.py`**

```python
# backend/database.py — add inside class Database
def get_idea_answer_cache(self, query_key: str):
    return None  # caching is Postgres-only; local dev always computes fresh
def set_idea_answer_cache(self, query_key: str, answer_json: dict, ttl_hours: int = 24, prose: str = None) -> None:
    return None
```

- [ ] **Step 3: Commit**

```bash
git add backend/database_postgres.py backend/database.py
git commit -m "feat(hero): TTL answer cache (Postgres) + SQLite no-op"
```

### Task 9: Restart-safe rate limiter

**Files:**
- Create: `backend/ratelimit.py`

**Interfaces:**
- Produces: `check_rate_limit(key: str, limit: int, window_seconds: int) -> tuple[bool, int]` → `(allowed, retry_after_seconds)`. Uses Upstash REST (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`) if configured; otherwise falls back to the existing in-memory limiter behavior.

- [ ] **Step 1: Implement**

```python
# backend/ratelimit.py
import os, time, logging
import requests
logger = logging.getLogger(__name__)
_URL = os.getenv("UPSTASH_REDIS_REST_URL")
_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN")
_mem = {}

def _mem_check(key, limit, window):
    now = time.time()
    hits = [t for t in _mem.get(key, []) if now - t < window]
    if len(hits) >= limit:
        return False, int(window - (now - hits[0])) + 1
    hits.append(now); _mem[key] = hits
    return True, 0

def check_rate_limit(key, limit, window_seconds):
    if not (_URL and _TOKEN):
        return _mem_check(key, limit, window_seconds)
    try:
        # INCR + EXPIRE via Upstash pipeline REST
        r = requests.post(f"{_URL}/pipeline",
            headers={"Authorization": f"Bearer {_TOKEN}"},
            json=[["INCR", key], ["EXPIRE", key, str(window_seconds), "NX"]], timeout=2)
        count = int(r.json()[0]["result"])
        if count > limit:
            return False, window_seconds
        return True, 0
    except Exception as e:
        logger.warning(f"Upstash rate-limit failed, falling back to memory: {e}")
        return _mem_check(key, limit, window_seconds)
```

- [ ] **Step 2: Commit**

```bash
git add backend/ratelimit.py
git commit -m "feat(ratelimit): restart-safe Upstash limiter with in-memory fallback"
```

### Task 10: `POST /api/hero-answer` endpoint

**Files:**
- Modify: `backend/main.py`

**Interfaces:**
- Consumes: `check_rate_limit` (Task 9), `get_search_text_for_embedding`, `embedding_service.generate_embedding_for_idea`, `db.find_similar_companies_by_embedding`, `db.count_companies_with_embeddings`, `db.get_market_analysis` (for portfolio total via existing count) OR a direct company count, `hero_service.build_verdict`, `db.get_idea_answer_cache`/`set_idea_answer_cache`.
- Produces: `POST /api/hero-answer` body `{ "idea": str }` → 200 `HeroAnswer` = `build_verdict(...)` output plus `{"cached": bool, "prose": str | None}`.

- [ ] **Step 1: Add request model + endpoint**

```python
# backend/main.py
import hashlib
from hero_service import build_verdict
import ratelimit

class HeroAnswerRequest(BaseModel):
    idea: str

@app.post("/api/hero-answer")
async def hero_answer(req: HeroAnswerRequest, request: Request):
    idea = (req.idea or "").strip()
    if len(idea) < 10:
        raise HTTPException(status_code=400, detail="Describe the idea in a bit more detail.")
    ip = request.client.host if request.client else "unknown"
    allowed, retry = ratelimit.check_rate_limit(f"hero:{ip}", limit=15, window_seconds=60)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Slow down — try again in {retry}s.")

    key = hashlib.sha1(idea.lower().encode()).hexdigest()
    cached = db.get_idea_answer_cache(key) if hasattr(db, "get_idea_answer_cache") else None
    if cached:
        return {**cached, "cached": True}

    if not hasattr(db, "count_companies_with_embeddings"):
        raise HTTPException(status_code=503, detail="Semantic search unavailable in this environment.")
    if db.count_companies_with_embeddings() == 0:
        raise HTTPException(status_code=503, detail="Company embeddings not yet generated.")

    search_text = get_search_text_for_embedding(idea)
    embedding = embedding_service.generate_embedding_for_idea(search_text)
    similar = db.find_similar_companies_by_embedding(embedding, limit=12, min_similarity=0.32)
    portfolio_total = db.get_company_count() if hasattr(db, "get_company_count") else 6000
    verdict = build_verdict(idea, similar, portfolio_total)

    if hasattr(db, "set_idea_answer_cache"):
        try:
            db.set_idea_answer_cache(key, verdict, ttl_hours=24)
        except Exception as e:
            logger.error(f"hero cache write failed (non-fatal): {e}")
    return {**verdict, "cached": False, "prose": None}
```

- [ ] **Step 2: Verify `get_company_count` exists** — grep `backend/database_postgres.py` for a total-company count method; if the name differs, use the actual one (e.g. reuse the `SELECT COUNT(*) FROM companies WHERE source='yc'` already inside `get_market_analysis`). Adjust the `portfolio_total` line to the real method name.

- [ ] **Step 3: Manual smoke against local Postgres** — With a `DATABASE_URL` that has embeddings, run the backend and `curl -s localhost:8000/api/hero-answer -H 'content-type: application/json' -d '{"idea":"ai code review tool for developers"}' | python3 -m json.tool`. Expect a `meter`, `headline`, `summary`, `closest[]`.

- [ ] **Step 4: Commit**

```bash
git add backend/main.py
git commit -m "feat(hero): POST /api/hero-answer — instant deterministic answer + cache"
```

### Task 11: Frontend hero answer box

**Files:**
- Modify: `frontend/src/lib/api.ts` (add `heroAnswer` + types)
- Create: `frontend/src/components/HeroAnswerBox.tsx`
- Modify: `frontend/src/pages/HomePage.tsx` (mount in hero, ~after line 62 subheading)

**Interfaces:**
- Consumes: `POST /api/hero-answer`.
- Produces: `<HeroAnswerBox />` — textarea + example chips + instant answer card (meter pill, headline, summary, closest-company chips linking to `/company/:slug` or opening the modal, and a "Full breakdown →" link to `/validator`).

- [ ] **Step 1: Add API method + types to `api.ts`**

```ts
// frontend/src/lib/api.ts
export interface HeroClosest { id: number; name: string; slug: string; batch: string; similarity: number }
export interface HeroAnswer {
  meter: 'open' | 'emerging' | 'competitive' | 'crowded'
  headline: string; summary: string; closest: HeroClosest[]
  total_similar: number; top_industries: { name: string; count: number }[]
  recent_share: number; hiring_share: number; market_size_percentage: number
  cached: boolean; prose: string | null
}
export const heroApi = {
  answer: (idea: string) => api.post<HeroAnswer>('/api/hero-answer', { idea }),
}
```

- [ ] **Step 2: Create `HeroAnswerBox.tsx`** (theme: monospace, `#FB651E`, Framer Motion; meter colors: open=emerald, emerging=orange, competitive=amber, crowded=red)

```tsx
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ArrowRight } from 'lucide-react'
import { heroApi, type HeroAnswer } from '../lib/api'

const EXAMPLES = ['AI code review for developers', 'Vertical SaaS for dentists', 'Fintech for freelancers', 'AI agents for customer support']
const METER: Record<HeroAnswer['meter'], { label: string; cls: string }> = {
  open: { label: 'OPEN FIELD', cls: 'text-emerald-500 border-emerald-500/40' },
  emerging: { label: 'EMERGING', cls: 'text-[#FB651E] border-[#FB651E]/40' },
  competitive: { label: 'COMPETITIVE', cls: 'text-amber-500 border-amber-500/40' },
  crowded: { label: 'CROWDED', cls: 'text-red-500 border-red-500/40' },
}

export function HeroAnswerBox() {
  const [idea, setIdea] = useState('')
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState<HeroAnswer | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function ask(q: string) {
    if (q.trim().length < 10) { setError('Add a little more detail.'); return }
    setLoading(true); setError(null)
    try { setAnswer((await heroApi.answer(q)).data) }
    catch (e: any) { setError(e?.response?.data?.detail ?? 'Something went wrong.') }
    finally { setLoading(false) }
  }

  return (
    <div className="w-full max-w-2xl font-mono">
      <div className="flex items-stretch gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <textarea
            value={idea} onChange={(e) => setIdea(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ask(idea) }}
            rows={2} placeholder="Describe your startup idea…  (⌘+Enter)"
            className="w-full resize-none rounded-md border border-border bg-background/70 pl-9 pr-3 py-3 text-sm outline-none focus:border-[#FB651E]/60"
          />
        </div>
        <button onClick={() => ask(idea)} disabled={loading}
          className="group inline-flex items-center gap-2 rounded-md bg-[#FB651E] px-4 text-sm text-white hover:bg-[#E65C00] disabled:opacity-60">
          {loading ? 'Scanning…' : <>Ask<ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" /></>}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button key={ex} onClick={() => { setIdea(ex); ask(ex) }}
            className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-[#FB651E]/50 hover:text-foreground">
            {ex}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      <AnimatePresence>
        {answer && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-4 rounded-md border border-border bg-card/40 p-4">
            <div className="flex items-center gap-3">
              <span className={`rounded border px-2 py-0.5 text-[11px] tracking-wider ${METER[answer.meter].cls}`}>
                {METER[answer.meter].label}
              </span>
              <span className="text-sm font-semibold">{answer.headline}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{answer.prose || answer.summary}</p>
            {answer.closest.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {answer.closest.map((c) => (
                  <a key={c.id} href={`/company/${c.slug}`}
                    className="inline-flex items-center gap-1 rounded border border-[#FB651E]/30 bg-[#FB651E]/5 px-2 py-1 text-xs hover:border-[#FB651E]/60">
                    {c.name} <span className="text-muted-foreground">{Math.round(c.similarity * 100)}%</span>
                  </a>
                ))}
              </div>
            )}
            <a href="/validator" className="mt-3 inline-flex items-center gap-1 text-xs text-[#FB651E] hover:underline">
              Full breakdown <ArrowRight className="h-3 w-3" />
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
```

- [ ] **Step 3: Mount in the hero** — In `frontend/src/pages/HomePage.tsx`, add `import { HeroAnswerBox } from '../components/HeroAnswerBox'`, then render `<div className="mb-8"><HeroAnswerBox /></div>` immediately after the subheading `<p>` (currently `HomePage.tsx:60-62`), above the live stats row.

- [ ] **Step 4: Manual verify (use the `run` skill / browser)** — Run frontend + backend, load `/`, type an idea, confirm an answer card renders with a meter pill and company chips, and example chips trigger a query.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/components/HeroAnswerBox.tsx frontend/src/pages/HomePage.tsx
git commit -m "feat(hero): homepage instant idea answer box"
```

---

## Phase 3 — Hardening + offline pre-warm

### Task 12: 🚧 GATED — production re-embed

- [ ] **Step 1:** After Task 5's migration is applied, run `python3 scripts/generate_embeddings.py --full` against **production** `DATABASE_URL`. This costs OpenAI money (~6k embeddings, batched → cheap but non-zero). **Requires explicit user go.** Verify with `count_companies_with_embeddings()` afterward.

### Task 13: Nightly pre-warm (offline gpt-4.1-mini prose)

**Files:**
- Create: `scripts/prewarm_hero.py`
- Modify: `.github/workflows/daily-cron.yml` (add a gated job)

**Interfaces:**
- Consumes: `/api/hero-answer` (to get the deterministic verdict) + OpenAI `gpt-4.1-mini` to rewrite `summary` into 2-3 punchier sentences grounded ONLY in the returned company names; writes back via `set_idea_answer_cache(key, verdict, ttl_hours=48, prose=<gpt text>)`.

- [ ] **Step 1: Write `scripts/prewarm_hero.py`** — a curated `POPULAR = [...]` list (~40 idea strings incl. the 4 example chips); for each: call the local/prod hero endpoint or `build_verdict` directly, then one `gpt-4.1-mini` chat call (`max_tokens=180`, temperature 0.3, system prompt: "Rewrite this verdict in 2-3 sentences. Only mention the companies listed. Do not invent companies."), then `set_idea_answer_cache(..., prose=...)`. Uses existing `OPENAI_API_KEY`.

```python
# scripts/prewarm_hero.py (skeleton — fill POPULAR + wiring)
import os, sys, hashlib
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from openai import OpenAI
from database_factory import get_database
from hero_service import build_verdict
from idea_filter import get_search_text_for_embedding
from embedding_service import get_embedding_service

POPULAR = ["AI code review for developers", "Vertical SaaS for dentists",
           "Fintech for freelancers", "AI agents for customer support", "..."]

db = get_database(); emb = get_embedding_service(); client = OpenAI()
total = db.get_company_count() if hasattr(db, "get_company_count") else 6000
for idea in POPULAR:
    vec = emb.generate_embedding_for_idea(get_search_text_for_embedding(idea))
    similar = db.find_similar_companies_by_embedding(vec, limit=12, min_similarity=0.32)
    verdict = build_verdict(idea, similar, total)
    msg = (f"Verdict: {verdict['summary']}\nCompanies: "
           + ", ".join(c["name"] for c in verdict["closest"]))
    prose = client.chat.completions.create(
        model="gpt-4.1-mini", temperature=0.3, max_tokens=180,
        messages=[{"role": "system", "content": "Rewrite the verdict in 2-3 punchy sentences. Only mention the listed companies; never invent companies."},
                  {"role": "user", "content": msg}]).choices[0].message.content
    key = hashlib.sha1(idea.lower().encode()).hexdigest()
    db.set_idea_answer_cache(key, verdict, ttl_hours=48, prose=prose)
    print("prewarmed:", idea)
```

- [ ] **Step 2: Add gated workflow job** — In `.github/workflows/daily-cron.yml`, add a `prewarm-hero` job (schedule `0 3 * * *`, `if: github.event.schedule == '0 3 * * *'`) that runs the script with `OPENAI_API_KEY` + `DATABASE_URL` secrets. Mark it clearly; do not enable until Task 12 is done.

- [ ] **Step 3: Commit**

```bash
git add scripts/prewarm_hero.py .github/workflows/daily-cron.yml
git commit -m "feat(hero): offline gpt-4.1-mini pre-warm for popular queries"
```

### Task 14: Swap the hero limiter to Upstash + docs

**Files:**
- Modify: `backend/main.py` (route the existing validator/predict limiters through `ratelimit.check_rate_limit` too, optional), `.env.example` (add `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`), `CLAUDE.md`/README env section.

- [ ] **Step 1:** Add the two Upstash vars to `.env.example` with a comment that absence → in-memory fallback.
- [ ] **Step 2:** Commit `chore(hero): document Upstash env + fallback behavior`.

---

## Self-Review

- **Spec coverage:** Retrieval recall fix → Task 4/5; richer embeddings → Task 1/3; automated backfill → Task 6; deterministic answer → Task 7; caching w/ TTL → Task 8/10; restart-safe rate limit → Task 9/10/14; hero UI → Task 11; offline gpt-4.1-mini pre-warm → Task 13; production re-embed → Task 12 (gated). All covered.
- **Live-path LLM-free:** confirmed — Task 10 makes only an embedding call + pgvector + `build_verdict`; the only chat call is Task 13 (offline).
- **Symmetry:** Task 1/3/6/10/13 all route text through `get_search_text_for_embedding` with no prefix. Consistent.
- **Type consistency:** `build_verdict` output keys match `HeroAnswer` TS interface (Task 7 ↔ Task 11); `find_similar_companies_by_embedding` provides `similarity_score`, `slug`, `batch`, `industry`, `is_hiring` (verified in `database_postgres.py:896`). `set_idea_answer_cache`/`get_idea_answer_cache` names consistent Task 8 ↔ 10 ↔ 13.
- **Gated steps flagged:** Tasks 5 (apply), 12 (re-embed), 13 (enable cron), any deploy.
- **Open verification the executor must do:** confirm the exact total-company-count method name (Task 10 Step 2) and that `embedding_service` singleton is already imported in `main.py` (Task 6 Step 2).
