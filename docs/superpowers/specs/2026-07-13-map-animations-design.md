# Map Animations & Polish — Design

**Date:** 2026-07-13
**Status:** Approved
**Scope:** Frontend only — `frontend/src/components/OptimizedMap.tsx` (+ small CSS additions). No backend or schema changes.

## Context

The interactive map (`OptimizedMap.tsx`, React Leaflet + marker clustering) is rendered on the Explore page and the Enhanced Dashboard. Company coordinates already exist in the database (`latitude`/`longitude` columns, populated at sync time) and are served by `/api/map` via `company_cache.py`, so this work is purely a rendering/experience upgrade. The decision was to polish the existing Leaflet map rather than rebuild on deck.gl/MapLibre.

## Goals

Make the map feel alive and shareable with four features:

1. Theme-aware basemap
2. Animated markers
3. Batch timeline animation
4. Fly-to city tour

## Non-goals

- No 3D globe, deck.gl, or MapLibre migration.
- No changes to geocoding, the `/api/map` endpoint, or the database.
- No new route/page — the upgrade lands wherever `OptimizedMap` is already used.

## Design

### 1. Theme-aware basemap

Replace the OpenStreetMap raster tiles with CARTO's free raster basemaps (no API key, attribution required):

- Dark mode (`darkMode` from `AppContext`): **Dark Matter** — `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`
- Light mode: **Positron** — `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png`

The `MapContainer` background color (currently a fixed ocean blue) switches with the theme (dark navy vs. light gray-blue) so map edges/poles blend in. The `TileLayer` is keyed on the theme so Leaflet swaps tiles cleanly when the user toggles dark mode.

Note: CARTO's *vector* style.json files require MapLibre; the raster tile endpoints above render the same visual design and drop directly into Leaflet's `TileLayer`.

### 2. Animated markers

A stylesheet (injected once, or a small imported CSS file) with keyframe animations applied via the existing `divIcon` HTML:

- **Hiring pulse:** companies with `is_hiring` get an expanding green ring (`box-shadow`/`transform: scale` keyframes) radiating from the marker circle.
- **Top-company glow:** companies with `top_company` get a soft gold halo (animated `box-shadow`).
- **Drop-in:** markers animate in with a translateY drop + ease-out bounce when added to the map. Most visible during timeline playback.
- **Cluster breathing:** cluster icons get a subtle scale oscillation so density hotspots feel alive.

Animations are CSS-only (GPU-friendly, no per-frame JS). Respect `prefers-reduced-motion: reduce` by disabling the looping animations.

### 3. Batch timeline animation

A control bar above the map:

- **Play/pause button** and a **scrubber slider** whose stops are the chronologically sorted batches.
- Batch names are parsed for true chronological order — season + year (Winter 2009 → Fall 2025), handling both long forms ("Winter 2025") and any short forms present in the data; unparseable batch names sort to the start of the timeline in lexical order so no company is dropped. The existing lexical `sort().reverse()` is not used for the timeline.
- **Playback:** ~700 ms per batch, cumulatively adding each batch's companies (markers drop-bounce in), with a live label such as "Summer 2016 — 1,204 companies".
- **Scrubbing** jumps to any point; the map shows all companies from batches up to and including the selected one.
- Opening/starting the timeline triggers `loadAllMapCompanies()` so every batch is available. While loading, the play button shows a loading state.
- The timeline's cumulative company sets are memoized (one pass to bucket companies by batch index, then a slice by scrubber position).

### 4. Fly-to city tour

- A **"Tour"** button in the map controls.
- Hubs are computed from the loaded data: group companies by rounded coordinates (~1 decimal degree, city-scale), rank by company count, take the top ~8. The hub label uses the most common city string from `all_locations` within the group.
- The tour uses Leaflet's built-in `map.flyTo(center, zoom)` to glide between hubs, ~4 s per stop.
- Each stop shows a floating stats card: hub name, company count, number hiring, top industry.
- Any manual map interaction (drag/zoom) or a ✕ button ends the tour and dismisses the card.

## Error handling

- If `loadAllMapCompanies()` fails, the timeline still runs over the batches already in memory; a non-blocking notice indicates partial data.
- Tour hub computation runs on whatever companies are loaded; it never blocks on the full dataset.
- Tile-server failure degrades exactly as today (Leaflet shows the background color).

## Performance

- All marker animation is CSS; no per-frame React re-renders.
- Timeline playback changes only the filtered company array passed to the existing `MarkerClusterGroup` (which already uses `chunkedLoading`).
- Memoized: batch buckets, hub list, marker icons per company id.

## Testing

No frontend test suite exists in this repo. Verification is manual:

1. Run backend + frontend dev servers with seeded data.
2. Exercise all four features in the browser.
3. Check both light and dark themes, and a mobile-width viewport.
4. Confirm `prefers-reduced-motion` disables looping animations.
