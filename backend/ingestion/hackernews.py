"""Hacker News source adapter — Launch HN / Show HN posts.

Ports the sync-PR's HN parsing into a native Python adapter. Uses the HN Algolia
search_by_date endpoint (no key) filtered on created_at_i for incremental pulls.
"""

import json
import re
import time
import urllib.parse
import urllib.request

from ingestion.base import FetchResult
from ingestion.normalize import norm_domain, slugify, dedupe_key
from sources import to_global_id

_SEARCH = "https://hn.algolia.com/api/v1/search_by_date"
_MAX_PAGES = 20
_HITS_PER_PAGE = 100


def parse_title(title):
    """Parse 'Launch HN: Acme (YC S26) – blurb' -> {name, batch, blurb}.

    Falls back gracefully when the format varies.
    """
    body = re.sub(r"^\s*(launch|show)\s+hn:\s*", "", title or "", flags=re.I).strip()
    segs = re.split(r"\s+[–—-]\s+", body, maxsplit=1)
    head = segs[0].strip() if segs else body
    blurb = segs[1].strip() if len(segs) > 1 else None
    m = re.search(r"\(YC\s+([A-Za-z]\d{2})\)", head, re.I)
    batch = m.group(1).upper() if m else None
    name = re.sub(r"\s*\(YC\s+[A-Za-z]\d{2}\)\s*", "", head, flags=re.I)
    name = re.sub(r"\s*\([^)]*\)\s*$", "", name).strip()
    return {"name": name or head, "batch": batch, "blurb": blurb}


def _get(url):
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
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
        # Require a real domain OR a YC-batch marker to count as a company (drops noise).
        if not domain and not parsed["batch"]:
            return None
        object_id = str(hit["objectID"])
        # slugify(name) is NOT unique across posts (two products can share a name, or
        # the same one is reposted), but the DB enforces UNIQUE(source, slug). Suffix
        # the unique HN item id so distinct posts never collide on (source, slug).
        base_slug = slugify(name) or object_id
        slug = f"{base_slug}-{object_id}"
        is_launch = bool(re.match(r"^\s*launch\s+hn", hit.get("title", ""), re.I))
        tag = "Launch HN" if is_launch else "Show HN"
        return {
            "id": to_global_id("hackernews", int(object_id)),
            "source": "hackernews",
            "source_id": object_id,
            "source_url": f"https://news.ycombinator.com/item?id={object_id}",
            "name": name,
            "slug": slug,
            "website": hit.get("url"),
            "one_liner": parsed["blurb"],
            "long_description": hit.get("story_text"),
            "batch": parsed["batch"],
            "tags": [tag],
            "industries": [],
            "regions": [],
            "isHiring": False,
            "top_company": False,
            "nonprofit": False,
            "country": None,
            # Merge on domain when present; otherwise keep each post distinct (by id) —
            # domainless posts can't be reliably merged by name without false positives.
            "dedupe_key": dedupe_key(domain, "hackernews", object_id),
            "raw_json": hit,
        }

    def fetch(self, cursor, full=False):
        lookback_days = 3650 if full else 30
        since = int(cursor) if cursor else int(time.time()) - lookback_days * 86400
        seen = set()
        rows = []
        max_ts = since
        for query in ('"Launch HN"', '"Show HN"'):
            for page in range(_MAX_PAGES):
                url = (
                    f"{_SEARCH}?query={urllib.parse.quote(query)}&tags=story"
                    f"&numericFilters=created_at_i>{since}"
                    f"&hitsPerPage={_HITS_PER_PAGE}&page={page}"
                )
                data = _get(url)
                for hit in data.get("hits", []):
                    oid = hit.get("objectID")
                    if not oid or oid in seen:
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
