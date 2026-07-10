#!/usr/bin/env python3
"""
Tests for DatabasePostgres embedding helpers:
  - build_company_embedding_text (staticmethod)
  - get_companies_for_embedding (instance method — not tested here; requires live DB)

Run: python3 test_embedding_batch.py
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))
from database_postgres import DatabasePostgres


def test_build_company_embedding_text_includes_all_signal_fields():
    text = DatabasePostgres.build_company_embedding_text({
        "name": "Litmus",
        "one_liner": "Async work trials for engineers",
        "long_description": "Run a real work trial on every candidate.",
        "industry": "B2B", "subindustry": "Recruiting",
        "tags": ["hiring", "devtools"], "industries": ["B2B", "HR Tech"],
    })
    for needle in ["Litmus", "Async work trials", "work trial", "B2B", "Recruiting", "hiring", "HR Tech"]:
        assert needle in text, f"Expected {needle!r} in text, got: {text!r}"


def test_build_company_embedding_text_skips_missing_fields():
    text = DatabasePostgres.build_company_embedding_text({"name": "X", "one_liner": None, "tags": []})
    assert text.strip() == "X", f"Expected 'X', got: {text!r}"


if __name__ == "__main__":
    test_build_company_embedding_text_includes_all_signal_fields()
    print("PASS: test_build_company_embedding_text_includes_all_signal_fields")

    test_build_company_embedding_text_skips_missing_fields()
    print("PASS: test_build_company_embedding_text_skips_missing_fields")
