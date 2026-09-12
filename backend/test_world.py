"""
Tests for ExploreYC World — checkout validation, webhook fulfillment,
boards and promotions (world.py + world_geo.py + the billing.py branch).

Pattern of test_billing.py: fakes, no network, no Stripe account. Checkout
endpoints run against a FastAPI TestClient with a stubbed stripe module;
fulfillment is driven through billing.handle_stripe_event with dict events
(the same shape stripe-python deserializes to). The DB is the real SQLite
layer on a temp file, so UNIQUE-constraint idempotency and rank() window
functions are exercised for real, not mocked.

Run: python -m pytest test_world.py
"""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

import world
import world_audience
from billing import handle_stripe_event
from database import Database
from world import fulfill_world_checkout, screen, status_for_listing
from world_constants import MIN_STAKE_CENTS, OVERTAKE_MARGIN_CENTS

# Sofia city centre — resolves to BG and snaps to the seeded Sofia row.
SOFIA = (42.6977, 23.3219)
# Mid-Atlantic — open ocean, must refuse.
OCEAN = (0.0, -35.0)


# ---- fixtures / helpers ----------------------------------------------------

@pytest.fixture
def db(tmp_path):
    d = Database(str(tmp_path / "world_test.db"))
    with d.get_connection() as conn:
        conn.executemany(
            """INSERT INTO world_countries (iso2, iso3, name, flag_emoji, centroid_lat, centroid_lng)
               VALUES (?, ?, ?, ?, ?, ?)""",
            [("BG", "BGR", "Bulgaria", "🇧🇬", 42.75, 25.49),
             ("US", "USA", "United States", "🇺🇸", 39.78, -100.45),
             ("FR", "FRA", "France", "🇫🇷", 46.62, 2.45)],
        )
        conn.executemany(
            """INSERT INTO world_cities (id, name, country_iso, lat, lng, population)
               VALUES (?, ?, ?, ?, ?, ?)""",
            [(1, "Sofia", "BG", 42.6977, 23.3219, 1236000),
             (2, "San Francisco", "US", 37.7749, -122.4194, 873965)],
        )
    return d


@pytest.fixture(autouse=True)
def _audience_throttle_is_per_test():
    """world_audience keeps a PROCESS-level refresh throttle, which would leak
    between tests and make the second one that touches it silently a no-op."""
    world_audience.reset_throttle()
    yield
    world_audience.reset_throttle()


def _user(db, email="founder@example.com", plan="free"):
    user_id = db.create_api_user(email, "x" * 32)
    if plan != "free":
        db.set_api_user_plan(user_id, plan)
    return user_id


def _plant(db, user_id, name="Acme", iso="BG", cents=500, **kw):
    return db.create_world_plot({
        "user_id": user_id, "name": name, "lat": kw.pop("lat", SOFIA[0]),
        "lng": kw.pop("lng", SOFIA[1]), "country_iso": iso,
        "total_cents": cents, **kw,
    })


def _plot_event(session_id, amount, metadata, mode="payment", payment_status="paid",
                user_id=None):
    md = {"product": "world_plot", **metadata}
    return {"type": "checkout.session.completed",
            "data": {"object": {
                "id": session_id, "mode": mode, "payment_status": payment_status,
                "amount_total": amount,
                "client_reference_id": str(user_id) if user_id else md.get("user_id"),
                "metadata": md,
            }}}


def _new_plot_md(user_id, name="Acme", iso="BG", lat=SOFIA[0], lng=SOFIA[1], **extra):
    return {"user_id": str(user_id), "name": name, "country_iso": iso,
            "lat": str(lat), "lng": str(lng), **extra}


class FakeStripe:
    """Records checkout.Session.create params; never touches the network."""

    api_key = None

    def __init__(self, url="https://stripe.test/cs_1", session_id="cs_1"):
        self.sessions = []
        outer = self

        class _Session:
            @staticmethod
            def create(**params):
                outer.sessions.append(params)
                return SimpleNamespace(url=url, id=session_id)

        self.checkout = SimpleNamespace(Session=_Session)


def _client(db, user_id=None, monkeypatch=None, fake_stripe=None):
    """TestClient over the world router with a fake dev session."""
    if user_id is None:
        def session_dep():
            raise HTTPException(status_code=401, detail="Missing authorization header")
    else:
        def session_dep():
            return {"user_id": user_id, "user_status": "active"}
    if monkeypatch is not None:
        monkeypatch.setattr(world, "stripe", fake_stripe or FakeStripe())
        monkeypatch.setattr(world, "STRIPE_SECRET_KEY", "sk_test_stub")
    app = FastAPI()
    app.include_router(world.create_world_router(db, session_dep))
    return TestClient(app)


def _claim_payload(amount=1000, **overrides):
    payload = {"lat": SOFIA[0], "lng": SOFIA[1], "name": "Acme",
               "url": "https://acme.example", "tagline": "We do things",
               "amount_cents": amount}
    payload.update(overrides)
    return payload


# ---- moderation ------------------------------------------------------------

def test_clean_listing_is_active():
    assert status_for_listing("Acme Robotics", "We build robots") == "active"


def test_denylist_variants_hit():
    assert screen("total fuck up") is not None          # word boundary
    assert screen("f u c k this") is not None           # spaced run
    assert screen("v14gra deals") is not None           # leetspeak fold
    assert screen("visit evil.com now") is not None     # embedded url
    assert screen("Scunthorpe Systems") is None         # Scunthorpe rule holds


# ---- checkout validation ---------------------------------------------------

def test_checkout_requires_auth(db, monkeypatch):
    client = _client(db, user_id=None, monkeypatch=monkeypatch)
    r = client.post("/api/world/checkout", json=_claim_payload())
    assert r.status_code == 401


