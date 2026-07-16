"""Founder sourcing service (Script 1 — authoritative).

Sources YC founder records from each company's public detail page
(``https://www.ycombinator.com/companies/{slug}``), where founder data lives inside
an Inertia.js ``data-page`` JSON blob. Builds a deduplicated founder dataset and the
founder <-> company graph.

Dedup key: YC ``user_id`` — stable across every company a founder started, so serial
founders collapse to a single record without fuzzy name matching.

This module is import-safe (no DB required to scrape). DB upsert wiring lives in the
callers; ``main()`` runs a standalone demo that prints a detailed view.
"""

from __future__ import annotations

import html
import json
import re
import sys
import time
import urllib.request
from dataclasses import dataclass, field, asdict
from typing import Any, Optional

YC_COMPANY_URL = "https://www.ycombinator.com/companies/{slug}"
USER_AGENT = "Mozilla/5.0 (compatible; ExploreYC-FounderBot/1.0)"
REQUEST_TIMEOUT = 25
POLITE_DELAY_S = 0.4

_DATA_PAGE_RE = re.compile(r'data-page="(.*?)"\s*>', re.S)

# Company fields we lift from the same page for founder context.
_COMPANY_FIELDS = (
    "id", "name", "slug", "batch", "one_liner", "team_size",
    "status", "all_locations", "small_logo_thumb_url", "industry", "website",
)


@dataclass
class FounderCompany:
    """A company a founder started (edge, with the founder's title there)."""
    slug: str
    name: str
    batch: Optional[str]
    title: Optional[str]
    one_liner: Optional[str] = None
    team_size: Optional[int] = None
    status: Optional[str] = None
    location: Optional[str] = None


@dataclass
class Founder:
    """A deduplicated founder plus every YC company they started."""
    yc_user_id: int
    full_name: str
    title: Optional[str] = None
    bio: Optional[str] = None
    linkedin_url: Optional[str] = None
    twitter_url: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: Optional[bool] = None
    companies: list[FounderCompany] = field(default_factory=list)

    # --- derived stats (the authoritative leaderboard inputs) ---
    @property
    def companies_count(self) -> int:
        return len(self.companies)

    @property
    def batches(self) -> list[str]:
        seen: list[str] = []
        for c in self.companies:
            if c.batch and c.batch not in seen:
                seen.append(c.batch)
        return seen

    @property
    def is_repeat_founder(self) -> bool:
        return self.companies_count > 1

    def slugify(self) -> str:
        base = re.sub(r"[^a-z0-9]+", "-", self.full_name.lower()).strip("-")
        return f"{base}-{self.yc_user_id}" if base else str(self.yc_user_id)


