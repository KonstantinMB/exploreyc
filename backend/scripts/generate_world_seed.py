"""
Generate ExploreYC World reference seed data.

Produces two committed JSON files in backend/data/:

  world_countries.json  — one row per ISO country present in the world-atlas
                          countries-10m topology (239 rows: 238 ISO-numeric
                          countries + Kosovo/'XK').
  world_cities.json     — Natural Earth 10m populated places (7,328 rows after
                          dropping places without an id/name/coords or whose
                          country is not in the reference set).

Inputs (already in backend/data/ or downloaded on demand):

  backend/data/countries-10m.json   — world-atlas TopoJSON (also shipped for
                                      runtime point-in-polygon in the router).
  backend/data/country_codes.json   — ISO 3166-1 numeric -> [alpha2, alpha3,
                                      name], extracted from startupworld's
                                      src/lib/countries.ts (donor repo).
  ne_10m_populated_places_simple.geojson — Natural Earth, downloaded to a
                                      cache dir when absent.

This mirrors startupworld's scripts/seed.ts + src/lib/db/resolve.ts decisions:
  - world-atlas keys countries by ISO numeric; country_codes.json bridges to
    alpha-2 (matching on polygon names would break on "Dem. Rep. Congo").
  - Kosovo/Somaliland/N. Cyprus polygons carry no numeric id; they map to
    XK/SO/CY by name. SO and CY dedupe against the real countries (larger
    polygon wins because it is seen first with a real numeric id).
  - Country centroid is taken from the LARGEST landmass, not the whole
    feature — France's overseas departments would otherwise drag its centroid
    into the Atlantic. (Here: length-weighted vertex average on the unit
    sphere, which is antimeridian-safe; a few km of divergence from d3's
    spherical area centroid is irrelevant for a camera target.)
  - City ISO fallback for Natural Earth's '-99': SOL->SO, CYN->CY, KOS->XK.
  - City coordinates come from the GeoJSON geometry, not the label-anchor
    latitude/longitude properties (those drift by kilometres).

Run:  python3 backend/scripts/generate_world_seed.py
Idempotent; output is deterministic (sorted) so diffs are reviewable.
"""

import json
import math
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(HERE, "..", "data")
CACHE_DIR = os.path.join(HERE, ".cache")

PLACES_FILE = "ne_10m_populated_places_simple.geojson"
PLACES_URL = (
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/"
    f"master/geojson/{PLACES_FILE}"
)

# Polygons with no ISO numeric id (see resolve.ts): map by name or drop.
ISO2_BY_POLYGON_NAME = {"Kosovo": "XK", "Somaliland": "SO", "N. Cyprus": "CY"}
# Kosovo is not in ISO 3166-1; 'XKX' is the user-assigned alpha-3.
EXTRA_COUNTRY_REFS = {"XK": ("XKX", "Kosovo")}
# Natural Earth populated places with iso_a2 == '-99', bridged by admin-0 a3.
ISO2_BY_ADM0_A3 = {"SOL": "SO", "CYN": "CY", "KOS": "XK"}


def flag_emoji(iso2: str) -> str:
    """Regional-indicator flag emoji from an alpha-2 code."""
    return "".join(chr(0x1F1E6 + ord(c) - ord("A")) for c in iso2.upper())


# --------------------------------------------------------------------------
# TopoJSON decoding (quantized, delta-encoded arcs)
# --------------------------------------------------------------------------

def decode_arcs(topology):
    scale = topology["transform"]["scale"]
    translate = topology["transform"]["translate"]
    arcs = []
    for arc in topology["arcs"]:
        x = y = 0
        points = []
        for dx, dy in arc:
            x += dx
            y += dy
            points.append((x * scale[0] + translate[0], y * scale[1] + translate[1]))
        arcs.append(points)
    return arcs


def ring_coords(arc_indexes, arcs):
    """Stitch arc indexes (negative = reversed, ~i) into one ring."""
    out = []
    for index in arc_indexes:
        arc = arcs[index] if index >= 0 else list(reversed(arcs[~index]))
        if out and out[-1] == arc[0]:
            out.extend(arc[1:])
        else:
            out.extend(arc)
    return out


def geometry_polygons(geometry, arcs):
    """List of polygons; each polygon is a list of rings (outer first)."""
    if geometry["type"] == "Polygon":
        poly_arcs = [geometry["arcs"]]
    elif geometry["type"] == "MultiPolygon":
        poly_arcs = geometry["arcs"]
    else:
        return []
    return [[ring_coords(r, arcs) for r in rings] for rings in poly_arcs]


# --------------------------------------------------------------------------
# Geometry helpers
# --------------------------------------------------------------------------

def unwrap_lngs(ring):
    """Shift successive longitudes by ±360 so the ring is continuous even
    across the antimeridian (Russia, Fiji)."""
    out = []
    prev = None
    for lng, lat in ring:
        if prev is not None:
            while lng - prev > 180:
                lng -= 360
            while lng - prev < -180:
                lng += 360
        out.append((lng, lat))
        prev = lng
    return out


def ring_area_deg2(ring):
    """|shoelace| area in unwrapped degrees² — only used to pick the largest
    landmass, never as a real area."""
    pts = unwrap_lngs(ring)
    total = 0.0
    for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]):
        total += x1 * y2 - x2 * y1
    return abs(total) / 2.0


