/* eslint-disable react-hooks/immutability -- three.js/DOM resources are
   GPU-adjacent objects written imperatively per frame; there is no pure-React
   formulation of that. Same deliberate call as the donor codebase. */
/*
 * Three.js resources and DOM nodes here are written imperatively, per frame;
 * there is no pure-React formulation of that.
 */

import { useLayoutEffect, useMemo, useRef } from 'react'
import type { GlobePin } from '../../../lib/worldApi'
import {
  countPlotsPerCity,
  useCityIndex,
  type CityIndex,
} from './cityIndex'
import {
  LOD_TIER_MIN,
  POP_FADE_DECADES,
  anchoredLabelX,
  cityLabelBudgetAt,
  clampLabelSpan,
} from './labelLayout'
import {
  LABEL_BORDER,
  LABEL_GAP,
  LABEL_HEIGHT,
  LABEL_LEADER,
  LABEL_PAD_X,
  createBoxPool,
  createLabelPool,
  useLabelLayer,
  useLabelSurface,
  type LabelPool,
} from './useLevelOfDetail'

/**
 * City names, and only names.
 *
 * There used to be a second layer here: a 7,328-instance dot field, one mark
 * for every populated place the camera could see. It was cheap — one draw call,
 * two uniforms per frame — and it was wrong. It speckled every continent with
 * grey confetti that competed with the country fills for attention and, worse,
 * pointed at the wrong noun. This map is about *countries*; a visitor claims a
 * country, hovers a country, buys a country. Seven thousand dots said "look at
 * the cities" over and over on a map where cities are not for sale.
 *
 * What is left is the curated layer: capped, collision-resolved, drawn as HTML,
 * and held back until the camera is close enough that a name is orientation
 * rather than decoration. There is no point drawing more than about a hundred;
 * past that it is not information, it is a hatch pattern made of type.
 *
 * A city holding plots is named earlier than its population alone would earn,
 * and carries its plot count. That is the bridge between the map and the
 * product — a city with plots is a contested city.
 */

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------
//
// The gazetteer itself, the one-fetch cache and the pin -> city snap all live in
// `cityIndex.ts` now: the density layer needs the same three things, and two
// copies of a 7,328-row build is how two layers end up disagreeing about which
// city a pin is in.

/**
 * Effective population, and the importance order that falls out of it.
 *
 * A contested city is promoted — up to four times its own size — so that the
 * place someone actually planted in appears before the anonymous million-person
 * city next door. Bounded at four, because unbounded promotion would put a
 * hamlet with nine plots above Tokyo, and a map that lies about which places
 * are big is not a map.
 *
 * The order array is what lets the per-frame scan break early: cities are
 * walked most-important-first, and the first one under the population floor
 * ends the loop.
 */
function buildOrder(index: CityIndex, counts: Uint16Array) {
  const logEffective = new Float32Array(index.count)
  for (let i = 0; i < index.count; i += 1) {
    const boost = counts[i] > 0 ? Math.min(1 + counts[i] * 0.5, 4) : 1
    logEffective[i] = Math.log10(index.population[i] * boost + 1)
  }

  const order = new Uint32Array(index.count)
  const scratch = new Array<number>(index.count)
  for (let i = 0; i < index.count; i += 1) scratch[i] = i
  scratch.sort((a, b) => logEffective[b] - logEffective[a])
  for (let i = 0; i < index.count; i += 1) order[i] = scratch[i]

  return { logEffective, order }
}

/**
 * Where a name's leader line starts, in globe radii.
 *
 * The dots that used to sit at this radius are gone, but the anchor is not:
 * a city name is still pinned to its place on the surface, and it still has to
 * clear the border lines (1.001) and the country fill (1.0015) so the leader
 * does not begin underneath the ground it points at.
 */
const CITY_ANCHOR_RADIUS = 1.003

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Most city labels offered to the layout in one frame. */
const CITY_CANDIDATES = 320
/** DOM nodes kept for city names. The global cap is 120, so this is all of it. */
const CITY_POOL = 120
/** Skip measuring text for anything this far outside the canvas. */
const OFFSCREEN_SLACK = 80
/** Camera distance, in globe radii, above which no city is named at all. */
const CITY_NAME_DISTANCE = LOD_TIER_MIN.far

export interface CityLabelsProps {
  /** PAID pins only — a seed is not a stake, so it never makes a city
   *  "contested". The caller filters; this layer just counts. */
  plots: readonly GlobePin[]
  enabled?: boolean
}

