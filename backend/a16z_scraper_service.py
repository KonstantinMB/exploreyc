"""
a16z portfolio scraper.

The a16z portfolio page (https://a16z.com/portfolio/) ships its full dataset inline
in the HTML as a global JS array `window.a16z_portfolio_companies = [ ... ];` — one
unauthenticated GET, no API key, no headless browser, no pagination. A small set of
companies (the exits ticker) additionally carry richer `data-company='{...}'` DOM
attributes (verticals, permalink, website_description, jobs, ...) which we merge in by id.

Each entry is mapped onto the shared multi-source `companies` schema (see sources.py):
YC keeps its native ids; a16z ids are offset into a reserved block so they never collide.

Runnable standalone as a seeder:

    cd backend
    python -m a16z_scraper_service --dry-run        # fetch + parse + map, write nothing
    python -m a16z_scraper_service --limit 20        # seed only the first 20 (smoke test)
    python -m a16z_scraper_service                    # seed all ~849
    DATABASE_URL=postgres://... python -m a16z_scraper_service   # seed Supabase/Postgres

With DATABASE_URL set it writes to Postgres (Supabase); otherwise to local SQLite.
"""

import asyncio
import html
import json
import re
from typing import Callable, Dict, List, Optional

import requests

from sources import to_global_id

PORTFOLIO_URL = "https://a16z.com/portfolio/"
SOURCE = "a16z"

# Stage tokens a16z uses to mark an exit (vs. an active-portfolio stage like Venture/Seed/Growth)
_EXIT_STAGES = {"IPO", "M&A", "SPAC", "DPO", "EXIT"}


def slugify(value: str) -> str:
    """Lowercase, hyphenate, strip to a URL-safe slug."""
    value = html.unescape(value or "").lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value


def _first_nonempty(*vals) -> Optional[str]:
    for v in vals:
        if v not in (None, "", []):
            return v
    return None


