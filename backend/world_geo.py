"""
Server-side geography for ExploreYC World.

Port of startupworld's `src/lib/db/resolve.ts` decisions onto shapely:

- Resolution happens on the server, once per checkout / `where` lookup. The
  client's lat/lng is an *input*, never an answer.
- Containment first; among several containing polygons the smallest area wins,
  so an enclave beats the country wrapped around it (Lesotho, not South
  Africa; Vatican, not Italy).
- If nothing contains the point, snap to the nearest coastline within
  COASTLINE_SNAP_KM (25 km). Every vector coastline is a simplification —
  without this, pins on downtown Miami, Copenhagen or Venice land "in the
  sea" and the buyer abandons.
- Open ocean resolves to None. The caller refuses before taking money.
- Nearest-city snap within CITY_SNAP_RADIUS_KM (50 km), constrained to the
  resolved country — a plot in Bulgaria must never appear on a Greek city
  board. The bounding box is an index-friendly prefilter; haversine does the
  exact work.

Data (shipped in backend/data/ by the data agent):
- countries-10m.json — world-atlas TopoJSON (10 m; the only resolution where
  microstates and coastal capitals all resolve).
- country_codes.json — ISO 3166-1 numeric → [alpha-2, alpha-3, name].

The TopoJSON is decoded by hand (delta-decoded arcs + affine transform) so no
topojson dependency is needed. Natural Earth polygons are already cut at the
antimeridian, so planar shapely containment is sound.

Everything is lazily loaded and memoised per process (~3.6 MB JSON, one-off
parse). If shapely is missing the loader raises RuntimeError and the router
maps it to a 503 — geography being down must never look like "ocean".
"""

import json
import logging
import math
import threading
from pathlib import Path
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

try:
    from shapely.geometry import MultiPolygon, Point, Polygon, box as shapely_box
    from shapely.ops import nearest_points
    from shapely.strtree import STRtree

    SHAPELY_AVAILABLE = True
except ImportError:  # pragma: no cover - exercised only on unprovisioned hosts
    SHAPELY_AVAILABLE = False

DATA_DIR = Path(__file__).parent / "data"

KM_PER_DEGREE_LAT = 111.32

#: How far offshore a click may land and still count as being in a country.
COASTLINE_SNAP_KM = 25.0

