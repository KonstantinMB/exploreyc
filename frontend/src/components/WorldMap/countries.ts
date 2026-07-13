import { feature } from 'topojson-client';
import type { FeatureCollection } from 'geojson';
// ?url keeps the ~100KB TopoJSON out of the JS chunk; fetched once on demand.
import countriesUrl from 'world-atlas/countries-110m.json?url';

let cached: Promise<FeatureCollection> | null = null;

export function getCountries(): Promise<FeatureCollection> {
  if (!cached) {
    cached = fetch(countriesUrl)
      .then((res) => res.json())
      .then(
        (topo) =>
          feature(topo, topo.objects.countries) as unknown as FeatureCollection
      );
  }
  return cached;
}
