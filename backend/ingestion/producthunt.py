"""Product Hunt source adapter.

Pulls newly-launched products from the Product Hunt GraphQL API v2 and maps them
into ExploreYC company rows. Requires a developer token in the PH_TOKEN env var
(create one at https://www.producthunt.com/v2/oauth/applications — "developer
token" is enough for read-only queries). Without a token this adapter is a safe
no-op so the sync run doesn't fail.

Incremental: the cursor is the ISO timestamp of the newest product seen; the next
run only asks for products `postedAfter` that time.
"""

import json
import logging
import os
import time
import urllib.request

from ingestion.base import FetchResult
from ingestion.normalize import norm_domain, slugify, dedupe_key
from sources import to_global_id

logger = logging.getLogger(__name__)

_GRAPHQL = "https://api.producthunt.com/v2/api/graphql"
_PAGE_SIZE = 50
_MAX_PAGES = 10  # cap per run to respect PON complexity/rate limits

_QUERY = """
query($after: String, $postedAfter: DateTime) {
  posts(order: NEWEST, first: %d, after: $after, postedAfter: $postedAfter) {
    pageInfo { hasNextPage endCursor }
    edges {
      node {
        id name tagline description url website slug createdAt
        thumbnail { url }
        topics(first: 5) { edges { node { name } } }
      }
    }
  }
}
""" % _PAGE_SIZE


def _graphql(token, variables):
    body = json.dumps({"query": _QUERY, "variables": variables}).encode()
    req = urllib.request.Request(
        _GRAPHQL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": f"Bearer {token}",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = json.loads(resp.read().decode())
    if payload.get("errors"):
        raise RuntimeError(f"Product Hunt GraphQL errors: {payload['errors']}")
    return payload["data"]["posts"]


def _to_row(node):
    name = (node.get("name") or "").strip()
    if not name:
        return None
    slug = node.get("slug") or slugify(name)
    domain = norm_domain(node.get("website"))
    topics = [
        e["node"]["name"]
        for e in (node.get("topics", {}) or {}).get("edges", [])
        if e.get("node", {}).get("name")
    ]
    # Product Hunt provides a real thumbnail; if absent, leave null (no broken
    # Clearbit fallback) so the row sorts after logo-having companies.
    thumb = (node.get("thumbnail") or {}).get("url")
    return {
        "id": to_global_id("producthunt", int(node["id"])),
        "source": "producthunt",
        "source_id": str(node["id"]),
        "source_url": node.get("url"),
        "name": name,
        "slug": slug,
        "website": node.get("website"),
        "one_liner": node.get("tagline"),
        "long_description": node.get("description"),
        "batch": None,
        "tags": ["Product Hunt"],
        "industries": topics,
        "regions": [],
        "isHiring": False,
        "top_company": False,
        "nonprofit": False,
        "country": None,
        "small_logo_thumb_url": thumb,
        "launched_at": node.get("createdAt"),
        "dedupe_key": dedupe_key(domain, "producthunt", slug),
        "raw_json": node,
    }


class ProductHuntAdapter:
    key = "producthunt"
    display_name = "Product Hunt"

    def fetch(self, cursor, full=False):
        token = (os.environ.get("PH_TOKEN") or "").strip()
        if not token:
            logger.warning("PH_TOKEN not set — skipping Product Hunt sync (no-op).")
            return FetchResult(rows=[], cursor=cursor, removed_source_ids=[])

        # First run (or full): look back a bounded window; else only new since cursor.
        posted_after = None if (full or not cursor) else cursor
        if posted_after is None and not full:
            lookback_days = 30
            posted_after = time.strftime(
                "%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - lookback_days * 86400)
            )

        rows, after, newest = [], None, cursor
        for _ in range(_MAX_PAGES):
            posts = _graphql(token, {"after": after, "postedAfter": posted_after})
            for edge in posts.get("edges", []):
                node = edge.get("node") or {}
                created = node.get("createdAt")
                if created and (newest is None or created > newest):
                    newest = created
                row = _to_row(node)
                if row:
                    rows.append(row)
            page = posts.get("pageInfo", {})
            if not page.get("hasNextPage"):
                break
            after = page.get("endCursor")

        return FetchResult(rows=rows, cursor=newest, removed_source_ids=[])
