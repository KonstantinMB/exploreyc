# WorldMap (deck.gl + MapLibre) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Leaflet map on the HomePage with a deck.gl + MapLibre map featuring a 2D/3D globe toggle, zoom-based hexagon/scatter layers, batch timeline animation, pulsing markers, and a city fly-to tour — then remove Leaflet entirely.

**Architecture:** New `frontend/src/components/WorldMap/` module. `WorldMap.tsx` owns UI chrome + feature state (view mode, timeline, tour); `DeckMap.tsx` owns the DeckGL canvas, basemap, and layers; `batchOrder.ts` and `hubs.ts` are pure utilities. Data flows from the existing `useApp()` context (`companies`, `totalMapCompanies`, `loadAllMapCompanies`, `setSelectedCompany`, `darkMode`) — no backend changes.

**Tech Stack:** deck.gl 9 (`@deck.gl/core`, `@deck.gl/react`, `@deck.gl/layers`, `@deck.gl/aggregation-layers`), `maplibre-gl`, `react-map-gl` (maplibre entry), `world-atlas` + `topojson-client` for the globe's country polygons. React 19 + Vite 8 + TypeScript.

## Global Constraints

- Frontend only; no backend/schema changes.
- Basemaps: CARTO `dark-matter-gl-style` (dark) / `positron-gl-style` (light), keyed to `darkMode` from `useApp()`.
- Map stays in the HomePage `#map` section; lazy-loaded via `React.lazy`.
- `prefers-reduced-motion: reduce` disables pulse loop and globe auto-rotation.
- No frontend test suite exists — each task's gate is `npx tsc -b` + `npm run build` passing, plus manual browser verification at the end.
- Company click handler must call `setSelectedCompany(company)` (existing `CompanyDetailModal` on HomePage renders it).
- YC orange is `#FB651E` in map UI (matches existing components).

---

### Task 1: Dependencies

**Files:**
- Modify: `frontend/package.json`

**Interfaces:**
- Produces: importable `@deck.gl/*`, `maplibre-gl`, `react-map-gl/maplibre`, `world-atlas/countries-110m.json`, `topojson-client`.

- [ ] **Step 1: Install**

```bash
cd frontend && npm install @deck.gl/core @deck.gl/react @deck.gl/layers @deck.gl/aggregation-layers maplibre-gl react-map-gl world-atlas topojson-client && npm install -D @types/topojson-client @types/geojson
```

- [ ] **Step 2: Verify build still passes** — `npm run build` from repo root. Expected: success.
- [ ] **Step 3: Commit** — `chore(frontend): add deck.gl + maplibre dependencies`

### Task 2: Utilities — `batchOrder.ts` and `hubs.ts`

**Files:**
- Create: `frontend/src/components/WorldMap/batchOrder.ts`
- Create: `frontend/src/components/WorldMap/hubs.ts`

**Interfaces (Produces):**
- `batchSortKey(batch: string): number` — chronological key; unparseable → `-1` (sorts first).
- `sortBatchesChronologically(batches: string[]): string[]` — ascending, unparseable first in lexical order.
- `computeHubs(companies: Company[], topN?: number): Hub[]` where `Hub = { name: string; latitude: number; longitude: number; count: number; hiringCount: number; topIndustry: string }` — grouped by 1-decimal rounded coords, ranked by count desc, default topN = 8.

- [ ] **Step 1: Implement `batchOrder.ts`**

Parse `(Winter|Spring|Summer|Fall) YYYY` and short forms `W21`/`S05`/`F24`/`SP25`/`IK12`. Key = `year * 10 + seasonIndex` (Winter=0, Spring=1, Summer=2, Fall=3; IK treated as Winter). Two-digit years: `>= 05 && < 80 → 2000s`, else 19xx not expected — treat all 2-digit as 2000+.

- [ ] **Step 2: Implement `hubs.ts`** — single pass grouping by `${lat.toFixed(1)},${lng.toFixed(1)}`; hub name = most frequent first segment of `all_locations` (split on `;` then take string before first `,`... actually keep full `City, ST, Country` first segment); topIndustry = most frequent `industry`.
- [ ] **Step 3: `npx tsc -b` passes. Commit** — `feat(map): batch chronology + hub computation utilities`

### Task 3: `DeckMap.tsx` — 2D core

