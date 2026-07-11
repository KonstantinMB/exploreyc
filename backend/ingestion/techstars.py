"""Techstars source adapter (STUB — no stable public data source found).

Investigated 2026-07-11: https://www.techstars.com/portfolio is a Next.js app
that renders the company grid CLIENT-SIDE. The portfolio companies are NOT in
the initial `__NEXT_DATA__` payload, there is no public JSON/GraphQL API or
Algolia index exposed in the HTML, and there is no portfolio sitemap to
enumerate `/portfolio/<slug>` pages. The fetch happens from a minified webpack
bundle against an endpoint we could not pin down without reverse-engineering.

Rather than ship a fragile scraper that breaks on the next site deploy, this is
left as a graceful no-op. To finish, EITHER:
  * discover the XHR the `[slug]` bundle calls (Network tab) and query it here, OR
  * render the page with a headless browser and read the hydrated grid, OR
  * ingest a maintained Techstars dataset (e.g. a periodic CSV export).
Then map each company to a row with source='techstars', website -> dedupe_key,
program/batch -> batch, and to_global_id('techstars', native_id).
"""

import logging

from ingestion.base import FetchResult

logger = logging.getLogger(__name__)


class TechstarsAdapter:
    key = "techstars"
    display_name = "Techstars"

    def fetch(self, cursor, full=False):
        logger.info("Techstars adapter has no data source wired yet — skipping (no-op).")
        return FetchResult(rows=[], cursor=cursor, removed_source_ids=[])
