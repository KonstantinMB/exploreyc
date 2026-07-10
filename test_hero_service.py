#!/usr/bin/env python3
"""
Unit tests for hero_service.build_verdict — the deterministic verdict brain.

Pure-function tests: no I/O, no LLM, no DB.
Run: python3 test_hero_service.py   (or: python -m pytest test_hero_service.py)
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from hero_service import build_verdict


def _co(name, sim, batch="Summer 2026", industry="B2B", hiring=False, cid=1, slug=None):
    return {"id": cid, "name": name, "slug": slug or name.lower(), "batch": batch,
            "industry": industry, "is_hiring": hiring, "similarity_score": sim}


def test_open_space_when_no_matches():
    v = build_verdict("quantum toothbrush", [], portfolio_total=6000)
    assert v["meter"] == "open"
    assert v["total_similar"] == 0
    assert "first" in v["summary"].lower() or "no " in v["summary"].lower()


def test_crowded_meter_and_names_closest():
    sims = [_co(f"C{i}", 0.7 - i*0.01, cid=i) for i in range(14)]
    v = build_verdict("ai code review", sims, portfolio_total=6000)
    assert v["meter"] == "crowded"
    assert v["total_similar"] == 14
    assert [c["name"] for c in v["closest"]] == ["C0", "C1", "C2"]
    assert "C0" in v["summary"]


def test_meter_thresholds():
    assert build_verdict("x", [_co("A", .6)], 6000)["meter"] == "emerging"
    assert build_verdict("x", [_co(f"n{i}", .6, cid=i) for i in range(6)], 6000)["meter"] == "competitive"


def test_market_size_percentage():
    v = build_verdict("x", [_co("A", .6)], portfolio_total=200)
    assert v["market_size_percentage"] == 0.5


def test_null_batch_no_none_string():
    # A company with batch=None must not render "(None)" in the summary.
    v = build_verdict("x", [_co("NullBatchCo", 0.85, batch=None)], portfolio_total=6000)
    assert "(None)" not in v["summary"], v["summary"]
    assert "unknown" in v["summary"], v["summary"]


if __name__ == "__main__":
    tests = [
        test_open_space_when_no_matches,
        test_crowded_meter_and_names_closest,
        test_meter_thresholds,
        test_market_size_percentage,
        test_null_batch_no_none_string,
    ]
    failed = 0
    for t in tests:
        try:
            t()
            print(f"PASS: {t.__name__}")
        except Exception as e:
            print(f"FAIL: {t.__name__} — {e}")
            failed += 1
    if failed:
        sys.exit(1)
