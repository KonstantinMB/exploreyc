"""
Restart-safe rate limiter.

Uses Upstash Redis REST API (sliding window via INCR + EXPIRE NX pipeline)
when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are configured.
Falls back to an in-memory sliding-window limiter on missing config or any
Upstash error so the caller is never disrupted.
"""

import os
import time
import logging

import requests

logger = logging.getLogger(__name__)

_URL = os.getenv("UPSTASH_REDIS_REST_URL")
_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN")

# In-memory store: key -> list of hit timestamps
_mem: dict[str, list[float]] = {}


def _mem_check(key: str, limit: int, window: int) -> tuple[bool, int]:
    """In-memory sliding-window rate check. Not restart-safe but always available."""
    now = time.time()
    hits = [t for t in _mem.get(key, []) if now - t < window]
    if len(hits) >= limit:
        return False, int(window - (now - hits[0])) + 1
    hits.append(now)
    _mem[key] = hits
    return True, 0


def check_rate_limit(key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
    """
    Check whether *key* is within the rate limit.

    Returns:
        (allowed, retry_after_seconds)
        allowed=True  → request may proceed; retry_after=0
        allowed=False → request denied;     retry_after>0 (seconds to wait)

    Uses Upstash Redis REST when configured, otherwise falls back to the
    in-memory limiter. Also falls back to in-memory on any Upstash exception.
    """
    if not (_URL and _TOKEN):
        return _mem_check(key, limit, window_seconds)
    try:
        # Pipeline: INCR increments (or creates) the counter; EXPIRE NX sets
        # the TTL only if the key has no expiry yet, preserving the window.
        r = requests.post(
            f"{_URL}/pipeline",
            headers={"Authorization": f"Bearer {_TOKEN}"},
            json=[
                ["INCR", key],
                ["EXPIRE", key, str(window_seconds), "NX"],
            ],
            timeout=2,
        )
        r.raise_for_status()
        count = int(r.json()[0]["result"])
        if count > limit:
            return False, window_seconds
        return True, 0
    except Exception as e:
        logger.warning("Upstash rate-limit failed, falling back to memory: %s", e)
        return _mem_check(key, limit, window_seconds)
