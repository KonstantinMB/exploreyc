# Multi-source Company Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend ExploreYC to ingest companies from new sources (Hacker News now; Product Hunt / Techstars stubbed), merge same-company rows on domain at read time, and make vector search + embeddings cover all sources — meshing with the existing Python ingestion, schema, and source-aware UI without data loss.

**Architecture:** A native Python source-adapter framework (`backend/ingestion/`) reuses the existing `to_global_id` id-block scheme, `insert_company` upsert, and cache refresh. A `dedupe_key` column (normalized domain, else `source:slug`) is added to every row; "merge" is a read-time grouping in `company_cache`, opt-in via a `merged` flag, so default YC-only views and all `WHERE source='yc'` analytics stay untouched. Embedding generation + similarity retrieval drop their YC-only filter (retrieval deduped by `dedupe_key`), while the hero idea-validator keeps a YC-scoped path so its market-size % / "N YC companies overlap" verdict is unchanged.

**Tech Stack:** FastAPI (Python 3.11), psycopg2 + SQLite, pgvector (HNSW), React 19 + Vite + TS + Tailwind. No new runtime deps.

## Global Constraints

- **No data loss / no destructive migration.** Only additive DDL (`ADD COLUMN`, new tables, new indexes). Every source keeps its own disjoint 1e9 id block; `insert_company` upserts `ON CONFLICT (id)` so no source can overwrite another's row. Upstream removals are soft-deletes only.
- **Default view unchanged.** `CompanyFilter.source is None → YC only`. Merge is opt-in via a new `merged: bool = False`.
- **Market-size % / crowding stays YC-denominated.** `get_yc_company_count()` and `hero_service.build_verdict` semantics are byte-for-byte unchanged; the hero passes `source_filter='yc'` to similarity search.
- **Column names are the existing ones:** `one_liner`, `long_description`, `all_locations`, `small_logo_thumb_url`, `team_size`, `batch`, `status`, `industry`, `subindustry`, `stage`, `country`; `tags`/`regions`/`industries` are JSON **strings**. `is_hiring` is read by `insert_company` from the key `isHiring`.
- **Both DBs.** Every schema/query change lands in both `backend/database_postgres.py` (Postgres) and `backend/database.py` (SQLite). Vector search is Postgres-only, as today.
- **Source id offsets:** yc=0, a16z=2e9, hackernews=3e9, producthunt=4e9, techstars=5e9 (block width 1e9).
- **Commit after every task.** PR-based workflow; branch is `feat/db-feature-requests`. Never push to master.

---

### Task 1: Normalization helpers

**Files:**
- Create: `backend/ingestion/__init__.py` (empty)
- Create: `backend/ingestion/normalize.py`
- Test: `backend/test_ingestion_normalize.py`

**Interfaces:**
- Produces:
  - `norm_domain(url: str | None) -> str | None`
  - `slugify(name: str) -> str`
  - `dedupe_key(domain: str | None, source: str, source_slug: str) -> str`
  - `country_from_locations(loc: str | None) -> str | None`
  - `SHARED_HOST_DENYLIST: set[str]`

- [ ] **Step 1: Write the failing test** — `backend/test_ingestion_normalize.py`

```python
from ingestion.normalize import norm_domain, slugify, dedupe_key, country_from_locations

def test_norm_domain_strips_scheme_www_path():
    assert norm_domain("https://www.Acme.com/careers") == "acme.com"
    assert norm_domain("acme.com") == "acme.com"
    assert norm_domain("http://sub.acme.co.uk:8080/x") == "sub.acme.co.uk"
    assert norm_domain(None) is None
    assert norm_domain("not a url") is None

def test_slugify():
    assert slugify("Acme, Inc.") == "acme-inc"
    assert slugify("  Héllo World  ") == "hello-world"

def test_dedupe_key_prefers_domain_else_source_slug():
    assert dedupe_key("acme.com", "yc", "acme") == "acme.com"
    assert dedupe_key(None, "hackernews", "acme") == "hackernews:acme"

def test_dedupe_key_shared_host_falls_back_to_source_slug():
    # A shared host must not merge unrelated companies.
    assert dedupe_key("myproj.github.io", "hackernews", "myproj") == "hackernews:myproj"

def test_country_from_locations():
    assert country_from_locations("San Francisco, CA, USA; Remote") == "USA"
    assert country_from_locations(None) is None
```

- [ ] **Step 2: Run test to verify it fails** — `cd backend && python -m pytest test_ingestion_normalize.py -v` → FAIL (module missing)

- [ ] **Step 3: Implement** — `backend/ingestion/normalize.py`

