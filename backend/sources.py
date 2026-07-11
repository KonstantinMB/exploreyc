"""
Source registry for multi-incubator / multi-VC company data.

ExploreYC started as Y-Combinator-only. This module generalizes the notion of a
"source" (an incubator or VC portfolio) so companies from YC, a16z, and future
funds can coexist in the single `companies` table.

Two collision problems are solved here:

1. ID collision — every source has its own native id space, and some overlap YC's
   Algolia id range (e.g. a16z uses ids like 371262 / 15049). The `companies.id`
   primary key is referenced by foreign keys, so we cannot just store the raw
   native id. Instead each source gets a reserved 1-billion-wide block in the
   BIGINT space and the stored `id` is `SOURCE_ID_OFFSETS[source] + int(native_id)`.
   YC keeps offset 0 so existing YC rows/ids/FKs are completely unchanged.

2. Slug collision — a16z's "pagerduty" could clash with a YC slug. Uniqueness is
   therefore enforced per-source: UNIQUE(source, slug) and UNIQUE(source, source_id)
   (see the schema migration), rather than a single global UNIQUE(slug).
"""

from typing import Dict

# Canonical source key -> display metadata. Add a new entry per incubator/VC.
SOURCES: Dict[str, Dict[str, str]] = {
    "yc": {"key": "yc", "display_name": "Y Combinator"},
    "a16z": {"key": "a16z", "display_name": "Andreessen Horowitz (a16z)"},
    "hackernews": {"key": "hackernews", "display_name": "Hacker News"},
    "producthunt": {"key": "producthunt", "display_name": "Product Hunt"},
    "techstars": {"key": "techstars", "display_name": "Techstars"},
}

# Default source for existing/unspecified rows (backward compatibility).
DEFAULT_SOURCE = "yc"

# Reserved 1e9-wide id blocks per source. YC = 0 so its ids stay = the Algolia id.
# Future sources: 3_000_000_000, 4_000_000_000, ... (BIGINT holds ~9.2e18 => ~9B blocks).
SOURCE_ID_OFFSETS: Dict[str, int] = {
    "yc": 0,
    "a16z": 2_000_000_000,
    "hackernews": 3_000_000_000,
    "producthunt": 4_000_000_000,
    "techstars": 5_000_000_000,
}

# Width of each source's reserved id block. The precondition for correctness is
# that every source's native ids stay below this width (YC Algolia ids and a16z
# ids are both well under 1e9).
SOURCE_BLOCK_WIDTH = 1_000_000_000


def is_known_source(source: str) -> bool:
    return source in SOURCES


def to_global_id(source: str, native_id) -> int:
    """Map a source's native id to the collision-free global `companies.id`.

    >>> to_global_id("yc", 12345)
    12345
    >>> to_global_id("a16z", "371262")
    2000371262
    """
    if source not in SOURCE_ID_OFFSETS:
        raise ValueError(f"Unknown source: {source!r}")
    return SOURCE_ID_OFFSETS[source] + int(native_id)


def from_global_id(global_id: int) -> tuple[str, int]:
    """Inverse of to_global_id: recover (source, native_id) from a stored id."""
    for source, offset in sorted(SOURCE_ID_OFFSETS.items(), key=lambda kv: kv[1], reverse=True):
        if global_id >= offset:
            return source, global_id - offset
    return DEFAULT_SOURCE, global_id
