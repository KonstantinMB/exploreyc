# World Map Rebuild — deck.gl + MapLibre with 2D/3D Globe

**Date:** 2026-07-13
**Status:** Approved
**Scope:** Frontend only. No backend or schema changes — coordinates already exist (`latitude`/`longitude` columns, `/api/map` endpoint, `company_cache.py`).

## Context

The live interactive map is `OptimizedMap.tsx` (React Leaflet + raster OSM tiles + marker clustering), rendered only on the HomePage `#map` section. `ExplorePage`, `Dashboard`, and `EnhancedDashboard` are unrouted dead pages; `CompanyMap`, `EnhancedMap`, and `ImprovedMap` are dead components. The decision: fully replace the Leaflet map with deck.gl + MapLibre, including a 2D/3D globe toggle, and delete the dead code so Leaflet can be uninstalled.

## Goals

1. GPU-rendered map with a **2D map ⇔ 3D globe toggle**.
2. **Zoom-based layers**: extruded hexagon density bars at world zoom, per-company scatterplot at closer zoom.
3. Carry over the four approved experience features: theme-aware basemap, animated/pulsing markers, batch timeline animation, fly-to city tour.
4. Remove Leaflet entirely (deps + dead pages/components).

## Non-goals

- No backend, geocoding, or database changes.
- No new route — the map stays in the HomePage `#map` section.
- No embed route (possible follow-up).

## Architecture

New module `frontend/src/components/WorldMap/`:

- `WorldMap.tsx` — container: card UI, legend, banner/stats, timeline bar, tour controls, 2D/3D toggle. Owns view state and feature state.
- `DeckMap.tsx` — rendering: `<DeckGL>` canvas with `MapView` or `GlobeView`, MapLibre basemap in 2D, layer construction.
- `batchOrder.ts` — chronological batch parsing (season + year, e.g. "Winter 2009" → "Fall 2025"); unparseable names sort to the start lexically so no company is dropped.
- `hubs.ts` — top-hub computation for the tour.

Dependencies added: `@deck.gl/core`, `@deck.gl/react`, `@deck.gl/layers`, `@deck.gl/aggregation-layers`, `maplibre-gl`, `react-map-gl`. Removed: `leaflet`, `react-leaflet`, `react-leaflet-cluster`.

The map is lazy-loaded (`React.lazy` + `Suspense` skeleton) on the HomePage so deck.gl (~300 KB gz) does not block the landing paint.

Data flow is unchanged: companies (with `latitude`/`longitude`) come from `useApp()`; "show all" triggers the existing `loadAllMapCompanies()`; clicking a company calls the existing `setSelectedCompany()` modal.

## Design

### 1. 2D map ⇔ 3D globe toggle

- **2D:** `MapView` over a MapLibre basemap using CARTO vector styles (free, no key), theme-aware via `darkMode` from `AppContext`: `dark-matter-gl-style` in dark mode, `positron-gl-style` in light mode.
- **3D:** `GlobeView` (deck.gl). No tile basemap on the globe: render a bundled Natural Earth 110m countries GeoJSON (~100 KB static asset) as a `GeoJsonLayer` over a dark sphere backdrop; companies render as glowing additive-blended dots. Slow idle auto-rotation until the first user interaction.
- Toggle button in the map controls; view state (center/zoom) carries across the switch where meaningful.

### 2. Zoom-based layers (2D)

- **Zoom < ~4:** extruded `HexagonLayer` — height = company count, YC-orange color ramp. Hovering a column shows a count tooltip.
- **Zoom ≥ ~4:** `ScatterplotLayer` — radius ∝ `team_size` (clamped), color by status: gold = top company, green = hiring, orange = standard. Hover shows a tooltip card (logo, name, one-liner, batch, location); click calls `setSelectedCompany`.
- Layers cross-fade over a zoom band rather than hard-switching.
- Globe mode uses the scatterplot (plus hexagons only if they render correctly on `GlobeView`; otherwise scatter-only is acceptable).

### 3. Batch timeline animation

- Control bar above the map: play/pause + scrubber over chronologically sorted batches (`batchOrder.ts`).
- Playback ~700 ms per batch, cumulative: each batch's companies animate in via deck.gl radius transitions (grow from 0). Live label, e.g. "Summer 2016 — 1,204 companies".
- Scrubbing jumps to any point (all companies from batches ≤ selected).
- Starting the timeline triggers `loadAllMapCompanies()`; the play button shows a loading state meanwhile. Works in both 2D and globe modes.
- Cumulative sets are computed once (bucket by batch index, slice by position) and memoized.

### 4. Animated / pulsing markers

- Hiring companies get an animated pulse-ring layer (time-driven via rAF updating a shared time value; additive blending).
- Top companies get a static gold glow (larger soft-edged dot underneath).
- `prefers-reduced-motion: reduce` disables the pulse loop and the globe auto-rotation.

### 5. Fly-to city tour

- "Tour" button in the map controls.
- Hubs computed from loaded data: group by rounded coordinates (~1 decimal degree), rank by company count, take top ~8; label = most common city string from `all_locations` in the group.
- 2D: `FlyToInterpolator` glides between hubs, ~4 s per stop. Globe: rotates/zooms to each hub.
- Each stop shows a floating stats card: hub name, company count, number hiring, top industry.
- Any manual interaction or the ✕ button ends the tour.

### 6. Cleanup

- HomePage swaps `OptimizedMap` → lazy `WorldMap`.
- Delete dead unrouted pages: `ExplorePage.tsx`, `Dashboard.tsx`, `EnhancedDashboard.tsx`.
- Delete dead map components: `OptimizedMap.tsx`, `CompanyMap.tsx`, `EnhancedMap.tsx`, `ImprovedMap.tsx`.
- Verify no remaining imports, then uninstall `leaflet`, `react-leaflet`, `react-leaflet-cluster` and remove Leaflet CSS imports.

## Error handling

- **No WebGL:** render a fallback card ("map requires WebGL") instead of crashing.
- **`loadAllMapCompanies()` failure:** timeline runs over already-loaded batches with a non-blocking notice.
- **Basemap style fetch failure:** deck.gl layers still render over the plain background color.
- Companies without coordinates are filtered out (existing behavior).

## Performance

- ~6k points is trivial for deck.gl; keep accessor functions referentially stable and memoize layer data arrays to avoid re-tessellation.
- Pulse animation updates a single time prop, not per-point React state.
- Lazy chunk keeps landing-page bundle unchanged until the map scrolls into use.

## Testing

No frontend test suite exists. Manual verification:

1. Dev servers with seeded data; exercise toggle, hexagons↔scatter zoom transition, timeline, tour, hover/click.
2. Both themes; both views; mobile-width viewport.
3. `prefers-reduced-motion` disables pulse + auto-rotate.
4. `npm run build` passes after dead-code deletion and dep removal.
