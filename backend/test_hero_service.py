"""Unit tests for hero_service.build_verdict()

Run with:  python test_hero_service.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from hero_service import build_verdict


def _make_company(name, batch, slug="test", similarity=0.8, industry="B2B", is_hiring=True):
    return {
        "id": 1,
        "name": name,
        "slug": slug,
        "batch": batch,
        "industry": industry,
        "is_hiring": is_hiring,
        "similarity_score": similarity,
    }


def test_open_field():
    verdict = build_verdict("Some idea", [], 6000)
    assert verdict["meter"] == "open"
    assert verdict["total_similar"] == 0
    assert verdict["market_size_percentage"] == 0.0
    assert "Open field" in verdict["headline"]
    print("PASS test_open_field")


def test_emerging():
    similar = [_make_company("Acme", "W23", similarity=0.75)]
    verdict = build_verdict("Some idea", similar, 6000)
    assert verdict["meter"] == "emerging"
    assert verdict["total_similar"] == 1
    print("PASS test_emerging")


def test_competitive():
    similar = [_make_company(f"Co{i}", "W23", similarity=0.7) for i in range(6)]
    verdict = build_verdict("Some idea", similar, 6000)
    assert verdict["meter"] == "competitive"
    print("PASS test_competitive")


def test_crowded():
    similar = [_make_company(f"Co{i}", "S22", similarity=0.65) for i in range(12)]
    verdict = build_verdict("Some idea", similar, 6000)
    assert verdict["meter"] == "crowded"
    print("PASS test_crowded")


def test_market_size_percentage():
    similar = [_make_company(f"Co{i}", "W23", similarity=0.7) for i in range(10)]
    verdict = build_verdict("Some idea", similar, 1000)
    assert verdict["market_size_percentage"] == 1.0
    print("PASS test_market_size_percentage")


def test_closest_capped_at_3():
    similar = [_make_company(f"Co{i}", "W23", similarity=0.9 - i * 0.05) for i in range(6)]
    verdict = build_verdict("Some idea", similar, 6000)
    assert len(verdict["closest"]) == 3
    print("PASS test_closest_capped_at_3")


def test_null_batch_no_none_string():
    """A company with batch=None must NOT produce '(None)' in the verdict summary."""
    similar = [_make_company("NullBatchCo", None, similarity=0.85)]
    verdict = build_verdict("Some idea", similar, 6000)
    assert "(None)" not in verdict["summary"], (
        f"'(None)' found in summary: {verdict['summary']!r}"
    )
    assert "unknown" in verdict["summary"], (
        f"Expected 'unknown' batch label in summary: {verdict['summary']!r}"
    )
    print("PASS test_null_batch_no_none_string")


if __name__ == "__main__":
    test_open_field()
    test_emerging()
    test_competitive()
    test_crowded()
    test_market_size_percentage()
    test_closest_capped_at_3()
    test_null_batch_no_none_string()
    print("\nAll tests passed.")
