"""Registry of source adapters. Add a source = add one import + entry here."""

from ingestion.hackernews import HackerNewsAdapter
from ingestion.producthunt import ProductHuntAdapter
from ingestion.techstars import TechstarsAdapter

ADAPTERS = {
    a.key: a for a in (
        HackerNewsAdapter(),
        ProductHuntAdapter(),
        TechstarsAdapter(),
    )
}


def get_adapter(key):
    return ADAPTERS.get(key)