class A16ZScraperService:
    """Fetch, parse, map, and upsert the a16z portfolio into the companies table."""

    def __init__(self, db):
        self.db = db
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                           "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"),
            "Accept": "text/html,application/xhtml+xml",
        })

    # ---- fetch + parse -----------------------------------------------------

    def fetch_html(self) -> str:
        resp = self.session.get(PORTFOLIO_URL, timeout=60)
        resp.raise_for_status()
        return resp.text

    def parse_entries(self, html_text: str) -> List[Dict]:
        """Extract the inline company array; merge richer data-company DOM attrs by id."""
        m = re.search(r"window\.a16z_portfolio_companies\s*=\s*(\[.*?\])\s*;", html_text, re.DOTALL)
        if not m:
            raise ValueError("window.a16z_portfolio_companies not found — a16z page layout may have changed")
        entries = json.loads(m.group(1))

        # Best-effort: richer per-company attributes (exits ticker), keyed by native id.
        dom_by_id: Dict[str, Dict] = {}
        for raw in re.findall(r"data-company='(\{.*?\})'", html_text, re.DOTALL):
            try:
                obj = json.loads(raw)
            except json.JSONDecodeError:
                try:
                    obj = json.loads(html.unescape(raw))
                except json.JSONDecodeError:
                    continue
            if obj.get("id") is not None:
                dom_by_id[str(obj["id"])] = obj

        for e in entries:
            extra = dom_by_id.get(str(e.get("id")))
            if extra:
                e["_dom"] = extra
        return entries

    # ---- mapping -----------------------------------------------------------

    def _derive_exit(self, entry: Dict, dom: Dict) -> tuple[Optional[str], str]:
        """Return (exit_type, status). Prefers explicit signals, falls back to stages."""
        stages = set(entry.get("stages") or [])
        acquirer = entry.get("acquirer")
        ticker = entry.get("ticker_symbol")

        if acquirer or "M&A" in stages:
            return "M&A", "Acquired"
        if ticker or "IPO" in stages:
            return "IPO", "Public"
        if "SPAC" in stages:
            return "SPAC", "Public"
        if entry.get("exit_date") or (stages & _EXIT_STAGES):
            return "Exit", "Exited"
        return None, "Active"

    def _map_entry(self, entry: Dict, seen_slugs: set) -> Dict:
        dom = entry.get("_dom") or {}
        native_id = str(entry.get("id"))
        name = _first_nonempty(dom.get("name"), entry.get("title"),
                               dom.get("display_name"), dom.get("post_title")) or f"a16z-{native_id}"

        # slug: prefer a16z's own permalink slug, else slugify name; guarantee uniqueness within source
        slug = None
        permalink = dom.get("permalink")
        if permalink:
            mslug = re.search(r"/companies/([^/]+)/?", permalink)
            if mslug:
                slug = mslug.group(1)
        slug = slug or slugify(name) or f"a16z-{native_id}"
        if slug in seen_slugs:
            slug = f"{slug}-{native_id}"
        seen_slugs.add(slug)

        # verticals / focus areas -> industry + industries[]
        verticals_raw = dom.get("verticals") or ""
        verticals = [v.strip() for v in re.split(r"[;,]", verticals_raw) if v.strip()]
        focus_areas = dom.get("focus_areas") or []
        industries = list(dict.fromkeys([*focus_areas, *verticals]))
        industry = industries[0] if industries else None

        year = entry.get("year_founded")
        try:
            year_founded = int(year) if year not in (None, "") else None
        except (ValueError, TypeError):
            year_founded = None

        jobs = dom.get("jobs")
        if jobs in (None, ""):
            try:
                jobs = int(dom.get("number_of_jobs") or 0)
            except (ValueError, TypeError):
                jobs = 0

        exit_type, status = self._derive_exit(entry, dom)

        overview = entry.get("overview") or ""
        website_description = dom.get("website_description") or ""
        one_liner = _first_nonempty(
            website_description,
            overview.split(". ")[0] + "." if overview else None,
            (entry.get("announcement") or {}).get("excerpt"),
        )

        return {
            "id": to_global_id(SOURCE, native_id),
            "source": SOURCE,
            "source_id": native_id,
            "name": name,
            "slug": slug,
            "website": _first_nonempty(entry.get("web"), dom.get("external_url"),
                                       dom.get("company_url"), dom.get("url")),
            "one_liner": one_liner,
            "long_description": _first_nonempty(overview, website_description),
            "small_logo_thumb_url": entry.get("logo"),
            "stage": ", ".join(entry.get("stages") or []) or None,
            "industry": industry,
            "industries": industries,
            "tags": dom.get("tags") or [],
            "founders": _first_nonempty(entry.get("founders"), dom.get("founders_list")),
            "year_founded": year_founded,
            "funded_date": _first_nonempty(dom.get("initial_a16z_date_funded"),
                                           entry.get("invest_date"), dom.get("investment_date")),
            "ticker_symbol": entry.get("ticker_symbol") or None,
            "acquirer": entry.get("acquirer") or None,
            "exit_type": exit_type,
            "status": status,
            "source_url": permalink,
            "isHiring": bool(jobs and int(jobs) > 0),
            # source-only fields, preserved in raw_json (no dedicated column)
            "socials": entry.get("socials") or [],
            "announcement": entry.get("announcement"),
            "email": entry.get("email") or None,
            # explicit non-applicable YC fields (keeps a16z out of YC-shaped views)
            "batch": None,
            "team_size": None,
            "all_locations": None,
            "regions": [],
            "top_company": False,
            "nonprofit": False,
            "subindustry": None,
        }

    def map_all(self, entries: List[Dict], limit: Optional[int] = None) -> List[Dict]:
        seen_slugs: set = set()
        mapped = []
        for e in entries:
            if e.get("id") is None:
                continue
            mapped.append(self._map_entry(e, seen_slugs))
            if limit and len(mapped) >= limit:
                break
        return mapped

    # ---- scrape lifecycle --------------------------------------------------

    async def scrape_companies(self, job_id: int,
                               progress_callback: Optional[Callable] = None,
                               limit: Optional[int] = None) -> int:
        total = 0
        try:
            loop = asyncio.get_event_loop()
            html_text = await loop.run_in_executor(None, self.fetch_html)
            entries = self.parse_entries(html_text)
            mapped = self.map_all(entries, limit=limit)

            if hasattr(self.db, "bulk_insert_companies"):
                # Fast path (Postgres/Supabase): one execute_values upsert instead of
                # ~2,500 sequential connections. Skips per-row change tracking (fine for a seed).
                await loop.run_in_executor(None, self.db.bulk_insert_companies, mapped)
                total = len(mapped)
            else:
                # Per-row path (SQLite local dev): change tracking + incremental progress.
                for company in mapped:
                    existing = self.db.get_company_by_id(company["id"])
                    self.db.insert_company(company)
                    if existing is None:
                        self.db.log_change(company_id=company["id"], change_type="created",
                                           new_value=company["name"])
                    total += 1
                    if total % 50 == 0:
                        self.db.update_scrape_job(job_id, "running", total, 1)
                        if progress_callback:
                            await progress_callback({"job_id": job_id, "status": "running",
                                                     "total_scraped": total, "current_page": 1})

            self.db.update_scrape_job(job_id, "completed", total, 1)
            if progress_callback:
                await progress_callback({"job_id": job_id, "status": "completed",
                                         "total_scraped": total, "current_page": 1})
            return total
        except Exception as e:
            self.db.update_scrape_job(job_id, "failed", total, 1, str(e))
            if progress_callback:
                await progress_callback({"job_id": job_id, "status": "failed",
                                         "error": str(e), "total_scraped": total, "current_page": 1})
            raise