class FounderScraper:
    """Fetches + parses YC company pages into deduplicated Founder records."""

    def fetch_page(self, slug: str) -> Optional[str]:
        url = YC_COMPANY_URL.format(slug=slug)
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
                return resp.read().decode("utf-8", "ignore")
        except Exception as exc:  # noqa: BLE001 - skip unreachable/removed pages
            print(f"  ! {slug}: fetch failed ({exc})", file=sys.stderr)
            return None

    @staticmethod
    def _extract_props(page_html: str) -> Optional[dict[str, Any]]:
        m = _DATA_PAGE_RE.search(page_html)
        if not m:
            return None
        try:
            return json.loads(html.unescape(m.group(1))).get("props", {})
        except json.JSONDecodeError:
            return None

    @staticmethod
    def _find_founders(props: dict[str, Any]) -> list[dict[str, Any]]:
        company = props.get("company") or {}
        if isinstance(company.get("founders"), list):
            return company["founders"]
        if isinstance(props.get("founders"), list):
            return props["founders"]
        # fallback: recursively locate the first "founders" list
        stack = [props]
        while stack:
            node = stack.pop()
            if isinstance(node, dict):
                if isinstance(node.get("founders"), list):
                    return node["founders"]
                stack.extend(node.values())
            elif isinstance(node, list):
                stack.extend(node)
        return []

    @staticmethod
    def _company_meta(props: dict[str, Any], slug: str) -> dict[str, Any]:
        company = props.get("company") or {}
        meta = {k: company.get(k) for k in _COMPANY_FIELDS}
        meta.setdefault("slug", slug)
        meta["slug"] = meta.get("slug") or slug
        return meta

    def parse(self, page_html: str, slug: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        props = self._extract_props(page_html)
        if not props:
            return [], {"slug": slug}
        return self._find_founders(props), self._company_meta(props, slug)

    def scrape(self, slugs: list[str]) -> dict[int, Founder]:
        """Scrape slugs into a {yc_user_id: Founder} map, deduped + edges merged."""
        founders: dict[int, Founder] = {}
        for slug in slugs:
            page = self.fetch_page(slug)
            if not page:
                continue
            raw_founders, meta = self.parse(page, slug)
            if not raw_founders:
                print(f"  - {slug}: no founders found", file=sys.stderr)
                continue
            edge = FounderCompany(
                slug=meta.get("slug") or slug,
                name=meta.get("name") or slug,
                batch=meta.get("batch"),
                title=None,
                one_liner=meta.get("one_liner"),
                team_size=meta.get("team_size"),
                status=meta.get("status"),
                location=meta.get("all_locations"),
            )
            for rf in raw_founders:
                uid = rf.get("user_id")
                if uid is None:
                    continue
                f = founders.get(uid)
                if f is None:
                    f = Founder(
                        yc_user_id=uid,
                        full_name=rf.get("full_name") or "Unknown",
                        title=rf.get("title"),
                        bio=(rf.get("founder_bio") or "").strip() or None,
                        linkedin_url=rf.get("linkedin_url"),
                        twitter_url=rf.get("twitter_url"),
                        avatar_url=rf.get("avatar_thumb_url"),
                        is_active=rf.get("is_active"),
                    )
                    founders[uid] = f
                # merge this company as an edge (with per-company title)
                comp_edge = FounderCompany(**{**asdict(edge), "title": rf.get("title")})
                f.companies.append(comp_edge)
            print(f"  * {slug}: {len(raw_founders)} founder(s)", file=sys.stderr)
            time.sleep(POLITE_DELAY_S)
        return founders


# ============================================================================
# DB WIRING (Script 1 — spec §5): scrape -> upsert founders + edges -> refresh.
# The scraping/parsing/dedup above is untouched; this layer persists its output.
# ============================================================================

import logging
import os

logger = logging.getLogger(__name__)

# Cursor key used in the sync_state table (parity with the other ingestion adapters).
SYNC_SOURCE_KEY = "founders"

# Avatar storage (spec §5.4). Dev writes here; prod uploads to Supabase Storage.
AVATAR_SUBPATH = "static/avatars"
AVATAR_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), AVATAR_SUBPATH)
AVATAR_BUCKET = os.environ.get("FOUNDER_AVATAR_BUCKET", "founder-avatars")


def _download_bytes(url: str, timeout: int = 20) -> tuple[bytes, str]:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read(), resp.headers.get("Content-Type", "image/jpeg")


def _upload_supabase(data: bytes, content_type: str, key: str) -> Optional[str]:
    """Upload to a public Supabase Storage bucket; return the public CDN URL.

    Gated on SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. Returns None if unconfigured
    so the caller can fall back to local dev storage.
    """
    base = os.environ.get("SUPABASE_URL")
    svc = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY")
    if not (base and svc):
        return None
    base = base.rstrip("/")
    obj_url = f"{base}/storage/v1/object/{AVATAR_BUCKET}/{key}"
    req = urllib.request.Request(obj_url, data=data, method="POST", headers={
        "Authorization": f"Bearer {svc}", "apikey": svc,
        "Content-Type": content_type, "x-upsert": "true",
    })
    urllib.request.urlopen(req, timeout=25).read()
    return f"{base}/storage/v1/object/public/{AVATAR_BUCKET}/{key}"


