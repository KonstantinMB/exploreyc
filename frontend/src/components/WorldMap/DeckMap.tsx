import { useEffect, useMemo, useRef, useState } from 'react';
import DeckGL from '@deck.gl/react';
import {
  MapView,
  _GlobeView as GlobeView,
  WebMercatorViewport,
  COORDINATE_SYSTEM,
} from '@deck.gl/core';
import type { MapViewState, PickingInfo } from '@deck.gl/core';
import { ScatterplotLayer, GeoJsonLayer, PathLayer } from '@deck.gl/layers';
import { HexagonLayer } from '@deck.gl/aggregation-layers';
import { SimpleMeshLayer } from '@deck.gl/mesh-layers';
import { SphereGeometry } from '@luma.gl/engine';
import { Map } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import './worldmap.css';
import type { Company } from '../../lib/api';
import { getCountries } from './countries';
import type { GlobeGeo } from './countries';

const DARK_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const LIGHT_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

const COLOR_TOP: [number, number, number] = [255, 193, 7];
const COLOR_HIRING: [number, number, number] = [76, 175, 80];
const COLOR_STANDARD: [number, number, number] = [251, 101, 30];

// Hexagon bars appear at continent zoom and fade to individual companies:
// invisible below IN_START, fully visible IN_END..OUT_START, gone past OUT_END.
const HEX_IN_START = 1.9;
const HEX_IN_END = 2.8;
const HEX_OUT_START = 3.6;
const HEX_OUT_END = 4.6;

// Past this zoom, companies with logos render as DOM logo markers instead of
// dots. At ~9 the per-id jitter disk (~4km) is wide enough on screen that
// stacked city-centroid companies separate into individual markers.
const LOGO_ZOOM = 9;
const MAX_LOGO_MARKERS = 130;

export interface DeckMapProps {
  companies: Company[]; // pre-filtered: latitude/longitude present
  darkMode: boolean;
  is3D: boolean;
  pulseTime: number; // seconds; 0 keeps rings static (reduced motion / off)
  viewState: MapViewState;
  onViewStateChange: (vs: MapViewState) => void;
  onCompanyClick: (c: Company) => void;
  onUserInteraction: () => void;
}

// True sphere mesh for the globe's ocean backdrop — a flat polygon warped onto
// the sphere leaves tessellation ring artifacts at the poles; a real mesh
// doesn't. Radius sits ~70km below Earth's surface (same margin as deck.gl's
// globe example): country polygons are planar triangles between coastline
// vertices, and with a tighter margin the sphere pokes through them
// mid-continent as dark blotches and dashed border lines.
const GLOBE_SEA_MESH = new SphereGeometry({ radius: 6_300_000, nlat: 90, nlong: 180 });

let webglSupport: boolean | null = null;
function supportsWebGL(): boolean {
  if (webglSupport === null) {
    try {
      const canvas = document.createElement('canvas');
      webglSupport = !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    } catch {
      webglSupport = false;
    }
  }
  return webglSupport;
}

function getFillColor(c: Company): [number, number, number] {
  if (c.top_company) return COLOR_TOP;
  if (c.is_hiring) return COLOR_HIRING;
  return COLOR_STANDARD;
}

function markerBorderColor(c: Company): string {
  if (c.top_company) return '#FFC107';
  if (c.is_hiring) return '#4CAF50';
  return '#FB651E';
}

