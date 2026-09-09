/* eslint-disable react-hooks/immutability -- three.js/DOM resources are
   GPU-adjacent objects written imperatively per frame; there is no pure-React
   formulation of that. Same deliberate call as the donor codebase. */
/*
 * DOM nodes here are written imperatively, per frame, from a frame callback;
 * there is no pure-React formulation of that.
 */

import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { flagEmoji } from './countries'
import { latLngToVector3 } from './geo'
import type { CountryInfo } from './CountryBorders'
import { clampLabelSpan, countryLabelBudget } from './labelLayout'
import {
  LABEL_GAP,
  LABEL_HEIGHT,
  createBoxPool,
  createLabelPool,
  useLabelLayer,
  useLabelSurface,
  type LabelPool,
} from './useLevelOfDetail'

/**
 * Country pills, written across their territory.
 *
 * The top layer of the ladder and the only one that survives at world view —
 * the globe is 500 pixels across and a city name would be a fleck. Six of them
 * out there, opening up as the camera comes in and then usually beaten back
 * down by collision anyway: a country centroid is a single point, and Europe
 * has thirty of them inside a thumbnail.
 *
 * The donor wrote the leading startup's name here, from a standings feed this
 * globe does not receive. What it does know — the pins — still lets the layer
 * make the product's argument: a country holding paid pins is labelled with
 * its pin count and wins priority over every empty giant, and an unclaimed
 * country reads as an invitation.
 */

/** DOM nodes kept. The budget never exceeds this. */
const COUNTRY_POOL = 26
/** Countries sit slightly higher than city pills so they win the visual stack. */
const LABEL_RADIUS = 1.004
const OFFSCREEN_SLACK = 80

/**
 * Priority floor for a claimed country.
 *
 * Pin counts and vertex-count size proxies live on wildly different scales, so
 * the floor keeps every claimed country above every unclaimed one without
 * flattening the order within either group — countries are the coarser reading
 * of the same data and should win a collision against a place name.
 */
const CLAIMED_PRIORITY_BASE = 1e9

/**
 * How much of the pill must still sit over the country's centroid after the
 * pill has been pushed away from a viewport edge.
 *
 * A country pill is centred on its centroid rather than offset beside it — the
 * label *is* the mark, and there is no dot or leader line saying which country
 * it belongs to. Slide it far enough and it stops being a label for that
 * country and becomes a caption floating in the ocean, so the pill is allowed
 * to move only while the centroid stays this far inside it. Past that the label
 * is dropped, which on a phone is what happens to a country whose centre is
 * within half a pill of the screen edge — correct, because the alternative is
 * naming a country the visitor cannot see.
 */
const ANCHOR_KEEP = 10

export interface CountryLabelsProps {
  /** Every country in the current topology, from `CountryBorders`. */
  countries: readonly CountryInfo[]
  /** iso2 → paid pin count. Absent or zero = unclaimed. */
  counts: ReadonlyMap<string, number>
  enabled?: boolean
  /**
   * Fired with the ISO-3166 alpha-2 when a pill is pressed.
   *
   * Supplying it is what makes this layer interactive at all — the pool leaves
   * every node inert until a handler exists.
   */
  onActivate?: (iso2: string) => void
}

