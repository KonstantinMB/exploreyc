"""Techstars source adapter (STUB).

Framework proof — implements the adapter contract but returns no rows yet.
To finish: scrape the Techstars portfolio (https://www.techstars.com/portfolio,
which hydrates from a JSON payload), map each company to a row with
source='techstars', website -> dedupe_key, program/batch -> batch, and
to_global_id('techstars', native_id). No incremental cursor upstream, so a
periodic full pull (full=True) is the expected mode.
"""

from ingestion.base import FetchResult


class TechstarsAdapter:
    key = "techstars"
    display_name = "Techstars"

    def fetch(self, cursor, full=False):
        # TODO: fetch the Techstars portfolio payload and map companies -> rows.
        return FetchResult(rows=[], cursor=cursor, removed_source_ids=[])