def test_checkout_enforces_floor(db, monkeypatch):
    uid = _user(db)
    client = _client(db, uid, monkeypatch)
    r = client.post("/api/world/checkout", json=_claim_payload(amount=MIN_STAKE_CENTS - 1))
    assert r.status_code == 400
    assert "5.00" in r.json()["detail"]


def test_checkout_rejects_ocean(db, monkeypatch):
    uid = _user(db)
    client = _client(db, uid, monkeypatch)
    r = client.post("/api/world/checkout",
                    json=_claim_payload(lat=OCEAN[0], lng=OCEAN[1]))
    assert r.status_code == 400
    assert r.json()["detail"] == "ocean"


def test_checkout_503_when_stripe_unconfigured(db, monkeypatch):
    uid = _user(db)
    client = _client(db, uid, monkeypatch)
    monkeypatch.setattr(world, "STRIPE_SECRET_KEY", None)
    r = client.post("/api/world/checkout", json=_claim_payload())
    assert r.status_code == 503


def test_checkout_resolves_geography_server_side(db, monkeypatch):
    uid = _user(db)
    fake = FakeStripe()
    client = _client(db, uid, monkeypatch, fake_stripe=fake)
    r = client.post("/api/world/checkout", json=_claim_payload(amount=1500))
    assert r.status_code == 200
    assert r.json() == {"checkout_url": "https://stripe.test/cs_1"}

    assert len(fake.sessions) == 1
    params = fake.sessions[0]
    assert params["mode"] == "payment"
    assert params["client_reference_id"] == str(uid)
    md = params["metadata"]
    assert md["product"] == "world_plot"
    assert md["country_iso"] == "BG"        # resolved by the server, not sent
    assert md["city_id"] == "1"             # snapped to Sofia
    # Mirrored to the PaymentIntent for dispute visibility.
    assert params["payment_intent_data"]["metadata"] == md
    assert params["line_items"][0]["price_data"]["unit_amount"] == 1500
    assert "/world/claimed?session_id={CHECKOUT_SESSION_ID}" in params["success_url"]
    # Checkout writes nothing — the webhook is the sole writer of money.
    with db.get_connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM world_plots").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM world_payments").fetchone()[0] == 0


def test_topup_checkout_uses_stored_geography(db, monkeypatch):
    """A top-up must not let the buyer relocate the plot by lying about lat/lng."""
    uid = _user(db)
    plot_id = _plant(db, uid, iso="BG")
    fake = FakeStripe()
    client = _client(db, uid, monkeypatch, fake_stripe=fake)
    r = client.post("/api/world/checkout",
                    json=_claim_payload(plot_id=plot_id, lat=48.8566, lng=2.3522))  # Paris
    assert r.status_code == 200
    md = fake.sessions[0]["metadata"]
    assert md["country_iso"] == "BG"
    assert float(md["lat"]) == pytest.approx(SOFIA[0])
    assert md["plot_id"] == str(plot_id)


def test_checkout_refuses_already_claimed_company(db, monkeypatch):
    uid = _user(db)
    _plant(db, uid, company_id=77)
    client = _client(db, uid, monkeypatch)
    r = client.post("/api/world/checkout", json=_claim_payload(company_id=77))
    assert r.status_code == 409


# ---- THE regression: mode=payment never touches api_users.plan -------------

def test_mode_payment_session_never_modifies_plan(db):
    uid = _user(db, plan="pro")  # a paying Pro subscriber buys a plot
    event = _plot_event("cs_reg_1", 1000, _new_plot_md(uid), user_id=uid)
    result = handle_stripe_event(db, event)
    assert result["handled"] is True
    assert result["outcome"] == "created"
    # The hazard this guards: plan_for_price("") → None → "free" would have
    # silently downgraded the subscriber. The plan must be untouched.
    assert db.get_api_user_by_id(uid)["plan"] == "pro"


def test_foreign_payment_session_is_ignored_and_plan_untouched(db):
    uid = _user(db, plan="max")
    event = {"type": "checkout.session.completed",
             "data": {"object": {"id": "cs_other", "mode": "payment",
                                 "payment_status": "paid", "amount_total": 700,
                                 "client_reference_id": str(uid),
                                 "metadata": {"product": "gift_card"}}}}
    result = handle_stripe_event(db, event)
    assert result["outcome"] == "ignored"
    assert db.get_api_user_by_id(uid)["plan"] == "max"
    with db.get_connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM world_payments").fetchone()[0] == 0


def test_subscription_checkout_still_reaches_billing_path(db, monkeypatch):
    """The world branch must not swallow subscription sessions (no mode, no product)."""
    import billing

    class _StubSub:
        @staticmethod
        def retrieve(sub_id):
            return {"status": "active", "items": {"data": [{"price": {"id": "price_x"}}]}}

    monkeypatch.setattr(billing, "stripe", SimpleNamespace(Subscription=_StubSub))
    monkeypatch.setattr(billing, "STRIPE_SECRET_KEY", "sk_test_stub")
    uid = _user(db)
    event = {"type": "checkout.session.completed",
             "data": {"object": {"client_reference_id": str(uid), "customer": "cus_1",
                                 "subscription": "sub_1", "metadata": {"plan": "pro"}}}}
    result = handle_stripe_event(db, event)
    assert result["handled"] is True
    assert "plan" in result  # went down the subscription path


# ---- fulfillment -----------------------------------------------------------

