#!/usr/bin/env python3
"""
Unit test for the daily digest HTML renderer.

Regression guard for the bug where `_render_daily_digest` referenced an
undefined bare `render_section(...)` (instead of `self._render_section`),
raising NameError. Because `send_daily_digest` swallows render exceptions and
returns False, every scheduled digest silently sent 0 emails for weeks.

Run: python -m pytest test_digest_render.py   (or: python test_digest_render.py)
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from email_service import EmailService  # noqa: E402


def _service():
    svc = EmailService()
    # __init__ returns early (and skips these) when RESEND_API_KEY is unset;
    # set them directly so we can exercise pure rendering without credentials.
    svc.from_email = "ExploreYC <digest@exploreyc.com>"
    svc.frontend_url = "https://exploreyc.com"
    return svc


NEW_COMPANIES = [
    {
        "id": 1,
        "name": "Litmus",
        "batch": "Summer 2026",
        "one_liner": "Run an async work trial on every engineer you interview.",
        "website": "https://litmushiring.com/",
        "slug": "litmus-build",
        "logo": "",
    }
]

NEWLY_HIRING = [
    {
        "id": 2,
        "name": "Soren",
        "batch": "Fall 2025",
        "one_liner": "AI Transformation for Regulated Institutions",
        "website": "https://usesoren.com",
        "slug": "soren",
        "logo": "",
        "is_hiring": True,
    }
]

BATCH_CHANGES = [
    {"id": 3, "name": "Acme", "old_batch": "Winter 2025", "new_batch": "Summer 2026", "slug": "acme"}
]


def test_render_daily_digest_does_not_raise():
    """The renderer must produce HTML for real change data without raising."""
    svc = _service()
    html = svc._render_daily_digest(
        new_companies=NEW_COMPANIES,
        newly_hiring=NEWLY_HIRING,
        batch_changes=BATCH_CHANGES,
        unsubscribe_link="https://exploreyc.com/unsubscribe?token=abc",
    )
    assert isinstance(html, str) and html
    # Each section's data must actually appear in the output.
    assert "Litmus" in html
    assert "Soren" in html
    assert "new companies (1)" in html
    assert "now hiring (1)" in html
    assert "batch updates (1)" in html


if __name__ == "__main__":
    test_render_daily_digest_does_not_raise()
    print("PASS: digest renders without error")