// Pixel radii keep dense hubs readable at every zoom (meters blow up at city zoom).
function getRadiusPx(c: Company): number {
  const teamSize = Math.min(c.team_size || 1, 1000);
  return Math.min(2.5 + Math.sqrt(teamSize) * 0.35, 12);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function companyTooltip(c: Company, darkMode: boolean) {
  const bg = darkMode ? '#1a1a1a' : '#ffffff';
  const fg = darkMode ? '#e5e5e5' : '#1a1a1a';
  const muted = darkMode ? '#999' : '#666';
  const logo = c.small_logo_thumb_url
    ? `<img src="${escapeHtml(c.small_logo_thumb_url)}" style="width:28px;height:28px;object-fit:contain;border-radius:4px;background:#fff;flex-shrink:0;" />`
    : '';
  return {
    html: `
      <div style="display:flex;gap:8px;align-items:flex-start;max-width:260px;">
        ${logo}
        <div>
          <div style="font-weight:700;">${escapeHtml(c.name)}</div>
          ${c.one_liner ? `<div style="color:${muted};margin-top:2px;">${escapeHtml(c.one_liner)}</div>` : ''}
          <div style="color:${muted};margin-top:4px;font-size:11px;">
            ${escapeHtml(c.batch || '')}${c.all_locations ? ` • ${escapeHtml(c.all_locations.split(';')[0])}` : ''}
          </div>
        </div>
      </div>`,
    style: {
      backgroundColor: bg,
      color: fg,
      fontSize: '12px',
      fontFamily: 'ui-monospace, monospace',
      borderRadius: '8px',
      padding: '10px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
    },
  };
}

// Quantize continuous zoom-derived values so the expensive layer array is only
// rebuilt on meaningful steps, not on every animation frame.
function quantize(v: number): number {
  return Math.round(v * 20) / 20;
}

interface LogoMarker {
  company: Company;
  x: number;
  y: number;
}

export function DeckMap({
  companies,
  darkMode,
  is3D,
  pulseTime,
  viewState,
  onViewStateChange,
  onCompanyClick,
  onUserInteraction,
}: DeckMapProps) {
  const [countries, setCountries] = useState<GlobeGeo | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (is3D && !countries) {
      getCountries().then(setCountries).catch(() => {
        // Globe still renders dots over the sphere backdrop without country outlines.
      });
    }
  }, [is3D, countries]);

  // Distinct ids per view type: with a shared id, deck keeps the previous
  // MapController when switching to the globe, which crashes on wheel zoom
  // (MapController against GlobeViewport).
  const view = useMemo(
    () =>
      is3D
        ? new GlobeView({ id: 'globe-3d', controller: true })
        : new MapView({ id: 'map-2d', controller: true, repeat: true }),
    [is3D]
  );

  const hiringCompanies = useMemo(() => companies.filter((c) => c.is_hiring), [companies]);
  const topCompanies = useMemo(() => companies.filter((c) => c.top_company), [companies]);

  const zoom = typeof viewState.zoom === 'number' ? viewState.zoom : 2;
  const rampIn = Math.max(0, Math.min(1, (zoom - HEX_IN_START) / (HEX_IN_END - HEX_IN_START)));
  const rampOut = Math.max(0, Math.min(1, (HEX_OUT_END - zoom) / (HEX_OUT_END - HEX_OUT_START)));
  const hexOpacity = quantize(is3D ? 0 : Math.min(rampIn, rampOut));
  const scatterOpacity = quantize(1 - hexOpacity * 0.85);
  const haloOpacity = quantize(
    scatterOpacity * Math.max(0, Math.min(1, (5.5 - zoom) / 1.5))
  );

  // DOM logo markers at city zoom (2D only — GlobeView isn't web-mercator).
  const showLogos = !is3D && zoom >= LOGO_ZOOM;
  const logoMarkers: LogoMarker[] = useMemo(() => {
    if (!showLogos || size.w === 0) return [];
    const viewport = new WebMercatorViewport({
      ...(viewState as { longitude: number; latitude: number; zoom: number }),
      width: size.w,
      height: size.h,
    });
    const [west, south, east, north] = viewport.getBounds();
    const visible = companies.filter(
      (c) =>
        c.small_logo_thumb_url &&
        c.longitude! >= west &&
        c.longitude! <= east &&
        c.latitude! >= south &&
        c.latitude! <= north
    );
    // Deterministic priority: biggest teams first, stable across pans.
    visible.sort((a, b) => (b.team_size || 0) - (a.team_size || 0) || a.id - b.id);
    return visible.slice(0, MAX_LOGO_MARKERS).map((c) => {
      const [x, y] = viewport.project([c.longitude!, c.latitude!]);
      return { company: c, x, y };
    });
  }, [showLogos, companies, viewState, size]);

  const logoIds = useMemo(() => new Set(logoMarkers.map((m) => m.company.id)), [logoMarkers]);

  // Static/slow layers: rebuilt only on data, theme, mode, or quantized-zoom steps.
  const baseLayers = useMemo(() => {
    const result: unknown[] = [];

    if (is3D) {
      // Sphere backdrop (oceans) — GlobeView renders no basemap tiles.
      // Globe floats in dark space in both themes; only land colors follow the theme.
      result.push(
        new SimpleMeshLayer({
          id: 'globe-sea',
          data: [0],
          mesh: GLOBE_SEA_MESH,
          coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
          getPosition: () => [0, 0, 0],
          getColor: darkMode ? [10, 17, 32] : [22, 38, 66],
          pickable: false,
        })
      );
      if (countries) {
        result.push(
          new GeoJsonLayer({
            id: 'globe-countries',
            data: countries.countries,
            stroked: false,
            filled: true,
            getFillColor: darkMode ? [56, 68, 90] : [228, 228, 220],
          }),
          // Borders as pre-split polylines: stroking the polygon rings directly
          // draws their antimeridian/polar closure edges as rings around the
          // globe (see countries.ts).
          new PathLayer<number[]>({
            id: 'globe-borders',
            data: countries.borders,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            getPath: ((d: number[]) => d) as any,
            positionFormat: 'XY',
            getColor: darkMode ? [130, 145, 175, 220] : [120, 130, 150, 160],
            getWidth: 1,
            widthUnits: 'pixels',
          })
        );
      }
    }

    if (!is3D && hexOpacity > 0.01) {
      result.push(
        new HexagonLayer<Company>({
          id: 'company-hexagons',
          data: companies,
          getPosition: (c) => [c.longitude!, c.latitude!],
          radius: 55_000,
          extruded: true,
          // Height = normalized count → elevationRange meters × elevationScale.
          elevationScale: 40,
          elevationRange: [200, 4_000],
          coverage: 0.82,
          opacity: hexOpacity * 0.9,
          pickable: hexOpacity > 0.4,
          colorRange: [
            [255, 183, 77],
            [255, 152, 0],
            [251, 101, 30],
            [240, 78, 20],
            [216, 58, 10],
            [183, 40, 5],
          ],
        })
      );
    }

    // Soft "constellation" halo — world-view depth; fades away past city zoom
    // so dense hubs don't melt into one glow.
    if (haloOpacity > 0.02) {
      result.push(
        new ScatterplotLayer<Company>({
          id: 'company-halo',
          data: companies,
          getPosition: (c) => [c.longitude!, c.latitude!],
          getRadius: (c) => getRadiusPx(c) * 2.4,
          radiusUnits: 'pixels',
          getFillColor: (c) => {
            const [r, g, b] = getFillColor(c);
            return [r, g, b, 40] as [number, number, number, number];
          },
          stroked: false,
          opacity: haloOpacity,
          pickable: false,
        })
      );
    }

    // Static gold under-glow for top companies.
    result.push(
      new ScatterplotLayer<Company>({
        id: 'top-company-glow',
        data: topCompanies,
        getPosition: (c) => [c.longitude!, c.latitude!],
        getRadius: (c) => getRadiusPx(c) * 2,
        radiusUnits: 'pixels',
        getFillColor: [255, 193, 7, 50],
        stroked: false,
        opacity: scatterOpacity,
        pickable: false,
      })
    );

    // Main company dots. Companies currently shown as DOM logo markers are
    // hidden here (alpha 0) so they don't double-render underneath.
    result.push(
      new ScatterplotLayer<Company>({
        id: 'company-dots',
        data: companies,
        getPosition: (c) => [c.longitude!, c.latitude!],
        getRadius: getRadiusPx,
        radiusUnits: 'pixels',
        getFillColor: (c) => {
          const [r, g, b] = getFillColor(c);
          return [r, g, b, logoIds.has(c.id) ? 0 : 255] as [number, number, number, number];
        },
        getLineColor: darkMode ? [255, 255, 255, 90] : [0, 0, 0, 60],
        lineWidthMinPixels: 0.5,
        stroked: true,
        opacity: scatterOpacity,
        pickable: true,
        onClick: (info: PickingInfo<Company>) => {
          if (info.object) onCompanyClick(info.object);
        },
        transitions: {
          getRadius: { duration: 500, enter: () => [0] },
        },
        updateTriggers: {
          getFillColor: logoIds,
        },
      })
    );

    return result;
  }, [
    is3D,
    darkMode,
    countries,
    companies,
    topCompanies,
    hexOpacity,
    scatterOpacity,
    haloOpacity,
    logoIds,
    onCompanyClick,
  ]);

  // Pulse ring layer is the only per-frame layer; building one small layer per
  // frame is cheap and keeps the base layers out of the animation loop.
  const layers = useMemo(() => {
    if (pulseTime === 0 || hiringCompanies.length === 0 || showLogos) return baseLayers;
    const pulsePhase = (pulseTime % 1.6) / 1.6;
    return [
      ...baseLayers,
      new ScatterplotLayer<Company>({
        id: 'hiring-pulse',
        data: hiringCompanies,
        getPosition: (c) => [c.longitude!, c.latitude!],
        getRadius: (c) => getRadiusPx(c) * (1 + pulsePhase * 1.8),
        radiusUnits: 'pixels',
        filled: false,
        stroked: true,
        getLineColor: [76, 175, 80, Math.round(150 * (1 - pulsePhase))],
        lineWidthMinPixels: 1,
        opacity: scatterOpacity,
        pickable: false,
        updateTriggers: {
          getRadius: pulsePhase,
          getLineColor: pulsePhase,
        },
      }),
    ];
  }, [baseLayers, pulseTime, hiringCompanies, scatterOpacity, showLogos]);

  if (!supportsWebGL()) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-muted text-muted-foreground font-mono text-sm p-8 text-center">
        The interactive map requires WebGL, which your browser doesn't support or has disabled.
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <DeckGL
        views={view}
        viewState={viewState}
        pickingRadius={8}
        onViewStateChange={({ viewState: vs, interactionState }) => {
          onViewStateChange(vs as MapViewState);
          if (
            interactionState &&
            (interactionState.isDragging || interactionState.isPanning || interactionState.isZooming)
          ) {
            onUserInteraction();
          }
        }}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        layers={layers as any}
        getTooltip={({ object, layer }: PickingInfo) => {
          if (!object || !layer) return null;
          if (layer.id === 'company-dots') {
            const c = object as Company;
            if (logoIds.has(c.id)) return null;
            return companyTooltip(c, darkMode);
          }
          if (layer.id === 'company-hexagons') {
            const hex = object as { count?: number; points?: unknown[]; elevationValue?: number };
            const count = hex.count ?? hex.elevationValue ?? hex.points?.length ?? 0;
            return {
              html: `<b>${count}</b> companies`,
              style: {
                backgroundColor: darkMode ? '#1a1a1a' : '#fff',
                color: darkMode ? '#e5e5e5' : '#1a1a1a',
                fontSize: '12px',
                fontFamily: 'ui-monospace, monospace',
                borderRadius: '8px',
                padding: '6px 10px',
              },
            };
          }
          return null;
        }}
        style={{ position: 'absolute', inset: '0' }}
      >
        {!is3D && (
          <Map
            mapStyle={darkMode ? DARK_STYLE : LIGHT_STYLE}
            attributionControl={{ compact: true }}
          />
        )}
      </DeckGL>

      {/* DOM logo markers at city zoom: real clickable elements with pop-in. */}
      {logoMarkers.length > 0 && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {logoMarkers.map(({ company: c, x, y }) => (
            <button
              key={c.id}
              onClick={() => onCompanyClick(c)}
              title={`${c.name}${c.one_liner ? ` — ${c.one_liner}` : ''}`}
              className="wm-logo-marker pointer-events-auto"
              style={{
                transform: `translate(${x - 16}px, ${y - 16}px)`,
                borderColor: markerBorderColor(c),
                boxShadow: c.top_company
                  ? '0 0 10px 2px rgba(255,193,7,0.55), 0 2px 6px rgba(0,0,0,0.3)'
                  : '0 2px 6px rgba(0,0,0,0.3)',
              }}
            >
              <img
                src={c.small_logo_thumb_url}
                alt={c.name}
                loading="lazy"
                onError={(e) => {
                  const img = e.currentTarget;
                  img.style.display = 'none';
                  const fallback = img.nextElementSibling as HTMLElement | null;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <span
                className="wm-logo-fallback"
                style={{ background: markerBorderColor(c) }}
              >
                {c.name.charAt(0)}
              </span>
              {c.is_hiring && <span className="wm-logo-pulse" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
