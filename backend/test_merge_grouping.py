from company_cache import CompanyCache


def _c(**kw):
    base = {
        "id": 0, "source": "yc", "dedupe_key": "acme.com", "name": "Acme",
        "one_liner": None, "is_hiring": False, "created_at": "2026-01-01",
        "small_logo_thumb_url": None, "source_url": None,
    }
    base.update(kw)
    return base


def test_merge_collapses_same_domain_with_badges():
    cache = CompanyCache()
    cache._build_cache([
        _c(id=1, source="yc", one_liner="YC one liner", source_url="yc/acme"),
        _c(id=3_000_000_001, source="hackernews", one_liner=None,
           is_hiring=True, source_url="hn/1"),
    ])
    rows = cache.get_companies(merged=True, source="all")
    acme = [r for r in rows if r["dedupe_key"] == "acme.com"]
    assert len(acme) == 1
    assert acme[0]["source"] == "yc"                     # yc wins primary
    assert acme[0]["is_hiring"] is True                  # OR across the group
    assert acme[0]["one_liner"] == "YC one liner"        # primary keeps its value
    assert {s["key"] for s in acme[0]["merged_sources"]} == {"yc", "hackernews"}


def test_merge_gap_fills_missing_fields_from_other_source():
    cache = CompanyCache()
    cache._build_cache([
        _c(id=1, source="yc", one_liner=None, small_logo_thumb_url=None),
        _c(id=3_000_000_001, source="hackernews",
           one_liner="HN blurb", small_logo_thumb_url="logo.png"),
    ])
    row = cache.get_companies(merged=True, source="all")[0]
    assert row["source"] == "yc"                          # primary is still YC
    assert row["one_liner"] == "HN blurb"                 # gap-filled from HN
    assert row["small_logo_thumb_url"] == "logo.png"


def test_merged_false_keeps_rows_separate():
    cache = CompanyCache()
    cache._build_cache([
        _c(id=1, source="yc"),
        _c(id=3_000_000_001, source="hackernews"),
    ])
    assert len(cache.get_companies(merged=False, source="all")) == 2


def test_default_view_unaffected_by_merge_code():
    # source=None must remain YC-only whether or not merged is requested.
    cache = CompanyCache()
    cache._build_cache([
        _c(id=1, source="yc"),
        _c(id=3_000_000_001, source="hackernews", dedupe_key="other.com"),
    ])
    assert len(cache.get_companies(merged=False)) == 1
    assert len(cache.get_companies(merged=True)) == 1


def test_rows_without_dedupe_key_stand_alone():
    cache = CompanyCache()
    cache._build_cache([
        _c(id=1, source="yc", dedupe_key=None),
        _c(id=2, source="yc", dedupe_key=None),
    ])
    assert len(cache.get_companies(merged=True, source="all")) == 2


def test_count_companies_merged():
    cache = CompanyCache()
    cache._build_cache([
        _c(id=1, source="yc", source_url="yc/acme"),
        _c(id=3_000_000_001, source="hackernews", source_url="hn/1"),
    ])
    assert cache.count_companies(merged=True, source="all") == 1
    assert cache.count_companies(merged=False, source="all") == 2


def test_logo_having_companies_sort_first():
    cache = CompanyCache()
    cache._build_cache([
        # newer, but NO logo (Hacker News)
        _c(id=1, source="hackernews", dedupe_key="a.com",
           small_logo_thumb_url=None, created_at="2026-05-01"),
        # older, but HAS a logo (YC)
        _c(id=2, source="yc", dedupe_key="b.com",
           small_logo_thumb_url="https://logo.png", created_at="2026-01-01"),
    ])
    rows = cache.get_companies(source="all")
    assert [r["id"] for r in rows] == [2, 1]  # logo-having first despite being older


def test_logo_priority_holds_in_merged_view():
    cache = CompanyCache()
    cache._build_cache([
        _c(id=1, source="hackernews", dedupe_key="a.com",
           small_logo_thumb_url=None, created_at="2026-05-01", source_url="hn/1"),
        _c(id=2, source="yc", dedupe_key="b.com",
           small_logo_thumb_url="https://logo.png", created_at="2026-01-01", source_url="yc/2"),
    ])
    rows = cache.get_companies(source="all", merged=True)
    assert rows[0]["dedupe_key"] == "b.com"  # the logo-having canonical row leads
