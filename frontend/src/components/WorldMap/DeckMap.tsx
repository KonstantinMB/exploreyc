import { useEffect, useMemo, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { MapView, _GlobeView as GlobeView } from '@deck.gl/core';
import type { MapViewState, PickingInfo } from '@deck.gl/core';
import { ScatterplotLayer, GeoJsonLayer, SolidPolygonLayer } from '@deck.gl/layers';
import { HexagonLayer } from '@deck.gl/aggregation-layers';
import { Map } from 'react-map-gl/maplibre';
import type { FeatureCollection } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Company } from '../../lib/api';
import { getCountries } from './countries';

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

// Dense perimeter (every 10°) so the sphere-covering sea polygon tessellates
// cleanly on the globe; flat [x,y,...] pairs consumed with positionFormat XY.
const GLOBE_SEA_POLYGON: number[] = (() => {
  const pts: number[] = [];
  for (let lng = -180; lng <= 180; lng += 10) pts.push(lng, 90);
  for (let lat = 90; lat >= -90; lat -= 10) pts.push(180, lat);
  for (let lng = 180; lng >= -180; lng -= 10) pts.push(lng, -90);
  for (let lat = -90; lat <= 90; lat += 10) pts.push(-180, lat);
  return pts;
})();

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

function getRadiusMeters(c: Company): number {
  const teamSize = Math.min(c.team_size || 1, 1000);
  return 2000 + Math.sqrt(teamSize) * 800;
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
  const [countries, setCountries] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    if (is3D && !countries) {
      getCountries().then(setCountries).catch(() => {
        // Globe still renders dots over the sphere backdrop without country outlines.
      });
    }
  }, [is3D, countries]);

  const view = useMemo(
    () =>
      is3D
        ? new GlobeView({ id: 'world', controller: true })
        : new MapView({ id: 'world', controller: true, repeat: true }),
    [is3D]
  );

  const hiringCompanies = useMemo(() => companies.filter((c) => c.is_hiring), [companies]);
  const topCompanies = useMemo(() => companies.filter((c) => c.top_company), [companies]);

  const zoom = typeof viewState.zoom === 'number' ? viewState.zoom : 2;
  const rampIn = Math.max(0, Math.min(1, (zoom - HEX_IN_START) / (HEX_IN_END - HEX_IN_START)));
  const rampOut = Math.max(0, Math.min(1, (HEX_OUT_END - zoom) / (HEX_OUT_END - HEX_OUT_START)));
  const hexOpacity = is3D ? 0 : Math.min(rampIn, rampOut);
  const scatterOpacity = 1 - hexOpacity * 0.85;

  // Pulse phase: 0→1 loop every 1.6s. pulseTime === 0 keeps rings at rest.
  const pulsePhase = (pulseTime % 1.6) / 1.6;

  const layers = useMemo(() => {
    const result: unknown[] = [];

    if (is3D) {
      // Sphere backdrop (oceans) — GlobeView renders no basemap tiles.
      // Globe floats in dark space in both themes; only land colors follow the theme.
      result.push(
        new SolidPolygonLayer<{ polygon: number[]; }>({
          id: 'globe-sea',
          data: [{ polygon: GLOBE_SEA_POLYGON }],
          getPolygon: (d) => d.polygon,
          positionFormat: 'XY',
          getFillColor: darkMode ? [10, 17, 32] : [22, 38, 66],
          filled: true,
        })
      );
      if (countries) {
        result.push(
          new GeoJsonLayer({
            id: 'globe-countries',
            data: countries,
            stroked: true,
            filled: true,
            getFillColor: darkMode ? [34, 42, 58] : [228, 228, 220],
            getLineColor: darkMode ? [80, 95, 120, 200] : [120, 130, 150, 160],
            getLineWidth: 1,
            lineWidthUnits: 'pixels',
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

    // Soft "constellation" halo under every dot — gives the world view depth.
    result.push(
      new ScatterplotLayer<Company>({
        id: 'company-halo',
        data: companies,
        getPosition: (c) => [c.longitude!, c.latitude!],
        getRadius: getRadiusMeters,
        radiusMinPixels: 8,
        radiusMaxPixels: 30,
        getFillColor: (c) => {
          const [r, g, b] = getFillColor(c);
          return [r, g, b, 45] as [number, number, number, number];
        },
        stroked: false,
        opacity: scatterOpacity,
        pickable: false,
      })
    );

    // Static gold under-glow for top companies.
    result.push(
      new ScatterplotLayer<Company>({
        id: 'top-company-glow',
        data: topCompanies,
        getPosition: (c) => [c.longitude!, c.latitude!],
        getRadius: (c) => getRadiusMeters(c) * 2.2,
        radiusMinPixels: 8,
        radiusMaxPixels: 34,
        getFillColor: [255, 193, 7, 45],
        stroked: false,
        opacity: scatterOpacity,
        pickable: false,
      })
    );

    // Main company dots.
    result.push(
      new ScatterplotLayer<Company>({
        id: 'company-dots',
        data: companies,
        getPosition: (c) => [c.longitude!, c.latitude!],
        getRadius: getRadiusMeters,
        radiusMinPixels: 3,
        radiusMaxPixels: 18,
        getFillColor,
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
      })
    );

    // Expanding pulse rings around hiring companies.
    if (pulseTime > 0 && hiringCompanies.length > 0) {
      result.push(
        new ScatterplotLayer<Company>({
          id: 'hiring-pulse',
          data: hiringCompanies,
          getPosition: (c) => [c.longitude!, c.latitude!],
          getRadius: (c) => getRadiusMeters(c) * (1 + pulsePhase * 2.5),
          radiusMinPixels: 4,
          radiusMaxPixels: 40,
          filled: false,
          stroked: true,
          getLineColor: [76, 175, 80, Math.round(200 * (1 - pulsePhase))],
          lineWidthMinPixels: 1.5,
          opacity: scatterOpacity,
          pickable: false,
          updateTriggers: {
            getRadius: pulsePhase,
            getLineColor: pulsePhase,
          },
        })
      );
    }

    return result;
  }, [
    is3D,
    darkMode,
    countries,
    companies,
    topCompanies,
    hiringCompanies,
    hexOpacity,
    scatterOpacity,
    pulsePhase,
    pulseTime,
    onCompanyClick,
  ]);

  if (!supportsWebGL()) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-muted text-muted-foreground font-mono text-sm p-8 text-center">
        The interactive map requires WebGL, which your browser doesn't support or has disabled.
      </div>
    );
  }

  return (
    <DeckGL
      views={view}
      viewState={viewState}
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
          return companyTooltip(object as Company, darkMode);
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
  );
}