export function CountryLabels({
  countries,
  counts,
  enabled = true,
  onActivate,
}: CountryLabelsProps) {
  const surface = useLabelSurface()

  /**
   * Centroid directions and the strings to draw, rebuilt only when the data
   * moves. `latLngToVector3` allocates a Vector3 per call; doing that for 238
   * countries inside a frame callback would be thousands of allocations a
   * second for data that changes every ten seconds at most.
   */
  const data = useMemo(() => {
    const count = countries.length
    const dirs = new Float32Array(count * 3)
    const ids = new Array<string>(count)
    const names = new Array<string>(count)
    const metas = new Array<string>(count)
    const priority = new Float32Array(count)
    const v = new THREE.Vector3()

    for (let i = 0; i < count; i += 1) {
      const row = countries[i]
      v.copy(latLngToVector3(row.lat, row.lng, 1))
      dirs[i * 3] = v.x
      dirs[i * 3 + 1] = v.y
      dirs[i * 3 + 2] = v.z
      ids[i] = `k${row.iso2}`

      const held = counts.get(row.iso2) ?? 0
      const flag = flagEmoji(row.iso2)
      names[i] = flag ? `${flag} ${row.name}` : row.name
      /*
       * The meta is the product in three words. A country with pins carries
       * its count; a country without them says so, and "unclaimed" on a map
       * where other countries visibly are not is the sentence that invites the
       * first bid.
       */
      metas[i] = held > 0 ? pinCountText(held) : 'unclaimed'
      priority[i] =
        held > 0 ? CLAIMED_PRIORITY_BASE + held * 1e3 : row.weight
    }

    // Most important first, so the tier budget is a prefix of this array.
    const order = new Uint16Array(count)
    const scratch: number[] = []
    for (let i = 0; i < count; i += 1) scratch.push(i)
    scratch.sort((a, b) => priority[b] - priority[a])
    for (let i = 0; i < count; i += 1) order[i] = scratch[i]

    return { count, dirs, ids, names, metas, priority, order }
  }, [countries, counts])

  const poolRef = useRef<LabelPool | null>(null)

  useLayoutEffect(() => {
    if (!surface) return undefined
    const pool = createLabelPool(surface, COUNTRY_POOL, 'country')
    poolRef.current = pool
    return () => {
      poolRef.current = null
      pool.dispose()
    }
  }, [surface])

  /**
   * Bind (or unbind) the press handler.
   *
   * Separate from the effect that builds the pool so that a changing handler
   * does not tear down and rebuild twenty-six DOM nodes — which would drop
   * every label's fade state and make the whole layer flash.
   *
   * The pool hands back the slot's own id, which this layer minted as
   * `k<ISO2>`; the prefix is stripped here rather than leaking a label-layer
   * encoding out to whoever is listening.
   */
  useLayoutEffect(() => {
    const pool = poolRef.current
    if (!pool) return undefined

    pool.setActivate(
      onActivate ? (id) => onActivate(id.replace(/^k/, '')) : null,
    )
    return () => pool.setActivate(null)
  }, [onActivate, surface])

  const slotCountry = useMemo(() => new Int32Array(COUNTRY_POOL).fill(-1), [])

  const scratch = useMemo(
    () => ({
      boxes: createBoxPool(),
      idx: [] as number[],
      alpha: [] as number[],
      /** Final top-left of each candidate, already clamped to the frame. */
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

      if (!enabled || data.count === 0 || !poolRef.current) return

      const budget = Math.min(countryLabelBudget(frame.tier), COUNTRY_POOL)
      const { camX, camY, camZ, horizon, horizonTop, width, height } = frame
      const invBand = 1 / Math.max(horizonTop - horizon, 1e-4)
      const pillH = LABEL_HEIGHT.country
      const halfH = pillH / 2

      let taken = 0
      for (let k = 0; k < data.count && taken < budget; k += 1) {
        const i = data.order[k]
        const o = i * 3
        const dx = data.dirs[o]
        const dy = data.dirs[o + 1]
        const dz = data.dirs[o + 2]

        const facing = dx * camX + dy * camY + dz * camZ
        if (facing <= horizon) continue

        const t = facing >= horizonTop ? 1 : (facing - horizon) * invBand
        const alpha = t * t * (3 - 2 * t)
        if (alpha < 0.02) continue

        if (!frame.project(dx, dy, dz, LABEL_RADIUS)) continue
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

        // 9px of padding, matching `.world-lod--country`.
        const pillWidth =
          9 * 2 +
          frame.measure(data.names[i], 'title') +
          LABEL_GAP +
          frame.measure(data.metas[i], 'meta')

        /*
         * Centred on the centroid rather than offset beside it — a country has
         * no dot to sit next to; the label *is* the mark — and then pulled back
         * inside the frame if that centre is close enough to an edge to hang the
         * pill over it.
         *
         * The clamp happens here, before the box is offered, so collision
         * resolution sees where the pill will actually be drawn. Clamping in
         * `commit` instead would let two pills that were resolved as disjoint
         * end up stacked in the corner they were both pushed into.
         */
        const left = clampLabelSpan(
          px - pillWidth / 2,
          pillWidth,
          width,
          pillWidth / 2 - ANCHOR_KEEP,
        )
        if (left === null) continue
        const top = clampLabelSpan(py - halfH, pillH, height, halfH - 4)
        if (top === null) continue

        out.push(
          s.boxes.take(
            data.ids[i],
            left,
            top,
            pillWidth,
            pillH,
            data.priority[i],
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

      const s = scratch
      for (let k = 0; k < s.idx.length; k += 1) {
        const i = s.idx[k]
        if (!placed.has(data.ids[i])) continue

        // `collect` already resolved the final top-left, edge clamp included,
        // so `commit` places exactly the rectangle the layout agreed to.
        const slot = pool.show(data.ids[i], s.x[k], s.y[k], s.alpha[k])
        if (slot < 0) continue

        if (slotCountry[slot] !== i) {
          slotCountry[slot] = i
          pool.names[slot].textContent = data.names[i]
          pool.metas[slot].textContent = data.metas[i]
          pool.metas[slot].style.display = ''
        }
      }

      pool.end(frame.dt, frame.reducedMotion)
    },
  })

  return null
}

function pinCountText(n: number): string {
  return n === 1 ? '1 pin' : `${n} pins`
}