def test_new_plot_fulfillment(db):
    uid = _user(db)
    md = _new_plot_md(uid, tagline="We do things", founder_name="Ana",
                      city_id="1", url="https://acme.example")
    result = fulfill_world_checkout(db, _plot_event("cs_1", 2500, md, user_id=uid)["data"]["object"])
    assert result["outcome"] == "created"
    plot = db.get_world_plot(result["plot_id"])
    assert plot["total_cents"] == 2500      # amount_total, the receipt
    assert plot["status"] == "active"
    assert plot["founder_name"] == "Ana"
    assert plot["city_id"] == 1
    assert plot["user_id"] == uid


def test_fulfillment_is_idempotent(db):
    """Duplicate delivery of the same session id → a single credit."""
    uid = _user(db)
    event = _plot_event("cs_dup", 1000, _new_plot_md(uid), user_id=uid)
    first = handle_stripe_event(db, event)
    second = handle_stripe_event(db, event)
    assert first["outcome"] == "created"
    assert second["outcome"] == "duplicate"
    plot = db.get_world_plot(first["plot_id"])
    assert plot["total_cents"] == 1000  # credited exactly once
    with db.get_connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM world_plots").fetchone()[0] == 1
        assert conn.execute("SELECT COUNT(*) FROM world_payments").fetchone()[0] == 1


def test_topup_credits_and_ignores_text_fields(db):
    uid = _user(db)
    plot_id = _plant(db, uid, name="Original", cents=500, tagline="honest line")
    md = {"user_id": str(uid), "plot_id": str(plot_id),
          "name": "HACKED", "tagline": "unmoderated rewrite"}
    result = fulfill_world_checkout(db, _plot_event("cs_top", 700, md, user_id=uid)["data"]["object"])
    assert result["outcome"] == "topped-up"
    plot = db.get_world_plot(plot_id)
    assert plot["total_cents"] == 1200
    assert plot["name"] == "Original"           # checkout is not an edit path
    assert plot["tagline"] == "honest line"


def test_topup_duplicate_session_single_credit(db):
    uid = _user(db)
    plot_id = _plant(db, uid, cents=500)
    obj = _plot_event("cs_top_dup", 700, {"user_id": str(uid), "plot_id": str(plot_id)},
                      user_id=uid)["data"]["object"]
    assert fulfill_world_checkout(db, obj)["outcome"] == "topped-up"
    assert fulfill_world_checkout(db, obj)["outcome"] == "duplicate"
    assert db.get_world_plot(plot_id)["total_cents"] == 1200


def test_unpaid_session_credits_nothing(db):
    uid = _user(db)
    event = _plot_event("cs_unpaid", 1000, _new_plot_md(uid), user_id=uid,
                        payment_status="unpaid")
    result = handle_stripe_event(db, event)
    assert result["outcome"] == "ignored"
    with db.get_connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM world_plots").fetchone()[0] == 0


def test_moderation_hit_holds_render_never_money(db):
    uid = _user(db)
    md = _new_plot_md(uid, name="Fuck Yeah Inc")
    result = fulfill_world_checkout(db, _plot_event("cs_mod", 900, md, user_id=uid)["data"]["object"])
    assert result["outcome"] == "created"
    plot = db.get_world_plot(result["plot_id"])
    assert plot["status"] == "pending"      # held, not rendered
    assert plot["total_cents"] == 900       # but paid for and credited


def test_seed_claim_and_second_claim_becomes_topup(db):
    uid1, uid2 = _user(db, "a@x.com"), _user(db, "b@x.com")
    with db.get_connection() as conn:
        conn.execute("""INSERT INTO companies (id, name, slug, latitude, longitude)
                        VALUES (55, 'SeedCo', 'seedco', 42.7, 23.3)""")
    assert any(c["id"] == 55 for c in db.get_world_seed_companies())

    md1 = _new_plot_md(uid1, name="SeedCo", company_id="55")
    r1 = fulfill_world_checkout(db, _plot_event("cs_s1", 1000, md1, user_id=uid1)["data"]["object"])
    assert r1["outcome"] == "created"
    # Claimed: the virtual seed pin disappears by construction.
    assert not any(c["id"] == 55 for c in db.get_world_seed_companies())

    # Second buyer paying for the same company out-stakes the owner: top-up,
    # their text never overwrites the first claim.
    md2 = _new_plot_md(uid2, name="Stolen Name", company_id="55")
    r2 = fulfill_world_checkout(db, _plot_event("cs_s2", 600, md2, user_id=uid2)["data"]["object"])
    assert r2["outcome"] == "topped-up"
    plot = db.get_world_plot(r1["plot_id"])
    assert plot["name"] == "SeedCo"
    assert plot["total_cents"] == 1600


# ---- boards ----------------------------------------------------------------

def test_board_joint_ranks_over_full_set(db):
    uid = _user(db)
    _plant(db, uid, name="A", iso="US", cents=1000, lat=37.7, lng=-122.4)
    _plant(db, uid, name="B", iso="BG", cents=1000)
    _plant(db, uid, name="C", iso="FR", cents=500, lat=48.8, lng=2.35)
    client = _client(db, uid)
    rows = client.get("/api/world/board?kind=richest&scope=world").json()["rows"]
    assert [r["rank"] for r in rows] == [1, 1, 3]    # joint ranks are real
    assert all(r["plot_id"] is None for r in rows)   # world scope = countries


def test_cents_to_beat_richest_and_unknown_planted(db):
    uid = _user(db)
    _plant(db, uid, name="Leader", iso="BG", cents=2000)
    client = _client(db, uid)
    richest = client.get("/api/world/board?kind=richest&scope=world").json()
    assert richest["cents_to_beat"] == 2000 + OVERTAKE_MARGIN_CENTS
    # 'planted' ranks by count/age — money cannot buy it, so the honest
    # answer is unknown: an explicit null, never a guessed price.
    planted = client.get("/api/world/board?kind=planted&scope=world").json()
    assert planted["cents_to_beat"] is None


