"""
ExploreYC World — router, Stripe checkout and webhook fulfillment.

Port of startupworld's checkout/webhook design onto the ExploreYC stack
(FastAPI + dual DB layer + `api_users` accounts). The load-bearing rules,
carried over verbatim from the donor:

- **Checkout writes nothing.** Not a plot, not a payment, not a cent of
  stake. It validates, resolves geography server-side, and hands back a
  Stripe redirect. The webhook is the sole writer of money.
- **The server owns geography.** The client sends lat/lng; the server
  decides country and city, writes the answer into session metadata, and the
  webhook trusts metadata precisely because it was written here and arrives
  back signed by Stripe. Ocean points are refused before money is taken.
- **Top-ups move money and nothing else.** The text fields in a top-up
  session's metadata are ignored on purpose — letting a $5 payment rewrite a
  listing that already cleared moderation turns checkout into an unmoderated
  edit endpoint. Editing is what PATCH /api/world/plots/{id} is for.
- **Idempotency lives in the database.** `world_payments.stripe_session_id`
  and `world_promotions.stripe_session_id` are UNIQUE; a duplicate delivery
  is reported by the DB layer as `already_processed` and treated as success.
- **Credit the receipt, not the request.** `session.amount_total` is what
  Stripe captured (after coupons/tax); crediting the requested amount is how
  a discount code turns into free rank.
- **A moderation hit never rejects a payment.** It flips the plot's status
  to 'pending' — paid for, recorded, ranked, simply not rendered until a
  human looks at it.
- Errors map to 400/500/503, never 502/504 (Cloudflare replaces origin 502s
  with a CORS-less error page).
"""

import logging
import math
import os
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Response
from pydantic import BaseModel, Field

import world_audience
from password_utils import hash_token
from world_constants import (
    CITY_SNAP_RADIUS_KM,
    MAX_ACTIVE_FEATURED_PER_COUNTRY,
    MIN_STAKE_CENTS,
    OVERTAKE_MARGIN_CENTS,
    PROMOTION_TIERS,
)
from world_geo import get_world_geo

logger = logging.getLogger(__name__)

try:
    import stripe
except ImportError:  # keeps local dev working before `pip install -r requirements.txt`
    stripe = None

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
FRONTEND_URL = (os.getenv("FRONTEND_URL") or "https://exploreyc.com").rstrip("/")

#: Per-payment ceiling, mirroring startupworld's MAX_STAKE_CENTS.
MAX_STAKE_CENTS = 99_999_900

#: Stripe caps a metadata value at 500 chars and rejects the whole request if
#: one is longer. Validation keeps every field well under that — which is
#: exactly why the truncation exists. A 400 from Stripe at the last step of
#: checkout is a lost sale; a silently shortened tagline is not.
_STRIPE_METADATA_VALUE_MAX = 500

#: Compliance surface, shown on the Stripe checkout line item. Mirrors the
#: honesty rule on claim surfaces: no prize, no payout, no refund.
NOT_A_BET = (
    "A named pin on the ExploreYC World globe. This is a listing, not a "
    "wager, lottery or investment. No prize, no payout, no refund."
)

WORLD_PRODUCTS = ("world_plot", "world_promotion")


# ---------------------------------------------------------------------------
# Moderation — port of startupworld's src/lib/moderation.ts
#
# A denylist is a first line, not a wall. It exists to stop the drive-by and
# make obviously-hostile submissions visible before they are public. A hit
# holds the render ('pending'); it never refuses the charge.
# ---------------------------------------------------------------------------

DENYLIST = (
    # slurs and hate terms
    "nigger", "nigga", "faggot", "tranny", "kike", "chink", "spic", "wetback",
    "gook", "raghead", "towelhead", "coon", "paki", "retard", "retarded",
    "heil hitler", "sieg heil", "white power", "gas the jews", "kill all",
    "1488", "14 88",
    # sexual content
    "porn", "pornhub", "xvideos", "onlyfans", "child porn", "cp links", "loli",
    "rape", "incest", "cum", "blowjob", "handjob", "anal sex", "dildo",
    "escort service", "sex cam", "camgirl",
    # profanity
    "fuck", "fucking", "motherfucker", "shit", "bullshit", "bitch", "cunt",
    "asshole", "dickhead", "wanker", "bastard", "twat", "slut", "whore",
    # scam / spam magnets
    "free crypto", "free bitcoin", "airdrop claim", "seed phrase",
    "connect wallet", "double your", "guaranteed returns", "viagra", "cialis",
)

#: Terms at least this long are also matched against the de-spaced string
#: (the Scunthorpe rule: substring-matching four-letter words fills the
#: moderation queue with noise, and a noisy queue is a queue nobody reads).
_CONDENSED_MIN_LENGTH = 5

#: Bidi overrides reorder how text renders without changing what it
#: contains ("Trojan Source"); zero-width characters smuggle banned words
#: past filters; control characters break the surfaces that print them.
_BIDI_CONTROL = re.compile("[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]")
_ZERO_WIDTH = re.compile("[\u200B\u200C\u200D\u2060-\u2064\uFEFF]")
_CONTROL_CHARS = re.compile("[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]")

_SNIFFED_TLDS = ("com|net|org|io|xyz|ru|cn|info|biz|link|top|shop|club|online|"
                 "site|live|app|dev|me|tv|gg|ly|co|uk|de|fr|es|it|nl")
_EMBEDDED_URL = re.compile(
    "|".join([
        r"https?://",
        r"www\.",
        rf"\b[a-z0-9][a-z0-9-]{{0,62}}\.(?:{_SNIFFED_TLDS})\b",
        rf"\b[a-z0-9][a-z0-9-]{{0,62}}\s*(?:\[\.\]|\(\.\)|\s+dot\s+)\s*(?:{_SNIFFED_TLDS})\b",
    ]),
    re.IGNORECASE,
)

_LEET_MAP = {"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t",
             "8": "b", "9": "g", "@": "a", "$": "s", "!": "i", "|": "i", "+": "t"}

_SPACED_RUN_MIN_TOKENS = 3


def _normalise(text: str) -> str:
    """Canonical lowercase form: NFKD fold, strip combining marks, leetspeak
    map, everything non-alphanumeric becomes a space."""
    folded = "".join(ch for ch in unicodedata.normalize("NFKD", text)
                     if not unicodedata.combining(ch)).lower()
    out = []
    for ch in folded:
        mapped = _LEET_MAP.get(ch, ch)
        out.append(mapped if mapped.isascii() and mapped.isalnum() else " ")
    return " ".join("".join(out).split())


def _condense(normalised: str) -> str:
    despaced = normalised.replace(" ", "")
    return re.sub(r"(.)\1{2,}", r"\1", despaced)


def _spaced_runs(normalised: str) -> list:
    """Stretches written one character at a time ('f u c k') — the only place
    spacing evasion can live. Ordinary prose never has 3+ one-letter words."""
    runs, current = [], []
    for token in normalised.split(" "):
        if len(token) == 1:
            current.append(token)
        else:
            if len(current) >= _SPACED_RUN_MIN_TOKENS:
                runs.append("".join(current))
            current = []
    if len(current) >= _SPACED_RUN_MIN_TOKENS:
        runs.append("".join(current))
    return runs


