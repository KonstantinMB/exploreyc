"""
Public API plans — single source of truth for rate limits and tier metadata.

The `plan` column on api_users drives everything. `verify_api_key` reads PLAN_LIMITS
to enforce the daily cap; the dashboard/admin read PLAN_META for display; a future
Stripe webhook maps a purchased price back to a plan key and calls set_api_user_plan.

Daily limits are per rolling 24h window. Free = 5/day (product requirement); paid
tiers are configurable — tune the numbers/prices without touching call sites.
"""

from typing import Dict

DEFAULT_PLAN = "free"

# Requests allowed per rolling 24h window, per API key.
PLAN_LIMITS: Dict[str, int] = {
    "free": 5,
    "starter": 500,
    "pro": 5_000,
    "enterprise": 50_000,
}

# Display / billing metadata. `stripe_price_id` is wired when Stripe lands (fast-follow).
PLAN_META: Dict[str, Dict] = {
    "free": {"name": "Free", "price_usd_month": 0, "stripe_price_id": None},
    "starter": {"name": "Starter", "price_usd_month": 29, "stripe_price_id": None},
    "pro": {"name": "Pro", "price_usd_month": 99, "stripe_price_id": None},
    "enterprise": {"name": "Enterprise", "price_usd_month": None, "stripe_price_id": None},
}


def plan_limit(plan: str) -> int:
    """Daily request limit for a plan key, falling back to the free tier."""
    return PLAN_LIMITS.get(plan or DEFAULT_PLAN, PLAN_LIMITS[DEFAULT_PLAN])


def is_valid_plan(plan: str) -> bool:
    return plan in PLAN_LIMITS
