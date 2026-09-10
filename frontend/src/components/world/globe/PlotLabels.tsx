/* eslint-disable react-hooks/immutability -- three.js/DOM resources are
   GPU-adjacent objects written imperatively per frame; there is no pure-React
   formulation of that. Same deliberate call as the donor codebase. */
/*
 * DOM nodes here are written imperatively, per frame, from a frame callback;
 * there is no pure-React formulation of that.
 */

import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { GlobePin } from '../../../lib/worldApi'
import { latLngToVector3, markerColor, type GlobePalette } from './geo'
import { anchoredLabelX, clampLabelSpan, plotLabelFade } from './labelLayout'
import {
  LABEL_BORDER,
  LABEL_CHIP_PAD,
  LABEL_GAP,
  LABEL_HEIGHT,
  LABEL_LEADER,
  LABEL_PAD_X,
  LABEL_SWATCH,
  createBoxPool,
  createLabelPool,
  useLabelLayer,
  useLabelSurface,
  type LabelPool,
} from './useLevelOfDetail'

/**
 * The bottom rung: who planted here.
 *
 * These arrive last and leave first. A pin name is the densest thing the map
 * can draw — a contested city has a dozen markers inside forty pixels, all of
 * them wanting a name — so the layer stays entirely dark until the camera is
 * well inside `near`, is capped hard, and loses most collisions to the city
 * underneath it. That is the correct order: you find the city, then the city
 * tells you who is in it.
 *
 * With one exception, and it is a paid-for exception: **promoted pins carry a
 * visible "Promoted" pill at every distance.** That is the honesty rule from
 * the spec — paid placement is always labelled as paid placement — and it is
 * also what the promoter bought. Promoted pills bypass the distance gate, sit
 * above every other label priority, and their swatch is the same YC orange as
 * their beacon.
 *
 * The swatch repeats the marker's colour so the pill and the bead it belongs
 * to are obviously the same object; the meta text ("Promoted" / "unclaimed")
 * is what stops that colour being the only carrier of state.
 */

/** Most plot labels offered to the layout in one frame. */
const PLOT_CANDIDATES = 60
/** DOM nodes kept. Beyond this a city is a wall of names, not a leaderboard. */
const PLOT_POOL = 40
/** Roughly where a marker's bead sits above the surface. */
const LABEL_RADIUS = 1.006
const OFFSCREEN_SLACK = 80

/**
 * Promoted pills outrank everything, including country pills (1e9-based).
 * "Always visible" loses its meaning if Bulgaria's name can knock it out.
 */
const PROMOTED_PRIORITY = 1e12

/**
 * How many top-ranked PAID plots are named at EVERY distance, orbit included —
 * on top of every promoted pin, which is always named regardless.
 *
 * A paid plot whose name only appears once somebody has zoomed into its city is
 * a paid plot most visitors never see the name of, and the name is most of what
 * was bought. Twelve is what a globe seen whole can carry without the pills
 * becoming the terrain; below the fold of the ladder the rest of the paid layer
 * still arrives on approach exactly as it did.
 *
 * Ranked by stake, so the names that survive from orbit are the ones that paid
 * the most to be there — the same rule the logo tiles use for their slots.
 */
const ALWAYS_LABELLED_PAID = 12

export interface PlotLabelsProps {
  pins: readonly GlobePin[]
  palette: GlobePalette
  enabled?: boolean
  /**
   * Pin id → half-width, in CSS pixels, of the logo tile drawn on that pin this
   * frame. Written by `LogoMarkers`, which is mounted ahead of this layer so the
   * map is fresh rather than a frame stale.
   *
   * A pill anchored `LABEL_LEADER` px from the pin's centre lands underneath a
   * 42px tile centred on the same point. Rather than let the collision pass
   * resolve that by dropping one of them — which would mean either an advertiser
   * with no name or a name with no logo — the pill steps out past the tile's
   * edge, and drops its colour swatch, because the logo IS the swatch.
   */
  logoClaims?: React.RefObject<Map<string, number> | null>
}

