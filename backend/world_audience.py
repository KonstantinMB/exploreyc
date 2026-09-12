"""
ExploreYC World — how many people actually see the globe.

This is the sales argument for a paid plot, so it is also the one place in the
product where an invented number would do the most damage. Two figures, two
sources, and both of them are measurements:

  * **REACH** — visitors and pageviews for exploreyc.com over the last 30 days,
    read from the Vercel Web Analytics REST API (`/v1/query/web-analytics/...`).
    Collection is already live: the frontend ships `@vercel/analytics`. This
    module only reads what Vercel already counted.

  * **WATCHING NOW** — distinct anonymous session ids that beat at
    `POST /api/world/beat` inside the last PRESENCE_WINDOW_SECONDS. That one is
    ours end to end; see the presence notes below.

THE HONESTY RULE, and it is absolute: **if we cannot measure it, it is null.**
`VERCEL_ANALYTICS_TOKEN` unset means `visitors_30d`, `pageviews_30d`,
`countries_count` and `updated_at` all come back `None` and the UI omits the
line entirely. Nothing here estimates, extrapolates, back-fills from a previous
window, or rounds anything up. A missing figure is missing.

WHY THE RESULT IS CACHED IN THE DATABASE. `/api/world/audience` is read by the
homepage, /world and the stake modal — a Vercel round trip per page load would
be both slow and rate-limited, and a rate-limited fetch fails, and a failure
would blank the number that sells the product. So the fetch happens on a
schedule (`POST /api/cron/refresh-world-audience`, plus the nightly
`/api/cron/daily-scrape`), the answer lands in `world_audience_cache`, and the
public endpoint only ever reads that row. A stale-but-real number is correct; a
live-but-rate-limited one is not.

`should_refresh()` exists so a deployment with no cron wired up still fills the
cache: the public endpoint may schedule ONE background refresh when the row is
older than REFRESH_AFTER_SECONDS, throttled per process to at most one attempt
per MIN_ATTEMPT_INTERVAL_SECONDS. It never blocks the response, and the response
it returns is the cached one, never the in-flight one.

PRESENCE IS ANONYMOUS BY CONSTRUCTION. A heartbeat carries one client-generated
opaque id and nothing else. No cookie is set, no IP is stored, no user id is
attached — `world_presence` has exactly two columns, and rows older than
PRESENCE_PRUNE_SECONDS are deleted on the next beat. The known limitation, said
plainly rather than hidden: a determined script could mint fresh session ids and
inflate the count. The number is a presence signal, not an audited metric, and
it is labelled as live presence everywhere it appears.
"""

import logging
import os
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger(__name__)

try:
    import requests
except ImportError:  # keeps local dev working before `pip install -r requirements.txt`
    requests = None

# ---------------------------------------------------------------------------
# Configuration
#
# Module-level so tests (and only tests) can rebind them with monkeypatch, the
# same way test_world.py rebinds world.STRIPE_SECRET_KEY. Every function below
# reads them at call time.
# ---------------------------------------------------------------------------

#: Vercel API token with read access to the project's analytics. Absent =>
#: every traffic field is None, forever, and the UI says nothing.
VERCEL_ANALYTICS_TOKEN = os.getenv("VERCEL_ANALYTICS_TOKEN")
#: `prj_…`. Required alongside the token.
VERCEL_PROJECT_ID = os.getenv("VERCEL_PROJECT_ID")
#: `team_…`. Required for a project owned by a team, which is the usual case.
VERCEL_TEAM_ID = os.getenv("VERCEL_TEAM_ID")

VERCEL_API_BASE = "https://api.vercel.com"

#: The measured window. 30 days is what the Vercel dashboard shows by default,
#: so the number on the site and the number the owner sees agree.
WINDOW_DAYS = 30

#: Country breakdown page size. 100 is the API maximum. When the response comes
#: back with this many rows the tail is bucketed into "Others" by Vercel, which
#: makes `countries_count` a FLOOR rather than a total — `countries_capped`
#: carries that fact to the UI so it can print a "+".
COUNTRY_LIMIT = 100

#: How many countries the endpoint hands to the UI. The full breakdown is only
#: needed to count distinct countries, and that count is stored separately.
TOP_COUNTRIES_KEPT = 12

#: The cached row is considered fresh for this long. Traffic figures move by the
#: hour at most; refetching more often buys nothing and spends rate limit.
REFRESH_AFTER_SECONDS = 6 * 3600

#: Floor between two refresh attempts in one process, success or failure. Stops
#: a broken token from turning every stale read into an outbound request.
MIN_ATTEMPT_INTERVAL_SECONDS = 15 * 60

#: "Watching now" = distinct sessions seen this recently. Three client beats'
#: worth of slack, so one dropped request does not blink somebody off the globe.
PRESENCE_WINDOW_SECONDS = 60

#: Anything older than this is garbage and is deleted on the next beat.
PRESENCE_PRUNE_SECONDS = 300

#: What the client is asked to do. Exported so the frontend and the window above
#: are derived from one number rather than two that happen to agree today.
BEAT_INTERVAL_SECONDS = 20

#: An anonymous, ephemeral, client-generated id. Deliberately narrow: this is
#: the only field a heartbeat carries, and the format makes it a poor smuggling
#: route for anything that looks like personal data.
SESSION_ID_RE = re.compile(r"^[A-Za-z0-9_-]{8,64}$")