# --------------------------------------------------------------------------
# Standalone seeder
# --------------------------------------------------------------------------

def _main() -> None:
    import argparse

    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass

    parser = argparse.ArgumentParser(description="Seed the a16z portfolio into the companies table")
    parser.add_argument("--dry-run", action="store_true", help="Fetch + parse + map, write nothing")
    parser.add_argument("--limit", type=int, default=None, help="Only process the first N companies")
    args = parser.parse_args()

    import os
    from database_factory import get_database

    svc = A16ZScraperService(db=None)
    print(f"Fetching {PORTFOLIO_URL} ...")
    html_text = svc.fetch_html()
    entries = svc.parse_entries(html_text)
    print(f"Parsed {len(entries)} companies from window.a16z_portfolio_companies")
    mapped = svc.map_all(entries, limit=args.limit)
    print(f"Mapped {len(mapped)} companies (limit={args.limit})")

    if args.dry_run:
        print("\n--- dry run: 3 sample mapped rows ---")
        for row in mapped[:3]:
            preview = {k: row.get(k) for k in
                       ("id", "source", "source_id", "name", "slug", "website", "stage",
                        "industry", "exit_type", "ticker_symbol", "acquirer", "founders")}
            print(json.dumps(preview, indent=2, ensure_ascii=False))
        exits = sum(1 for r in mapped if r["exit_type"])
        print(f"\nsummary: {len(mapped)} total, {exits} exits, "
              f"{sum(1 for r in mapped if r['website'])} with website, "
              f"{sum(1 for r in mapped if r['industry'])} with industry")
        return

    target = "Postgres (DATABASE_URL set)" if os.environ.get("DATABASE_URL") else "local SQLite"
    print(f"Writing to {target} ...")
    db = get_database()
    svc.db = db
    job_id = db.create_scrape_job({"source": SOURCE, "limit": args.limit})
    total = asyncio.run(svc.scrape_companies(job_id, limit=args.limit))
    print(f"✅ Seeded {total} a16z companies (job_id={job_id}).")


if __name__ == "__main__":
    _main()