**Files:**
- Create: `frontend/src/components/WorldMap/DeckMap.tsx`

**Interfaces (Produces):**

```ts
interface DeckMapProps {
  companies: Company[];          // pre-filtered to lat/lng present
  darkMode: boolean;
  is3D: boolean;
  pulseTime: number;             // seconds, drives hiring pulse; 0 = static
  viewState: MapViewState;       // controlled from WorldMap
  onViewStateChange: (vs: MapViewState) => void;
  onCompanyClick: (c: Company) => void;
  onUserInteraction: () => void; // ends tour / stops auto-rotate
}
```

- [ ] **Step 1: WebGL guard** — module-level `supportsWebGL()` (try `canvas.getContext('webgl2') || getContext('webgl')`); render fallback `<div>` with message if unsupported.
- [ ] **Step 2: 2D rendering** — `<DeckGL views={new MapView()} …>` wrapping `<Map mapStyle={darkMode ? DARK_STYLE : LIGHT_STYLE} …/>` from `react-map-gl/maplibre`; import `maplibre-gl/dist/maplibre-gl.css`.
- [ ] **Step 3: Layers** —
  - `HexagonLayer` (world zoom): `extruded: true`, `radius: 100_000`, `elevationScale` tuned, orange color range, `opacity` fades out over zoom 3.5→4.5.
  - `ScatterplotLayer`: `getPosition: d => [d.longitude, d.latitude]`, `getRadius` ∝ clamped `team_size`, `radiusUnits: 'pixels'` via min/max pixels, `getFillColor`: gold `[255,193,7]` top / green `[76,175,80]` hiring / orange `[251,101,30]`, `pickable: true`, opacity fades in over the same zoom band, radius transition `{ duration: 500, enter: () => [0] }` for timeline grow-in.
- [ ] **Step 4: Tooltip + click** — DeckGL `getTooltip` returning `{ html }` card (logo `<img>`, name, one-liner, batch, location) with dark-aware inline styles; `onClick` → `onCompanyClick(object)`.
- [ ] **Step 5: `npx tsc -b` passes. Commit** — `feat(map): DeckMap 2D core with hexagon/scatter layers`

### Task 4: Globe mode

**Files:**
- Modify: `frontend/src/components/WorldMap/DeckMap.tsx`
- Create: `frontend/src/components/WorldMap/countries.ts` (TopoJSON → GeoJSON conversion, memoized)

- [ ] **Step 1: `countries.ts`** — `import { feature } from 'topojson-client'` + `world-atlas/countries-110m.json`; export `getCountries(): FeatureCollection` (lazy, cached).
- [ ] **Step 2: GlobeView branch** — `is3D` → `new _GlobeView()`; no `<Map>` child; layers prepend: background `SolidPolygonLayer` sphere-filling polygon (dark navy) + `GeoJsonLayer` countries (stroked, subtle fill). Scatter uses additive-ish bright dots.
- [ ] **Step 3: Auto-rotate** — rAF in `WorldMap` (not DeckMap) increments `viewState.longitude` slowly while `is3D && !interacted && !reducedMotion`.
- [ ] **Step 4: `npx tsc -b`. Commit** — `feat(map): 3D globe view with Natural Earth countries`

### Task 5: `WorldMap.tsx` container + HomePage swap

**Files:**
- Create: `frontend/src/components/WorldMap/WorldMap.tsx` (+ `index.ts` re-export)
- Modify: `frontend/src/pages/HomePage.tsx` (swap `OptimizedMap` → lazy `WorldMap`)

**Interfaces:**
- Consumes: `useApp()`, `DeckMap`, utilities.
- Produces: `export function WorldMap()` (default-exported too, for `React.lazy`).

- [ ] **Step 1: Container** — Card chrome ported from `OptimizedMap` (stats line, legend, "show all batches" banner incl. `loadAllMapCompanies` flow, footer hint). Controls: region jump buttons + **2D/3D toggle** + **Tour** + timeline bar placeholder. Controlled `viewState` with `flyTo`-style transitions (`FlyToInterpolator` on region jumps).
- [ ] **Step 2: HomePage swap** — `const WorldMap = lazy(() => import('../components/WorldMap'))`, wrap in `<Suspense fallback={skeleton}>`.
- [ ] **Step 3: `npm run build` passes; dev-server smoke check. Commit** — `feat(map): WorldMap container replaces OptimizedMap on HomePage`

