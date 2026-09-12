/* eslint-disable react-hooks/immutability -- three.js/DOM resources are
   GPU-adjacent objects written imperatively per frame; there is no pure-React
   formulation of that. Same deliberate call as the donor codebase. */
/*
 * DOM nodes here are written imperatively, per frame, from a frame callback;
 * there is no pure-React formulation of that.
 */

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { flagEmoji } from './countries'
import { latLngToVector3 } from './geo'
import type { CountryInfo } from './CountryBorders'
import {
  clampLabelSpan,
  countryLabelBudgetAt,
  labelRoomScale,
  unclaimedCountryBudgetAt,
} from './labelLayout'
import {
  LABEL_BORDER,
  LABEL_CHEVRON,
  LABEL_GAP,
  LABEL_HEIGHT,
  LABEL_PAD_COUNTRY,
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
 * make the product's argument: a country holding paid stakes is labelled with
 * how many are bidding on it, and wins priority over every empty giant.
 *
 * NOTHING ON THIS LAYER SAYS "UNCLAIMED". It used to: every country with no
 * stakes carried the word as its meta line, which meant the most common thing
 * written across the map was a label for the absence of a product. It is also
 * not information — the fill already says who owns what, in colour, at a
 * glance — and a world covered in the same negative word reads as a dead
 * product rather than as an open one. An empty country now carries its name and
 * nothing else, and the countries with real numbers are the ones with a second
 * line.
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
 * Priority for the SELECTED country. Above everything, unconditionally.
 *
 * The one country the panel is about is the one country whose pill must never
 * lose a collision — it is the anchor tying the panel's heading to a shape on
 * the sphere, and a selection whose label got culled by a bigger neighbour
 * leaves the visitor reading about a country they cannot find.
 */
const SELECTED_PRIORITY = 1e12

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
  /** iso2 → paid pin count. Absent or zero = nobody is bidding yet. */
  counts: ReadonlyMap<string, number>
  /**
   * ISO-3166 alpha-2 of the country the panel is showing, or null.
   *
   * Its pill takes the accent border the territory itself is wearing, is
   * announced as the current one, and jumps to the front of the priority queue
   * so a collision can never cull it.
   */
  selectedIso2?: string | null
  enabled?: boolean
  /**
   * Fired with the ISO-3166 alpha-2 when a pill is pressed.
   *
   * Supplying it is what makes this layer interactive at all — the pool leaves
   * every node inert until a handler exists.
   */
  onActivate?: (iso2: string) => void
  /**
   * Fired with the ISO-3166 alpha-2 the cursor is over, or null on leave.
   *
   * The pill covers the canvas while the cursor is on it, so the globe's own
   * hover picker goes blind exactly then; forwarding this keeps the territory
   * lit while its label is being aimed at.
   */
  onHover?: (iso2: string | null) => void
}