#: Vercel buckets the tail of a capped breakdown under this label, and rows with
#: no resolvable country come back with an empty string. Neither is a country.
_NOT_A_COUNTRY = {"", "others", "other", "unknown"}

#: Per-process throttle for the opportunistic refresh. Monotonic, so a clock
#: change cannot unlock it early.
_last_attempt_monotonic: Optional[float] = None


def is_configured() -> bool:
    """True when a Vercel read is even possible. False => traffic fields stay
    None and nothing is ever fetched."""
    return bool(VERCEL_ANALYTICS_TOKEN and VERCEL_PROJECT_ID and requests is not None)


def _params(extra: Optional[dict] = None) -> dict:
    params = {"projectId": VERCEL_PROJECT_ID}
    if VERCEL_TEAM_ID:
        params["teamId"] = VERCEL_TEAM_ID
    if extra:
        params.update(extra)
    return params


def _get(path: str, params: dict) -> dict:
    response = requests.get(
        f"{VERCEL_API_BASE}{path}",
        params=params,
        headers={"Authorization": f"Bearer {VERCEL_ANALYTICS_TOKEN}"},
        timeout=10,
    )
    response.raise_for_status()
    return response.json()


def _iso_z(value: datetime) -> str:
    """UTC ISO-8601 with a literal Z. `new Date()` parses this identically in
    every browser, which a bare 'YYYY-MM-DD HH:MM:SS' does not."""
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def fetch_reach() -> Optional[dict]:
    """One round trip pair to Vercel: the 30-day totals and the country
    breakdown. Returns the payload to cache, or None — never a partial figure
    and never a fabricated one.

    None means exactly one thing to every caller: *we do not know*. Not zero.
    """
    if not is_configured():
        return None

    until = datetime.now(timezone.utc)
    since = until - timedelta(days=WINDOW_DAYS)
    window = {"since": _iso_z(since), "until": _iso_z(until)}

    try:
        totals = _get("/v1/query/web-analytics/visits/count", _params(window))
        breakdown = _get(
            "/v1/query/web-analytics/visits/aggregate",
            _params({**window, "by": "country", "limit": COUNTRY_LIMIT}),
        )
    except Exception as e:  # network, auth, rate limit, schema drift — all the same
        logger.warning("world audience: Vercel Web Analytics read failed: %s", e)
        return None

    data = totals.get("data") or {}
    visitors = data.get("visitors")
    pageviews = data.get("pageviews")
    if not isinstance(visitors, int) or not isinstance(pageviews, int):
        logger.warning("world audience: unexpected count payload, ignoring: %r", totals)
        return None

    rows = breakdown.get("data") or []
    countries = []
    for row in rows:
        iso = str(row.get("country") or "").strip()
        seen = row.get("visitors")
        if iso.lower() in _NOT_A_COUNTRY or not isinstance(seen, int) or seen <= 0:
            continue
        countries.append({"iso": iso.upper(), "visitors": seen})
    countries.sort(key=lambda c: (-c["visitors"], c["iso"]))

    return {
        "visitors_30d": visitors,
        "pageviews_30d": pageviews,
        # Distinct countries with at least one visitor. A floor, not a total,
        # whenever the breakdown filled its page — see `countries_capped`.
        "countries_count": len(countries),
        "countries_capped": len(rows) >= COUNTRY_LIMIT,
        "top_countries": countries[:TOP_COUNTRIES_KEPT],
        "window_days": WINDOW_DAYS,
        "measured_at": _iso_z(until),
        "source": "vercel_web_analytics",
    }


def refresh(db) -> Optional[dict]:
    """Fetch and persist. Returns the new payload, or None when the fetch could
    not be made or failed — in which case the previously cached row is left
    exactly as it was, because a real old number beats no number."""
    global _last_attempt_monotonic
    _last_attempt_monotonic = time.monotonic()
    payload = fetch_reach()
    if payload is None:
        return None
    try:
        db.save_world_audience(payload)
    except Exception as e:
        logger.error("world audience: could not cache the Vercel read: %s", e)
        return None
    logger.info(
        "world audience: cached %s visitors / %s pageviews over %sd from %s countries",
        payload["visitors_30d"], payload["pageviews_30d"],
        payload["window_days"], payload["countries_count"],
    )
    return payload


def should_refresh(cached: Optional[dict]) -> bool:
    """Whether the public endpoint may schedule a background refresh right now.

    Three gates, all of which must open: a token exists, this process has not
    tried inside MIN_ATTEMPT_INTERVAL_SECONDS, and the cached row is missing or
    older than REFRESH_AFTER_SECONDS. The endpoint never waits on the result.
    """
    if not is_configured():
        return False
    if _last_attempt_monotonic is not None:
        if time.monotonic() - _last_attempt_monotonic < MIN_ATTEMPT_INTERVAL_SECONDS:
            return False
    if not cached:
        return True
    measured = cached.get("measured_at")
    if not measured:
        return True
    try:
        when = datetime.fromisoformat(str(measured).replace("Z", "+00:00"))
    except ValueError:
        return True
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - when).total_seconds() > REFRESH_AFTER_SECONDS


def reset_throttle() -> None:
    """Test seam. Clears the per-process refresh throttle."""
    global _last_attempt_monotonic
    _last_attempt_monotonic = None


def valid_session_id(value: Optional[str]) -> bool:
    return bool(value) and bool(SESSION_ID_RE.match(value))