def ring_centroid(ring):
    """Length-weighted vertex average on the unit sphere -> (lat, lng)."""
    sx = sy = sz = 0.0
    pts = ring if ring[0] != ring[-1] else ring[:-1]
    for (lng1, lat1), (lng2, lat2) in zip(pts, pts[1:] + pts[:1]):
        p1, p2 = math.radians(lat1), math.radians(lat2)
        l1, l2 = math.radians(lng1), math.radians(lng2)
        # Weight each midpoint by the chord length so vertex density
        # (heavily digitised coastlines) does not bias the centroid.
        x1, y1, z1 = math.cos(p1) * math.cos(l1), math.cos(p1) * math.sin(l1), math.sin(p1)
        x2, y2, z2 = math.cos(p2) * math.cos(l2), math.cos(p2) * math.sin(l2), math.sin(p2)
        w = math.dist((x1, y1, z1), (x2, y2, z2))
        sx += w * (x1 + x2) / 2
        sy += w * (y1 + y2) / 2
        sz += w * (z1 + z2) / 2
    norm = math.sqrt(sx * sx + sy * sy + sz * sz) or 1.0
    return (
        round(math.degrees(math.asin(max(-1.0, min(1.0, sz / norm)))), 4),
        round(math.degrees(math.atan2(sy, sx)), 4),
    )


# --------------------------------------------------------------------------
# Countries
# --------------------------------------------------------------------------

def build_countries(topology, codes):
    arcs = decode_arcs(topology)
    by_iso2 = {}
    for geometry in topology["objects"]["countries"]["geometries"]:
        gid = geometry.get("id")
        if gid is not None:
            row = codes.get(str(gid))
            if not row:
                continue
            iso2, iso3, name = row
        else:
            name_prop = (geometry.get("properties") or {}).get("name")
            iso2 = ISO2_BY_POLYGON_NAME.get(name_prop or "")
            if not iso2:
                continue  # Indian Ocean Ter. / Siachen Glacier — correct drop
            iso3, name = EXTRA_COUNTRY_REFS.get(iso2, (None, None))
            if iso3 is None:
                # Somaliland / N. Cyprus share an ISO2 with a real country
                # whose row (larger polygon, real numeric id) wins below.
                iso3, name = "", name_prop
        if iso2 in by_iso2:
            continue

        polygons = geometry_polygons(geometry, arcs)
        outers = [p[0] for p in polygons if p and p[0]]
        if not outers:
            continue
        largest = max(outers, key=ring_area_deg2)
        lat, lng = ring_centroid(largest)
        by_iso2[iso2] = {
            "iso2": iso2,
            "iso3": iso3,
            "name": name,
            "flag_emoji": flag_emoji(iso2),
            "centroid_lat": lat,
            "centroid_lng": lng,
        }
    return sorted(by_iso2.values(), key=lambda c: c["iso2"])


# --------------------------------------------------------------------------
# Cities
# --------------------------------------------------------------------------

def load_places():
    os.makedirs(CACHE_DIR, exist_ok=True)
    cache_path = os.path.join(CACHE_DIR, PLACES_FILE)
    if not os.path.exists(cache_path):
        print(f"  fetching {PLACES_URL}")
        urllib.request.urlretrieve(PLACES_URL, cache_path)
    with open(cache_path) as f:
        parsed = json.load(f)
    features = parsed.get("features") or []
    if not features:
        raise SystemExit(f"{cache_path} has no features — delete it and re-run")
    return features


def build_cities(features, known_iso2):
    rows, seen, skipped = [], set(), 0
    for f in features:
        p = f.get("properties") or {}
        ne_id = p.get("ne_id")
        name = p.get("name") or p.get("nameascii")
        coords = (f.get("geometry") or {}).get("coordinates")
        if not ne_id or not name or not isinstance(coords, list) or len(coords) < 2:
            skipped += 1
            continue
        raw_iso = (p.get("iso_a2") or "").upper()
        iso2 = raw_iso if len(raw_iso) == 2 and raw_iso.isalpha() else \
            ISO2_BY_ADM0_A3.get((p.get("adm0_a3") or "").upper())
        if not iso2 or iso2 not in known_iso2 or ne_id in seen:
            skipped += 1
            continue
        seen.add(ne_id)
        rows.append({
            "id": ne_id,
            "name": name,
            "country_iso": iso2,
            "lat": round(coords[1], 5),
            "lng": round(coords[0], 5),
            "population": int(p.get("pop_max") or 0),
        })
    rows.sort(key=lambda r: r["id"])
    return rows, skipped


def main():
    with open(os.path.join(DATA_DIR, "countries-10m.json")) as f:
        topology = json.load(f)
    with open(os.path.join(DATA_DIR, "country_codes.json")) as f:
        codes = json.load(f)

    countries = build_countries(topology, codes)
    print(f"countries: {len(countries)}")

    cities, skipped = build_cities(load_places(), {c["iso2"] for c in countries})
    print(f"cities: {len(cities)} (skipped {skipped})")

    with open(os.path.join(DATA_DIR, "world_countries.json"), "w") as f:
        json.dump({"countries": countries}, f, indent=1, ensure_ascii=False)
    with open(os.path.join(DATA_DIR, "world_cities.json"), "w") as f:
        json.dump({"cities": cities}, f, indent=1, ensure_ascii=False)
    print("wrote backend/data/world_countries.json and world_cities.json")


if __name__ == "__main__":
    sys.exit(main())