def _rehost_avatar(avatar_url: Optional[str], yc_user_id: int) -> Optional[str]:
    """Download-once re-host of a founder avatar to stable storage (spec §5.4).

    YC's ``avatar_thumb_url`` is a signed S3 URL that expires (~1h), so we fetch the
    bytes once and re-host them under a stable URL:
      - prod: Supabase Storage public bucket -> CDN URL (needs SUPABASE_URL +
        SUPABASE_SERVICE_ROLE_KEY and the bucket to exist).
      - dev: local ``static/avatars/{id}.jpg`` served by the FastAPI static mount.
    On any failure it falls back to the original (expiring) URL so the run never dies.
    """
    if not avatar_url:
        return None
    key = f"{yc_user_id}.jpg"
    try:
        data, ctype = _download_bytes(avatar_url)
    except Exception as e:  # noqa: BLE001
        logger.warning("avatar download failed for %s: %s", yc_user_id, e)
        return avatar_url
    try:
        public = _upload_supabase(data, ctype, key)
        if public:
            return public
    except Exception as e:  # noqa: BLE001
        logger.warning("avatar Supabase upload failed for %s: %s", yc_user_id, e)
    try:
        os.makedirs(AVATAR_DIR, exist_ok=True)
        with open(os.path.join(AVATAR_DIR, key), "wb") as fh:
            fh.write(data)
        return f"/{AVATAR_SUBPATH}/{key}"
    except Exception as e:  # noqa: BLE001
        logger.warning("avatar local write failed for %s: %s", yc_user_id, e)
        return avatar_url


def sync_founders(db, slugs: Optional[list[str]] = None, full: bool = False,
                  limit: Optional[int] = None) -> dict[str, Any]:
    """Scrape YC founders and persist them into the DB (spec §5.1).

    Args:
        db: the database instance (SQLite or Postgres) from database_factory.
        slugs: explicit company slugs to scrape; when None, selects companies
            from the DB (see ``limit``).
        full: forces a full rebuild (ignores any incremental cursor / limit).
        limit: bounded incremental batch size. When ``slugs is None``, ``limit``
            is set, and ``not full``, select only up to ``limit`` YC companies that
            have never been sourced (no founder edges yet) via
            ``db.get_unsourced_yc_company_slugs`` — so the nightly cron drains the
            backlog over time instead of re-scraping every company each run. When
            ``limit`` is None (the default), the full ``source='yc'`` set is used
            and behavior is unchanged.

    Returns a summary dict: founders upserted, edges linked, companies scraped.
    """
    # 1. Determine the input set of company slugs.
    if slugs is None:
        try:
            if limit is not None and not full and hasattr(db, "get_unsourced_yc_company_slugs"):
                # Bounded incremental: only not-yet-sourced YC companies, most notable first.
                rows = db.get_unsourced_yc_company_slugs(limit)
            else:
                rows = db.get_yc_company_slugs()
        except Exception as e:  # noqa: BLE001
            logger.error("sync_founders: could not read YC company slugs: %s", e)
            raise
        slug_to_company_id = {r["slug"]: r["id"] for r in rows if r.get("slug")}
        slugs = list(slug_to_company_id.keys())
    else:
        slug_to_company_id = {}

    if not slugs:
        logger.info("sync_founders: no company slugs to scrape")
        if hasattr(db, "save_sync_state"):
            db.save_sync_state(SYNC_SOURCE_KEY, None, "ok", 0)
        return {"founders_upserted": 0, "edges_linked": 0, "companies_scraped": 0}

    # 2. Scrape (existing dedup logic) -> {yc_user_id: Founder}.
    scraper = FounderScraper()
    logger.info("sync_founders: scraping %d YC companies for founders (full=%s)",
                len(slugs), full)
    founders = scraper.scrape(slugs)

    founders_upserted = 0
    edges_linked = 0
    avatars_seen: set[int] = set()

    # 3. Upsert founders + edges.
    for uid, f in founders.items():
        try:
            # Re-host the avatar once per founder (spec §5.4).
            avatar_url = f.avatar_url
            if uid not in avatars_seen:
                avatar_url = _rehost_avatar(f.avatar_url, uid)
                avatars_seen.add(uid)

            founder_id = db.upsert_founder({
                "yc_user_id": f.yc_user_id,
                "full_name": f.full_name,
                "slug": f.slugify(),
                "bio": f.bio,
                "avatar_url": avatar_url,
                "linkedin_url": f.linkedin_url,
                "twitter_url": f.twitter_url,
                "is_active": f.is_active,
            })
            founders_upserted += 1

            for edge in f.companies:
                company_id = slug_to_company_id.get(edge.slug)
                if company_id is None:
                    company_id = db.get_company_id_by_slug(edge.slug)
                if company_id is None:
                    # Company isn't in our DB (e.g. an ad-hoc slug list). Skip the edge
                    # rather than fabricate a company row.
                    logger.debug("sync_founders: no company row for slug=%s; skipping edge",
                                 edge.slug)
                    continue
                db.link_company_founder(company_id, founder_id, edge.title, source="yc")
                edges_linked += 1
        except Exception as e:  # noqa: BLE001 — one bad founder must not sink the run
            logger.warning("sync_founders: skipped founder yc_user_id=%s: %s", uid, e)

    # 4. Refresh derived stats (materialized view in PG, recomputed table in SQLite).
    try:
        db.refresh_founder_stats()
    except Exception as e:  # noqa: BLE001
        logger.error("sync_founders: refresh_founder_stats failed (non-fatal): %s", e)

    # 5. Record the incremental cursor if the sync_state pattern exists.
    if hasattr(db, "save_sync_state"):
        try:
            db.save_sync_state(SYNC_SOURCE_KEY, None, "ok", founders_upserted)
        except Exception as e:  # noqa: BLE001
            logger.warning("sync_founders: save_sync_state failed: %s", e)

    summary = {
        "founders_upserted": founders_upserted,
        "edges_linked": edges_linked,
        "companies_scraped": len(slugs),
    }
    logger.info("sync_founders: %s", summary)
    return summary


