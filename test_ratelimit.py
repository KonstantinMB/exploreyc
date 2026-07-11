"""
Tests for backend/ratelimit.py — in-memory path only (no network).

Run: python3 test_ratelimit.py
"""
import sys
import os

# Ensure no Upstash env vars are present so we exercise the in-memory path
os.environ.pop("UPSTASH_REDIS_REST_URL", None)
os.environ.pop("UPSTASH_REDIS_REST_TOKEN", None)

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from ratelimit import check_rate_limit, _mem  # noqa: E402

PASS = "\033[32mPASS\033[0m"
FAIL = "\033[31mFAIL\033[0m"
failures = 0


def check(label, condition):
    global failures
    status = PASS if condition else FAIL
    print(f"  [{status}] {label}")
    if not condition:
        failures += 1


def run():
    print("=== test_ratelimit.py ===\n")

    # --- Test 1: first two calls within limit=2 are allowed ---
    _mem.clear()
    allowed1, retry1 = check_rate_limit("test_key", limit=2, window_seconds=60)
    allowed2, retry2 = check_rate_limit("test_key", limit=2, window_seconds=60)

    print("Test 1: first two calls allowed")
    check("call 1 allowed=True", allowed1 is True)
    check("call 1 retry_after=0", retry1 == 0)
    check("call 2 allowed=True", allowed2 is True)
    check("call 2 retry_after=0", retry2 == 0)

    # --- Test 2: third call exceeds limit and returns retry_after > 0 ---
    print("\nTest 2: third call denied")
    allowed3, retry3 = check_rate_limit("test_key", limit=2, window_seconds=60)
    check("call 3 allowed=False", allowed3 is False)
    check("call 3 retry_after > 0", retry3 > 0)
    check("call 3 retry_after <= 61", retry3 <= 61)

    # --- Test 3: separate keys are isolated ---
    print("\nTest 3: different keys are independent")
    _mem.clear()
    check_rate_limit("key_a", limit=1, window_seconds=60)
    allowed_b, _ = check_rate_limit("key_b", limit=1, window_seconds=60)
    check("key_b first call allowed (isolated from key_a)", allowed_b is True)

    # --- Test 4: return types ---
    print("\nTest 4: return types are (bool, int)")
    _mem.clear()
    a, r = check_rate_limit("type_key", limit=1, window_seconds=60)
    check("allowed is bool", isinstance(a, bool))
    check("retry_after is int", isinstance(r, int))

    # --- Summary ---
    print(f"\n{'All tests passed!' if failures == 0 else f'{failures} test(s) FAILED'}\n")
    return failures


if __name__ == "__main__":
    sys.exit(run())
