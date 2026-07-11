from ingestion.hackernews import parse_title, HackerNewsAdapter, clean_hn_text
from ingestion import registry


def test_clean_hn_text_decodes_entities_and_strips_tags():
    raw = ('Hey, we&#x27;re building '
           '<a href="https:&#x2F;&#x2F;sonarly.com" rel="nofollow">https:&#x2F;&#x2F;sonarly.com</a>.'
           '<p>Second paragraph.')
    out = clean_hn_text(raw)
    assert "<a" not in out and "<p>" not in out
    assert "&#x27;" not in out and "&#x2F;" not in out
    assert "we're building https://sonarly.com." in out
    assert "\n\nSecond paragraph." in out
    assert clean_hn_text(None) is None
    assert clean_hn_text("") is None


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
    assert row["dedupe_key"] == "acme.com"       # merges on domain when present
    assert row["slug"] == "acme-42"              # slug is unique (name + HN id)
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


def test_to_row_shared_host_stays_distinct_by_id():
    # A shared host (github.io) can't merge, so each post is distinct by its id.
    row = HackerNewsAdapter()._to_row(_hit(
        title="Show HN: MyProj – a tool", url="https://myproj.github.io", objectID="7",
    ))
    assert row["dedupe_key"] == "hackernews:7"


def test_same_name_posts_get_unique_slugs_no_collision():
    # Regression: two different posts named "Inconvo" must NOT collide on (source, slug).
    a = HackerNewsAdapter()._to_row(_hit(
        title="Launch HN: Inconvo (YC S26) – a", url="https://inconvo.com", objectID="100",
    ))
    b = HackerNewsAdapter()._to_row(_hit(
        title="Show HN: Inconvo – b", url="https://inconvo.com", objectID="200",
    ))
    assert a["slug"] != b["slug"]                 # unique -> no UNIQUE(source, slug) violation
    assert a["slug"] == "inconvo-100" and b["slug"] == "inconvo-200"
    assert a["dedupe_key"] == b["dedupe_key"] == "inconvo.com"  # same domain still merges


def test_to_row_has_no_logo_and_cleans_description():
    row = HackerNewsAdapter()._to_row(_hit(
        story_text="We&#x27;re here.<p>Line two.",
    ))
    # No fake logo (Clearbit was broken) — HN rows sort after logo-having companies.
    assert row["small_logo_thumb_url"] is None
    assert row["long_description"] == "We're here.\n\nLine two."


def test_registry_has_all_adapters():
    for k in ("hackernews", "producthunt", "techstars"):
        assert registry.get_adapter(k) is not None
