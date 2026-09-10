/**
 * City-scale hubs: where the imported companies actually cluster.
 *
 * Ported from the retiring deck.gl map (components/WorldMap/hubs.ts) when the
 * two globes merged. The algorithm is unchanged — same 0.1° cells, same
 * centroid, same "most frequent wins" for name and industry, same '—'/'Unknown'
 * fallbacks — only the input type moved, from the fat `Company` row the deck.gl
 * map fetched to the lean `GlobePin` the globe already has.
 *
 * That swap is the whole reason GET /api/world/globe grew `industry` and
 * `location`: without them every hub here comes back named 'Unknown' with a
 * topIndustry of '—', which is a worse answer than not shipping the feature.
 *
 * FEED IT UNJITTERED PINS. `jitterSeeds` scatters coincident seeds over a ~5 km
 * disc so they stop stacking into one dot; that is a rendering trick, and
 * averaging jittered coordinates would drift a hub's centre off the city it is
 * named after. GlobeScene keeps `feedById` — the pre-jitter pins, keyed by id —
 * for exactly this kind of caller. Paid plots are never jittered at all, so
 * they are safe from either source.
 */

import type { GlobePin } from '../../../lib/worldApi'

export interface Hub {
  name: string
  latitude: number
  longitude: number
  count: number
  hiringCount: number
  topIndustry: string
}

function mostFrequent(counts: Map<string, number>): string {
  let best = ''
  let bestCount = 0
  for (const [key, count] of counts) {
    if (count > bestCount) {
      best = key
      bestCount = count
    }
  }
  return best
}

// Group pins into city-scale hubs (~1 decimal degree cells) and rank by size.
export function computeHubs(pins: readonly GlobePin[], topN = 8): Hub[] {
  const cells = new Map<
    string,
    {
      latSum: number
      lngSum: number
      count: number
      hiringCount: number
      cities: Map<string, number>
      industries: Map<string, number>
    }
  >()

  for (const c of pins) {
    if (c.lat == null || c.lng == null) continue
    const key = `${c.lat.toFixed(1)},${c.lng.toFixed(1)}`
    let cell = cells.get(key)
    if (!cell) {
      cell = {
        latSum: 0,
        lngSum: 0,
        count: 0,
        hiringCount: 0,
        cities: new Map(),
        industries: new Map(),
      }
      cells.set(key, cell)
    }
    cell.latSum += c.lat
    cell.lngSum += c.lng
    cell.count += 1
    if (c.is_hiring) cell.hiringCount += 1

    // Already the first ';'-segment of all_locations, trimmed server-side —
    // the same string the deck.gl version split out of the raw column.
    const city = c.location?.trim()
    if (city) cell.cities.set(city, (cell.cities.get(city) || 0) + 1)
    if (c.industry) cell.industries.set(c.industry, (cell.industries.get(c.industry) || 0) + 1)
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
    }))
}
