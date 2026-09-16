"""
ExploreYC World — gamification and pricing constants.

Single source of truth for the backend; mirrored in a frontend constants
module. Changing a price here requires no migration — promotions store their
amount at purchase time.
"""

# Minimum stake to claim a plot, and the floor for every top-up ($5.00).
MIN_STAKE_CENTS = 500

# How much more than the current leader a challenger must stake to take a
# rank ("cents to beat" = leader + margin).
OVERTAKE_MARGIN_CENTS = 100

# A plot snaps to the nearest seeded city within this radius; beyond it the
# plot belongs to the country only (city_id NULL).
CITY_SNAP_RADIUS_KM = 50

# Promotion tiers: tier key -> (duration_days, price_cents). Launch pricing:
# 7 days $19, 30 days $49.
PROMOTION_TIERS = {
    "7d": {"days": 7, "amount_cents": 1900},
    "30d": {"days": 30, "amount_cents": 4900},
}

# Scarcity cap: max concurrently active 'featured' promotions per country.
# Global scope (country_iso NULL) counts as its own separate pool.
MAX_ACTIVE_FEATURED_PER_COUNTRY = 3

# ---------------------------------------------------------------------------
# Founding plots — the launch-window promotion
# ---------------------------------------------------------------------------
#
# The first FREE_PLOT_LIMIT companies get a plot without paying. This exists so
# a launch-day globe has real startups on it instead of nothing; it is NOT a way
# to make the money boards look busier, and the schema is what keeps that true:
#
#   * a founding plot is written with total_cents = 0, by the DB method itself
#     (see claim_world_founding_plot) — no caller can talk it into a stake;
#   * so it CANNOT appear as money on 'richest' or 'rising', and "$5 takes #1"
#     stays literally true;
#   * it DOES count on 'planted', which ranks by plot count and age. That board
#     exists precisely so participation can beat spending, and a company that
#     really did plant a pin really did plant it;
#   * every one is labelled "Founding plot" wherever it is identified, so a
#     comped listing can never read as a purchase.
#
# Tunable in one place: this constant is the cap, and the frontend mirrors it in
# frontend/src/components/world/constants.ts the way MIN_STAKE_CENTS does. The
# server is still the authority — GET /api/world/free-slots reports the real
# remaining count and POST /api/world/claim-free enforces it in SQL.
FREE_PLOT_LIMIT = 20

# Postgres transaction-level advisory lock key that serializes free claims, so
# the "how many founding plots exist?" count cannot be read by two transactions
# that then both insert the last one. Arbitrary but stable: b'worldf' as an int.
# (SQLite needs no equivalent — it serializes writers at the database level.)
FOUNDING_CLAIM_LOCK_KEY = 0x776F726C6466

# Owner of record for a plot an operator places from the admin tool. A plot row
# must belong to an account; an operator-placed listing honestly belongs to the
# operator until the company it names comes and claims it. The account is
# created with an unusable password hash — nobody can log into it.
ADMIN_PLOT_OWNER_EMAIL = "world-operator@exploreyc.com"
