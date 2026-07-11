import os

from ingestion.producthunt import ProductHuntAdapter, _to_row
from ingestion import registry


def test_no_token_is_graceful_noop(monkeypatch):
    monkeypatch.delenv("PH_TOKEN", raising=False)
    result = ProductHuntAdapter().fetch(None)
    assert result.rows == []
    assert result.removed_source_ids == []


def _node(**kw):
    base = {
        "id": "455900", "name": "Acme AI", "tagline": "AI for dentists",
        "description": "Longer description", "url": "https://www.producthunt.com/posts/acme-ai",
        "website": "https://acme.ai", "slug": "acme-ai", "createdAt": "2026-07-10T12:00:00Z",
        "thumbnail": {"url": "https://ph/logo.png"},
        "topics": {"edges": [{"node": {"name": "Artificial Intelligence"}}]},
    }
    base.update(kw)
    return base


def test_maps_node_to_row():
    row = _to_row(_node())
    assert row["id"] == 4_000_455_900
    assert row["source"] == "producthunt"
    assert row["source_id"] == "455900"
    assert row["name"] == "Acme AI"
    assert row["dedupe_key"] == "acme.ai"           # merges with YC/HN on domain
    assert row["one_liner"] == "AI for dentists"
    assert row["industries"] == ["Artificial Intelligence"]
    assert row["small_logo_thumb_url"] == "https://ph/logo.png"
    assert row["tags"] == ["Product Hunt"]


def test_maps_ph_redirect_website_falls_back_to_source_slug():
    # PH sometimes returns its own redirect URL as the website -> denylisted host.
    row = _to_row(_node(website="https://www.producthunt.com/r/abc123", slug="acme-ai"))
    assert row["dedupe_key"] == "producthunt:acme-ai"


def test_node_without_name_is_dropped():
    assert _to_row(_node(name="")) is None


def test_registry_still_resolves_producthunt():
    assert registry.get_adapter("producthunt") is not None