export function PlotLabels({
  pins,
  palette,
  enabled = true,
  logoClaims,
}: PlotLabelsProps) {
  const surface = useLabelSurface()

  /**
   * Directions, colours and the strings, rebuilt only when the data moves.
   * Promoted first, then paid by tier, then seeds — the candidate scan below
   * walks this order and takes the first N, so the order *is* the policy.
   */
  const data = useMemo(() => {
    const count = pins.length
    const dirs = new Float32Array(count * 3)
    const ids = new Array<string>(count)
    /** The pin's own id, for looking a logo claim up by. */
    const pinIds = new Array<string>(count)
    const names = new Array<string>(count)
    const metas = new Array<string>(count)
    const colors = new Array<string>(count)
    const priority = new Float32Array(count)
    const v = new THREE.Vector3()

    for (let i = 0; i < count; i += 1) {
      const pin = pins[i]
      v.copy(latLngToVector3(pin.lat, pin.lng, 1))
      dirs[i * 3] = v.x
      dirs[i * 3 + 1] = v.y
      dirs[i * 3 + 2] = v.z
      ids[i] = `p${pin.id}`
      pinIds[i] = pin.id
      names[i] = pin.name
      metas[i] = pin.promoted
        ? 'Promoted'
        : pin.kind === 'seed'
          ? 'unclaimed'
          : ''
      colors[i] = markerColor(palette.markers, pin.kind, pin.tier, pin.promoted)
      priority[i] = pin.promoted
        ? PROMOTED_PRIORITY + pin.tier
        : pin.kind === 'plot'
          ? 1e6 + pin.tier * 1e3
          : pin.tier
    }

    const order = new Uint32Array(count)
    const scratch: number[] = []
    for (let i = 0; i < count; i += 1) scratch.push(i)
    scratch.sort((a, b) => priority[b] - priority[a])
    for (let i = 0; i < count; i += 1) order[i] = scratch[i]

    return { count, dirs, ids, pinIds, names, metas, colors, priority, order }
  }, [pins, palette])

  /**
   * How many leading entries of `order` skip the distance gate.
   *
   * `order` is promoted-first, then paid by tier, then seeds — so the leading
   * run is exactly the paid layer, best-funded first, and "the top N paid" is a
   * prefix length rather than a search. Every promoted pin is in it by
   * construction (they sort above the rest of paid), which is what keeps the
   * paid-placement disclosure visible at every distance.
   */
  const alwaysCount = useMemo(() => {
    let promoted = 0
    let paid = 0
    for (let i = 0; i < pins.length; i += 1) {
      if (pins[i].promoted) promoted += 1
      if (pins[i].kind === 'plot') paid += 1
    }
    return Math.min(paid, promoted + ALWAYS_LABELLED_PAID)
  }, [pins])

  const poolRef = useRef<LabelPool | null>(null)

  useLayoutEffect(() => {
    if (!surface) return undefined
    const pool = createLabelPool(surface, PLOT_POOL, 'plot')
    poolRef.current = pool
    return () => {
      poolRef.current = null
      pool.dispose()
    }
  }, [surface])

  const slotPin = useMemo(() => new Int32Array(PLOT_POOL).fill(-1), [])
  /** Whether the slot was last dressed with its swatch hidden by a logo tile. */
  const slotLogo = useMemo(() => new Int8Array(PLOT_POOL).fill(-1), [])

  const scratch = useMemo(
    () => ({
      boxes: createBoxPool(),
      idx: [] as number[],
      alpha: [] as number[],
      x: [] as number[],
      y: [] as number[],
      /** Half-width of the logo tile this pill stepped around, or 0. */
      logo: [] as number[],
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
      s.logo.length = 0

      if (!enabled || data.count === 0 || !poolRef.current) return

      const claims = logoClaims?.current ?? null
      const tierAlpha = plotLabelFade(frame.distance)
      // Promoted pins and the best-funded plots survive at every distance; the
      // rest of the layer needs the camera inside the near tier to exist at all.
      const limit = tierAlpha <= 0.01 ? alwaysCount : data.count

      const { camX, camY, camZ, horizon, horizonTop, width, height } = frame
      const invBand = 1 / Math.max(horizonTop - horizon, 1e-4)
      const pillH = LABEL_HEIGHT.plot
      const halfH = pillH / 2

      let taken = 0
      for (let k = 0; k < limit && taken < PLOT_CANDIDATES; k += 1) {
        const i = data.order[k]
        const promoted = data.priority[i] >= PROMOTED_PRIORITY
        const o = i * 3
        const dx = data.dirs[o]
        const dy = data.dirs[o + 1]
        const dz = data.dirs[o + 2]

        const facing = dx * camX + dy * camY + dz * camZ
        if (facing <= horizon) continue

        const t = facing >= horizonTop ? 1 : (facing - horizon) * invBand
        const limb = t * t * (3 - 2 * t)
        const alpha = k < alwaysCount ? limb : limb * tierAlpha
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
         * A logo tile on this pin takes the swatch's job and the pill's space.
         *
         * The tile is the mark now — the same company's own logo, centred on the
         * bead — so repeating its stake colour in a 9px dot beside it says
         * nothing, and anchoring the pill at the usual gap would put the name
         * underneath the tile it belongs to.
         */
        const logoHalf = claims?.get(data.pinIds[i]) ?? 0
        const leader = LABEL_LEADER + logoHalf
        const markHalf = Math.max(5, logoHalf)

        // "Promoted" is a filled chip and carries its own padding; "unclaimed"
        // is plain meta text and does not. Both have to be in the width the
        // layout resolves, or the pill it places is not the pill that draws.
        const metaWidth = data.metas[i]
          ? frame.measure(data.metas[i], 'meta') +
            LABEL_GAP +
            (promoted ? LABEL_CHIP_PAD : 0)
          : 0
        const pillWidth =
          LABEL_BORDER * 2 +
          LABEL_PAD_X * 2 +
          (logoHalf > 0 ? 0 : LABEL_SWATCH + LABEL_GAP) +
          frame.measure(data.names[i], 'name') +
          metaWidth

        // Right of the marker, or mirrored to its left when the frame edge is
        // in the way. A plot name is the one string on this map somebody paid
        // for; rendering half of it is worse than dropping it.
        const left = anchoredLabelX(px, pillWidth, leader, width)
        if (left === null) continue
        const top = clampLabelSpan(py - halfH, pillH, height, halfH - 4)
        if (top === null) continue

        /*
         * The box the pill reserves — and the one place the tile and the pill
         * had to stop fighting each other.
         *
         * Without a logo the box spans the bead AND the pill, because the two
         * are one mark and nothing may be drawn between them. With a logo it
         * spans the PILL ONLY: the tile has already reserved its own square in
         * `LogoMarkers`, at a priority above this one, so a box that reached
         * back over the bead was guaranteed to collide with it. That collision
         * resolved backwards in both directions — an ordinary paid plot lost
         * its name to its own logo and rendered as an anonymous letter tile,
         * and a PROMOTED plot (priority 1e12, the one thing that outranks a
         * tile) lost its logo to its own name, so the plot that had paid the
         * most was the only one on the globe with no mark at all. The pill
         * already sits a whole `logoHalf` clear of the tile; the box just has
         * to say so.
         */
        const boxX = logoHalf > 0 ? left : Math.min(px - markHalf, left)
        const boxW =
          logoHalf > 0
            ? pillWidth
            : Math.max(px + markHalf, left + pillWidth) - boxX
        out.push(
          s.boxes.take(data.ids[i], boxX, top, boxW, pillH, data.priority[i]),
        )
        s.idx.push(i)
        s.alpha.push(alpha)
        s.x.push(left)
        s.y.push(top)
        s.logo.push(logoHalf > 0 ? 1 : 0)
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

        // `collect` resolved the side and the edge clamp already, so this is
        // the exact rectangle the layout agreed to.
        const slot = pool.show(data.ids[i], s.x[k], s.y[k], s.alpha[k])
        if (slot < 0) continue

        const hasLogo = s.logo[k]
        if (slotPin[slot] !== i || slotLogo[slot] !== hasLogo) {
          slotPin[slot] = i
          slotLogo[slot] = hasLogo
          pool.names[slot].textContent = data.names[i]
          const meta = pool.metas[slot]
          if (data.metas[i]) {
            meta.textContent = data.metas[i]
            meta.style.display = ''
            // Paid placement is a disclosure, so it is drawn as a filled chip
            // that survives any terrain; "unclaimed" is an invitation and stays
            // quiet meta text.
            meta.classList.toggle(
              'world-lod__meta--promoted',
              data.priority[i] >= PROMOTED_PRIORITY,
            )
          } else {
            meta.style.display = 'none'
            meta.classList.remove('world-lod__meta--promoted')
          }
          const swatch = pool.swatches[slot]
          // Hidden when a logo tile is standing in for it: two marks for one
          // company, side by side, is one mark too many.
          swatch.style.display = hasLogo ? 'none' : ''
          swatch.style.background = data.colors[i]
        }
      }

      pool.end(frame.dt, frame.reducedMotion)
    },
  })

  return null
}