# Default demo set — a mix chosen so serial founders (same user_id across two YC
# companies) show up and dedup is visibly working.
DEMO_SLUGS = [
    "reddit", "hipmunk",        # Steve Huffman — serial
    "twitch", "socialcam",      # Justin Kan / Michael Seibel — serial
    "stripe", "airbnb", "dropbox", "coinbase", "doordash", "gitlab",
]


def _fmt_founder(rank: int, f: Founder) -> str:
    lines = [f"#{rank}  {f.full_name}   (yc_user_id={f.yc_user_id})"]
    if f.title:
        lines.append(f"      title:      {f.title}")
    serial = "  ⭐ SERIAL FOUNDER" if f.is_repeat_founder else ""
    lines.append(f"      companies:  {f.companies_count}{serial}")
    for c in f.companies:
        bits = " · ".join(x for x in [c.batch, c.status, c.location] if x)
        lines.append(f"        - {c.name} ({bits})  [{c.title or 'Founder'}]")
    if f.batches:
        lines.append(f"      batches:    {', '.join(f.batches)}")
    socials = " ".join(x for x in [
        f"linkedin={bool(f.linkedin_url)}", f"twitter={bool(f.twitter_url)}",
        f"avatar={bool(f.avatar_url)}"] )
    lines.append(f"      signals:    {socials}")
    if f.bio:
        lines.append(f"      bio:        {f.bio[:120]}")
    return "\n".join(lines)


def main() -> None:
    slugs = sys.argv[1:] or DEMO_SLUGS
    print(f"Scraping {len(slugs)} YC companies for founders...", file=sys.stderr)
    scraper = FounderScraper()
    founders = scraper.scrape(slugs)

    # rank: serial founders first, then by name — a stand-in until funding stats join in
    ranked = sorted(founders.values(), key=lambda f: (-f.companies_count, f.full_name))
    top = ranked[:10]

    print("\n" + "=" * 72)
    print(f"CENTRALIZED FOUNDER DATASET — detailed view (top 10 of {len(founders)})")
    print("=" * 72)
    for i, f in enumerate(top, 1):
        print(_fmt_founder(i, f))
        print("-" * 72)

    # JSON dump for downstream rendering / verification
    out = {
        "founder_count": len(founders),
        "companies_scraped": len(slugs),
        "founders": [
            {**{k: v for k, v in asdict(f).items() if k != "companies"},
             "companies": [asdict(c) for c in f.companies],
             "companies_count": f.companies_count,
             "batches": f.batches,
             "is_repeat_founder": f.is_repeat_founder,
             "slug": f.slugify()}
            for f in top
        ],
    }
    dump_path = sys.argv[0].rsplit("/", 1)[0] + "/../founders_demo.json" if "/" in sys.argv[0] else "founders_demo.json"
    with open(dump_path, "w") as fh:
        json.dump(out, fh, indent=2)
    print(f"\nJSON written: {dump_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