```python
"""Shared normalization for source adapters (Python port of the sync PR helpers)."""
from urllib.parse import urlparse
import re
import unicodedata

# Hosts shared by many unrelated projects — never merge companies on these.
SHARED_HOST_DENYLIST = {
    "github.io", "notion.site", "vercel.app", "netlify.app", "webflow.io",
    "wixsite.com", "substack.com", "medium.com", "gitbook.io", "herokuapp.com",
    "pages.dev", "framer.website", "carrd.co", "bubbleapps.io",
}


def norm_domain(url):
    """Bare lowercase host: strip scheme/www/path/port. None if unparseable."""
    if not url:
        return None
    raw = url.strip()
    if not re.match(r"^https?://", raw, re.I):
        raw = "https://" + raw
    try:
        host = urlparse(raw).hostname
    except ValueError:
        return None
    if not host:
        return None
    host = host.lower()
    if host.startswith("www."):
        host = host[4:]
    return host or None


def _registrable_suffix(host):
    """Last two labels, e.g. 'a.github.io' -> 'github.io' (denylist check)."""
    parts = host.split(".")
    return ".".join(parts[-2:]) if len(parts) >= 2 else host


def slugify(name):
    s = unicodedata.normalize("NFKD", name or "")
    s = s.encode("ascii", "ignore").decode("ascii").lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:80]


def dedupe_key(domain, source, source_slug):
    """Domain when it's a real (non-shared) host, else source-scoped slug."""
    if domain and _registrable_suffix(domain) not in SHARED_HOST_DENYLIST:
        return domain
    return f"{source}:{source_slug}"


def country_from_locations(loc):
    if not loc:
        return None
    first = loc.split(";")[0].strip()
    parts = [p.strip() for p in first.split(",") if p.strip()]
    return parts[-1] if parts else None
```

- [ ] **Step 4: Run tests** — `python -m pytest test_ingestion_normalize.py -v` → PASS
- [ ] **Step 5: Commit** — `git add backend/ingestion/__init__.py backend/ingestion/normalize.py backend/test_ingestion_normalize.py && git commit -m "feat(sync): shared normalization helpers for source adapters"`

---

### Task 2: Schema — dedupe_key, sync_state, DB methods (both DBs)

**Files:**
- Create: `supabase/migrations/20260711130000_multi_source_sync.sql`
- Modify: `backend/database.py` (SQLite schema + insert + new methods)
- Modify: `backend/database_postgres.py` (insert dedupe_key + new methods)
- Test: `backend/test_sync_state.py`

**Interfaces:**
- Produces on both DB classes:
  - `get_sync_cursor(source: str) -> str | None`
  - `save_sync_state(source, cursor, status, records_upserted, error=None) -> None`
  - `set_dedupe_key(company_id: int, key: str) -> None`
  - `backfill_dedupe_keys() -> int` (fills rows where `dedupe_key IS NULL`)
  - `insert_company(...)` now persists `company.get("dedupe_key")`.

- [ ] **Step 1: Postgres migration** — `supabase/migrations/20260711130000_multi_source_sync.sql`

```sql
-- Multi-source sync: dedupe_key merge column + per-source cursor. Additive only.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS dedupe_key TEXT;
CREATE INDEX IF NOT EXISTS idx_companies_dedupe_key
  ON companies (dedupe_key) WHERE dedupe_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS sync_state (
  source           TEXT PRIMARY KEY,
  last_run_at      TIMESTAMPTZ,
  last_cursor      TEXT,
  last_status      TEXT,
  records_upserted INTEGER DEFAULT 0,
  error            TEXT,
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
```

- [ ] **Step 2: SQLite parity** — in `backend/database.py`, add to the `companies` CREATE (or as `ALTER TABLE ADD COLUMN` in the migration block) a `dedupe_key TEXT` column, an index `CREATE INDEX IF NOT EXISTS idx_dedupe_key ON companies(dedupe_key)`, and:

```sql
CREATE TABLE IF NOT EXISTS sync_state (
  source TEXT PRIMARY KEY, last_run_at TEXT, last_cursor TEXT,
  last_status TEXT, records_upserted INTEGER DEFAULT 0, error TEXT, updated_at TEXT
);
```
Use the existing `ALTER TABLE ... ADD COLUMN` idempotent pattern already in `database.py` for `dedupe_key` so existing local DBs upgrade in place.

- [ ] **Step 3: Wire `dedupe_key` into `insert_company` + `bulk_insert_companies`** (both DBs). Add `dedupe_key` to the column list, the `VALUES` params (`company.get("dedupe_key")`), and the `ON CONFLICT DO UPDATE SET dedupe_key = COALESCE(EXCLUDED.dedupe_key, companies.dedupe_key)`.

- [ ] **Step 4: Add sync_state + dedupe methods** to both DB classes. Postgres example:

```python
def get_sync_cursor(self, source: str):
    with self.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT last_cursor FROM sync_state WHERE source = %s", (source,))
            row = cur.fetchone()
            return row[0] if row else None

def save_sync_state(self, source, cursor, status, records_upserted, error=None):
    with self.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO sync_state (source, last_run_at, last_cursor, last_status, records_upserted, error, updated_at)
                VALUES (%s, NOW(), %s, %s, %s, %s, NOW())
                ON CONFLICT (source) DO UPDATE SET
                    last_run_at = NOW(), last_cursor = EXCLUDED.last_cursor,
                    last_status = EXCLUDED.last_status, records_upserted = EXCLUDED.records_upserted,
                    error = EXCLUDED.error, updated_at = NOW()
            """, (source, cursor, status, records_upserted, error))
            conn.commit()

def backfill_dedupe_keys(self):
    from ingestion.normalize import norm_domain, dedupe_key
    with self.get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT id, source, slug, website FROM companies WHERE dedupe_key IS NULL")
            rows = cur.fetchall()
        with conn.cursor() as cur:
            for r in rows:
                key = dedupe_key(norm_domain(r["website"]), r["source"] or "yc", r["slug"] or str(r["id"]))
                cur.execute("UPDATE companies SET dedupe_key = %s WHERE id = %s", (key, r["id"]))
            conn.commit()
    return len(rows)
```
(SQLite: same logic, `?` placeholders, `sqlite3.Row`.)

- [ ] **Step 5: Test (SQLite)** — `backend/test_sync_state.py`

```python
from database import Database  # SQLite impl; adjust import to the project's class name

def test_sync_cursor_roundtrip(tmp_path):
    db = Database(str(tmp_path / "t.db"))
    assert db.get_sync_cursor("hackernews") is None
    db.save_sync_state("hackernews", "1700000000", "ok", 5)
    assert db.get_sync_cursor("hackernews") == "1700000000"

def test_backfill_dedupe_keys(tmp_path):
    db = Database(str(tmp_path / "t.db"))
    db.insert_company({"id": 1, "source": "yc", "slug": "acme", "name": "Acme",
                       "website": "https://acme.com", "isHiring": False})
    n = db.backfill_dedupe_keys()
    assert n >= 1
    assert db.get_company_by_id(1)["dedupe_key"] == "acme.com"
```

- [ ] **Step 6: Run** — `python -m pytest test_sync_state.py -v` → PASS
- [ ] **Step 7: Commit** — `git commit -am "feat(sync): dedupe_key + sync_state schema and DB methods"`

---

### Task 3: Register new sources

**Files:**
- Modify: `backend/sources.py:25-38`
- Test: `backend/test_sources_registry.py`

**Interfaces:**
- Produces: `SOURCES` and `SOURCE_ID_OFFSETS` include `hackernews`, `producthunt`, `techstars`.

- [ ] **Step 1: Test**

```python
from sources import SOURCES, SOURCE_ID_OFFSETS, to_global_id
def test_new_sources_registered():
    for k in ("hackernews", "producthunt", "techstars"):
        assert k in SOURCES and k in SOURCE_ID_OFFSETS
    assert to_global_id("hackernews", 42) == 3_000_000_042
```

- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** — extend the dicts:

```python
SOURCES.update({
    "hackernews":  {"key": "hackernews",  "display_name": "Hacker News"},
    "producthunt": {"key": "producthunt", "display_name": "Product Hunt"},
    "techstars":   {"key": "techstars",   "display_name": "Techstars"},
})
SOURCE_ID_OFFSETS.update({
    "hackernews": 3_000_000_000, "producthunt": 4_000_000_000, "techstars": 5_000_000_000,
})
```

- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit** — `git commit -am "feat(sync): register hackernews/producthunt/techstars sources"`

---

### Task 4: Adapter framework + HN adapter + stubs

**Files:**
- Create: `backend/ingestion/base.py`
- Create: `backend/ingestion/hackernews.py`
- Create: `backend/ingestion/producthunt.py` (stub)
- Create: `backend/ingestion/techstars.py` (stub)
- Create: `backend/ingestion/registry.py`
- Test: `backend/test_hackernews_adapter.py`

**Interfaces:**
- Produces:
  - `base.FetchResult` = dataclass `(rows: list[dict], cursor: str | None, removed_source_ids: list[str])`
  - `base.SourceAdapter` protocol: attrs `key`, `display_name`; method `fetch(self, cursor, full=False) -> FetchResult`
  - `hackernews.parse_title(title: str) -> dict{name, batch, blurb}`
  - `hackernews.HackerNewsAdapter`
  - `registry.ADAPTERS: dict[str, SourceAdapter]`, `registry.get_adapter(key)`
- Each row dict is keyed with real column names + `source`, `source_id`, `source_url`, `dedupe_key`, `isHiring` (not `is_hiring`), `raw_json` (a dict).

- [ ] **Step 1: Test HN title parsing** — `backend/test_hackernews_adapter.py`