def test_cents_to_beat_on_empty_board_is_the_floor(db):
    client = _client(db, _user(db))
    body = client.get("/api/world/board?kind=richest&scope=world").json()
    assert body["rows"] == []
    assert body["cents_to_beat"] == MIN_STAKE_CENTS


def test_board_country_scope_rows_are_plots(db):
    uid = _user(db)
    p1 = _plant(db, uid, name="A", iso="BG", cents=900)
    _plant(db, uid, name="B", iso="US", cents=5000, lat=37.7, lng=-122.4)
    client = _client(db, uid)
    rows = client.get("/api/world/board?kind=richest&scope=country:BG").json()["rows"]
    assert [r["plot_id"] for r in rows] == [p1]


def test_board_rejects_bad_kind_and_scope(db):
    client = _client(db, _user(db))
    assert client.get("/api/world/board?kind=weird").status_code == 400
    assert client.get("/api/world/board?kind=richest&scope=galaxy:1").status_code == 400


def test_virtual_seeds_excluded_from_boards_but_on_globe(db):
    uid = _user(db)
    with db.get_connection() as conn:
        conn.execute("""INSERT INTO companies (id, name, slug, latitude, longitude)
                        VALUES (9, 'GhostCo', 'ghostco', 42.7, 23.3)""")
    client = _client(db, uid)
    seeds = _decode_seeds(client.get("/api/world/globe").json())
    assert len(seeds) == 1 and seeds[0]["company_slug"] == "ghostco" and seeds[0]["tier"] == 0
    # Boards read only world_plots, so seeds can never appear.
    assert client.get("/api/world/board?kind=planted&scope=world").json()["rows"] == []
    assert client.get("/api/world/board?kind=richest&scope=country:BG").json()["rows"] == []


# ---- the globe payload -----------------------------------------------------
#
# The merged globe filters and renders the imported layer, so seed pins carry
# batch/industry/location/logo/team/hiring. They travel columnar (world.py,
# SEED_COLUMNS) to stop 5,579 pins tripling the payload, so these tests decode
# the wire exactly the way frontend/src/lib/worldApi.ts does — the helper below
# is the contract written twice, on purpose, in the two languages that have to
# agree about it.

def _decode_seeds(body: dict) -> list:
    """Wire -> the GlobePins the client renders. Mirrors decodeGlobe()."""
    layer = body["seeds"]
    assert layer["cols"] == list(world.SEED_COLUMNS), "tuple order is the contract"

    def at(dictionary, i):
        return dictionary[i] if 0 <= i < len(dictionary) else None

    out = []
    for cid, lat, lng, name, slug, bi, ii, li, logo, team, flags in layer["rows"]:
        out.append({
            "id": f"seed-{cid}", "lat": lat, "lng": lng, "name": name,
            "tier": 0, "promoted": False, "kind": "seed",
            "company_slug": slug or None, "company_id": cid,
            "batch": at(layer["batches"], bi),
            "industry": at(layer["industries"], ii),
            "location": at(layer["locations"], li),
            "logo_url": ((layer["logo_prefix"] + logo[1:])
                         if logo.startswith(world.SEED_LOGO_FOLD) else logo) if logo else None,
            "team_size": team if team >= 0 else None,
            "is_hiring": bool(flags & world.SEED_FLAG_HIRING),
            "top_company": bool(flags & world.SEED_FLAG_TOP_COMPANY),
        })
    return out


def _company(db, cid, **cols):
    cols.setdefault("name", f"Co{cid}")
    cols.setdefault("slug", f"co{cid}")
    cols.setdefault("latitude", 42.7)
    cols.setdefault("longitude", 23.3)
    with db.get_connection() as conn:
        conn.execute(
            f"""INSERT INTO companies (id, {', '.join(cols)})
                VALUES (?, {', '.join('?' for _ in cols)})""",
            (cid, *cols.values()))


LOGO = "https://bookface-images.s3.amazonaws.com/small_logos/abc123.png"


def test_globe_seeds_carry_the_facts_the_filters_need(db):
    """Every widened field survives the columnar round trip."""
    _company(db, 1, name="Stripe", slug="stripe", batch="Summer 2009",
             industry="Fintech", is_hiring=1, team_size=7000, top_company=1,
             small_logo_thumb_url=LOGO, all_locations="San Francisco, CA, USA")
    pin = _decode_seeds(_client(db).get("/api/world/globe").json())[0]
    assert pin == {
        "id": "seed-1", "lat": 42.7, "lng": 23.3, "name": "Stripe",
        "tier": 0, "promoted": False, "kind": "seed",
        "company_slug": "stripe", "company_id": 1,
        "batch": "Summer 2009", "industry": "Fintech",
        "location": "San Francisco, CA, USA", "logo_url": LOGO,
        "team_size": 7000, "is_hiring": True, "top_company": True,
    }


def test_globe_seeds_are_absent_safe_never_placeholders(db):
    """A company the scrape never filled in reads as null, not '' and not a
    stand-in string. Filters must be able to tell 'no industry' from 'an
    industry called nothing', and the logo slot must stay empty rather than
    render a broken image."""
    _company(db, 2, name="Sparse", slug="sparse")   # every optional column NULL
    pin = _decode_seeds(_client(db).get("/api/world/globe").json())[0]
    assert (pin["batch"], pin["industry"], pin["location"], pin["logo_url"]) == (
        None, None, None, None)
    assert pin["team_size"] is None                  # unknown, not 0
    assert pin["is_hiring"] is False and pin["top_company"] is False
    assert pin["name"] == "Sparse" and pin["company_slug"] == "sparse"