def _matches_denylist(text: str) -> Optional[str]:
    normalised = _normalise(text)
    if not normalised:
        return None
    condensed = _condense(normalised)
    runs = _spaced_runs(normalised)
    for term in DENYLIST:
        nterm = _normalise(term)
        if not nterm:
            continue
        if re.search(rf"(^| ){re.escape(nterm)}( |$)", normalised):
            return term
        cterm = _condense(nterm)
        if not cterm:
            continue
        if any(cterm in run for run in runs):
            return term
        if len(cterm) >= _CONDENSED_MIN_LENGTH and cterm in condensed:
            return term
    return None


def screen(text: Optional[str]) -> Optional[str]:
    """First problem found in a piece of user-supplied text, or None.

    A non-None reason means "hold the listing in 'pending'", never "refuse the
    payment". The reason is operator-facing, never shown to a buyer.
    """
    if not text:
        return None
    if _BIDI_CONTROL.search(text):
        return "bidi-control-character"
    if _ZERO_WIDTH.search(text):
        return "zero-width-character"
    if _CONTROL_CHARS.search(text):
        return "control-character"
    if "\n" in text or "\r" in text:
        return "line-break"
    if _EMBEDDED_URL.search(text):
        return "embedded-url"
    term = _matches_denylist(text)
    if term:
        return f"denylist:{term}"
    return None


def screen_link_text(url: Optional[str]) -> Optional[str]:
    """Screen the text of a URL field (donor: screenProfile's link pass).

    Render-safety plus the denylist, and nothing else: running full screen()
    over a link would trip `embedded-url` on every single URL, which is the
    field's entire purpose. This is the pass that catches a slur in the path,
    which no structural https check can see."""
    if not url:
        return None
    if _BIDI_CONTROL.search(url):
        return "bidi-control-character"
    if _ZERO_WIDTH.search(url):
        return "zero-width-character"
    if _CONTROL_CHARS.search(url):
        return "control-character"
    term = _matches_denylist(url)
    if term:
        return f"denylist:{term}"
    return None


def screen_listing(name: Optional[str], tagline: Optional[str],
                   founder_name: Optional[str] = None,
                   founder_title: Optional[str] = None,
                   founder_link: Optional[str] = None,
                   url: Optional[str] = None) -> Optional[str]:
    """First problem across every rendered text field of a listing.

    founder_name/founder_title get the full screen — founder_name renders on
    the shared founders board, which is exactly the free-distribution surface
    the embedded-url rule exists for. Link fields get the link pass only."""
    for field, value in (("name", name), ("tagline", tagline),
                         ("founder_name", founder_name),
                         ("founder_title", founder_title)):
        reason = screen(value)
        if reason:
            return f"{field}:{reason}"
    for field, value in (("founder_link", founder_link), ("url", url)):
        reason = screen_link_text(value)
        if reason:
            return f"{field}:{reason}"
    return None


def status_for_listing(name: Optional[str], tagline: Optional[str],
                       founder_name: Optional[str] = None,
                       founder_title: Optional[str] = None,
                       founder_link: Optional[str] = None,
                       url: Optional[str] = None) -> str:
    """'active' or 'pending' — the one expression of the moderation rule."""
    if screen_listing(name, tagline, founder_name, founder_title,
                      founder_link, url):
        return "pending"
    return "active"


# ---------------------------------------------------------------------------
# Link validation — port of startupworld's validation.ts URL rules.
#
# `https:` and nothing else: these values are rendered straight into an
# <a href> on the plot page, so `javascript:` and `data:` are code execution,
# `http:` is a downgrade. Python's urlsplit strips \t\r\n before parsing
# (same WHATWG behaviour that makes "java\nscript:" parse as javascript:),
# so the scheme check below catches the newline smuggle too.
# ---------------------------------------------------------------------------

from urllib.parse import urlsplit


def validate_link(value: Optional[str], field: str) -> Optional[str]:
    """The trimmed URL when acceptable, None when empty; 400 otherwise."""
    if value is None:
        return None
    v = value.strip()
    if not v:
        return None
    try:
        parts = urlsplit(v)
    except ValueError:
        raise HTTPException(status_code=400,
                            detail=f"{field} must be a full https:// URL")
    if parts.scheme.lower() != "https" or not parts.netloc:
        raise HTTPException(status_code=400,
                            detail=f"{field} must be a full https:// URL")
    return v


# ---------------------------------------------------------------------------
# Stripe plumbing (same approach as billing.py)
# ---------------------------------------------------------------------------

def _stripe_ready() -> None:
    if stripe is None or not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Payments are not configured on this server.")
    stripe.api_key = STRIPE_SECRET_KEY


def _stripe_error_detail(e: Exception, fallback: str) -> str:
    """Stripe's user_message/message fields are safe to show (no secrets) and
    name the actual problem, which beats a generic retry prompt."""
    msg = getattr(e, "user_message", None) or getattr(e, "message", None) or str(e)
    return f"{fallback} Stripe said: {msg}" if msg else fallback


def _meta(value) -> str:
    """Metadata-safe string: '' for None, truncated to Stripe's 500-char cap."""
    if value is None:
        return ""
    return str(value)[:_STRIPE_METADATA_VALUE_MAX]


# ---------------------------------------------------------------------------
# Webhook fulfillment — called from billing.handle_stripe_event for
# checkout.session.completed sessions with mode == "payment" or a world
# metadata.product. The sole writer of world money.
# ---------------------------------------------------------------------------

class WorldFulfillmentError(Exception):
    """Deterministic fault (malformed metadata, missing plot). Raising it makes
    the webhook 500 so the failure sits red in Stripe's dashboard — money that
    arrived without a listing behind it must be visible where an operator
    already looks — instead of vanishing behind a log line."""


def _md_int(md: dict, key: str) -> Optional[int]:
    raw = str(md.get(key) or "").strip()
    if not raw:
        return None
    try:
        return int(raw)
    except ValueError:
        raise WorldFulfillmentError(f"metadata.{key} is {raw!r}")


def fulfill_world_checkout(db, session_obj: dict) -> dict:
    """Fulfill a completed one-time Checkout Session (plot or promotion).

    Idempotent via the UNIQUE stripe_session_id columns: a duplicate delivery
    credits nothing and is reported as success. Returns a summary dict in the
    same shape billing.handle_stripe_event uses.
    """
    md = session_obj.get("metadata") or {}
    product = md.get("product") or ""
    session_id = session_obj.get("id") or ""

    # Delayed payment methods complete the session before the money arrives;
    # we enable none of them, so an unpaid session here will never be paid.
    if session_obj.get("payment_status") != "paid":
        logger.warning("world: session %s ignored (payment_status=%s)",
                       session_id, session_obj.get("payment_status"))
        return {"handled": True, "product": product, "outcome": "ignored"}

    amount = session_obj.get("amount_total")
    if not isinstance(amount, int) or amount <= 0:
        logger.warning("world: session %s ignored (amount_total=%r)", session_id, amount)
        return {"handled": True, "product": product, "outcome": "ignored"}

    if not session_id:
        raise WorldFulfillmentError("checkout session has no id")

    user_id = session_obj.get("client_reference_id") or md.get("user_id")
    if not user_id:
        # A mode=payment session that carries none of our metadata is not
        # ours (some future one-time product). Acknowledge, credit nothing.
        logger.warning("world: session %s has no user reference; ignored", session_id)
        return {"handled": False, "outcome": "ignored"}
    user_id = int(user_id)

    if product == "world_promotion":
        return _fulfill_promotion(db, session_obj, md, user_id, amount)
    if product == "world_plot":
        return _fulfill_plot(db, session_obj, md, user_id, amount)
    # mode="payment" but not our metadata: some other (future) one-time
    # product. Acknowledge without writing — and, crucially, without ever
    # reaching the subscription plan logic.
    logger.warning("world: payment session %s has product=%r; ignored", session_id, product)
    return {"handled": False, "outcome": "ignored"}