### Task 6: Batch timeline

**Files:**
- Modify: `frontend/src/components/WorldMap/WorldMap.tsx`

- [ ] **Step 1: Timeline state** — `timelineIdx: number | null` (null = off). Batches = `sortBatchesChronologically(unique batches)`. Visible companies = `timelineIdx === null ? all : those with batchSortKey <= key(batches[timelineIdx])` (precomputed buckets, memoized).
- [ ] **Step 2: Controls** — play/pause button + `<input type="range">` scrubber styled to theme + label "Summer 2016 — 1,204 companies". Play: `setInterval` 700 ms advancing idx; pause on end/manual scrub. Opening timeline triggers `loadAllMapCompanies()` (loading state on button; on failure show non-blocking notice and continue with loaded batches).
- [ ] **Step 3: Verify grow-in animation via scatter radius `enter` transition. Commit** — `feat(map): batch timeline animation`

### Task 7: Pulse markers + reduced motion

**Files:**
- Modify: `frontend/src/components/WorldMap/WorldMap.tsx`, `DeckMap.tsx`

- [ ] **Step 1:** rAF loop in `WorldMap` sets `pulseTime` (throttle ~30fps) unless `matchMedia('(prefers-reduced-motion: reduce)').matches`.
- [ ] **Step 2:** In `DeckMap`, hiring-only `ScatterplotLayer` ring: `stroked: true, filled: false`, `getRadius: base * (1 + 0.5 * ((pulseTime % 1.6) / 1.6))`, `getLineColor` alpha fades with phase; `updateTriggers: { getRadius: pulseTime, getLineColor: pulseTime }`. Top companies: soft gold under-glow dot (static, larger radius, low alpha).
- [ ] **Step 3: Commit** — `feat(map): pulsing hiring markers + top-company glow`

### Task 8: City tour

**Files:**
- Modify: `frontend/src/components/WorldMap/WorldMap.tsx`

- [ ] **Step 1:** `tourIdx: number | null`; hubs = `computeHubs(mapCompanies)` memoized. Advancing every 4 s: `viewState` → hub center, zoom ~9 (2D: `FlyToInterpolator({ speed: 0.6 })`; 3D: transition longitude/latitude).
- [ ] **Step 2:** Floating stats card (hub name, count, hiring count, top industry) + ✕; any `onUserInteraction` ends tour.
- [ ] **Step 3: Commit** — `feat(map): fly-to city tour`

### Task 9: Leaflet removal + dead code deletion

**Files:**
- Delete: `frontend/src/pages/ExplorePage.tsx`, `Dashboard.tsx`, `EnhancedDashboard.tsx`
- Delete: `frontend/src/components/OptimizedMap.tsx`, `CompanyMap.tsx`, `EnhancedMap.tsx`, `ImprovedMap.tsx`
- Modify: `frontend/src/index.css` (remove `@import "leaflet/dist/leaflet.css"` + `.leaflet-*` rules), `frontend/package.json`

- [ ] **Step 1:** `grep -rn "ExplorePage\|EnhancedDashboard\|OptimizedMap\|CompanyMap\|EnhancedMap\|ImprovedMap\|from 'leaflet'\|react-leaflet"` across `frontend/src` — fix any remaining importers before deleting.
- [ ] **Step 2:** Delete files; `npm uninstall leaflet react-leaflet react-leaflet-cluster @types/leaflet`; clean `index.css`.
- [ ] **Step 3:** `npm run build` passes. Commit — `refactor(frontend): remove Leaflet and dead map pages/components`

### Task 10: Manual verification

- [ ] Backend (`uvicorn main:app`) + frontend (`npm run dev`) with seeded SQLite data; browser check: 2D↔3D toggle, hexagon→scatter zoom cross-fade, tooltip + click→modal, timeline play/scrub, tour, pulse, both themes, mobile width (~390px), reduced-motion emulation.
- [ ] Fix anything found; final commit.

## Self-Review

- Spec coverage: all spec sections map to tasks (toggle→3/4, layers→3, timeline→6, pulse→7, tour→8, cleanup→9, error handling→3/6, perf→3/7, testing→10). ✓
- Placeholder scan: none. ✓
- Type consistency: `DeckMapProps` produced in Task 3 is what Tasks 4–8 extend. ✓
