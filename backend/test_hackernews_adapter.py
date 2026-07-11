from ingestion.hackernews import parse_title, HackerNewsAdapter
from ingestion import registry


def test_parse_launch_with_yc_batch():
    r = parse_title("Launch HN: Acme (YC S26) – AI for dentists")
    assert r["name"] == "Acme"
    assert r["batch"] == "S26"
    assert "dentists" in r["blurb"]


def test_parse_show_hn_no_batch():
    r = parse_title("Show HN: Bpar – a faster bundler")
    assert r["name"] == "Bpar"
    assert r["batch"] is None
    assert r["blurb"] == "a faster bundler"


def test_parse_hyphen_and_trailing_paren():
    r = parse_title("Launch HN: Nimbus (YC W24) - weather API (open source)")
    assert r["name"] == "Nimbus"
    assert r["batch"] == "W24"


def _hit(**kw):
    base = {
        "objectID": "42", "title": "Launch HN: Acme (YC S26) – x",
        "url": "https://acme.com", "created_at_i": 1700000000,
        "author": "pg", "points": 10, "num_comments": 3, "story_text": None,
    }
    base.update(kw)
    return base


def test_to_row_sets_source_and_key():
    row = HackerNewsAdapter()._to_row(_hit())
    assert row["source"] == "hackernews"
    assert row["source_id"] == "42"
    assert row["id"] == 3_000_000_042
    assert row["dedupe_key"] == "acme.com"
    assert row["batch"] == "S26"
    assert row["isHiring"] is False
    assert row["tags"] == ["Launch HN"]
    assert row["source_url"].endswith("id=42")


def test_to_row_drops_noise_without_domain_or_batch():
    # A Show HN with no URL and no YC batch is not a company.
    row = HackerNewsAdapter()._to_row(_hit(
        title="Show HN: My weekend project", url=None, objectID="99",
    ))
    assert row is None


def test_to_row_shared_host_falls_back_to_source_slug():
    row = HackerNewsAdapter()._to_row(_hit(
        title="Show HN: MyProj – a tool", url="https://myproj.github.io", objectID="7",
    ))
    assert row["dedupe_key"] == "hackernews:myproj"


def test_registry_has_all_adapters():
    for k in ("hackernews", "producthunt", "techstars"):
        assert registry.get_adapter(k) is not None
