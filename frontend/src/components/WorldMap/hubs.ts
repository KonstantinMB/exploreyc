import type { Company } from '../../lib/api';

export interface Hub {
  name: string;
  latitude: number;
  longitude: number;
  count: number;
  hiringCount: number;
  topIndustry: string;
}

function mostFrequent(counts: Map<string, number>): string {
  let best = '';
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

// Group companies into city-scale hubs (~1 decimal degree cells) and rank by size.
export function computeHubs(companies: Company[], topN = 8): Hub[] {
  const cells = new Map<
    string,
    {
      latSum: number;
      lngSum: number;
      count: number;
      hiringCount: number;
      cities: Map<string, number>;
      industries: Map<string, number>;
    }
  >();

  for (const c of companies) {
    if (c.latitude == null || c.longitude == null) continue;
    const key = `${c.latitude.toFixed(1)},${c.longitude.toFixed(1)}`;
    let cell = cells.get(key);
    if (!cell) {
      cell = {
        latSum: 0,
        lngSum: 0,
        count: 0,
        hiringCount: 0,
        cities: new Map(),
        industries: new Map(),
      };
      cells.set(key, cell);
    }
    cell.latSum += c.latitude;
    cell.lngSum += c.longitude;
    cell.count += 1;
    if (c.is_hiring) cell.hiringCount += 1;

    const city = (c.all_locations || '').split(';')[0]?.trim();
    if (city) cell.cities.set(city, (cell.cities.get(city) || 0) + 1);
    if (c.industry) cell.industries.set(c.industry, (cell.industries.get(c.industry) || 0) + 1);
  }

  return Array.from(cells.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, topN)
    .map((cell) => ({
      name: mostFrequent(cell.cities) || 'Unknown',
      latitude: cell.latSum / cell.count,
      longitude: cell.lngSum / cell.count,
      count: cell.count,
      hiringCount: cell.hiringCount,
      topIndustry: mostFrequent(cell.industries) || '—',
    }));
}
