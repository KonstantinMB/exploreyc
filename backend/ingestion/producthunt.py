"""Product Hunt source adapter (STUB).

Framework proof — implements the adapter contract but returns no rows yet.
To finish: use the Product Hunt GraphQL API
(https://api.producthunt.com/v2/api/graphql, needs a PH_TOKEN), page over
`posts` by `postedAfter` (cursor = last posted-at), and map each post to a row
with source='producthunt', website -> dedupe_key, tagline -> one_liner,
topics -> industries, and to_global_id('producthunt', post_numeric_id).
"""

from ingestion.base import FetchResult


class ProductHuntAdapter:
    key = "producthunt"
    display_name = "Product Hunt"

    def fetch(self, cursor, full=False):
        # TODO: fetch from the Product Hunt GraphQL API and map posts -> rows.
        return FetchResult(rows=[], cursor=cursor, removed_source_ids=[])