def test_globe_seed_team_size_zero_is_not_unknown(db):
    """0 is a real value in this data (wound-down companies carry it), so it
    has to survive the -1 sentinel rather than decode back to null."""
    _company(db, 3, team_size=0)
    assert _decode_seeds(_client(db).get("/api/world/globe").json())[0]["team_size"] == 0


def test_globe_seed_location_is_the_first_segment_verbatim(db):
    """computeHubs() groups by this string, and it was ported from the deck.gl
    map unchanged — so the segment arrives exactly as that map split it."""
    _company(db, 4, all_locations="Sofia, BG; Remote; New York, NY, USA")
    assert _decode_seeds(_client(db).get("/api/world/globe").json())[0]["location"] == "Sofia, BG"


def test_globe_seed_logos_survive_a_foreign_host_or_a_relative_path(db):
    """The shared prefix is derived, not hardcoded, and folding is marked
    rather than guessed. A logo from anywhere else — another CDN, or a
    root-relative path like the ones resolveMediaUrl() handles — is shipped
    whole and decodes back byte-identical. A host change in the scrape costs
    payload, never correctness."""
    other = "https://cdn.example.org/logos/x.svg"
    relative = "/static/logos/x.png"          # would break a "://"-sniffing decoder
    _company(db, 5, small_logo_thumb_url=LOGO)
    _company(db, 6, small_logo_thumb_url=LOGO)
    _company(db, 7, small_logo_thumb_url=other)
    _company(db, 8, small_logo_thumb_url=relative)
    body = _client(db).get("/api/world/globe").json()
    by_id = {p["id"]: p for p in _decode_seeds(body)}
    assert by_id["seed-5"]["logo_url"] == LOGO
    assert by_id["seed-7"]["logo_url"] == other
    assert by_id["seed-8"]["logo_url"] == relative
    # The saving is real: the folded rows do not carry the directory.
    assert body["seeds"]["logo_prefix"] and LOGO.startswith(body["seeds"]["logo_prefix"])
    assert not any(body["seeds"]["logo_prefix"] in row[8] for row in body["seeds"]["rows"])


def test_globe_seed_layer_is_total_no_truncation(db):
    """Every seed company produces exactly one pin. If this number ever has to
    shrink it must be a deliberate product decision, not a quiet slice."""
    for cid in range(100, 350):
        _company(db, cid, longitude=23.3 + cid / 1000)
    body = _client(db).get("/api/world/globe").json()
    assert len(body["seeds"]["rows"]) == 250
    assert len({p["id"] for p in _decode_seeds(body)}) == 250


def test_globe_paid_plots_keep_objects_and_exact_coordinates(db):
    """The paid layer is untouched by any of the seed compaction: still full
    objects under `plots`, still the coordinate the buyer paid for, to the last
    digit. Seed coordinates are rounded; a plot's never is."""
    uid = _user(db)
    plot_id = _plant(db, uid, name="Paid", cents=30_000,
                     lat=42.698123456, lng=23.321987654)
    body = _client(db, uid).get("/api/world/globe").json()
    assert len(body["plots"]) == 1
    plot = body["plots"][0]
    assert plot["lat"] == 42.698123456 and plot["lng"] == 23.321987654
    assert plot == {"id": plot_id, "lat": 42.698123456, "lng": 23.321987654,
                    "name": "Paid", "tier": 3, "promoted": False,
                    "kind": "plot", "company_slug": None,
                    "logo_url": None, "total_cents": 30_000}
    assert body["seeds"]["rows"] == []


def test_globe_paid_plot_carries_its_logo(db):
    """The paid marker's whole pitch is a branded pin, so the globe payload
    carries the logo: the plot's own, else the linked company's thumbnail,
    else null — never '' and never a placeholder."""
    uid = _user(db)
    _plant(db, uid, name="Own", cents=5_000,
           logo_url="https://cdn.example.com/own.png")
    _company(db, 44, name="Linked", slug="linked",
             small_logo_thumb_url="https://cdn.example.com/linked.png")
    _plant(db, uid, name="Linked", cents=5_000, company_id=44)
    _plant(db, uid, name="Bare", cents=5_000)

    plots = {p["name"]: p for p in _client(db).get("/api/world/globe").json()["plots"]}
    assert plots["Own"]["logo_url"] == "https://cdn.example.com/own.png"
    assert plots["Linked"]["logo_url"] == "https://cdn.example.com/linked.png"
    assert plots["Bare"]["logo_url"] is None


def test_globe_claimed_company_leaves_the_seed_layer(db):
    """Claiming moves a company across the layers, it does not duplicate it —
    the same guarantee as before the payload was widened."""
    uid = _user(db)
    _company(db, 8, name="SeedCo", slug="seedco")
    assert [p["company_id"] for p in
            _decode_seeds(_client(db).get("/api/world/globe").json())] == [8]

    fulfill_world_checkout(db, _plot_event(
        "cs_layer", 1000, _new_plot_md(uid, name="SeedCo", company_id="8"),
        user_id=uid)["data"]["object"])

    body = _client(db, uid).get("/api/world/globe").json()
    assert body["seeds"]["rows"] == []
    assert [p["kind"] for p in body["plots"]] == ["plot"]


# ---- promotions ------------------------------------------------------------

def _active_promo(db, iso="BG", plot_id=None, sid=None):
    return db.create_world_promotion({
        "kind": "featured", "plot_id": plot_id, "country_iso": iso,
        "ends_at": datetime.now(timezone.utc) + timedelta(days=7),
        "amount_cents": 1900, "stripe_session_id": sid, "status": "active",
    })