def _fulfill_plot(db, session_obj: dict, md: dict, user_id: int, amount: int) -> dict:
    session_id = session_obj["id"]

    # Fast idempotency path. The UNIQUE constraint below is the real guard
    # (this check-then-act alone would race); this just makes redeliveries
    # cheap and keeps the new-plot path from minting a duplicate row.
    if db.get_world_payment_by_session(session_id):
        logger.info("world: duplicate delivery ignored session=%s", session_id)
        return {"handled": True, "product": "world_plot", "outcome": "duplicate"}

    plot_id = _md_int(md, "plot_id")
    company_id = _md_int(md, "company_id")

    # Claiming a seed that someone claimed first: the second buyer's payment
    # becomes a top-up on the existing plot — they out-staked the new owner.
    # (Donor semantics: two people paying for the same seed must not silently
    # overwrite each other while both are charged.)
    if plot_id is None and company_id is not None:
        existing = db.get_world_plot_by_company(company_id)
        if existing:
            plot_id = existing["id"]

    if plot_id is not None:
        # ---- top-up: money moves, nothing else does -----------------------
        # The name/tagline/url in this session's metadata are ignored on
        # purpose; see module docstring.
        if not db.get_world_plot(plot_id):
            raise WorldFulfillmentError(f"plot {plot_id} does not exist")
        result = db.insert_world_payment(plot_id, user_id, session_id, amount)
        if result.get("already_processed"):
            logger.info("world: duplicate delivery ignored session=%s", session_id)
            return {"handled": True, "product": "world_plot", "outcome": "duplicate"}
        db.credit_world_plot(plot_id, amount)  # SQL increment, never read-modify-write
        logger.info("world: topped-up plot=%s +%s session=%s", plot_id, amount, session_id)
        return {"handled": True, "product": "world_plot", "outcome": "topped-up",
                "plot_id": plot_id, "user_id": user_id}

    # ---- new plot ---------------------------------------------------------
    name = (md.get("name") or "").strip()
    country_iso = (md.get("country_iso") or "").strip().upper()
    if not name:
        raise WorldFulfillmentError("metadata.name is missing")
    if len(country_iso) != 2:
        raise WorldFulfillmentError(f"metadata.country_iso is {country_iso!r}")
    try:
        lat, lng = float(md.get("lat")), float(md.get("lng"))
    except (TypeError, ValueError):
        raise WorldFulfillmentError("metadata.lat/lng are not numbers")
    if not (math.isfinite(lat) and math.isfinite(lng)):
        raise WorldFulfillmentError("metadata.lat/lng are not finite")

    tagline = (md.get("tagline") or "").strip() or None
    url = (md.get("url") or "").strip() or None
    founder_name = (md.get("founder_name") or "").strip() or None
    founder_title = (md.get("founder_title") or "").strip() or None
    founder_link = (md.get("founder_link") or "").strip() or None
    # A hit holds the render, never the money.
    status = status_for_listing(name, tagline, founder_name, founder_title,
                                founder_link, url)
    new_id = db.create_world_plot({
        "user_id": user_id,
        "company_id": company_id,
        "name": name,
        "url": url,
        "tagline": tagline,
        "founder_name": founder_name,
        "founder_title": founder_title,
        "founder_link": founder_link,
        "lat": lat,
        "lng": lng,
        "country_iso": country_iso,
        "city_id": _md_int(md, "city_id"),
        "total_cents": amount,
        "status": status,
    })
    result = db.insert_world_payment(new_id, user_id, session_id, amount)
    if result.get("already_processed"):
        # Lost a redelivery race after the fast path: the credit is safe (the
        # first delivery's plot holds it) but this row is an orphan. Its id
        # was never returned to anyone and no payment references it, so the
        # guarded delete self-heals; if the guard refuses (someone paid it in
        # the meantime — theoretically impossible), escalate to ERROR.
        if db.delete_world_plot_if_unreferenced(new_id):
            logger.warning("world: redelivery race orphan plot=%s deleted session=%s",
                           new_id, session_id)
        else:
            logger.error("world: redelivery race left orphan plot=%s session=%s "
                         "(delete guard refused; inspect manually)", new_id, session_id)
        return {"handled": True, "product": "world_plot", "outcome": "duplicate"}
    logger.info("world: created plot=%s status=%s session=%s", new_id, status, session_id)
    return {"handled": True, "product": "world_plot", "outcome": "created",
            "plot_id": new_id, "status": status, "user_id": user_id}


def _fulfill_promotion(db, session_obj: dict, md: dict, user_id: int, amount: int) -> dict:
    session_id = session_obj["id"]
    plot_id = _md_int(md, "plot_id")
    tier = md.get("tier") or ""
    if plot_id is None:
        raise WorldFulfillmentError("promotion metadata.plot_id is missing")
    if tier not in PROMOTION_TIERS:
        raise WorldFulfillmentError(f"promotion metadata.tier is {tier!r}")
    country_iso = (md.get("country_iso") or "").strip().upper() or None
    ends_at = datetime.now(timezone.utc) + timedelta(days=PROMOTION_TIERS[tier]["days"])
    result = db.create_world_promotion({
        "kind": "featured",
        "plot_id": plot_id,
        "user_id": user_id,
        "country_iso": country_iso,
        "ends_at": ends_at,
        "amount_cents": amount,
        "stripe_session_id": session_id,
        "status": "active",
    })
    if result.get("already_processed"):
        logger.info("world: duplicate promotion delivery ignored session=%s", session_id)
        return {"handled": True, "product": "world_promotion", "outcome": "duplicate"}
    logger.info("world: promotion %s activated plot=%s tier=%s session=%s",
                result["id"], plot_id, tier, session_id)
    return {"handled": True, "product": "world_promotion", "outcome": "created",
            "promotion_id": result["id"], "plot_id": plot_id, "user_id": user_id}


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class WorldCheckoutRequest(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    name: str = Field(min_length=1, max_length=40)
    url: Optional[str] = Field(None, max_length=2048)
    tagline: Optional[str] = Field(None, max_length=140)
    founder_name: Optional[str] = Field(None, max_length=80)
    founder_title: Optional[str] = Field(None, max_length=80)
    founder_link: Optional[str] = Field(None, max_length=2048)
    company_id: Optional[int] = None
    plot_id: Optional[int] = None  # set = top-up; text fields are ignored
    amount_cents: int


class PromotionCheckoutRequest(BaseModel):
    plot_id: int
    tier: str  # '7d' | '30d'


class PlotUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=40)
    url: Optional[str] = Field(None, max_length=2048)
    tagline: Optional[str] = Field(None, max_length=140)
    founder_name: Optional[str] = Field(None, max_length=80)
    founder_title: Optional[str] = Field(None, max_length=80)
    founder_link: Optional[str] = Field(None, max_length=2048)