export function CountryLabels({
  countries,
  counts,
  selectedIso2 = null,
  enabled = true,
  onActivate,
  onHover,
}: CountryLabelsProps) {
  const surface = useLabelSurface()

  /**
   * Centroid directions and the strings to draw, rebuilt only when the data
   * moves. `latLngToVector3` allocates a Vector3 per call; doing that for 238
   * countries inside a frame callback would be thousands of allocations a
   * second for data that changes every ten seconds at most.
   */
  const selected = selectedIso2 ? selectedIso2.toUpperCase() : null

  const data = useMemo(() => {
    const count = countries.length
    const dirs = new Float32Array(count * 3)
    const ids = new Array<string>(count)
    const names = new Array<string>(count)
    const metas = new Array<string>(count)
    const priority = new Float32Array(count)
    /** Paid pins in each country, parallel to the arrays above. 0 = no bids. */
    const held = new Float32Array(count)
    let claimed = 0
    const v = new THREE.Vector3()

    for (let i = 0; i < count; i += 1) {
      const row = countries[i]
      v.copy(latLngToVector3(row.lat, row.lng, 1))
      dirs[i * 3] = v.x
      dirs[i * 3 + 1] = v.y
      dirs[i * 3 + 2] = v.z
      ids[i] = `k${row.iso2}`

      const heldHere = counts.get(row.iso2) ?? 0
      held[i] = heldHere
      if (heldHere > 0) claimed += 1
      const flag = flagEmoji(row.iso2)
      names[i] = flag ? `${flag} ${row.name}` : row.name
      /*
       * The meta is a COUNT OF REAL BIDS or it is nothing at all.
       *
       * "12 bidding" is a fact about the board — it came from the paid pins the
       * feed shipped, one per stake — and it is the same sentence the country
       * panel opens with, so the map and the panel say the same thing in the
       * same words. There is deliberately no branch producing a string for a
       * country with no stakes: silence is the honest rendering of "no data
       * here yet", and it leaves the claimed countries as the only ones on the
       * map carrying a number.
       */
      metas[i] = heldHere > 0 ? biddingText(heldHere) : ''
      priority[i] =
        row.iso2 === selected
          ? SELECTED_PRIORITY
          : heldHere > 0
            ? CLAIMED_PRIORITY_BASE + heldHere * 1e3
            : row.weight
    }

    // Most important first, so the tier budget is a prefix of this array.
    const order = new Uint16Array(count)
    const scratch: number[] = []
    for (let i = 0; i < count; i += 1) scratch.push(i)
    scratch.sort((a, b) => priority[b] - priority[a])
    for (let i = 0; i < count; i += 1) order[i] = scratch[i]

    return { count, dirs, ids, names, metas, priority, held, claimed, order }
  }, [countries, counts, selected])

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

  /** Same contract as above, for the pill's own hover. */
  useLayoutEffect(() => {
    const pool = poolRef.current
    if (!pool) return undefined

    pool.setHover(
      onHover ? (id) => onHover(id ? id.replace(/^k/, '') : null) : null,
    )
    return () => pool.setHover(null)
  }, [onHover, surface])

  const slotCountry = useMemo(() => new Int32Array(COUNTRY_POOL).fill(-1), [])

  /**
   * Forget which country each slot holds whenever the data is rebuilt.
   *
   * `commit` only rewrites a slot's text when the slot changes OWNER, which is
   * the right economy for a frame loop and the wrong one when the strings
   * themselves move underneath it. The board refetches every sixty seconds; a
   * country that went from nothing to "1 bidding" while its pill stayed on
   * screen would keep the old text — an empty label on a country that has just
   * been bid on, which is precisely the number this layer exists to show.
   * Clearing the map forces one rewrite on the next frame and nothing after it.
   */
  useEffect(() => {
    slotCountry.fill(-1)
  }, [data, slotCountry])

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

  /**
   * The chevron's contribution to a pill's width, or zero.
   *
   * `onActivate` is the same condition the pool uses to add `is-pressable`,
   * which is the class that reveals the glyph — so this is the one flag that
   * decides both whether the affordance is drawn and whether the layout is
   * told about it. Read fresh each render: `useLabelLayer` mirrors the latest
   * layer object into a ref every render, so this closure never goes stale.
   */
  const chevronWidth = onActivate ? LABEL_CHEVRON : 0

  useLabelLayer({
    collect(out, frame) {
      const s = scratch
      s.boxes.reset()
      s.idx.length = 0
      s.alpha.length = 0
      s.x.length = 0
      s.y.length = 0

      if (!enabled || data.count === 0 || !poolRef.current) return

      // Continuous in camera distance, not stepped per tier — country names now
      // arrive one at a time as the camera descends instead of eight at once on
      // a tier boundary. See `countryLabelBudgetAt`.
      //
      // …and continuous in the CANVAS, too. The distance ramp alone says the
      // same six names fit a 480px homepage band and a 1,250px full-viewport
      // stage, which is how a globe a thousand pixels across ended up with
      // Greenland, Canada and Mexico on it and nothing else. `labelRoomScale`
      // is the second half of the answer; the collision pass below is still
      // what decides whether any given candidate actually lands.
      const room = labelRoomScale(frame.height)
      const budget = Math.min(countryLabelBudgetAt(frame.distance, room), COUNTRY_POOL)
      /*
       * The empty countries get their own, much tighter ceiling — but only once
       * somebody has actually bought something. With nothing claimed there are
       * no advertisers to protect and the atlas is the best thing on offer, so
       * the cap lifts to the whole budget. See `unclaimedCountryBudgetAt`.
       */
      const emptyBudget = data.claimed > 0
        ? Math.min(unclaimedCountryBudgetAt(frame.distance, room), budget)
        : budget
      const { camX, camY, camZ, horizon, horizonTop, width, height } = frame
      const invBand = 1 / Math.max(horizonTop - horizon, 1e-4)
      const pillH = LABEL_HEIGHT.country
      const halfH = pillH / 2

      let taken = 0
      let empties = 0
      for (let k = 0; k < data.count && taken < budget; k += 1) {
        const i = data.order[k]
        // `order` puts every claimed country first, so once the empty tail is
        // full there is nothing left worth walking — but `continue`, not
        // `break`: a later empty country may still be the one on screen while
        // the ones already counted were behind the horizon.
        if (data.held[i] === 0 && empties >= emptyBudget) continue
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

        /*
         * Padding, text, meta — and the chevron, when there is one.
         *
         * The chevron only exists on a pressable pill (`.is-pressable` is what
         * reveals it), and it is drawn in CSS, so it has no text width for
         * `measure` to find. Leaving it out of this sum would make every
         * country pill LABEL_CHEVRON pixels wider than the rectangle the layout
         * resolved, which is how the edge clamp starts letting pills hang off
         * the frame again.
         */
        const meta = data.metas[i]
        const pillWidth =
          LABEL_BORDER * 2 +
          LABEL_PAD_COUNTRY * 2 +
          frame.measure(data.names[i], 'title') +
          // An empty meta costs nothing — not its width and not the flex gap in
          // front of it, which is only in the box model when the span is
          // displayed. Charging for a gap that is not drawn is how a country
          // with no bids ends up with a pill that is visibly too wide for it.
          (meta ? LABEL_GAP + frame.measure(meta, 'meta') : 0) +
          chevronWidth

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
        if (data.held[i] === 0) empties += 1
      }
    },

    commit(placed, frame) {
      const pool = poolRef.current
      if (!pool) return

      pool.begin()

      const s = scratch
      const selectedId = selected ? `k${selected}` : null

      for (let k = 0; k < s.idx.length; k += 1) {
        const i = s.idx[k]
        if (!placed.has(data.ids[i])) continue

        // `collect` already resolved the final top-left, edge clamp included,
        // so `commit` places exactly the rectangle the layout agreed to.
        const slot = pool.show(data.ids[i], s.x[k], s.y[k], s.alpha[k])
        if (slot < 0) continue

        if (slotCountry[slot] !== i) {
          slotCountry[slot] = i
          const meta = data.metas[i]
          pool.names[slot].textContent = data.names[i]
          pool.metas[slot].textContent = meta
          // Hidden rather than emptied: an empty flex child still spends the
          // pill's gap, and `collect` above sized the rectangle on the
          // assumption that it does not.
          pool.metas[slot].style.display = meta ? '' : 'none'
        }

        /*
         * The selected pill, outside the slot-identity guard above.
         *
         * Selection can change while a slot keeps the same country — clicking
         * the territory rather than its label does exactly that — so this
         * cannot ride along with the text write. `classList.toggle` with an
         * explicit boolean is idempotent and touches no attribute when the
         * answer has not moved, so paying it on 26 nodes a frame is free.
         *
         * `aria-current` only where the pill is a real button: on an inert,
         * aria-hidden caption it would be an announcement nobody can act on.
         */
        const isSelected = data.ids[i] === selectedId
        pool.nodes[slot].classList.toggle('is-selected', isSelected)
        if (isSelected && onActivate) {
          pool.nodes[slot].setAttribute('aria-current', 'true')
        } else {
          pool.nodes[slot].removeAttribute('aria-current')
        }
      }

      pool.end(frame.dt, frame.reducedMotion)
    },
  })

  return null
}

/**
 * How many stakes are on a country's board, in the panel's own words.
 *
 * "1 bidding" and not "1 bid": the panel's headline is "12 bidding · #1 pays
 * $51", the pill is the same sentence at map scale, and two phrasings for one
 * number is how a visitor starts wondering whether they are two numbers.
 */
function biddingText(n: number): string {
  return `${n} bidding`
}
