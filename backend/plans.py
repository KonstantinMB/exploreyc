"""
Public API plans — single source of truth for rate limits and tier metadata.

The `plan` column on api_users drives everything. `verify_api_key` reads PLAN_LIMITS
to enforce the daily cap; the dashboard/admin read PLAN_META for display; the Stripe
webhook (billing.py) maps a purchased price back to a plan key and calls
set_api_user_plan.

Ladder: free (5/day) → pro ($50, 500/day) → max ($500, 5,000/day) → unlimited
(no cap; admin-granted only, never purchasable — Stripe never touches it).

Daily limits are per rolling 24h window. A limit of None means uncapped.

Legacy keys (starter/pro/enterprise from the pre-Stripe ladder) are remapped by
migration: 20260908000000_stripe_billing_plans.sql on Postgres, a PRAGMA
user_version-guarded remap in database.py on SQLite.
"""

import os
from typing import Dict, Optional

DEFAULT_PLAN = "free"

# Requests allowed per rolling 24h window, per API key. None = uncapped.
PLAN_LIMITS: Dict[str, Optional[int]] = {
    "free": 5,
    "pro": 500,
    "max": 5_000,
    "unlimited": None,
}

# Display / billing metadata. Price IDs come from env so test/live mode is a
# config change, not a deploy.
PLAN_META: Dict[str, Dict] = {
    "free": {"name": "Free", "price_usd_month": 0, "stripe_price_id": None},
    "pro": {"name": "Pro", "price_usd_month": 50,
            "stripe_price_id": os.getenv("STRIPE_PRICE_PRO") or None},
    "max": {"name": "Max", "price_usd_month": 500,
            "stripe_price_id": os.getenv("STRIPE_PRICE_MAX") or None},
    "unlimited": {"name": "Unlimited", "price_usd_month": None, "stripe_price_id": None},
}

# Plans a user can buy through Stripe Checkout. `unlimited` is deliberately
# excluded — it exists only as an admin grant.
PURCHASABLE_PLANS = ("pro", "max")


def plan_limit(plan: str) -> Optional[int]:
    """Daily request limit for a plan key (None = uncapped), falling back to free."""
    if (plan or DEFAULT_PLAN) in PLAN_LIMITS:
        return PLAN_LIMITS[plan or DEFAULT_PLAN]
    return PLAN_LIMITS[DEFAULT_PLAN]


def is_valid_plan(plan: str) -> bool:
    return plan in PLAN_LIMITS


def plan_for_price(price_id: str) -> Optional[str]:
    """Map a Stripe price ID back to a purchasable plan key (webhook direction)."""
    if not price_id:
        return None
    for key in PURCHASABLE_PLANS:
        if PLAN_META[key].get("stripe_price_id") == price_id:
            return key
    return None


def public_plans() -> list:
    """Plan list for the pricing UI. Never leaks price IDs; flags purchasability."""
    return [
        {
            "key": key,
            "name": PLAN_META[key]["name"],
            "price_usd_month": PLAN_META[key]["price_usd_month"],
            "daily_limit": PLAN_LIMITS[key],
            "purchasable": key in PURCHASABLE_PLANS and bool(PLAN_META[key].get("stripe_price_id")),
        }
        for key in PLAN_LIMITS
        if key != "unlimited"
    ]
