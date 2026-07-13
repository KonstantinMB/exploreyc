import { feature } from 'topojson-client';
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson';
// ?url keeps the ~100KB TopoJSON out of the JS chunk; fetched once on demand.
import countriesUrl from 'world-atlas/countries-110m.json?url';

export interface GlobeGeo {
  countries: FeatureCollection;
  // Border polylines for stroking, as flat [x,y,...] arrays (PathLayer with
  // positionFormat XY). Polygon rings can't be stroked directly on the globe:
  // rings that close across the antimeridian (Russia) or along the dataset's
  // polar edge (Antarctica at -84.7°) render as lines circling the whole
  // planet. These paths break at those artifacts.
  borders: number[][];
}

function ringToBorderChunks(ring: number[][], out: number[][]) {
  let chunk: number[] = [];
  for (let i = 0; i < ring.length; i++) {
    const [lng, lat] = ring[i];
    const prevLng = chunk.length >= 2 ? chunk[chunk.length - 2] : null;
    const jumps = prevLng !== null && Math.abs(lng - prevLng) > 180;
    if (Math.abs(lat) > 84 || jumps) {
      if (chunk.length > 2) out.push(chunk);
      chunk = Math.abs(lat) > 84 ? [] : [lng, lat];
    } else {
      chunk.push(lng, lat);
    }
  }
  if (chunk.length > 2) out.push(chunk);
}

let cached: Promise<GlobeGeo> | null = null;

export function getCountries(): Promise<GlobeGeo> {
  if (!cached) {
    cached = fetch(countriesUrl)
      .then((res) => res.json())
      .then((topo) => {
        const countries = feature(
          topo,
          topo.objects.countries
        ) as unknown as FeatureCollection;
        const borders: number[][] = [];
        for (const f of countries.features) {
          const geom = f.geometry as Polygon | MultiPolygon;
          const polys =
            geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
          for (const poly of polys) {
            for (const ring of poly) {
              ringToBorderChunks(ring as number[][], borders);
            }
          }
        }
        return { countries, borders };
      });
  }
  return cached;
}