def test_promotion_checkout_caps_at_three_per_country(db, monkeypatch):
    uid = _user(db)
    plot_id = _plant(db, uid, iso="BG")
    for i in range(3):
        _active_promo(db, iso="BG", plot_id=plot_id, sid=f"cs_seed_{i}")
    client = _client(db, uid, monkeypatch)
    r = client.post("/api/world/promotions/checkout", json={"plot_id": plot_id, "tier": "7d"})
    assert r.status_code == 409


def test_promotion_checkout_creates_session(db, monkeypatch):
    uid = _user(db)
    plot_id = _plant(db, uid, iso="BG")
    fake = FakeStripe()
    client = _client(db, uid, monkeypatch, fake_stripe=fake)
    r = client.post("/api/world/promotions/checkout", json={"plot_id": plot_id, "tier": "7d"})
    assert r.status_code == 200
    params = fake.sessions[0]
    assert params["mode"] == "payment"
    assert params["metadata"]["product"] == "world_promotion"
    assert params["metadata"]["country_iso"] == "BG"
    assert params["line_items"][0]["price_data"]["unit_amount"] == 1900  # $19 / 7d


def test_promotion_checkout_rejects_bad_tier_and_wrong_owner(db, monkeypatch):
    owner, stranger = _user(db, "o@x.com"), _user(db, "s@x.com")
    plot_id = _plant(db, owner)
    client = _client(db, stranger, monkeypatch)
    assert client.post("/api/world/promotions/checkout",
                       json={"plot_id": plot_id, "tier": "90d"}).status_code == 400
    assert client.post("/api/world/promotions/checkout",
                       json={"plot_id": plot_id, "tier": "7d"}).status_code == 403


def test_promotion_fulfillment_activates_and_is_idempotent(db):
    uid = _user(db)
    plot_id = _plant(db, uid, iso="BG")
    obj = {"id": "cs_promo", "mode": "payment", "payment_status": "paid",
           "amount_total": 1900, "client_reference_id": str(uid),
           "metadata": {"product": "world_promotion", "user_id": str(uid),
                        "plot_id": str(plot_id), "tier": "7d", "country_iso": "BG"}}
    first = fulfill_world_checkout(db, obj)
    second = fulfill_world_checkout(db, obj)
    assert first["outcome"] == "created"
    assert second["outcome"] == "duplicate"
    assert db.count_active_featured("BG") == 1
    active = db.get_active_world_promotions("BG")
    assert len(active) == 1 and active[0]["plot_id"] == plot_id


# ---- post-checkout poll & where -------------------------------------------

def test_claimed_poll_pending_then_done(db):
    uid = _user(db)
    client = _client(db, uid)
    assert client.get("/api/world/claimed?session_id=cs_wait").json() == {
        "status": "pending", "plot_id": None}
    result = fulfill_world_checkout(
        db, _plot_event("cs_wait", 800, _new_plot_md(uid), user_id=uid)["data"]["object"])
    body = client.get("/api/world/claimed?session_id=cs_wait").json()
    assert body == {"status": "done", "plot_id": result["plot_id"]}


def test_where_resolves_land_and_refuses_ocean(db):
    client = _client(db, _user(db))
    body = client.get(f"/api/world/where?lat={SOFIA[0]}&lng={SOFIA[1]}").json()
    assert body["country_iso"] == "BG"
    assert body["country_name"] == "Bulgaria"
    assert body["city_id"] == 1 and body["city_name"] == "Sofia"
    r = client.get(f"/api/world/where?lat={OCEAN[0]}&lng={OCEAN[1]}")
    assert r.status_code == 400 and r.json()["detail"] == "ocean"


# ---- plot detail & owner management ---------------------------------------

def test_plot_detail_is_mine_flag(db):
    uid, other = _user(db, "o@x.com"), _user(db, "s@x.com")
    plot_id = _plant(db, uid)
    client = _client(db, uid)
    # No Authorization header → no is_mine key at all.
    anon = client.get(f"/api/world/plots/{plot_id}").json()
    assert "is_mine" not in anon
    assert "user_id" not in anon  # owner identity is not public
    assert client.get("/api/world/plots/999999").status_code == 404


def test_patch_reruns_moderation_and_enforces_owner(db):
    owner, stranger = _user(db, "o@x.com"), _user(db, "s@x.com")
    plot_id = _plant(db, owner, name="Clean")
    assert _client(db, stranger).patch(
        f"/api/world/plots/{plot_id}", json={"name": "Mine Now"}).status_code == 403
    body = _client(db, owner).patch(
        f"/api/world/plots/{plot_id}", json={"tagline": "buy free bitcoin here"}).json()
    assert body["status"] == "pending"   # edit held for review, plot kept
    assert db.get_world_plot(plot_id)["tagline"] == "buy free bitcoin here"


# ---- adversarial hardening -------------------------------------------------

def test_checkout_rejects_non_https_links(db, monkeypatch):
    """url / founder_link render straight into <a href>: https-only, always."""
    uid = _user(db)
    client = _client(db, uid, monkeypatch)
    for field, value in (
        ("url", "javascript:alert(1)"),
        ("url", "http://acme.example"),          # downgrade
        ("url", "data:text/html,<script>1</script>"),
        ("url", "java\nscript:alert(1)"),        # WHATWG newline smuggle
        ("url", "acme.example"),                 # scheme-less
        ("founder_link", "javascript:alert(1)"),
    ):
        r = client.post("/api/world/checkout", json=_claim_payload(**{field: value}))
        assert r.status_code == 400, (field, value, r.text)
    # and a clean https link still sails through
    assert client.post("/api/world/checkout", json=_claim_payload()).status_code == 200


