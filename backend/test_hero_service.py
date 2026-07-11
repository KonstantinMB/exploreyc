from hero_service import build_verdict


def _c(**kw):
    base = {"name": "Acme", "slug": "acme", "batch": "S24", "industry": "AI",
            "is_hiring": True, "similarity_score": 0.8}
    base.update(kw)
    return base


def test_verdict_copy_is_source_agnostic():
    v = build_verdict("ai for dentists", [_c()], portfolio_total=1000)
    assert "YC" not in v["headline"], v["headline"]
    assert "YC" not in v["summary"], v["summary"]
    assert "overlap" in v["headline"]
    assert v["total_similar"] == 1
    assert v["market_size_percentage"] == round(1 / 1000 * 100, 2)


def test_verdict_empty_has_no_yc_wording():
    v = build_verdict("a genuinely novel idea", [], portfolio_total=1000)
    assert v["total_similar"] == 0
    assert "YC" not in v["headline"]
    assert "YC" not in v["summary"]
    assert "no close matches" in v["headline"]
