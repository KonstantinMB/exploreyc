"""
Tests for Stripe billing → plan entitlements (billing.py + plans.py).

Drives handle_stripe_event / apply_subscription_state directly with dict events
(the same shape stripe-python deserializes to), so no Stripe account or network
is involved. Signature verification is deliberately out of scope — it's a thin
call into stripe.Webhook.construct_event.

Run: python -m pytest test_billing.py
"""

import billing
from billing import apply_subscription_state, handle_stripe_event
from plans import PLAN_META, plan_for_price, plan_limit, public_plans


class FakeDB:
    def __init__(self, users):
        self.users = {u["id"]: dict(u) for u in users}

    def get_api_user_by_id(self, user_id):
        return self.users.get(user_id)

    def get_api_user_by_stripe_customer(self, customer_id):
        for u in self.users.values():
            if u.get("stripe_customer_id") == customer_id:
                return u
        return None

    def set_api_user_plan(self, user_id, plan):
        self.users[user_id]["plan"] = plan
        return True

    def set_api_user_stripe_customer(self, user_id, customer_id):
        self.users[user_id]["stripe_customer_id"] = customer_id
        return True

    def set_api_user_subscription(self, user_id, subscription_id, status):
        self.users[user_id]["stripe_subscription_id"] = subscription_id
        self.users[user_id]["subscription_status"] = status
        return True


PRICE_PRO = "price_test_pro"
PRICE_MAX = "price_test_max"


def _configure_prices(monkeypatch):
    monkeypatch.setitem(PLAN_META["pro"], "stripe_price_id", PRICE_PRO)
    monkeypatch.setitem(PLAN_META["max"], "stripe_price_id", PRICE_MAX)


def _sub_event(etype, customer, price_id, status, sub_id="sub_1"):
    return {
        "type": etype,
        "data": {"object": {
            "id": sub_id,
            "customer": customer,
            "status": status,
            "items": {"data": [{"price": {"id": price_id}}]},
        }},
    }


# ---- plans.py ----

def test_plan_limits_ladder():
    assert plan_limit("free") == 5
    assert plan_limit("pro") == 500
    assert plan_limit("max") == 5000
    assert plan_limit("unlimited") is None
    assert plan_limit("bogus") == 5      # unknown → free
    assert plan_limit(None) == 5


def test_plan_for_price(monkeypatch):
    _configure_prices(monkeypatch)
    assert plan_for_price(PRICE_PRO) == "pro"
    assert plan_for_price(PRICE_MAX) == "max"
    assert plan_for_price("price_unknown") is None
    assert plan_for_price("") is None


def test_public_plans_hides_unlimited_and_price_ids(monkeypatch):
    _configure_prices(monkeypatch)
    plans = public_plans()
    keys = [p["key"] for p in plans]
    assert "unlimited" not in keys
    assert all("stripe_price_id" not in p for p in plans)
    assert next(p for p in plans if p["key"] == "pro")["purchasable"] is True
    assert next(p for p in plans if p["key"] == "free")["purchasable"] is False


# ---- apply_subscription_state ----

def test_active_subscription_sets_plan(monkeypatch):
    _configure_prices(monkeypatch)
    db = FakeDB([{"id": 1, "plan": "free"}])
    assert apply_subscription_state(db, db.users[1], PRICE_PRO, "active") == "pro"
    assert db.users[1]["plan"] == "pro"


def test_past_due_keeps_plan(monkeypatch):
    _configure_prices(monkeypatch)
    db = FakeDB([{"id": 1, "plan": "pro"}])
    assert apply_subscription_state(db, db.users[1], PRICE_PRO, "past_due") == "pro"


def test_canceled_drops_to_free(monkeypatch):
    _configure_prices(monkeypatch)
    db = FakeDB([{"id": 1, "plan": "max"}])
    assert apply_subscription_state(db, db.users[1], PRICE_MAX, "canceled") == "free"
    assert db.users[1]["plan"] == "free"


def test_unlimited_grant_never_downgraded(monkeypatch):
    _configure_prices(monkeypatch)
    db = FakeDB([{"id": 1, "plan": "unlimited"}])
    assert apply_subscription_state(db, db.users[1], PRICE_PRO, "canceled") == "unlimited"
    assert db.users[1]["plan"] == "unlimited"


# ---- handle_stripe_event ----

def test_subscription_updated_upgrades_user(monkeypatch):
    _configure_prices(monkeypatch)
    db = FakeDB([{"id": 7, "plan": "free", "stripe_customer_id": "cus_7"}])
    result = handle_stripe_event(db, _sub_event("customer.subscription.updated", "cus_7", PRICE_MAX, "active"))
    assert result == {"handled": True, "user_id": 7, "plan": "max"}
    assert db.users[7]["subscription_status"] == "active"


def test_subscription_deleted_downgrades_user(monkeypatch):
    _configure_prices(monkeypatch)
    db = FakeDB([{"id": 7, "plan": "pro", "stripe_customer_id": "cus_7"}])
    result = handle_stripe_event(db, _sub_event("customer.subscription.deleted", "cus_7", PRICE_PRO, "active"))
    assert result["plan"] == "free"
    assert db.users[7]["plan"] == "free"
    assert db.users[7]["subscription_status"] == "canceled"


def test_unknown_customer_is_ignored(monkeypatch):
    _configure_prices(monkeypatch)
    db = FakeDB([])
    result = handle_stripe_event(db, _sub_event("customer.subscription.updated", "cus_nobody", PRICE_PRO, "active"))
    assert result == {"handled": False}


def test_unrecognized_event_acknowledged():
    db = FakeDB([])
    assert handle_stripe_event(db, {"type": "invoice.finalized", "data": {"object": {}}}) == {"handled": False}


def test_checkout_completed_links_customer_and_sets_plan(monkeypatch):
    _configure_prices(monkeypatch)

    class _StubSubscription:
        @staticmethod
        def retrieve(sub_id):
            assert sub_id == "sub_9"
            return {"status": "active", "items": {"data": [{"price": {"id": PRICE_PRO}}]}}

    class _StubStripe:
        Subscription = _StubSubscription

    monkeypatch.setattr(billing, "stripe", _StubStripe)
    monkeypatch.setattr(billing, "STRIPE_SECRET_KEY", "sk_test_stub")

    db = FakeDB([{"id": 3, "plan": "free"}])
    event = {
        "type": "checkout.session.completed",
        "data": {"object": {
            "client_reference_id": "3",
            "customer": "cus_3",
            "subscription": "sub_9",
            "metadata": {"user_id": "3", "plan": "pro"},
        }},
    }
    result = handle_stripe_event(db, event)
    assert result == {"handled": True, "user_id": 3, "plan": "pro"}
    assert db.users[3]["stripe_customer_id"] == "cus_3"
    assert db.users[3]["stripe_subscription_id"] == "sub_9"


def test_checkout_completed_unknown_user(monkeypatch):
    _configure_prices(monkeypatch)
    db = FakeDB([])
    event = {"type": "checkout.session.completed",
             "data": {"object": {"client_reference_id": "99", "customer": "cus_x"}}}
    assert handle_stripe_event(db, event) == {"handled": False}