def test_patch_rejects_non_https_links(db):
    uid = _user(db)
    plot_id = _plant(db, uid)
    client = _client(db, uid)
    assert client.patch(f"/api/world/plots/{plot_id}",
                        json={"url": "javascript:alert(1)"}).status_code == 400
    assert client.patch(f"/api/world/plots/{plot_id}",
                        json={"founder_link": "http://x.example"}).status_code == 400
    assert db.get_world_plot(plot_id)["url"] is None  # nothing stored
    assert client.patch(f"/api/world/plots/{plot_id}",
                        json={"url": "https://ok.example"}).status_code == 200


def test_founder_fields_are_moderated_at_fulfillment(db):
    """founder_name renders on the shared founders board — a hostile value
    holds the render exactly like a hostile name would (never the money)."""
    uid = _user(db)
    md = _new_plot_md(uid, founder_name="Fuck You Inc")
    result = fulfill_world_checkout(
        db, _plot_event("cs_fmod", 900, md, user_id=uid)["data"]["object"])
    assert result["outcome"] == "created"
    plot = db.get_world_plot(result["plot_id"])
    assert plot["status"] == "pending"
    assert plot["total_cents"] == 900


def test_patch_moderates_founder_fields(db):
    uid = _user(db)
    plot_id = _plant(db, uid, name="Clean")
    body = _client(db, uid).patch(
        f"/api/world/plots/{plot_id}",
        json={"founder_title": "chief fuck officer"}).json()
    assert body["status"] == "pending"
    # clearing it back to clean text reactivates via the merged re-screen
    body = _client(db, uid).patch(
        f"/api/world/plots/{plot_id}", json={"founder_title": "CEO"}).json()
    assert body["status"] == "active"


def test_redelivery_race_orphan_plot_self_heals(db, monkeypatch):
    """Two concurrent deliveries of one session: the loser's freshly minted
    plot row is deleted, leaving exactly one plot and one payment."""
    uid = _user(db)
    obj = _plot_event("cs_race", 1000, _new_plot_md(uid), user_id=uid)["data"]["object"]
    first = fulfill_world_checkout(db, obj)
    assert first["outcome"] == "created"
    # Simulate the loser thread: it passed the fast path before the winner's
    # payment row existed, so it reaches create_world_plot + insert.
    monkeypatch.setattr(db, "get_world_payment_by_session", lambda sid: None)
    second = fulfill_world_checkout(db, obj)
    assert second["outcome"] == "duplicate"
    with db.get_connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM world_plots").fetchone()[0] == 1
        assert conn.execute("SELECT COUNT(*) FROM world_payments").fetchone()[0] == 1
    assert db.get_world_plot(first["plot_id"])["total_cents"] == 1000


def test_delete_guard_never_touches_a_paid_plot(db):
    uid = _user(db)
    plot_id = _plant(db, uid)
    db.insert_world_payment(plot_id, uid, "cs_paid_guard", 500)
    assert db.delete_world_plot_if_unreferenced(plot_id) is False
    assert db.get_world_plot(plot_id) is not None


# ---- audience: real reach + live presence ----------------------------------
#
# The product's honesty rule, as executable assertions: a figure we did not
# measure is null (never 0, never a placeholder), the cached figure is served
# from the database rather than refetched per request, and "watching now" counts
# distinct live sessions and drops them when they stop beating.

def _reach(visitors=2329, pageviews=7650, countries=95, capped=False,
           measured_at="2026-09-12T09:00:00Z"):
    """The shape world_audience.fetch_reach() returns on a successful read."""
    return {
        "visitors_30d": visitors, "pageviews_30d": pageviews,
        "countries_count": countries, "countries_capped": capped,
        "top_countries": [{"iso": "US", "visitors": 643},
                          {"iso": "IN", "visitors": 412}],
        "window_days": 30, "measured_at": measured_at,
        "source": "vercel_web_analytics",
    }


def _configure_vercel(monkeypatch, fetch):
    """Pretend a token is present and route fetch_reach at `fetch`."""
    monkeypatch.setattr(world_audience, "VERCEL_ANALYTICS_TOKEN", "tok_test")
    monkeypatch.setattr(world_audience, "VERCEL_PROJECT_ID", "prj_test")
    monkeypatch.setattr(world_audience, "VERCEL_TEAM_ID", "team_test")
    monkeypatch.setattr(world_audience, "fetch_reach", fetch)


def _age_presence(db, session_id, seconds):
    with db.get_connection() as conn:
        conn.execute(
            "UPDATE world_presence SET last_seen = datetime('now', ?) WHERE session_id = ?",
            (f"-{seconds} seconds", session_id))


def test_audience_without_a_token_reports_null_traffic_not_zero(db, monkeypatch):
    """The load-bearing case. No VERCEL_ANALYTICS_TOKEN => every traffic figure
    is null, so the UI omits the line instead of printing a made-up number."""
    monkeypatch.setattr(world_audience, "VERCEL_ANALYTICS_TOKEN", None)
    monkeypatch.setattr(world_audience, "fetch_reach",
                        lambda: pytest.fail("fetched Vercel with no token configured"))

    body = _client(db).get("/api/world/audience").json()

    for field in ("visitors_30d", "pageviews_30d", "countries_count",
                  "window_days", "updated_at", "source"):
        assert body[field] is None, f"{field} must be null, not {body[field]!r}"
    assert body["top_countries"] == []
    assert body["countries_capped"] is False
    # Presence is ours, so it still answers — truthfully, with nobody watching.
    assert body["viewers_now"] == 0
    assert body["window_seconds"] == world_audience.PRESENCE_WINDOW_SECONDS