class PlotLogoRequest(BaseModel):
    logo_data_url: str


class BeatRequest(BaseModel):
    """The entire body of a presence heartbeat.

    One field, and the bound is the point: an anonymous, ephemeral id the client
    generated for this tab. There is nowhere in this shape to put an email, an
    IP or a user id, which is how "we do not collect that" stops being a
    promise and becomes a fact about the schema.
    """
    session_id: str = Field(..., min_length=8, max_length=64)


# ---------------------------------------------------------------------------
# Response shaping
# ---------------------------------------------------------------------------

def _tier_bucket(total_cents: int) -> int:
    """Stake tier for pin sizing: 1 (<$50), 2 (<$250), 3 (<$1000), 4 ($1000+).
    Virtual seeds are tier 0 (muted)."""
    if total_cents >= 100_000:
        return 4
    if total_cents >= 25_000:
        return 3
    if total_cents >= 5_000:
        return 2
    return 1


def _public_plot(plot: dict, is_mine: Optional[bool] = None) -> dict:
    out = {
        "id": plot["id"],
        "name": plot["name"],
        "url": plot.get("url"),
        "tagline": plot.get("tagline"),
        "founder_name": plot.get("founder_name"),
        "founder_title": plot.get("founder_title"),
        "founder_link": plot.get("founder_link"),
        "logo_url": plot.get("logo_url"),
        "lat": plot["lat"],
        "lng": plot["lng"],
        "country_iso": plot["country_iso"],
        "country_name": plot.get("country_name"),
        "city_id": plot.get("city_id"),
        "city_name": plot.get("city_name"),
        "company_id": plot.get("company_id"),
        "company_slug": plot.get("company_slug"),
        "total_cents": plot["total_cents"],
        "tier": _tier_bucket(plot["total_cents"]),
        "status": plot["status"],
        "promoted": bool(plot.get("promoted")),
        "created_at": plot.get("created_at"),
        "updated_at": plot.get("updated_at"),
    }
    if is_mine is not None:
        out["is_mine"] = is_mine
    return out


# ---------------------------------------------------------------------------
# The seed layer's wire format
# ---------------------------------------------------------------------------
#
# WHY THIS IS NOT JUST A WIDER DICT. The merged globe needs to *filter* the
# imported layer (batch, industry, hiring, team size) and *render* it (logo,
# location label), and production ships 5,579 seed pins on a query that
# refetches every 60 seconds. Measured on a 5,579-row modelled dataset through
# this exact endpoint:
#
#     before, 8 narrow fields per pin, as objects ..............  759 KiB
#     naive widen, 15 fields per pin, as objects ............... 2184 KiB
#     this encoding, 15 fields per pin .........................  563 KiB
#
# So the payload carries seven new fields and still weighs *less* than the one
# it replaces. Three things buy that, and none of them drop a single pin:
#
#   1. Tuples, not objects. 5,579 copies of `"company_slug":` is a third of a
#      megabyte of key names. The column order is SEED_COLUMNS, below, and it
#      is the contract — decoded in frontend/src/lib/worldApi.ts.
#   2. Interned strings. Batch, industry and location repeat across thousands
#      of rows, so each becomes a small integer index into a dictionary shipped
#      once. -1 means "the row has no value", never "" and never a placeholder.
#   3. A folded logo prefix. Every YC logo lives under the same S3 directory;
#      that directory is sent once as `logo_prefix` and stripped from the rows,
#      with a leading "*" marking the ones that were folded. Anything else —
#      another host, a root-relative path — travels whole and unmarked, so the
#      scheme degrades to "no saving" rather than to a broken image if the
#      scrape ever changes host. The marker is what makes that safe: without
#      it, "/static/logo.png" is indistinguishable from a folded tail and gets
#      the prefix glued onto the front of it.
#
# Paid plots do NOT go through any of this. They stay full objects in `plots`,
# with their coordinates untouched to the last digit: a plot's position is the
# spot its buyer paid for. Seeds are rounded to SEED_COORD_DECIMALS (~11 m —
# three orders of magnitude under the ~7 km jitterSeeds() disc they land in on
# the client anyway) because nobody bought them.

#: Column order of every tuple in `seeds.rows`. Positional — appending is
#: safe, reordering or removing is a breaking change; bump SEED_WIRE_VERSION.
SEED_COLUMNS = (
    "id",         # companies.id — the client renders the pin id as f"seed-{id}"
    "lat",        # rounded, see SEED_COORD_DECIMALS
    "lng",
    "name",
    "slug",       # -> GlobePin.company_slug; "" means null
    "batch",      # index into seeds.batches, -1 = none
    "industry",   # index into seeds.industries, -1 = none
    "location",   # index into seeds.locations, -1 = none
    "logo",       # "" = none; SEED_LOGO_FOLD + tail = logo_prefix + tail; else whole URL
    "team_size",  # -1 = unknown (0 is a real, distinct value in the data)
    "flags",      # bitfield: SEED_FLAG_HIRING | SEED_FLAG_TOP_COMPANY
)

SEED_WIRE_VERSION = 1
SEED_COORD_DECIMALS = 4
SEED_FLAG_HIRING = 1
SEED_FLAG_TOP_COMPANY = 2

#: Marks a logo value as "relative to logo_prefix". No URL and no filesystem
#: path begins with it, which is the whole reason it was picked.
SEED_LOGO_FOLD = "*"


class _Interner:
    """Repeated strings -> small integer indices, in first-seen order.

    None and "" both collapse to -1: the payload has one way to say "this row
    has no industry", so the client has one case to handle."""

    def __init__(self):
        self.values: list = []
        self._index: dict = {}

    def index(self, value: Optional[str]) -> int:
        if not value:
            return -1
        found = self._index.get(value)
        if found is None:
            found = len(self.values)
            self._index[value] = found
            self.values.append(value)
        return found


def _first_location(all_locations: Optional[str]) -> Optional[str]:
    """The first ';'-separated segment of companies.all_locations, verbatim.

    Verbatim matters: this is what the retiring deck.gl map grouped hubs by,
    and computeHubs() is being ported to keep that behaviour exactly. In YC's
    data a segment is a whole place string ("San Francisco, CA, USA"), not a
    bare city name — hence the field is called `location`, not `city`."""
    if not all_locations:
        return None
    return (all_locations.split(";")[0] or "").strip() or None


def _common_logo_prefix(urls) -> str:
    """The directory prefix shared by most seed logos, or "" if there is none.

    Derived, never hardcoded: whatever host the scrape writes today is what
    gets folded, and a mixed-host set simply folds the majority. Requires at
    least two users, so a one-off URL is never mistaken for a prefix."""
    counts: dict = {}
    for url in urls:
        if not url:
            continue
        cut = url.rfind("/")
        if cut <= 0:
            continue
        head = url[: cut + 1]
        counts[head] = counts.get(head, 0) + 1
    if not counts:
        return ""
    prefix, hits = max(counts.items(), key=lambda kv: (kv[1], len(kv[0])))
    return prefix if hits >= 2 else ""