#: world-atlas polygons that carry no ISO numeric id. Kosovo gets the
#: user-assigned code the EU/IMF/CLDR use; Somaliland and N. Cyprus fold into
#: their ISO answer (containment only — not a recognition claim).
ISO2_BY_POLYGON_NAME = {"Kosovo": "XK", "Somaliland": "SO", "N. Cyprus": "CY"}
EXTRA_COUNTRY_NAMES = {"XK": "Kosovo"}


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in kilometres."""
    rlat1, rlat2 = math.radians(lat1), math.radians(lat2)
    dlat = rlat2 - rlat1
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlng / 2) ** 2
    return 6371.0088 * 2 * math.asin(min(1.0, math.sqrt(a)))


def bounding_box(lat: float, lng: float, radius_km: float) -> Tuple[float, float, float, float]:
    """(min_lat, max_lat, min_lng, max_lng) guaranteed to contain the circle.

    Wider than the true circle on purpose — it is a cheap prefilter and
    haversine does the exact work afterwards. When min_lng > max_lng the box
    wraps the antimeridian (the DB bbox query understands that convention).
    Near a pole every meridian is in range and the lng filter collapses to
    the full [-180, 180].
    """
    dlat = radius_km / KM_PER_DEGREE_LAT
    min_lat, max_lat = max(-90.0, lat - dlat), min(90.0, lat + dlat)
    cos = math.cos(math.radians(max(abs(min_lat), abs(max_lat))))
    if cos <= 1e-6:
        return min_lat, max_lat, -180.0, 180.0
    dlng = radius_km / (KM_PER_DEGREE_LAT * cos)
    if dlng >= 180.0:
        return min_lat, max_lat, -180.0, 180.0
    west, east = lng - dlng, lng + dlng
    if west < -180.0:
        west += 360.0  # wraps: west > east
    if east > 180.0:
        east -= 360.0  # wraps: west > east
    return min_lat, max_lat, west, east


# ---------------------------------------------------------------------------
# TopoJSON decoding (delta-encoded arcs + affine transform)
# ---------------------------------------------------------------------------

def _decode_arcs(topo: dict) -> List[List[Tuple[float, float]]]:
    scale = topo["transform"]["scale"]
    translate = topo["transform"]["translate"]
    arcs = []
    for arc in topo["arcs"]:
        x = y = 0
        points = []
        for dx, dy in arc:
            x += dx
            y += dy
            points.append((x * scale[0] + translate[0], y * scale[1] + translate[1]))
        arcs.append(points)
    return arcs


def _ring(arcs: List[List[Tuple[float, float]]], arc_ids: List[int]) -> List[Tuple[float, float]]:
    """Stitch arc references into one ring. `~i` (i.e. -1 - i) means arc i reversed."""
    points: List[Tuple[float, float]] = []
    for aid in arc_ids:
        arc = arcs[~aid] if aid < 0 else arcs[aid]
        seq = list(reversed(arc)) if aid < 0 else arc
        if points:
            seq = seq[1:]  # arcs share their junction point
        points.extend(seq)
    return points


class _Country:
    __slots__ = ("iso2", "name", "geom", "area")

    def __init__(self, iso2: str, name: str, geom, area: float):
        self.iso2, self.name, self.geom, self.area = iso2, name, geom, area


class WorldGeo:
    """Lazily-built country polygon index + city snap. One instance per process."""

    def __init__(self, data_dir: Optional[str] = None):
        self._data_dir = Path(data_dir) if data_dir else DATA_DIR
        self._lock = threading.Lock()
        self._countries: Optional[List[_Country]] = None
        self._tree = None
        self._names: Dict[str, str] = {}

    # -- loading ------------------------------------------------------------

    def _load(self) -> None:
        if self._countries is not None:
            return
        with self._lock:
            if self._countries is not None:
                return
            if not SHAPELY_AVAILABLE:
                raise RuntimeError("shapely is not installed — world geography unavailable")
            with open(self._data_dir / "country_codes.json") as f:
                by_numeric: Dict[str, list] = json.load(f)
            with open(self._data_dir / "countries-10m.json") as f:
                topo = json.load(f)

            arcs = _decode_arcs(topo)
            countries: List[_Country] = []
            for geometry in topo["objects"]["countries"]["geometries"]:
                ref = self._ref_for(geometry, by_numeric)
                if ref is None:
                    continue
                iso2, name = ref
                polys = []
                raw = geometry.get("arcs") or []
                poly_arcs = [raw] if geometry["type"] == "Polygon" else raw
                for rings in poly_arcs:
                    decoded = [_ring(arcs, r) for r in rings]
                    decoded = [r for r in decoded if len(r) >= 4]
                    if not decoded:
                        continue
                    poly = Polygon(decoded[0], decoded[1:])
                    if not poly.is_valid:
                        poly = poly.buffer(0)  # planar equivalent of winding repair
                    if not poly.is_empty:
                        polys.append(poly)
                if not polys:
                    continue
                geom = polys[0] if len(polys) == 1 else MultiPolygon(
                    [p for g in polys for p in (g.geoms if hasattr(g, "geoms") else [g])]
                )
                countries.append(_Country(iso2, name, geom, geom.area))
                self._names.setdefault(iso2, name)

            self._tree = STRtree([c.geom for c in countries])
            self._countries = countries
            logger.info("world_geo: loaded %d country polygons", len(countries))

    @staticmethod
    def _ref_for(geometry: dict, by_numeric: Dict[str, list]) -> Optional[Tuple[str, str]]:
        gid = geometry.get("id")
        if gid is not None:
            row = by_numeric.get(str(gid).zfill(3)) or by_numeric.get(str(gid))
            return (row[0], row[2]) if row else None
        name = (geometry.get("properties") or {}).get("name")
        iso2 = ISO2_BY_POLYGON_NAME.get(name or "")
        if not iso2:
            return None
        display = EXTRA_COUNTRY_NAMES.get(iso2)
        if display is None:
            display = next((r[2] for r in by_numeric.values() if r[0] == iso2), name)
        return iso2, display

    def _candidates(self, geom) -> List[int]:
        """Indices of countries whose bbox intersects `geom` (shapely 1/2 tolerant)."""
        hits = self._tree.query(geom)
        out = []
        for h in hits:
            if isinstance(h, (int,)) or hasattr(h, "item"):  # shapely 2.x: indices
                out.append(int(h))
            else:  # shapely 1.8: geometries — map back by identity
                for i, c in enumerate(self._countries):
                    if c.geom is h:
                        out.append(i)
                        break
        return out

    # -- public API ---------------------------------------------------------

    def resolve_country(self, lat: float, lng: float) -> Optional[str]:
        """ISO alpha-2 for a coordinate, or None for open ocean.

        Containment first (smallest containing polygon wins); then the 25 km
        coastline snap. Mirrors startupworld's resolveCountry.
        """
        if not (math.isfinite(lat) and math.isfinite(lng)):
            return None
        if lat < -90 or lat > 90 or lng < -180 or lng > 180:
            return None
        self._load()
        point = Point(lng, lat)

        containing: Optional[_Country] = None
        for i in self._candidates(point):
            c = self._countries[i]
            if c.geom.covers(point) and (containing is None or c.area < containing.area):
                containing = c
        if containing:
            return containing.iso2

        # Coastline snap: nearest boundary within 25 km. nearest_points works
        # in planar degrees; at this radius the picked point is close enough
        # that the haversine on it is authoritative.
        pad_lat = COASTLINE_SNAP_KM / KM_PER_DEGREE_LAT
        cos = max(math.cos(math.radians(lat)), 0.01)
        pad_lng = COASTLINE_SNAP_KM / (KM_PER_DEGREE_LAT * cos)
        probe = shapely_box(lng - pad_lng, lat - pad_lat, lng + pad_lng, lat + pad_lat)
        best, best_km = None, COASTLINE_SNAP_KM
        for i in self._candidates(probe):
            c = self._countries[i]
            near = nearest_points(point, c.geom)[1]
            km = haversine_km(lat, lng, near.y, near.x)
            if km < best_km:
                best, best_km = c, km
        return best.iso2 if best else None

    def country_name(self, iso2: str) -> Optional[str]:
        self._load()
        return self._names.get(iso2.upper())

    @staticmethod
    def nearest_city(db, lat: float, lng: float, country_iso: Optional[str] = None,
                     radius_km: float = 50.0) -> Optional[Dict]:
        """Nearest seeded city within `radius_km`, constrained to a country.

        Bounding-box prefilter through the DB index, exact haversine here.
        Ties resolve to the bigger city (the DB orders by population and the
        strict `<` keeps the earlier candidate).
        """
        min_lat, max_lat, min_lng, max_lng = bounding_box(lat, lng, radius_km)
        rows = db.get_world_cities_in_bbox(min_lat, max_lat, min_lng, max_lng)
        iso = country_iso.upper() if country_iso else None
        best, best_km = None, radius_km
        for row in rows:
            if iso and row.get("country_iso") != iso:
                continue
            km = haversine_km(lat, lng, row["lat"], row["lng"])
            if km < best_km:
                best, best_km = row, km
        return best


_world_geo: Optional[WorldGeo] = None
_world_geo_lock = threading.Lock()


def get_world_geo() -> WorldGeo:
    """Process-wide singleton (the polygon index is ~3.6 MB parsed once)."""
    global _world_geo
    if _world_geo is None:
        with _world_geo_lock:
            if _world_geo is None:
                _world_geo = WorldGeo()
    return _world_geo