export function CityLabels({ plots, enabled = true }: CityLabelsProps) {
  const index = useCityIndex(enabled)
  const surface = useLabelSurface()

  const counts = useMemo(
    () => (index ? countPlotsPerCity(index, plots) : null),
    [index, plots],
  )

  const ranking = useMemo(
    () => (index && counts ? buildOrder(index, counts) : null),
    [index, counts],
  )

  // ---- label pool ---------------------------------------------------------

  const poolRef = useRef<LabelPool | null>(null)

  useLayoutEffect(() => {
    if (!surface) return undefined
    const pool = createLabelPool(surface, CITY_POOL, 'city')
    poolRef.current = pool
    return () => {
      poolRef.current = null
      pool.dispose()
    }
  }, [surface])

  /** Which city each slot currently shows, so text is written only on change. */
  const slotCity = useMemo(() => new Int32Array(CITY_POOL).fill(-1), [])
  const slotCount = useMemo(() => new Int32Array(CITY_POOL).fill(-1), [])

  const scratch = useMemo(
    () => ({
      boxes: createBoxPool(),
      idx: [] as number[],
      alpha: [] as number[],
      x: [] as number[],
      y: [] as number[],
    }),
    [],
  )

  useLabelLayer({
    collect(out, frame) {
      const s = scratch
      s.boxes.reset()
      s.idx.length = 0
      s.alpha.length = 0
      s.x.length = 0
      s.y.length = 0

      if (!enabled || !index || !counts || !ranking || !poolRef.current) return

      /*
       * Names are a close-range layer now.
       *
       * With the dot field gone, a handful of city names floating over an empty
       * ocean at world view is the only thing on the globe pointing at cities,
       * and it reads as a mistake rather than as detail. `CITY_NAME_DISTANCE`
       * is the top of the `mid` tier — the same rung at which the urban layer
       * starts to fade in — so names arrive with the ground they belong to.
       */
      if (frame.distance > CITY_NAME_DISTANCE) return

      const { order, logEffective } = ranking
      const { dirs, names, ids } = index
      const logFloor = frame.logPopFloor
      if (!Number.isFinite(logFloor)) return

      const { camX, camY, camZ, horizon, horizonTop, width, height } = frame
      const invBand = 1 / Math.max(horizonTop - horizon, 1e-4)
      const pillH = LABEL_HEIGHT.city
      const halfH = pillH / 2

      /*
       * The ceiling. `CITY_CANDIDATES` is the measuring cost cap; this is the
       * editorial one — how many names the picture can carry before it stops
       * being a map of a product and becomes a road atlas. `order` puts every
       * city holding paid plots near the front, so the tightened budget is
       * spent on the contested ones. See `cityLabelBudgetAt`.
       */
      const budget = Math.min(cityLabelBudgetAt(frame.distance), CITY_CANDIDATES)
      if (budget <= 0) return

      let taken = 0
      for (let k = 0; k < order.length; k += 1) {
        if (taken >= budget) break
        const i = order[k]

        // Sorted by effective population, so the first city under the floor is
        // the last city worth looking at.
        const above = logEffective[i] - logFloor
        if (above <= 0) break

        const o = i * 3
        const dx = dirs[o]
        const dy = dirs[o + 1]
        const dz = dirs[o + 2]

        const facing = dx * camX + dy * camY + dz * camZ
        if (facing <= horizon) continue

        const t = facing >= horizonTop ? 1 : (facing - horizon) * invBand
        const limb = t * t * (3 - 2 * t)
        const lod = above >= POP_FADE_DECADES ? 1 : above / POP_FADE_DECADES
        const alpha = lod * limb
        if (alpha < 0.02) continue

        if (!frame.project(dx, dy, dz, CITY_ANCHOR_RADIUS)) continue
        const px = frame.px
        const py = frame.py
        if (
          px < -OFFSCREEN_SLACK ||
          px > width + OFFSCREEN_SLACK ||
          py < -OFFSCREEN_SLACK ||
          py > height + OFFSCREEN_SLACK
        ) {
          continue
        }

        const held = counts[i]
        const nameWidth = frame.measure(names[i], 'name')
        const metaWidth =
          held > 0 ? frame.measure(plotCountText(held), 'meta') + LABEL_GAP : 0
        const pillWidth =
          LABEL_BORDER * 2 + LABEL_PAD_X * 2 + nameWidth + metaWidth

        // Right of the dot, or mirrored to its left when the frame edge is in
        // the way — a half-drawn city name is worse than a missing one.
        const left = anchoredLabelX(px, pillWidth, LABEL_LEADER, width)
        if (left === null) continue
        const top = clampLabelSpan(py - halfH, pillH, height, halfH - 4)
        if (top === null) continue

        // The box covers the dot as well as the pill: a name whose leader line
        // runs straight through a neighbouring city's dot reads as belonging to
        // the wrong place.
        const boxX = Math.min(px - 5, left)
        out.push(
          s.boxes.take(
            ids[i],
            boxX,
            top,
            Math.max(px + 5, left + pillWidth) - boxX,
            pillH,
            cityPriority(index.population[i], held),
          ),
        )
        s.idx.push(i)
        s.alpha.push(alpha)
        s.x.push(left)
        s.y.push(top)
        taken += 1
      }
    },

    commit(placed, frame) {
      const pool = poolRef.current
      if (!pool) return

      pool.begin()

      if (index && counts) {
        const s = scratch
        for (let k = 0; k < s.idx.length; k += 1) {
          const i = s.idx[k]
          if (!placed.has(index.ids[i])) continue

          // `collect` resolved the side and the edge clamp already, so this is
          // the exact rectangle the layout agreed to.
          const slot = pool.show(index.ids[i], s.x[k], s.y[k], s.alpha[k])
          if (slot < 0) continue

          const held = counts[i]
          if (slotCity[slot] !== i || slotCount[slot] !== held) {
            slotCity[slot] = i
            slotCount[slot] = held
            pool.names[slot].textContent = index.names[i]
            const meta = pool.metas[slot]
            if (held > 0) {
              meta.textContent = plotCountText(held)
              meta.style.display = ''
            } else {
              meta.style.display = 'none'
            }
          }
        }
      }

      pool.end(frame.dt, frame.reducedMotion)
    },
  })

  // Nothing in the scene graph: this layer is HTML, positioned from `commit`.
  return null
}

/**
 * Label importance.
 *
 * Contested cities are lifted above every uncontested city smaller than two
 * million, which is all but about fifty places on Earth. Plot count then orders
 * them among themselves. The result is that when Plovdiv and a nameless
 * Chinese prefecture of the same size collide, the one with someone's money in
 * it wins — which is the whole argument the map is making.
 */
function cityPriority(population: number, plots: number): number {
  return population + (plots > 0 ? 2_000_000 + plots * 500_000 : 0)
}

function plotCountText(n: number): string {
  return n === 1 ? '1 plot' : `${n} plots`
}