def _encode_seed_layer(companies: list) -> dict:
    """Serialize seed pins to the columnar shape documented above.

    Total in pins, lossless in facts: every row in `companies` produces exactly
    one row out. There is no cap, no sampling and no truncation here — if this
    ever needs to ship fewer pins that has to be a visible, deliberate product
    decision, not a quiet slice()."""
    prefix = _common_logo_prefix(c.get("logo_url") for c in companies)
    batches, industries, locations = _Interner(), _Interner(), _Interner()

    rows = []
    for c in companies:
        logo = c.get("logo_url") or ""
        if prefix and logo.startswith(prefix):
            logo = SEED_LOGO_FOLD + logo[len(prefix):]

        team_size = c.get("team_size")
        flags = ((SEED_FLAG_HIRING if c.get("is_hiring") else 0)
                 | (SEED_FLAG_TOP_COMPANY if c.get("top_company") else 0))

        rows.append([
            c["id"],
            round(float(c["lat"]), SEED_COORD_DECIMALS),
            round(float(c["lng"]), SEED_COORD_DECIMALS),
            c["name"],
            c.get("slug") or "",
            batches.index(c.get("batch")),
            industries.index(c.get("industry")),
            locations.index(_first_location(c.get("all_locations"))),
            logo,
            int(team_size) if team_size is not None else -1,
            flags,
        ])

    return {
        "v": SEED_WIRE_VERSION,
        "cols": list(SEED_COLUMNS),
        "batches": batches.values,
        "industries": industries.values,
        "locations": locations.values,
        "logo_prefix": prefix,
        "rows": rows,
    }


def _company_brief(row: Optional[dict]) -> Optional[dict]:
    """The linked company's public facts for the plot detail card, or None.

    Every field is copied straight from the companies row — a value the
    scrape never captured stays null, it never becomes '' or a guess."""
    if not row:
        return None
    return {
        "slug": row["slug"],
        "name": row["name"],
        "logo_url": row.get("logo_url") or None,
        "batch": row.get("batch") or None,
        "one_liner": row.get("one_liner") or None,
        "industry": row.get("industry") or None,
        "team_size": row.get("team_size"),
        "is_hiring": bool(row.get("is_hiring")),
    }


def _board_row(row: dict) -> dict:
    """Normalize country- and plot-board rows onto the shared contract shape.

    logo_url is optional imagery, never a claim: a plot row carries its own
    logo or the linked company's thumb, a country row carries None (the UI
    renders a flag emoji), and an absent logo stays None rather than ''.

    tagline is the plot's own one-liner (falling back to the linked company's),
    and it behaves exactly like logo_url: present when the owner wrote one,
    None otherwise. It is additive — a country-board row has no tagline and
    gets None — and it exists because a ranked list of bare domains tells a
    reader who paid but not who they are. Never synthesised: a plot with no
    words of its own renders no second line at all."""
    return {
        "rank": row["rank"],
        "iso": row.get("iso"),
        "name": row.get("name"),
        "total_cents": row.get("total_cents"),
        "plot_id": row.get("plot_id"),
        "delta_cents": row.get("delta_cents"),
        "logo_url": row.get("logo_url") or None,
        "tagline": row.get("tagline") or None,
    }


def _cents_to_beat(kind: str, rows: list) -> Optional[int]:
    """What a challenger must stake to take rank 1 — or None for "unknown".

    Known only when rank is bought with cents: 'richest' (leader's total) and
    'rising' (leader's 24h delta). 'planted' ranks by count/age, which money
    cannot buy, so the honest answer is None — the UI must say "unknown",
    never guess a price.
    """
    if kind == "planted":
        return None
    if not rows:
        return MIN_STAKE_CENTS  # an empty board: the floor takes rank 1
    leader = rows[0].get("delta_cents") if kind == "rising" else rows[0].get("total_cents")
    if leader is None:
        return None
    return int(leader) + OVERTAKE_MARGIN_CENTS


def _parse_scope(scope: str):
    """'world' | 'country:XX' | 'city:ID' → (country_iso, city_id)."""
    if scope in ("", "world"):
        return None, None
    if scope.startswith("country:"):
        iso = scope[len("country:"):].strip().upper()
        if len(iso) != 2 or not iso.isalpha():
            raise HTTPException(status_code=400, detail="scope country code must be two letters")
        return iso, None
    if scope.startswith("city:"):
        raw = scope[len("city:"):].strip()
        try:
            return None, int(raw)
        except ValueError:
            raise HTTPException(status_code=400, detail="scope city id must be an integer")
    raise HTTPException(status_code=400, detail="scope must be world, country:XX or city:ID")


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

