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