def test_audience_serves_the_cache_instead_of_refetching(db, monkeypatch):
    """One fetch fills the cache; every later read is served from the database.
    A Vercel round trip per page load is exactly what this must never become."""
    calls = []

    def fetch():
        calls.append(1)
        return _reach()

    _configure_vercel(monkeypatch, fetch)
    client = _client(db)

    first = client.get("/api/world/audience").json()
    # Cold cache: the first read schedules a BACKGROUND refresh and returns the
    # (empty) row it had. Nothing is fabricated to fill the gap.
    assert first["visitors_30d"] is None
    assert len(calls) == 1

    for _ in range(5):
        body = client.get("/api/world/audience").json()
    assert len(calls) == 1, "cached row was refetched"
    assert body["visitors_30d"] == 2329
    assert body["pageviews_30d"] == 7650
    assert body["countries_count"] == 95
    assert body["window_days"] == 30
    assert body["updated_at"] == "2026-09-12T09:00:00Z"
    assert body["source"] == "vercel_web_analytics"
    assert body["top_countries"][0] == {"iso": "US", "visitors": 643}


def test_a_failed_vercel_read_keeps_the_last_real_number(db, monkeypatch):
    """A rate limit must not blank the number that sells the product."""
    _configure_vercel(monkeypatch, lambda: _reach())
    client = _client(db)
    client.get("/api/world/audience")                     # primes the cache
    assert client.get("/api/world/audience").json()["visitors_30d"] == 2329

    world_audience.reset_throttle()
    monkeypatch.setattr(world_audience, "fetch_reach", lambda: None)
    monkeypatch.setattr(world_audience, "REFRESH_AFTER_SECONDS", 0)  # force a retry

    body = client.get("/api/world/audience").json()
    assert body["visitors_30d"] == 2329
    assert body["updated_at"] == "2026-09-12T09:00:00Z"


def test_viewers_now_counts_distinct_sessions_inside_the_window(db):
    client = _client(db)
    for session in ("aaaaaaaa1111", "bbbbbbbb2222", "aaaaaaaa1111"):
        body = client.post("/api/world/beat", json={"session_id": session}).json()
    assert body["viewers_now"] == 2                       # three beats, two people
    assert client.get("/api/world/audience").json()["viewers_now"] == 2


def test_viewers_now_drops_a_session_that_stopped_beating(db):
    client = _client(db)
    client.post("/api/world/beat", json={"session_id": "staleaaaa111"})
    client.post("/api/world/beat", json={"session_id": "livebbbbb222"})
    _age_presence(db, "staleaaaa111", world_audience.PRESENCE_WINDOW_SECONDS + 30)

    assert client.get("/api/world/audience").json()["viewers_now"] == 1

    # ...and the garbage row is deleted rather than kept forever.
    _age_presence(db, "staleaaaa111", world_audience.PRESENCE_PRUNE_SECONDS + 60)
    client.post("/api/world/beat", json={"session_id": "livebbbbb222"})
    with db.get_connection() as conn:
        remaining = [r[0] for r in conn.execute("SELECT session_id FROM world_presence")]
    assert remaining == ["livebbbbb222"]


def test_beat_refuses_anything_that_is_not_an_opaque_session_id(db):
    """The one field a heartbeat carries is bounded, so it cannot be used to
    smuggle in something that looks like personal data."""
    client = _client(db)
    for bad in ("", "short", "founder@example.com", "a" * 65, "has spaces12",
                "<script>xx</script>"):
        assert client.post("/api/world/beat", json={"session_id": bad}).status_code in (400, 422), bad
    assert client.post("/api/world/beat",
                       json={"session_id": "ok-Session_1234"}).status_code == 200
    with db.get_connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM world_presence").fetchone()[0] == 1


def test_fetch_reach_never_invents_a_figure(db, monkeypatch):
    """Unit-level guard on the parser: a malformed Vercel payload yields None
    (i.e. 'we do not know'), never a zero and never a partial row."""
    monkeypatch.setattr(world_audience, "VERCEL_ANALYTICS_TOKEN", "tok_test")
    monkeypatch.setattr(world_audience, "VERCEL_PROJECT_ID", "prj_test")

    monkeypatch.setattr(world_audience, "_get", lambda path, params: {"data": {}})
    assert world_audience.fetch_reach() is None

    def _boom(path, params):
        raise RuntimeError("429 Too Many Requests")

    monkeypatch.setattr(world_audience, "_get", _boom)
    assert world_audience.fetch_reach() is None
    assert db.get_world_audience() is None     # nothing was written


def test_country_breakdown_drops_non_countries_and_flags_a_capped_count(monkeypatch):
    """'Others' is a bucket, '' is an unresolved lookup — neither is a country."""
    monkeypatch.setattr(world_audience, "VERCEL_ANALYTICS_TOKEN", "tok_test")
    monkeypatch.setattr(world_audience, "VERCEL_PROJECT_ID", "prj_test")
    monkeypatch.setattr(world_audience, "COUNTRY_LIMIT", 3)

    def _get(path, params):
        if path.endswith("/count"):
            return {"data": {"visitors": 10, "pageviews": 40}}
        return {"data": [{"country": "US", "visitors": 6},
                         {"country": "", "visitors": 1},
                         {"country": "Others", "visitors": 3}]}

    monkeypatch.setattr(world_audience, "_get", _get)
    payload = world_audience.fetch_reach()
    assert payload["countries_count"] == 1
    assert payload["top_countries"] == [{"iso": "US", "visitors": 6}]
    assert payload["countries_capped"] is True   # 3 rows back on a 3-row page
