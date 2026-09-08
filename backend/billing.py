"""
Stripe subscription billing for Public API plans.

Flow:
  1. Dashboard calls POST /api/dev/billing/checkout {plan} → Stripe Checkout URL.
  2. Stripe redirects back to the dashboard; the webhook (not the redirect) is
     the source of truth for entitlements.
  3. POST /api/stripe/webhook maps subscription state → plan key → set_api_user_plan.
  4. POST /api/dev/billing/portal lets subscribers cancel/change cards themselves.

Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_PRO, STRIPE_PRICE_MAX.
With STRIPE_SECRET_KEY unset the endpoints 503 and the rest of the app is unaffected.

Guardrail: the webhook never downgrades a user whose plan is `unlimited` — that
plan is an admin grant and outlives any Stripe subscription state.
"""

import logging
import os

from fastapi import APIRouter, Depends, HTTPException, Request

from plans import PLAN_META, PURCHASABLE_PLANS, plan_for_price, public_plans

logger = logging.getLogger(__name__)

try:
    import stripe
except ImportError:  # keeps local dev working before `pip install -r requirements.txt`
    stripe = None

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
FRONTEND_URL = (os.getenv("FRONTEND_URL") or "https://exploreyc.com").rstrip("/")

# Subscription statuses that keep the paid plan active. `past_due` is included
# on purpose: Stripe retries failed payments for days — don't cut access on the
# first hiccup. `customer.subscription.deleted` fires when retries are exhausted.
ACTIVE_STATUSES = ("active", "trialing", "past_due")


def _stripe_ready() -> None:
    if stripe is None or not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Billing is not configured on this server.")
    stripe.api_key = STRIPE_SECRET_KEY


def apply_subscription_state(db, user: dict, price_id: str, status: str) -> str:
    """
    Pure entitlement decision + write. Returns the plan the user ends up on.
    Called from webhook handlers; separated out so tests can drive it directly.
    """
    current = user.get("plan", "free")
    if current == "unlimited":
        return current  # admin grant wins; Stripe state never clobbers it

    plan = plan_for_price(price_id)
    if status in ACTIVE_STATUSES and plan:
        new_plan = plan
    else:
        new_plan = "free"
    if new_plan != current:
        db.set_api_user_plan(user["id"], new_plan)
        logger.info("billing: user %s plan %s → %s (sub status=%s)", user["id"], current, new_plan, status)
    return new_plan


def _subscription_price_id(subscription: dict) -> str:
    items = (subscription.get("items") or {}).get("data") or []
    if items:
        return ((items[0].get("price") or {}).get("id")) or ""
    return ""


def handle_stripe_event(db, event: dict) -> dict:
    """Route a verified Stripe event. Returns a small summary (also used by tests)."""
    etype = event.get("type", "")
    obj = (event.get("data") or {}).get("object") or {}

    if etype == "checkout.session.completed":
        user_id = obj.get("client_reference_id") or (obj.get("metadata") or {}).get("user_id")
        customer_id = obj.get("customer")
        if not user_id:
            logger.warning("billing: checkout.session.completed without client_reference_id")
            return {"handled": False}
        user = db.get_api_user_by_id(int(user_id))
        if not user:
            logger.warning("billing: checkout completed for unknown user %s", user_id)
            return {"handled": False}
        if customer_id:
            db.set_api_user_stripe_customer(user["id"], customer_id)
        sub_id = obj.get("subscription")
        price_id, status = "", "active"
        if sub_id and stripe is not None and STRIPE_SECRET_KEY:
            sub = stripe.Subscription.retrieve(sub_id)
            price_id, status = _subscription_price_id(sub), sub.get("status", "active")
            db.set_api_user_subscription(user["id"], sub_id, status)
        plan = apply_subscription_state(db, user, price_id, status)
        return {"handled": True, "user_id": user["id"], "plan": plan}

    if etype in ("customer.subscription.updated", "customer.subscription.deleted"):
        customer_id = obj.get("customer")
        user = db.get_api_user_by_stripe_customer(customer_id) if customer_id else None
        if not user:
            logger.warning("billing: %s for unknown customer %s", etype, customer_id)
            return {"handled": False}
        status = "canceled" if etype.endswith("deleted") else obj.get("status", "")
        db.set_api_user_subscription(user["id"], obj.get("id"), status)
        plan = apply_subscription_state(db, user, _subscription_price_id(obj), status)
        return {"handled": True, "user_id": user["id"], "plan": plan}

    return {"handled": False}  # unrecognized events are acknowledged, not errors