```python
from ingestion.hackernews import parse_title, HackerNewsAdapter

def test_parse_launch_with_yc_batch():
    r = parse_title("Launch HN: Acme (YC S26) – AI for dentists")
    assert r["name"] == "Acme" and r["batch"] == "S26" and "dentists" in r["blurb"]

def test_parse_show_hn_no_batch():
    r = parse_title("Show HN: Bpar – a faster bundler")
    assert r["name"] == "Bpar" and r["batch"] is None

def test_hit_to_row_sets_source_and_key():
    hit = {"objectID": "42", "title": "Launch HN: Acme (YC S26) – x",
           "url": "https://acme.com", "created_at_i": 1700000000,
           "author": "pg", "points": 10, "num_comments": 3, "story_text": None}
    row = HackerNewsAdapter()._to_row(hit)
    assert row["source"] == "hackernews" and row["source_id"] == "42"
    assert row["dedupe_key"] == "acme.com" and row["batch"] == "S26"
    assert row["isHiring"] is False and row["source_url"].endswith("id=42")
```

- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement `base.py`**

```python
from dataclasses import dataclass, field

@dataclass
class FetchResult:
    rows: list = field(default_factory=list)
    cursor: str | None = None
    removed_source_ids: list = field(default_factory=list)
```
(Adapters are duck-typed; no ABC needed. Document the `fetch` contract in a docstring.)

