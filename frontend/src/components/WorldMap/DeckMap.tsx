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

// Hexagon bars fade out and individual companies fade in across this zoom band.
const HEX_FADE_START = 3.5;
const HEX_FADE_END = 4.5;

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
  const hexOpacity = is3D
    ? 0
    : Math.max(0, Math.min(1, (HEX_FADE_END - zoom) / (HEX_FADE_END - HEX_FADE_START)));
  const scatterOpacity = 1 - hexOpacity * 0.85;

  // Pulse phase: 0→1 loop every 1.6s. pulseTime === 0 keeps rings at rest.
  const pulsePhase = (pulseTime % 1.6) / 1.6;

  const layers = useMemo(() => {
    const result: unknown[] = [];

    if (is3D) {
      // Sphere backdrop (oceans) — GlobeView renders no basemap tiles.
      result.push(
        new SolidPolygonLayer<{ polygon: number[][] }>({
          id: 'globe-sea',
          data: [
            { polygon: [[-180, 90], [0, 90], [180, 90], [180, -90], [0, -90], [-180, -90]] },
          ],
          getPolygon: (d) => d.polygon.flat(),
          getFillColor: darkMode ? [8, 14, 26] : [170, 211, 223],
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
            getFillColor: darkMode ? [30, 36, 48] : [235, 235, 230],
            getLineColor: darkMode ? [70, 80, 100, 180] : [150, 150, 150, 180],
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
          radius: 100_000,
          extruded: true,
          elevationScale: 60,
          elevationRange: [0, 40_000],
          coverage: 0.85,
          opacity: hexOpacity * 0.75,
          pickable: hexOpacity > 0.4,
          colorRange: [
            [255, 224, 178],
            [255, 183, 77],
            [255, 152, 0],
            [251, 101, 30],
            [230, 74, 25],
            [191, 54, 12],
          ],
        })
      );
    }

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
          const count = (object as { points?: unknown[] }).points?.length ?? 0;
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