def create_billing_router(db, verify_dev_session) -> APIRouter:
    router = APIRouter()

    @router.get("/api/dev/plans")
    async def list_plans():
        return {"plans": public_plans()}

    @router.post("/api/dev/billing/checkout")
    async def create_checkout(payload: dict, session: dict = Depends(verify_dev_session)):
        _stripe_ready()
        plan = (payload or {}).get("plan")
        if plan not in PURCHASABLE_PLANS:
            raise HTTPException(status_code=400, detail=f"Plan must be one of: {list(PURCHASABLE_PLANS)}")
        price_id = PLAN_META[plan].get("stripe_price_id")
        if not price_id:
            raise HTTPException(status_code=503, detail=f"No Stripe price configured for plan '{plan}'.")
        user = db.get_api_user_by_id(session["user_id"])
        if user.get("plan") == plan:
            raise HTTPException(status_code=400, detail="You are already on this plan.")
        # Existing subscribers change plans via the portal (proration, no double-sub).
        if user.get("stripe_subscription_id") and user.get("subscription_status") in ACTIVE_STATUSES:
            raise HTTPException(status_code=409,
                                detail="You already have an active subscription — use 'Manage billing' to change plans.")
        params = {
            "mode": "subscription",
            "line_items": [{"price": price_id, "quantity": 1}],
            "client_reference_id": str(user["id"]),
            "metadata": {"user_id": str(user["id"]), "plan": plan},
            "success_url": f"{FRONTEND_URL}/dashboard?billing=success",
            "cancel_url": f"{FRONTEND_URL}/dashboard?billing=cancelled",
            "allow_promotion_codes": True,
        }
        if user.get("stripe_customer_id"):
            params["customer"] = user["stripe_customer_id"]
        else:
            params["customer_email"] = user["email"]
        try:
            checkout = stripe.checkout.Session.create(**params)
        except Exception as e:
            logger.error("billing: checkout session failed: %s", e)
            raise HTTPException(status_code=502, detail="Could not start checkout. Please try again.")
        return {"url": checkout.url}

    @router.post("/api/dev/billing/portal")
    async def create_portal(session: dict = Depends(verify_dev_session)):
        _stripe_ready()
        user = db.get_api_user_by_id(session["user_id"])
        if not user.get("stripe_customer_id"):
            raise HTTPException(status_code=400, detail="No billing account yet — subscribe first.")
        try:
            portal = stripe.billing_portal.Session.create(
                customer=user["stripe_customer_id"],
                return_url=f"{FRONTEND_URL}/dashboard",
            )
        except Exception as e:
            logger.error("billing: portal session failed: %s", e)
            raise HTTPException(status_code=502, detail="Could not open the billing portal. Please try again.")
        return {"url": portal.url}

    @router.post("/api/stripe/webhook")
    async def stripe_webhook(request: Request):
        _stripe_ready()
        if not STRIPE_WEBHOOK_SECRET:
            raise HTTPException(status_code=503, detail="Webhook secret not configured.")
        payload = await request.body()
        signature = request.headers.get("stripe-signature", "")
        try:
            event = stripe.Webhook.construct_event(payload, signature, STRIPE_WEBHOOK_SECRET)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid webhook signature.")
        try:
            result = handle_stripe_event(db, event)
        except Exception as e:
            # 500 → Stripe retries with backoff, which is what we want for transient DB errors.
            logger.error("billing: webhook handling failed for %s: %s", event.get("type"), e, exc_info=True)
            raise HTTPException(status_code=500, detail="Webhook processing failed.")
        return {"received": True, **{k: v for k, v in result.items() if k == "handled"}}

    return router