- [ ] **Step 4: Implement `hackernews.py`** (ports the PR's parser; uses `to_global_id` + `dedupe_key`)

```python
import re, json, time, urllib.request
from ingestion.base import FetchResult
from ingestion.normalize import norm_domain, slugify, dedupe_key
from sources import to_global_id

_SEARCH = "https://hn.algolia.com/api/v1/search_by_date"

def parse_title(title):
    body = re.sub(r"^\s*(launch|show)\s+hn:\s*", "", title, flags=re.I).strip()
    segs = re.split(r"\s+[–—-]\s+", body, maxsplit=1)
    head = segs[0].strip()
    blurb = segs[1].strip() if len(segs) > 1 else None
    m = re.search(r"\(YC\s+([A-Za-z]\d{2})\)", head, re.I)
    batch = m.group(1).upper() if m else None
    name = re.sub(r"\s*\(YC\s+[A-Za-z]\d{2}\)\s*", "", head, flags=re.I)
    name = re.sub(r"\s*\([^)]*\)\s*$", "", name).strip()
    return {"name": name or head, "batch": batch, "blurb": blurb}

def _get(url):
    with urllib.request.urlopen(url, timeout=30) as resp:
        return json.loads(resp.read().decode())

class HackerNewsAdapter:
    key = "hackernews"
    display_name = "Hacker News"

    def _to_row(self, hit):
        parsed = parse_title(hit.get("title", ""))
        name = parsed["name"]
        if not name:
            return None
        domain = norm_domain(hit.get("url"))
        slug = slugify(name)
        tag = "Launch HN" if re.match(r"^\s*launch\s+hn", hit.get("title", ""), re.I) else "Show HN"
        # Require a domain OR a YC batch marker to count as a company (drops noise).
        if not domain and not parsed["batch"]:
            return None
        native = int(hit["objectID"])
        return {
            "id": to_global_id("hackernews", native),
            "source": "hackernews", "source_id": str(hit["objectID"]),
            "source_url": f"https://news.ycombinator.com/item?id={hit['objectID']}",
            "name": name, "slug": slug, "website": hit.get("url"),
            "one_liner": parsed["blurb"], "long_description": hit.get("story_text"),
            "batch": parsed["batch"], "tags": [tag], "industries": [], "regions": [],
            "isHiring": False, "top_company": False, "nonprofit": False,
            "dedupe_key": dedupe_key(domain, "hackernews", slug),
            "country": None, "raw_json": hit,
        }

    def fetch(self, cursor, full=False):
        lookback_days = 3650 if full else 30
        since = int(cursor) if cursor else int(time.time()) - lookback_days * 86400
        seen, rows, max_ts = set(), [], since
        for query in ('"Launch HN"', '"Show HN"'):
            for page in range(20):
                url = (f"{_SEARCH}?query={urllib.parse.quote(query)}&tags=story"
                       f"&numericFilters=created_at_i>{since}&hitsPerPage=100&page={page}")
                data = _get(url)
                for hit in data.get("hits", []):
                    oid = hit.get("objectID")
                    if oid in seen:
                        continue
                    seen.add(oid)
                    ts = hit.get("created_at_i") or 0
                    if ts > max_ts:
                        max_ts = ts
                    row = self._to_row(hit)
                    if row:
                        rows.append(row)
                if page + 1 >= data.get("nbPages", 0):
                    break
        return FetchResult(rows=rows, cursor=str(max_ts), removed_source_ids=[])
```
(Add `import urllib.parse` at top.)

- [ ] **Step 5: Implement stubs `producthunt.py` / `techstars.py`**

```python
from ingestion.base import FetchResult

class ProductHuntAdapter:
    key = "producthunt"
    display_name = "Product Hunt"
    def fetch(self, cursor, full=False):
        # TODO: GraphQL https://api.producthunt.com/v2/api/graphql (needs PH_TOKEN),
        # map posts -> rows with source='producthunt', dedupe_key from post website.
        return FetchResult(rows=[], cursor=cursor, removed_source_ids=[])
```
(Techstars analogous: scrape https://www.techstars.com/portfolio; TODO fetch.)

- [ ] **Step 6: Implement `registry.py`**

```python
from ingestion.hackernews import HackerNewsAdapter
from ingestion.producthunt import ProductHuntAdapter
from ingestion.techstars import TechstarsAdapter

ADAPTERS = {a.key: a for a in (HackerNewsAdapter(), ProductHuntAdapter(), TechstarsAdapter())}
def get_adapter(key): return ADAPTERS.get(key)
```

- [ ] **Step 7: Run** — `python -m pytest test_hackernews_adapter.py -v` → PASS
- [ ] **Step 8: Commit** — `git commit -m "feat(sync): adapter framework + Hacker News adapter + PH/Techstars stubs"`

---

### Task 5: sync_service orchestrator + cron endpoint + workflow

**Files:**
- Create: `backend/ingestion/sync_service.py`
- Modify: `backend/main.py` (new `/api/cron/sync-sources`; extend scrape source handling)
- Modify: `.github/workflows/daily-cron.yml`
- Test: `backend/test_sync_service.py`

**Interfaces:**
- Consumes: `registry.ADAPTERS`, `db.insert_company`, `db.get_sync_cursor`, `db.save_sync_state`, `db.backfill_dedupe_keys`, `embedding_service`, `company_cache.refresh`.
- Produces: `run_sync(db, sources: list[str] | None = None, full=False) -> dict{source: {upserted, cursor, status}}`, and `embed_missing(db, limit=2000) -> int`.

- [ ] **Step 1: Test with a fake adapter** — `backend/test_sync_service.py`

```python
from database import Database
from ingestion import sync_service
from ingestion.base import FetchResult

class FakeAdapter:
    key = "hackernews"; display_name = "HN"
    def fetch(self, cursor, full=False):
        return FetchResult(rows=[{
            "id": 3_000_000_001, "source": "hackernews", "source_id": "1",
            "name": "Acme", "slug": "acme", "website": "https://acme.com",
            "dedupe_key": "acme.com", "isHiring": False, "raw_json": {"x": 1},
            "tags": ["Launch HN"], "industries": [], "regions": [],
        }], cursor="123", removed_source_ids=[])

def test_run_sync_upserts_and_saves_cursor(tmp_path, monkeypatch):
    db = Database(str(tmp_path / "t.db"))
    monkeypatch.setitem(sync_service.registry.ADAPTERS, "hackernews", FakeAdapter())
    out = sync_service.run_sync(db, sources=["hackernews"])
    assert out["hackernews"]["upserted"] == 1
    assert db.get_sync_cursor("hackernews") == "123"
    assert db.get_company_by_id(3_000_000_001)["dedupe_key"] == "acme.com"
```

- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement `sync_service.py`**

```python
import logging
from ingestion import registry

logger = logging.getLogger(__name__)

def run_sync(db, sources=None, full=False):
    keys = sources or list(registry.ADAPTERS.keys())
    results = {}
    for key in keys:
        adapter = registry.get_adapter(key)
        if adapter is None:
            continue
        try:
            cursor = db.get_sync_cursor(key)
            result = adapter.fetch(cursor, full=full)
            for row in result.rows:
                db.insert_company(row)
            db.save_sync_state(key, result.cursor, "ok", len(result.rows))
            results[key] = {"upserted": len(result.rows), "cursor": result.cursor, "status": "ok"}
            logger.info(f"sync {key}: upserted {len(result.rows)}, cursor {result.cursor}")
        except Exception as e:
            db.save_sync_state(key, None, "error", 0, str(e))
            results[key] = {"upserted": 0, "cursor": None, "status": "error", "error": str(e)}
            logger.error(f"sync {key} failed: {e}")
    return results

def embed_missing(db, limit=2000):
    """Embed any rows (all sources) missing an embedding. No-op on SQLite."""
    if not hasattr(db, "get_companies_for_embedding"):
        return 0
    from embedding_service import get_embedding_service
    from idea_filter import get_search_text_for_embedding
    missing = db.get_companies_for_embedding(only_missing=True, limit=limit)
    if not missing:
        return 0
    svc = get_embedding_service()
    texts = [get_search_text_for_embedding(db.build_company_embedding_text(c)) for c in missing]
    vectors = svc.generate_embeddings_batch(texts)
    return db.update_company_embeddings_batch([(c["id"], v) for c, v in zip(missing, vectors)])
```

- [ ] **Step 4: Run** — `python -m pytest test_sync_service.py -v` → PASS
- [ ] **Step 5: Add cron endpoint** in `backend/main.py` (mirror `/api/cron/daily-scrape` auth at `main.py:1665`)

```python
@app.post("/api/cron/sync-sources")
async def cron_sync_sources(request: Request, full: bool = False):
    _require_cron_secret(request)  # same helper used by daily-scrape (extract if inline)
    from ingestion import sync_service
    db.backfill_dedupe_keys()
    results = sync_service.run_sync(db, full=full)
    embedded = sync_service.embed_missing(db)
    company_cache.refresh(db)
    return {"results": results, "embedded": embedded}
```
If daily-scrape uses inline secret check, replicate the same 3 lines here rather than refactoring.

- [ ] **Step 6: Add workflow step** in `.github/workflows/daily-cron.yml` — a curl POST to `/api/cron/sync-sources` with the `CRON_SECRET` bearer, scheduled after the daily scrape. Delete the PR's `scripts/exploreyc-sync-pr/.github/workflows/sync-companies.yml`.

- [ ] **Step 7: Commit** — `git commit -am "feat(sync): sync orchestrator + /api/cron/sync-sources + workflow"`

---

### Task 6: Embeddings + similarity across all sources (Postgres)

**Files:**
- Modify: `backend/database_postgres.py` (embedding generation + retrieval)
- Modify: `backend/main.py` (hero/validator call sites pass `source_filter='yc'`; new `/api/companies/similar`)
- Modify: `backend/database.py` (SQLite stubs if the methods exist there)
- Test: `backend/test_embedding_all_sources.py` (skipped without a live PG/pgvector; assert SQL shape via string checks where possible)

**Interfaces:**
- Produces:
  - `find_similar_companies_by_embedding(embedding, limit=10, min_similarity=0.5, source_filter=None)` — `source_filter='yc'` = YC-only (unchanged behavior); `None` = all sources deduped by `dedupe_key`.
  - `find_companies_by_text_search(idea, limit=10, source_filter=None)` — same convention.
  - `get_companies_for_embedding` / `get_companies_without_embeddings` / `count_companies_with_embeddings` — no longer filtered to `source='yc'`.
  - New endpoint `POST /api/companies/similar {query: str, limit?: int}` → all-source vector matches.
  - Unchanged: `get_yc_company_count()` (YC denominator).

- [ ] **Step 1: Broaden generation** — in `get_companies_for_embedding` remove `WHERE source = 'yc'` (keep `embedding IS NULL` when `only_missing`); same for `get_companies_without_embeddings`; drop `AND source='yc'` in `count_companies_with_embeddings`.

- [ ] **Step 2: Add `source_filter` to retrieval** — parametrize the two finder queries:

```python
def find_similar_companies_by_embedding(self, embedding, limit=10, min_similarity=0.5, source_filter=None):
    embedding_str = '[' + ','.join(map(str, embedding)) + ']'
    src_clause = "AND source = %s" if source_filter else ""
    dedup = "" if source_filter else "DISTINCT ON (dedupe_key)"
    order_extra = "dedupe_key," if not source_filter else ""
    sql = f"""
        SELECT {dedup} id, name, slug, website, one_liner, long_description,
               industry, subindustry, tags, industries, batch, is_hiring,
               team_size, all_locations, country, small_logo_thumb_url, source, dedupe_key,
               (1 - (embedding <=> %s::vector)) AS similarity_score
        FROM companies
        WHERE embedding IS NOT NULL {src_clause}
          AND (1 - (embedding <=> %s::vector)) >= %s
        ORDER BY {order_extra} embedding <=> %s::vector
        LIMIT %s
    """
    params = [embedding_str] + ([source_filter] if source_filter else []) + [embedding_str, min_similarity, embedding_str, limit]
    # NOTE: with DISTINCT ON, a subquery re-sorts by similarity for final ordering.
```
For the all-source branch wrap in a subquery so final results order by `similarity_score DESC` after `DISTINCT ON (dedupe_key)` dedup. Round scores as before. Apply the analogous `source_filter` to `find_companies_by_text_search`.

- [ ] **Step 3: Preserve the hero/validator** — at `main.py` call sites (~964, ~1063, ~1143) pass `source_filter="yc"` so the verdict/market-size stay YC-only and `hero_service.build_verdict` is unchanged.

- [ ] **Step 4: New all-source endpoint** — `main.py`

```python
class SimilarQuery(BaseModel):
    query: str
    limit: int = 12

@app.post("/api/companies/similar")
async def companies_similar(body: SimilarQuery):
    if db.count_companies_with_embeddings() == 0:
        raise HTTPException(status_code=503, detail="Embeddings not generated yet")
    text = get_search_text_for_embedding(body.query, min_length=3)
    emb = get_embedding_service().generate_embedding_for_idea(text)
    results = db.find_similar_companies_by_embedding(emb, limit=body.limit, min_similarity=0.3)  # source_filter=None -> all
    return {"companies": results, "total": len(results)}
```

- [ ] **Step 5: Test** — `backend/test_embedding_all_sources.py`: unit-test that `get_companies_for_embedding`'s SQL no longer contains `source = 'yc'` (introspect via a monkeypatched cursor capturing SQL), and that `find_similar_companies_by_embedding(..., source_filter='yc')` includes `source = %s`. Guard live-PG tests behind `pytest.mark.skipif(no DATABASE_URL)`.

- [ ] **Step 6: Run** — `python -m pytest test_embedding_all_sources.py -v` → PASS
- [ ] **Step 7: Commit** — `git commit -am "feat(sync): embeddings + vector search across all sources; hero stays YC-scoped"`

---

### Task 7: Read-time merge grouping + `merged` flag

**Files:**
- Modify: `backend/company_cache.py` (merge grouping)
- Modify: `backend/main.py` (`CompanyFilter.merged`; pass through `/api/companies`)
- Test: `backend/test_merge_grouping.py`

**Interfaces:**
- Consumes: rows carry `dedupe_key`, `source`, `source_url`.
- Produces:
  - `CompanyCache._merge_group(rows: list[dict]) -> dict` (primary + `merged_sources`)
  - `get_companies(..., merged: bool = False)` and `count_companies(..., merged=False)` group by `dedupe_key` when `merged=True`.
  - `CompanyFilter.merged: bool = False` on the API model.
- Primary priority: `yc > a16z > techstars > producthunt > hackernews`. Gap-fill `one_liner`, `small_logo_thumb_url`, `long_description` from group members; `is_hiring = any`.

- [ ] **Step 1: Test** — `backend/test_merge_grouping.py`

```python
from company_cache import CompanyCache

def _c(**kw):
    base = {"id": 0, "source": "yc", "dedupe_key": "acme.com", "name": "Acme",
            "one_liner": None, "is_hiring": False, "created_at": "2026-01-01"}
    base.update(kw); return base

def test_merge_collapses_same_domain_with_badges():
    cache = CompanyCache()
    cache._build_cache([
        _c(id=1, source="yc", one_liner="YC one liner", source_url="yc/acme"),
        _c(id=3_000_000_001, source="hackernews", one_liner=None, is_hiring=True, source_url="hn/1"),
    ])
    rows = cache.get_companies(merged=True, source="all")
    acme = [r for r in rows if r["dedupe_key"] == "acme.com"]
    assert len(acme) == 1
    assert acme[0]["source"] == "yc"                       # yc wins primary
    assert acme[0]["is_hiring"] is True                    # any() across group
    assert {s["key"] for s in acme[0]["merged_sources"]} == {"yc", "hackernews"}

def test_merged_false_keeps_rows_separate():
    cache = CompanyCache()
    cache._build_cache([_c(id=1, source="yc"), _c(id=3_000_000_001, source="hackernews")])
    assert len(cache.get_companies(merged=False, source="all")) == 2
```

- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement merge** in `company_cache.py`:

```python
_SOURCE_PRIORITY = {"yc": 0, "a16z": 1, "techstars": 2, "producthunt": 3, "hackernews": 4}

@staticmethod
def _merge_group(rows):
    primary = min(rows, key=lambda r: CompanyCache._SOURCE_PRIORITY.get(r.get("source") or "yc", 99))
    merged = dict(primary)
    for field in ("one_liner", "small_logo_thumb_url", "long_description", "country", "all_locations"):
        if not merged.get(field):
            for r in rows:
                if r.get(field):
                    merged[field] = r[field]; break
    merged["is_hiring"] = any(r.get("is_hiring") for r in rows)
    merged["merged_sources"] = [
        {"key": r.get("source") or "yc", "source_url": r.get("source_url")} for r in rows
    ]
    return merged

def _apply_merge(self, filtered):
    groups = {}
    for c in filtered:
        key = c.get("dedupe_key") or f'id:{c.get("id")}'
        groups.setdefault(key, []).append(c)
    return [self._merge_group(g) for g in groups.values()]
```
Then in `get_companies`/`count_companies` add `merged: bool = False`; after `_filter_companies(...)`, if `merged`, run `filtered = self._apply_merge(filtered)` **before** slicing/counting. Preserve created_at ordering by sorting merged output with the existing sort key.

- [ ] **Step 4: Add API flag** — `CompanyFilter.merged: bool = False` (`main.py:275`), and pass `merged=filters.merged` into `company_cache.get_companies(...)` / `count_companies(...)` at `main.py:551` / `:563`.

- [ ] **Step 5: Run** — `python -m pytest test_merge_grouping.py -v` → PASS
- [ ] **Step 6: Commit** — `git commit -am "feat(sync): read-time domain merge grouping behind merged flag"`

---

### Task 8: Frontend — badges, merged cluster, types, semantic search

**Files:**
- Modify: `frontend/src/components/ui/SourceBadge.tsx`
- Modify: `frontend/src/lib/api.ts` (`Company`, `CompanyFilter`, `Source`, client method)
- Modify: `frontend/src/components/CompaniesBrowser.tsx`
- Modify: `frontend/src/components/CompanyDetailModal.tsx`
- Modify: `frontend/src/pages/CompanyPage.tsx`

**Interfaces:**
- Consumes: API `merged_sources?: {key: string; source_url?: string}[]`, `dedupe_key?`, `/api/companies/similar`.
- Produces: multi-badge cluster rendering; `merged` filter flag; `getSimilarCompanies(query, limit)`.

- [ ] **Step 1: SourceBadge** — add branches for `hackernews` (HN orange `#FF6600` square "HN"), `producthunt` (`#DA552F` "P"), `techstars` (`#0090FF` "T"), and `sourceLabel()` cases.
- [ ] **Step 2: api.ts types** — add `dedupe_key?: string` and `merged_sources?: {key: string; source_url?: string}[]` to `Company`; `merged?: boolean` to `CompanyFilter`; add:

```ts
getSimilarCompanies: (query: string, limit = 12) =>
  api.post<{ companies: Company[]; total: number }>('/api/companies/similar', { query, limit }),
```
- [ ] **Step 3: Badge cluster component** — render `company.merged_sources` (fallback to `[{key: company.source}]`) as a row of `<SourceBadge>`s in `CompaniesBrowser` cards, `CompanyDetailModal`, and `CompanyPage`. Cards guard empty `batch`/`all_locations` (already conditional).
- [ ] **Step 4: Merged + semantic toggles in `CompaniesBrowser`** — a "Merge sources" checkbox sets `filters.merged = true, source = 'all'`; a "Semantic search" toggle routes the search box through `getSimilarCompanies` instead of `getCompanies`.
- [ ] **Step 5: Build check** — `cd frontend && npm run build` → succeeds (TS strict passes).
- [ ] **Step 6: Commit** — `git commit -am "feat(sync): source badges, merged cluster, semantic search UI"`

---

### Task 9: Rollout & verification

**Files:**
- Modify: `scripts/exploreyc-sync-pr/` → remove (folded into platform); keep `PR_DESCRIPTION.md` notes migrated into the plan/spec.
- Create: `backend/scripts/backfill_dedupe_and_embed.py` (one-off convenience) — optional.

- [ ] **Step 1: Full backend test run** — `cd backend && python -m pytest test_ingestion_normalize.py test_sync_state.py test_sources_registry.py test_hackernews_adapter.py test_sync_service.py test_merge_grouping.py test_embedding_all_sources.py -v` → all PASS.
- [ ] **Step 2: Local smoke (SQLite)** — start backend (`cd backend && uvicorn main:app --port 8000`), seed a few YC rows via `/api/scrape`, then `curl -X POST localhost:8000/api/cron/sync-sources -H "Authorization: Bearer $CRON_SECRET"` (set a local `CRON_SECRET`). Verify HN rows appear via `curl -X POST localhost:8000/api/companies -d '{"source":"all","merged":true}'`.
- [ ] **Step 3: Frontend build** — `cd frontend && npm run build`.
- [ ] **Step 4: Remove the superseded PR folder** — `git rm -r scripts/exploreyc-sync-pr` and commit.
- [ ] **Step 5: Push branch + open PR** — `git push -u origin feat/db-feature-requests` and open a PR summarizing the meshed design (link the spec).
- [ ] **Step 6: Production rollout handoff (user-run):** apply migration `20260711130000_multi_source_sync.sql` via `supabase db push`; trigger `/api/cron/sync-sources?full=true` once to backfill HN + `dedupe_key` + embeddings; confirm daily cron picks it up. No new secrets required (reuses `CRON_SECRET`, `SUPABASE_*`, `OPENAI_API_KEY`).

---

## Self-Review

**Spec coverage:** §3.1 schema → T2; §3.2 registry → T3; §3.3 framework/adapters/sync_service → T1/T4/T5; §3.4 backfill → T2/T5; §3.5 merge → T7; §3.6 cron/ops → T5; §3.7 frontend → T8; §3.8 embeddings all-source + YC metric preserved → T6; testing → tests in each task + T9; rollout → T9. All covered.

**Placeholder scan:** stubs (PH/Techstars `fetch`) are intentional per spec and clearly marked TODO with the concrete endpoint; no other placeholders.

**Type consistency:** `FetchResult(rows, cursor, removed_source_ids)`, adapter `.key`/`.fetch`, `run_sync`/`embed_missing`, `find_similar_companies_by_embedding(..., source_filter=)`, `_merge_group`/`merged_sources`, `CompanyFilter.merged` — names consistent across tasks. `insert_company` reads `isHiring` (adapters emit `isHiring`, not `is_hiring`).
