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

export interface PlotLabelsProps {
  pins: readonly GlobePin[]
  palette: GlobePalette
  enabled?: boolean
}

export function PlotLabels({ pins, palette, enabled = true }: PlotLabelsProps) {
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

    return { count, dirs, ids, names, metas, colors, priority, order }
  }, [pins, palette])

  /** How many leading entries of `order` are promoted — they skip the gate. */
  const promotedCount = useMemo(() => {
    let n = 0
    for (let i = 0; i < pins.length; i += 1) if (pins[i].promoted) n += 1
    return n
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

      if (!enabled || data.count === 0 || !poolRef.current) return

      const tierAlpha = plotLabelFade(frame.distance)
      // Promoted pills survive at every distance; the rest of the layer needs
      // the camera inside the near tier before it exists at all.
      const limit = tierAlpha <= 0.01 ? promotedCount : data.count

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
        const alpha = promoted ? limb : limb * tierAlpha
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
          LABEL_SWATCH +
          LABEL_GAP +
          frame.measure(data.names[i], 'name') +
          metaWidth

        // Right of the marker, or mirrored to its left when the frame edge is
        // in the way. A plot name is the one string on this map somebody paid
        // for; rendering half of it is worse than dropping it.
        const left = anchoredLabelX(px, pillWidth, LABEL_LEADER, width)
        if (left === null) continue
        const top = clampLabelSpan(py - halfH, pillH, height, halfH - 4)
        if (top === null) continue

        const boxX = Math.min(px - 5, left)
        out.push(
          s.boxes.take(
            data.ids[i],
            boxX,
            top,
            Math.max(px + 5, left + pillWidth) - boxX,
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

        // `collect` resolved the side and the edge clamp already, so this is
        // the exact rectangle the layout agreed to.
        const slot = pool.show(data.ids[i], s.x[k], s.y[k], s.alpha[k])
        if (slot < 0) continue

        if (slotPin[slot] !== i) {
          slotPin[slot] = i
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
          swatch.style.display = ''
          swatch.style.background = data.colors[i]
        }
      }

      pool.end(frame.dt, frame.reducedMotion)
    },
  })

  return null
}
