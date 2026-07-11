"""Source-adapter contract for the multi-source sync.

An adapter fetches from one external source and returns rows already normalized
into ExploreYC's canonical column names (the same keys `insert_company` reads).

Adapter contract (duck-typed — no ABC needed):

    class MyAdapter:
        key = "mysource"            # matches sources.SOURCES / SOURCE_ID_OFFSETS
        display_name = "My Source"
        def fetch(self, cursor, full=False) -> FetchResult: ...

`cursor` is the last stored incremental cursor (str) or None on first run.
`full=True` requests a complete backfill (ignore the cursor).

Each row dict SHOULD carry: id (global, via sources.to_global_id), source,
source_id, source_url, name, slug, website, one_liner, long_description, batch,
tags/industries/regions (lists), isHiring (NOT is_hiring — that's the key
insert_company reads), top_company, nonprofit, country, dedupe_key, raw_json.
"""

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class FetchResult:
    rows: List[dict] = field(default_factory=list)
    cursor: Optional[str] = None
    removed_source_ids: List[str] = field(default_factory=list)