def create_world_router(db, verify_dev_session, verify_admin_session=None) -> APIRouter:
    router = APIRouter()
    geo = get_world_geo()

    def _optional_user_id(authorization: Optional[str]) -> Optional[int]:
        """Best-effort viewer identity for public endpoints (is_mine flags).
        Invalid tokens read as anonymous, never as an error."""
        if not authorization or not authorization.startswith("Bearer "):
            return None
        try:
            session = db.get_api_session(hash_token(authorization[7:].strip()))
        except Exception:
            return None
        return session["user_id"] if session else None

    def _resolve_geography(lat: float, lng: float):
        """(country_iso, city_id_or_None); 400 for ocean, 503 when geo is down."""
        try:
            iso = geo.resolve_country(lat, lng)
        except RuntimeError as e:
            logger.error("world: geography unavailable: %s", e)
            raise HTTPException(status_code=503, detail="Geography is not available on this server.")
        if not iso:
            raise HTTPException(status_code=400, detail="ocean")
        city = geo.nearest_city(db, lat, lng, country_iso=iso, radius_km=CITY_SNAP_RADIUS_KM)
        return iso, (city["id"] if city else None)

    # ---- public reads -----------------------------------------------------

    @router.get("/api/world/globe")
    def world_globe():
        """Every pin on the merged globe, in two layers.

        `plots` — the paid layer, and the product. Full objects, coordinates
        untouched, one per active world_plot. This is what the page is for, so
        it is the layer that stays legible on the wire.

        `seeds` — the imported layer: every geo-located company that nobody has
        claimed yet, as a compact columnar block (see SEED_COLUMNS). Seeds carry
        no row anywhere — a claimed company drops out of the seed set by
        construction, and boards never see seeds because boards read only
        world_plots.

        The client merges the two back into one flat pin list; the split exists
        purely so 5,579 imported pins can carry filterable facts without the
        payload tripling. `seeds` is always present, `seeds.rows` may be empty."""
        pins = []
        for p in db.get_world_plots_for_globe():
            pins.append({
                "id": p["id"], "lat": p["lat"], "lng": p["lng"], "name": p["name"],
                "tier": _tier_bucket(p["total_cents"]), "promoted": bool(p["promoted"]),
                "kind": "plot", "company_slug": p.get("company_slug"),
                # The mark and the money. A paid plot is an advertisement, and
                # both of these are what it advertises — the globe draws the
                # logo on the marker and the amount in the hover card, and
                # neither can wait for a per-plot round trip. `None`, never ''
                # and never a placeholder, when the buyer supplied no logo.
                "logo_url": p.get("logo_url") or None,
                "total_cents": p["total_cents"],
            })
        return {"plots": pins, "seeds": _encode_seed_layer(db.get_world_seed_companies())}

    @router.get("/api/world/board")
    def world_board(kind: str = "richest", scope: str = "world"):
        if kind not in ("richest", "planted", "rising"):
            raise HTTPException(status_code=400, detail="kind must be richest, planted or rising")
        country_iso, city_id = _parse_scope(scope)
        if country_iso is None and city_id is None:
            rows = db.get_world_country_board(kind)
        else:
            rows = db.get_world_plot_board(kind, country_iso=country_iso, city_id=city_id)
        return {"rows": [_board_row(r) for r in rows],
                "cents_to_beat": _cents_to_beat(kind, rows)}

    @router.get("/api/world/founders")
    def world_founders(kind: str = "staked"):
        if kind not in ("staked", "pioneers"):
            raise HTTPException(status_code=400, detail="kind must be staked or pioneers")
        rows = db.get_world_founder_board(kind)
        return {"rows": [{
            "rank": r["rank"], "founder_name": r["founder_name"],
            "plot_id": r["plot_id"], "name": r["name"],
            "total_cents": r["total_cents"], "created_at": r["created_at"],
            # Plot logo, else the linked company's thumb, else null.
            "logo_url": r.get("logo_url") or None,
        } for r in rows]}

    @router.get("/api/world/cities")
    def world_cities(response: Response):
        """The full city reference set as compact tuple rows
        [id, name, country_iso, lat, lng, population] — feeds the globe's
        city-label layer. The set never changes at runtime, so it is cached
        hard (the frontend fetches it once per page load with force-cache)."""
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return {"cities": [
            [c["id"], c["name"], c["country_iso"], c["lat"], c["lng"], c["population"]]
            for c in db.list_world_cities()
        ]}

    @router.get("/api/world/country/{iso}")
    def world_country(iso: str):
        stats = db.get_world_country_stats(iso.upper())
        if not stats:
            raise HTTPException(status_code=404, detail="Unknown country code")
        plots = db.get_world_plot_board("richest", country_iso=iso.upper(), limit=50)
        cities = db.get_world_country_cities(iso.upper())
        # Promoted flags for this country's plot list (featured promotions in
        # the country pool; the plot's own pool is always its country).
        promoted_ids = {pr["plot_id"] for pr in db.get_active_world_promotions(iso.upper())
                        if pr["kind"] == "featured" and pr.get("plot_id") is not None}
        return {
            "iso": stats["iso2"],
            "name": stats["name"],
            "flag_emoji": stats.get("flag_emoji"),
            "centroid_lat": stats.get("centroid_lat"),
            "centroid_lng": stats.get("centroid_lng"),
            "rank_richest": stats.get("rank_richest"),
            "rank_planted": stats.get("rank_planted"),
            "total_cents": stats["total_cents"],
            "plots_count": stats["plots_count"],
            "plots": [{**_board_row(r), "id": r["plot_id"],
                       "promoted": r["plot_id"] in promoted_ids} for r in plots],
            "cities": [{
                "id": c["id"], "name": c["name"], "total_cents": c["total_cents"],
                "plots_count": c.get("plots_count"),
                "top_plot": ({"id": c["top_plot_id"], "name": c["top_plot_name"],
                              "total_cents": c.get("top_plot_total_cents")}
                             if c.get("top_plot_id") is not None else None),
            } for c in cities],
        }

    def _rank_of(rows: list, plot_id: int) -> Optional[int]:
        for r in rows:
            if r.get("plot_id") == plot_id:
                return r["rank"]
        return None

    @router.get("/api/world/plots/{plot_id}")
    def world_plot_detail(plot_id: int, authorization: Optional[str] = Header(None)):
        plot = db.get_world_plot(plot_id)
        if not plot:
            raise HTTPException(status_code=404, detail="Plot not found")
        is_mine = None
        if authorization:
            viewer = _optional_user_id(authorization)
            is_mine = viewer is not None and viewer == plot.get("user_id")
        out = _public_plot(plot, is_mine=is_mine)
        # The linked company's public facts, so the detail card can show a real
        # logo and one-liner without a second round trip. Null when the plot is
        # unlinked, or when the company row has since gone.
        out["company"] = (_company_brief(db.get_company_brief(plot["company_id"]))
                          if plot.get("company_id") is not None else None)
        # Richest-board ranks for the share/OG surfaces. A pending plot is off
        # the boards, so its ranks are honestly None (rendered as an em dash).
        out["rank_world"] = _rank_of(db.get_world_plot_board("richest", limit=1_000_000), plot_id)
        out["rank_country"] = _rank_of(
            db.get_world_plot_board("richest", country_iso=plot["country_iso"], limit=1_000_000),
            plot_id)
        return out

    @router.get("/api/world/where")
    def world_where(lat: float, lng: float):
        """Server geography preview for the claim wizard. 400 'ocean' when the
        point is not on land."""
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            raise HTTPException(status_code=400, detail="lat/lng out of range")
        iso, city_id = _resolve_geography(lat, lng)
        country = db.get_world_country(iso)
        city = db.get_world_city(city_id) if city_id is not None else None
        return {
            "country_iso": iso,
            "country_name": (country or {}).get("name") or geo.country_name(iso),
            "city_id": city_id,
            "city_name": city["name"] if city else None,
        }

    @router.get("/api/world/pulse")
    def world_pulse():
        return {"events": [{
            "type": e["type"], "name": e["name"], "country_iso": e["country_iso"],
            "amount_cents": e["amount_cents"], "at": e["at"],
        } for e in db.get_world_pulse()]}

    # ---- audience: who actually sees this ----------------------------------
    #
    # The question a $5 plot is bought to answer — "how many people will see my
    # logo?" — so this is the endpoint where an invented number would cost the
    # most. Two figures, and the rule for each is in world_audience.py:
    #
    #   viewers_now   ours, live, always a real integer (possibly 0 or 1).
    #   the rest      the last successful Vercel Web Analytics read, or NULL.
    #
    # NULL is not zero and is never rendered as one: with no
    # VERCEL_ANALYTICS_TOKEN configured, every traffic field below comes back
    # null and the UI omits the reach line entirely.

    def _audience(cached: Optional[dict]) -> dict:
        """Assemble the public contract from an already-fetched cache row."""
        row = cached or {}
        return {
            # Live presence, counted from world_presence. Not cached, not
            # smoothed, never rounded up — 1 means one person is looking.
            "viewers_now": db.count_world_presence(world_audience.PRESENCE_WINDOW_SECONDS),
            "window_seconds": world_audience.PRESENCE_WINDOW_SECONDS,
            "beat_seconds": world_audience.BEAT_INTERVAL_SECONDS,
            # Platform reach. All null until a real read has been cached.
            "visitors_30d": row.get("visitors_30d"),
            "pageviews_30d": row.get("pageviews_30d"),
            "countries_count": row.get("countries_count"),
            # True => countries_count is a floor, because the breakdown filled
            # its page. The UI prints a "+" rather than claiming a total.
            "countries_capped": bool(row.get("countries_capped")),
            "top_countries": row.get("top_countries") or [],
            "window_days": row.get("window_days"),
            # End of the measured window, so the UI can say WHEN, not just what.
            "updated_at": row.get("measured_at"),
            "source": row.get("source"),
        }

    @router.get("/api/world/audience")
    def world_audience_read(background: BackgroundTasks, response: Response):
        """Platform reach + live viewers. Reads the cache; never fetches inline.

        The only outbound request this endpoint can cause is a BACKGROUND one,
        scheduled at most once per process per MIN_ATTEMPT_INTERVAL_SECONDS and
        only when the cached row is older than REFRESH_AFTER_SECONDS. The
        response is always the row we already had.
        """
        cached = db.get_world_audience()
        if world_audience.should_refresh(cached):
            background.add_task(world_audience.refresh, db)
        # Short and shared: the payload is identical for every visitor, and 15s
        # is under the client's own 20s beat, so a cached copy is never the
        # reason a viewer count looks stuck.
        response.headers["Cache-Control"] = "public, max-age=15"
        return _audience(cached)

    @router.post("/api/world/beat")
    def world_presence_beat(req: BeatRequest):
        """One anonymous heartbeat from a World surface, and the same payload
        back — so the client gets a fresh count without a second request.

        What this stores: an opaque client-generated id and a timestamp. What it
        does NOT store: an IP, a user id, a cookie, a user agent, a referrer.
        Every beat also prunes rows older than PRESENCE_PRUNE_SECONDS, so the
        table cannot accumulate yesterday's visitors.
        """
        if not world_audience.valid_session_id(req.session_id):
            raise HTTPException(
                status_code=400,
                detail="session_id must be 8-64 characters of A-Z, a-z, 0-9, '-' or '_'")
        db.record_world_presence(req.session_id)
        db.prune_world_presence(world_audience.PRESENCE_PRUNE_SECONDS)
        return _audience(db.get_world_audience())

    @router.get("/api/world/promotions")
    def world_promotions(scope: str = "world"):
        country_iso, city_id = _parse_scope(scope)
        if city_id is not None:
            raise HTTPException(status_code=400, detail="scope must be world or country:XX")
        promos = db.get_active_world_promotions(country_iso)
        featured, sponsors = [], []
        for pr in promos:
            if pr["kind"] == "featured":
                featured.append({
                    "plot_id": pr["plot_id"],
                    "name": pr.get("plot_name") or pr.get("label"),
                    "logo_url": pr.get("plot_logo_url") or pr.get("logo_url"),
                    "ends_at": pr["ends_at"],
                })
            else:
                sponsors.append({
                    "label": pr.get("label"), "url": pr.get("url"),
                    "logo_url": pr.get("logo_url"), "ends_at": pr["ends_at"],
                })
        return {"featured": featured, "sponsors": sponsors}

    @router.get("/api/world/claimed")
    def world_claimed(session_id: str = ""):
        """Post-checkout landing poll (no auth — the buyer may not be logged in
        on the return device). Resolves a Checkout Session id to the plot the
        webhook minted, waiting out the usually sub-second gap. Reading this
        proves nothing and writes nothing — a success URL is a URL anyone can
        type."""
        if not session_id:
            raise HTTPException(status_code=400, detail="session_id is required")
        payment = db.get_world_payment_by_session(session_id)
        if payment:
            return {"status": "done", "plot_id": payment["plot_id"]}
        promo = db.get_world_promotion_by_session(session_id)
        if promo:
            return {"status": "done", "plot_id": promo.get("plot_id")}
        return {"status": "pending", "plot_id": None}

    # ---- checkout (auth; sync def — the Stripe SDK blocks and FastAPI runs
    # sync handlers in the threadpool) ---------------------------------------

    @router.post("/api/world/checkout")
    def world_checkout(payload: WorldCheckoutRequest,
                       session: dict = Depends(verify_dev_session)):
        _stripe_ready()
        user_id = session["user_id"]

        if payload.amount_cents < MIN_STAKE_CENTS:
            raise HTTPException(status_code=400,
                                detail=f"Minimum stake is ${MIN_STAKE_CENTS / 100:.2f}.")
        if payload.amount_cents > MAX_STAKE_CENTS:
            raise HTTPException(status_code=400, detail="That amount is above the per-payment limit.")

        if payload.plot_id is not None:
            # Top-up. The geography of an existing plot is settled; re-resolving
            # from this request's coordinates would let a buyer relocate their
            # listing — and its city and country rank — by paying $5 with
            # different numbers in the body. The stored values win.
            plot = db.get_world_plot(payload.plot_id)
            if not plot:
                raise HTTPException(status_code=400, detail="That plot does not exist.")
            if plot["status"] != "active":
                # Taking money to raise the rank of something that is not
                # rendered is taking money for nothing.
                raise HTTPException(status_code=400, detail="That plot is not currently available.")
            lat, lng = plot["lat"], plot["lng"]
            country_iso, city_id = plot["country_iso"], plot.get("city_id")
            company_id = plot.get("company_id")
        else:
            # Links are validated here, pre-payment, where a bad one costs a
            # 400 instead of a stored javascript: href (the webhook trusts
            # this metadata because only this code writes it).
            validate_link(payload.url, "url")
            validate_link(payload.founder_link, "founder_link")
            country_iso, city_id = _resolve_geography(payload.lat, payload.lng)
            lat, lng = payload.lat, payload.lng
            company_id = payload.company_id
            if company_id is not None and db.get_world_plot_by_company(company_id):
                raise HTTPException(status_code=409, detail="That company has already been claimed.")

        # Prove the resolved ISO exists in world_countries before taking money:
        # a bad code here costs a 400; in the webhook it costs a captured
        # payment with no listing behind it.
        country = db.get_world_country(country_iso)
        if not country:
            logger.error("world: resolved iso %s missing from world_countries", country_iso)
            raise HTTPException(status_code=500, detail="Could not place that point. Try somewhere else.")

        metadata = {
            "product": "world_plot",
            "user_id": _meta(user_id),
            "lat": _meta(lat),
            "lng": _meta(lng),
            "country_iso": _meta(country_iso),
            "city_id": _meta(city_id),
            "name": _meta(payload.name),
            "url": _meta(payload.url),
            "tagline": _meta(payload.tagline),
            "founder_name": _meta(payload.founder_name),
            "founder_title": _meta(payload.founder_title),
            "founder_link": _meta(payload.founder_link),
            "company_id": _meta(company_id),
            "plot_id": _meta(payload.plot_id),
        }
        try:
            checkout = stripe.checkout.Session.create(
                mode="payment",
                client_reference_id=str(user_id),
                line_items=[{
                    "quantity": 1,
                    "price_data": {
                        "currency": "usd",
                        "unit_amount": payload.amount_cents,
                        "product_data": {
                            "name": f"ExploreYC World — a plot in {country['name']}",
                            "description": NOT_A_BET,
                        },
                    },
                }],
                metadata=metadata,
                # Mirrored onto the PaymentIntent so the metadata is still
                # attached when someone is looking at a charge or a dispute.
                payment_intent_data={"metadata": metadata},
                success_url=f"{FRONTEND_URL}/world/claimed?session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{FRONTEND_URL}/world?canceled=1",
                submit_type="pay",
                allow_promotion_codes=False,
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error("world: checkout session failed: %s", e)
            raise HTTPException(status_code=400,
                                detail=_stripe_error_detail(e, "Could not start checkout."))
        if not checkout.url:
            raise HTTPException(status_code=500, detail="Could not start checkout. Try again.")
        return {"checkout_url": checkout.url}

    @router.post("/api/world/promotions/checkout")
    def world_promotion_checkout(payload: PromotionCheckoutRequest,
                                 session: dict = Depends(verify_dev_session)):
        _stripe_ready()
        user_id = session["user_id"]
        tier = PROMOTION_TIERS.get(payload.tier)
        if not tier:
            raise HTTPException(status_code=400,
                                detail=f"tier must be one of: {list(PROMOTION_TIERS)}")
        plot = db.get_world_plot(payload.plot_id)
        if not plot:
            raise HTTPException(status_code=404, detail="Plot not found")
        if plot.get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="You can only promote your own plot.")
        if plot["status"] != "active":
            raise HTTPException(status_code=400, detail="That plot is not currently visible.")
        # Scarcity cap, enforced at checkout time. Race note: two buyers can
        # both pass this check and both pay; acceptable at launch scale and
        # far better than refusing a paid promotion in the webhook.
        if db.count_active_featured(plot["country_iso"]) >= MAX_ACTIVE_FEATURED_PER_COUNTRY:
            raise HTTPException(
                status_code=409,
                detail="All featured slots for this country are taken right now. Try again when one expires.")

        metadata = {
            "product": "world_promotion",
            "user_id": _meta(user_id),
            "plot_id": _meta(payload.plot_id),
            "tier": _meta(payload.tier),
            "country_iso": _meta(plot["country_iso"]),
        }
        try:
            checkout = stripe.checkout.Session.create(
                mode="payment",
                client_reference_id=str(user_id),
                line_items=[{
                    "quantity": 1,
                    "price_data": {
                        "currency": "usd",
                        "unit_amount": tier["amount_cents"],
                        "product_data": {
                            "name": f"ExploreYC World — featured placement ({tier['days']} days)",
                            "description": "Time-boxed promoted placement on the World globe. "
                                           "Always labeled 'Promoted'. No refund.",
                        },
                    },
                }],
                metadata=metadata,
                payment_intent_data={"metadata": metadata},
                success_url=f"{FRONTEND_URL}/world/claimed?session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{FRONTEND_URL}/world?canceled=1",
                submit_type="pay",
                allow_promotion_codes=False,
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error("world: promotion checkout failed: %s", e)
            raise HTTPException(status_code=400,
                                detail=_stripe_error_detail(e, "Could not start checkout."))
        if not checkout.url:
            raise HTTPException(status_code=500, detail="Could not start checkout. Try again.")
        return {"checkout_url": checkout.url}

    # ---- owner management (auth) ------------------------------------------

    def _owned_plot(plot_id: int, session: dict) -> dict:
        plot = db.get_world_plot(plot_id)
        if not plot:
            raise HTTPException(status_code=404, detail="Plot not found")
        if plot.get("user_id") != session["user_id"]:
            raise HTTPException(status_code=403, detail="Not your plot")
        return plot

    @router.patch("/api/world/plots/{plot_id}")
    def world_plot_update(plot_id: int, payload: PlotUpdateRequest,
                          session: dict = Depends(verify_dev_session)):
        plot = _owned_plot(plot_id, session)
        fields = {k: v for k, v in payload.model_dump().items() if v is not None}
        if not fields:
            raise HTTPException(status_code=400, detail="Nothing to update")
        # Same link rules as checkout: an edit must not store what a claim
        # could not (javascript:/data:/http: hrefs).
        if "url" in fields:
            fields["url"] = validate_link(fields["url"], "url")
        if "founder_link" in fields:
            fields["founder_link"] = validate_link(fields["founder_link"], "founder_link")
        # Edits re-run moderation exactly as a fresh listing would: the merged
        # result (new values over stored) decides active vs pending.
        merged = {k: fields.get(k, plot.get(k))
                  for k in ("name", "tagline", "founder_name", "founder_title",
                            "founder_link", "url")}
        fields["status"] = status_for_listing(
            merged["name"], merged["tagline"], merged["founder_name"],
            merged["founder_title"], merged["founder_link"], merged["url"])
        db.update_world_plot(plot_id, fields)
        return _public_plot(db.get_world_plot(plot_id), is_mine=True)

    @router.post("/api/world/plots/{plot_id}/logo")
    def world_plot_logo(plot_id: int, payload: PlotLogoRequest,
                        session: dict = Depends(verify_dev_session)):
        _owned_plot(plot_id, session)
        logo = payload.logo_data_url
        if not logo.startswith("data:image/"):
            raise HTTPException(status_code=400, detail="logo_data_url must be a data:image/* URL")
        if len(logo) > 400_000:
            raise HTTPException(status_code=400,
                                detail="Image too large (max ~300KB). Please crop or shrink it.")
        db.update_world_plot(plot_id, {"logo_url": logo})
        return _public_plot(db.get_world_plot(plot_id), is_mine=True)

    @router.get("/api/world/mine")
    def world_mine(session: dict = Depends(verify_dev_session)):
        plots = [_public_plot(p, is_mine=True) for p in db.get_world_plots_for_user(session["user_id"])]
        promotions = [{
            "id": pr["id"], "kind": pr["kind"], "plot_id": pr.get("plot_id"),
            "plot_name": pr.get("plot_name"), "country_iso": pr.get("country_iso"),
            "starts_at": pr.get("starts_at"), "ends_at": pr.get("ends_at"),
            "amount_cents": pr.get("amount_cents"), "status": pr.get("status"),
        } for pr in db.get_world_promotions_for_user(session["user_id"])]
        return {"plots": plots, "promotions": promotions}

    # ---- admin sponsor slots (mounted only when the caller provides the
    # admin dependency; no payment involved) --------------------------------

    if verify_admin_session is not None:
        class SponsorSlotRequest(BaseModel):
            label: str = Field(min_length=1, max_length=80)
            url: Optional[str] = Field(None, max_length=2048)
            logo_url: Optional[str] = None
            country_iso: Optional[str] = None  # None = global
            starts_at: Optional[datetime] = None
            ends_at: datetime

        @router.post("/api/admin/world/promotions")
        def admin_create_sponsor(payload: SponsorSlotRequest,
                                 _: dict = Depends(verify_admin_session)):
            result = db.create_world_promotion({
                "kind": "sponsor",
                "label": payload.label,
                "url": payload.url,
                "logo_url": payload.logo_url,
                "country_iso": payload.country_iso,
                "starts_at": payload.starts_at,
                "ends_at": payload.ends_at,
                "amount_cents": 0,
                "status": "active",
            })
            return {"id": result["id"]}

        @router.delete("/api/admin/world/promotions/{promo_id}")
        def admin_revoke_promotion(promo_id: int, _: dict = Depends(verify_admin_session)):
            if not db.revoke_world_promotion(promo_id):
                raise HTTPException(status_code=404, detail="Promotion not found")
            return {"success": True}

    return router
