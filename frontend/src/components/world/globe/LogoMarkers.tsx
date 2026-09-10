/*
 * DOM nodes here are long-lived imperative resources, written to per frame from
 * a frame callback; there is no pure-React formulation of "move a hundred and
 * thirty buttons this frame".
 */

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { GlobePin } from '../../../lib/worldApi'
import { logoLetter, logoPriority, logoSizeFor, safeImageUrl } from './logos'
import { clamp01 } from './labelLayout'
import {
  createBoxPool,
  useLabelLayer,
  useLabelSurface,
} from './useLevelOfDetail'

/**
 * The company's own logo, on the map, on top of its pin.
 *
 * This is the single biggest capability the deck.gl map had that the globe did
 * not, and it is the one that matters most commercially: a bead the colour of a
 * stake tier says "somebody paid here", a logo says WHO — and "who" is the thing
 * a business is buying when it buys a plot. The globe is advertising space, and
 * advertising space with no brand on it is a car park.
 *
 * Ported from `DeckMap.tsx`, idea for idea:
 *
 *  - **Viewport-culled.** Only what is on screen and on the near hemisphere is
 *    projected, measured or drawn.
 *  - **Capped.** `MAX_LOGO_MARKERS` of them, because 5,579 `<img>` elements is
 *    not a map, it is a memory leak with a globe behind it.
 *  - **Deterministically prioritised, with a stable tiebreak.** The order is
 *    computed once per data change (never per frame, never per pan), by
 *    `logoPriority` and then by id — so panning back and forth cannot reshuffle
 *    which companies are showing, which was the specific glitch the donor's
 *    `|| a.id - b.id` tiebreak existed to prevent.
 *  - **`<img onError>` falling back to a first letter.** Roughly a fifth of
 *    imported companies have a dead thumbnail; a broken-image glyph on a paid
 *    map is worse than no logo at all.
 *  - **Real focusable buttons**, not painted pixels — see the tab-order note on
 *    `TABBABLE` below.
 *
 * Two things are new, and both come from the merge:
 *
 *  1. **Paid plots take absolute priority for slots.** `logoPriority` puts every
 *     paid plot above every seed by a margin no seed can close, so a crowded
 *     city fills its slots with customers first and imports second. Seeds fill
 *     what is left — and only when their layer is switched on at all, which the
 *     page expresses by simply not passing them.
 *  2. **They join the label collision layout.** The markers offer their boxes to
 *     the same greedy pass the city, country and plot pills go through, at a
 *     priority above all of them, so a logo can never end up half-under a place
 *     name and a place name can never end up on top of an advertiser. `claimed`
 *     is how the plot pills find out to step aside — see `PlotLabels`.
 */

/** Hard cap on live marker elements. The donor's number, and for the same reason. */
export const MAX_LOGO_MARKERS = 130

/**
 * …of which at most this many may be imported companies.
 *
 * Paid plots are uncapped inside `MAX_LOGO_MARKERS` and take their slots first;
 * this is the ceiling on what is left. It exists because "seeds stay quiet
 * background texture" has to survive a zoom into San Francisco, where 2,819 of
 * them are in frame: without the sub-cap, the imported layer would fill every
 * remaining slot and a city holding two paid plots would render as a hundred and
 * thirty logos, two of which somebody paid for. Sixty is a mosaic you can still
 * pick a customer out of.
 */
const MAX_SEED_LOGOS = 60

/**
 * Camera distance below which a PAID plot shows its logo, in globe radii.
 *
 * `LOD_TIER_MIN.far` — the moment the camera stops being in orbit. Paid plots
 * are the product, so they brand themselves as early as the ladder allows.
 */
const PAID_DISTANCE = 3.15

/**
 * …and for a seed. Much closer: an imported company is background texture, and
 * 5,579 logos at continent range is a mosaic, not a map.
 */
const SEED_DISTANCE = 1.9

/** Distance over which a marker fades in below its gate, in globe radii. */
const GATE_FADE = 0.35

/**
 * The radius the tile is projected at — the same one `PlotLabels` anchors to,
 * which is roughly where a bead sits above the surface. Tile and bead have to
 * be projected from the same shell or they separate as the camera moves.
 */
const MARKER_RADIUS = 1.006

/**
 * How many top-ranked PAID plots carry their logo at *every* distance, orbit
 * included.
 *
 * The whole pitch of a paid plot is visibility, and visibility that begins only
 * once somebody has zoomed in is visibility the buyer did not get. Eight is the
 * number that fits on a globe seen whole without becoming a collage — and
 * because they are ranked by stake, the ones that are always visible are the
 * ones that paid the most for it.
 */
const ALWAYS_VISIBLE_PAID = 8

/**
 * Only paid plots are in the tab order.
 *
 * Both are real `<button type="button">` elements with real click and hover
 * handlers; the difference is `tabindex`. A hundred and thirty tab stops that
 * reorder themselves as the planet turns is a keyboard trap dressed up as an
 * affordance, and the imported layer duplicates data that is already reachable
 * as ordinary links on the boards and at /company/<slug>. Paid plots are few,
 * they are the thing a visitor came to interact with, and they stay reachable.
 */
const TABBABLE = { plot: 0, seed: -1 } as const

const CSS_ID = 'world-logo-marker-styles'

/*
 * Colours are the `--lod-*` tokens defined by `.world-lod-surface` in
 * `useLevelOfDetail.ts`, inherited because this container lives inside that
 * surface. Nothing new is invented here: the marker is the label pill's
 * substrate at a different aspect ratio, so the contrast ratios documented
 * there hold, and the dark theme follows the same single class toggle.
 *
 * No backticks in this stylesheet — it lives inside a template literal.
 */
const MARKER_CSS = `
.world-logo-pins {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  contain: layout paint;
}
.world-logo-pin {
  position: absolute;
  left: 0;
  top: 0;
  display: grid;
  place-items: center;
  box-sizing: border-box;
  padding: 0;
  margin: 0;
  border: 0;
  border-radius: 10px;
  background: var(--lod-card);
  color: var(--lod-muted);
  font-family: inherit;
  font-weight: 800;
  line-height: 1;
  overflow: hidden;
  opacity: 0;
  visibility: hidden;
  pointer-events: auto;
  cursor: pointer;
  transform: translate3d(-9999px, -9999px, 0);
  /* NO TRANSFORM STATES ON THIS ELEMENT: the frame loop overwrites transform
     sixty times a second. Hover and press are expressed in the box-shadow
     stack and in the ring, which the loop never touches. */
  transition: box-shadow 90ms ease-out, border-color 90ms ease-out;
  contain: layout style paint;
}
/* Paid: a card sitting on the map, with the physical edge the World's buttons
   have. Seeds: a flat sticker that never lifts. */
.world-logo-pin--plot {
  box-shadow: 0 0 0 1.5px var(--lod-border), 0 2px 0 var(--lod-edge),
    var(--lod-shadow);
}
.world-logo-pin--seed {
  border-radius: 8px;
  box-shadow: 0 0 0 1px var(--lod-border);
}
/* Paid placement, ringed in the one accent the map is allowed. The WORD
   "Promoted" is not repeated here — the plot pill carries it at every distance
   and duplicating a disclosure beside itself is noise, not honesty.

   ORDER MATTERS BELOW THIS RULE. Every state that follows has the same
   specificity as this one (a class plus a pseudo-class), so the cascade is
   decided by source order alone — and with this rule written after them, a
   promoted tile would be the one tile on the map that could not show hover,
   press or focus. */
.world-logo-pin.is-promoted {
  box-shadow: 0 0 0 2px var(--lod-accent), 0 0 0 3.5px var(--lod-card),
    0 2px 0 var(--lod-press), var(--lod-shadow-hi);
}
.world-logo-pin:hover {
  box-shadow: 0 0 0 2px var(--lod-accent), 0 2px 0 var(--lod-press),
    var(--lod-shadow-hi);
}
.world-logo-pin:active {
  box-shadow: 0 0 0 2px var(--lod-accent), var(--lod-shadow);
}
.world-logo-pin:focus-visible {
  outline: none;
  /* The same layered ring as .world-focus: card halo, accent ring, then a
     hairline of --lod-accent-text so the indicator clears 3:1 against pale
     land as well as against the tile. */
  box-shadow: 0 0 0 2px var(--lod-card), 0 0 0 5px var(--lod-accent),
    0 0 0 6px var(--lod-accent-text), var(--lod-shadow-hi);
}
.world-logo-pin__img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  /* Logos are drawn for white. Giving them white in both themes is what keeps a
     transparent PNG legible on a dark map. */
  background: #ffffff;
  display: block;
}
.world-logo-pin__letter {
  display: none;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  /* The same pairing WorldLogo uses for its letter tile — muted ink on the
     warm ground — which is what keeps it at AA in both themes (5.4:1 light,
     6.0:1 dark) where the accent would have come in at 4.4:1 on dark. */
  background: var(--lod-card-hi);
  color: var(--lod-muted);
}
@media (prefers-reduced-motion: reduce) {
  .world-logo-pin {
    transition-duration: 1ms;
  }
}
@media (forced-colors: active) {
  .world-logo-pin {
    border: 1px solid ButtonBorder;
  }
  .world-logo-pin.is-promoted {
    border: 2px solid Highlight;
  }
  .world-logo-pin:focus-visible {
    outline: 3px solid Highlight;
    outline-offset: 2px;
  }
}
`

/** Opacity easing rate, matching the label pool's (~150ms to settle at 60fps). */
const FADE_RATE = 14

interface LogoPool {
  show(id: string, x: number, y: number, alpha: number): number
  begin(): void
  end(dt: number, snap: boolean): void
  /** Write a slot's contents. Called only when the slot changes owner. */
  dress(slot: number, pin: GlobePin, size: number): void
  dispose(): void
}

function createLogoPool(
  container: HTMLElement,
  size: number,
  onActivate: (id: string) => void,
  onHover: (id: string | null) => void,
): LogoPool {
  const doc = container.ownerDocument
  if (!doc.getElementById(CSS_ID)) {
    const style = doc.createElement('style')
    style.id = CSS_ID
    style.textContent = MARKER_CSS
    doc.head.appendChild(style)
  }

  const nodes: HTMLButtonElement[] = []
  const imgs: HTMLImageElement[] = []
  const letters: HTMLSpanElement[] = []
  const cleanups: Array<() => void> = []

  const alpha = new Float32Array(size)
  const target = new Float32Array(size)
  const written = new Float32Array(size).fill(-1)
  const visible = new Uint8Array(size)
  const owner: (string | null)[] = new Array(size).fill(null)
  const slotOf = new Map<string, number>()
  /**
   * The last src that failed to load, per slot.
   *
   * Without this a company with a dead thumbnail comes back as a broken-image
   * glyph the second time it is drawn: `dress` would set display:block again,
   * the src would be unchanged, and the browser does not re-fire `error` for a
   * request it has already failed and cached. Remembering the URL turns the
   * second visit into a letter, silently, like the first.
   */
  const failed: (string | null)[] = new Array(size).fill(null)

  // Handed out from the back, so a marker keeps the same node between frames
  // and its fade animates the element it belongs to.
  const free: number[] = []
  for (let i = size - 1; i >= 0; i -= 1) free.push(i)

  for (let i = 0; i < size; i += 1) {
    const el = doc.createElement('button')
    el.type = 'button'
    el.className = 'world-logo-pin'

    const img = doc.createElement('img')
    img.className = 'world-logo-pin__img'
    img.alt = ''
    img.loading = 'lazy'
    img.decoding = 'async'

    const letter = doc.createElement('span')
    letter.className = 'world-logo-pin__letter'

    // The donor's fallback, kept as a listener bound once per SLOT rather than
    // per company: a dead thumbnail hides the image and reveals the letter that
    // occupies the same box, so the marker never becomes a broken-image glyph.
    const onError = () => {
      failed[i] = img.getAttribute('src')
      img.style.display = 'none'
      letter.style.display = 'flex'
    }
    img.addEventListener('error', onError)

    const click = (event: Event) => {
      // The globe's own click handler is on the canvas underneath. A press on a
      // logo opens that company; it must not also resolve to whatever pixel of
      // ground happens to be behind the tile.
      event.stopPropagation()
      const id = owner[i]
      if (id) onActivate(id)
    }
    // The overlay covers the canvas, so the canvas is sent a pointerleave the
    // moment the cursor arrives here and its own hover scan gives up. Handing
    // the hover back is what keeps the tooltip alive over the tile.
    const enter = () => {
      const id = owner[i]
      if (id) onHover(id)
    }
    const leave = () => onHover(null)

    el.addEventListener('click', click)
    el.addEventListener('pointerenter', enter)
    el.addEventListener('pointerleave', leave)
    cleanups.push(() => {
      img.removeEventListener('error', onError)
      el.removeEventListener('click', click)
      el.removeEventListener('pointerenter', enter)
      el.removeEventListener('pointerleave', leave)
    })

    el.append(img, letter)
    container.appendChild(el)
    nodes.push(el)
    imgs.push(img)
    letters.push(letter)
  }

  return {
    begin() {
      target.fill(0)
    },

    show(id, x, y, a) {
      let slot = slotOf.get(id)
      if (slot === undefined) {
        const next = free.pop()
        if (next === undefined) return -1
        slot = next
        owner[slot] = id
        slotOf.set(id, slot)
        alpha[slot] = 0
      }
      target[slot] = a
      nodes[slot].style.transform =
        `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      return slot
    },

    dress(slot, pin, px) {
      const el = nodes[slot]
      const img = imgs[slot]
      const letter = letters[slot]

      el.style.width = `${px}px`
      el.style.height = `${px}px`
      el.classList.toggle('world-logo-pin--plot', pin.kind === 'plot')
      el.classList.toggle('world-logo-pin--seed', pin.kind === 'seed')
      el.classList.toggle('is-promoted', pin.promoted)
      el.tabIndex = pin.kind === 'plot' ? TABBABLE.plot : TABBABLE.seed
      // The vocabulary the pills use, so the same pin is described the same way
      // whether it is read or seen: "Promoted" for paid placement, "unclaimed"
      // for an import nobody has staked on.
      el.setAttribute(
        'aria-label',
        pin.promoted
          ? `${pin.name} — Promoted`
          : pin.kind === 'seed'
            ? `${pin.name} — unclaimed`
            : pin.name,
      )
      letter.textContent = logoLetter(pin.name)
      letter.style.fontSize = `${Math.round(px * 0.42)}px`

      const url = safeImageUrl(pin.logo_url)
      if (url && url !== failed[slot]) {
        img.style.display = 'block'
        letter.style.display = 'none'
        if (img.getAttribute('src') !== url) img.setAttribute('src', url)
      } else {
        img.style.display = 'none'
        if (!url) img.removeAttribute('src')
        letter.style.display = 'flex'
      }
    },

    end(dt, snap) {
      const k = snap ? 1 : 1 - Math.exp(-FADE_RATE * dt)
      for (let i = 0; i < size; i += 1) {
        const t = target[i]
        let a = alpha[i]
        if (a !== t) {
          a = snap ? t : a + (t - a) * k
          if (Math.abs(t - a) < 0.004) a = t
          alpha[i] = a
        }

        const show = a > 0.01
        if (show !== (visible[i] === 1)) {
          visible[i] = show ? 1 : 0
          nodes[i].style.visibility = show ? 'visible' : 'hidden'
        }

        if (!show) {
          if (t === 0 && owner[i] !== null) {
            slotOf.delete(owner[i] as string)
            owner[i] = null
            free.push(i)
            written[i] = -1
          }
          continue
        }

        if (Math.abs(a - written[i]) > 0.004) {
          written[i] = a
          nodes[i].style.opacity = a.toFixed(3)
        }
      }
    },

    dispose() {
      for (const cleanup of cleanups) cleanup()
      for (const el of nodes) el.remove()
      nodes.length = 0
      slotOf.clear()
    },
  }
}

export interface LogoMarkersProps {
  /** The DRAWN pins — jittered, exactly as `PlotColumns` places its beads. */
  pins: readonly GlobePin[]
  enabled?: boolean
  /** A marker was pressed. The scene routes it like any other pin click. */
  onSelectPin?: (pin: GlobePin) => void
  /** Cursor entered/left a marker, so the tooltip can follow it onto the tile. */
  onHoverPin?: (pin: GlobePin | null) => void
  /**
   * Written every frame: pin id → half the marker's width in CSS pixels, for
   * every marker offered this frame.
   *
   * `PlotLabels` reads it to push its pill clear of the tile instead of
   * colliding with it. A ref rather than state because it is rewritten sixty
   * times a second, and the two layers are ordered — `LogoMarkers` is mounted
   * ahead of `PlotLabels`, so within one frame this is written before it is
   * read.
   */
  claimed?: React.RefObject<Map<string, number> | null>
}

export function LogoMarkers({
  pins,
  enabled = true,
  onSelectPin,
  onHoverPin,
  claimed,
}: LogoMarkersProps) {
  const surface = useLabelSurface()

  /**
   * Directions, sizes and the priority ORDER — rebuilt only when the pins
   * change, never on pan and never per frame. That is the whole of the
   * "stable tiebreak" promise: the order is not a function of the camera.
   */
  const data = useMemo(() => {
    const count = pins.length
    const dirs = new Float32Array(count * 3)
    const size = new Float32Array(count)
    const isPaid = new Uint8Array(count)
    const priority = new Float64Array(count)

    for (let i = 0; i < count; i += 1) {
      const pin = pins[i]
      // Inlined rather than via latLngToVector3: this is the only maths in the
      // module and importing three for it would put the whole engine in a
      // chunk that otherwise needs none of it.
      const phi = ((90 - pin.lat) * Math.PI) / 180
      const theta = ((pin.lng + 180) * Math.PI) / 180
      const s = Math.sin(phi)
      dirs[i * 3] = -s * Math.cos(theta)
      dirs[i * 3 + 1] = Math.cos(phi)
      dirs[i * 3 + 2] = s * Math.sin(theta)

      size[i] = logoSizeFor(pin)
      isPaid[i] = pin.kind === 'plot' ? 1 : 0
      priority[i] = logoPriority(pin)
    }

    const scratch: number[] = []
    for (let i = 0; i < count; i += 1) scratch.push(i)
    scratch.sort((a, b) => {
      const d = priority[b] - priority[a]
      if (d !== 0) return d
      // The stable tiebreak. Ids are unique and never change, so two companies
      // of equal rank keep the same relative order for the life of the feed.
      return pins[a].id < pins[b].id ? -1 : pins[a].id > pins[b].id ? 1 : 0
    })
    const order = new Uint32Array(scratch)

    let paidCount = 0
    for (let i = 0; i < count; i += 1) if (isPaid[i] === 1) paidCount += 1

    return {
      count,
      dirs,
      size,
      isPaid,
      order,
      // Paid sorts above every seed, so the leading `paidCount` entries of
      // `order` are exactly the paid plots, best-funded first.
      alwaysCount: Math.min(paidCount, ALWAYS_VISIBLE_PAID),
    }
  }, [pins])

  /** id → pin, so a slot can resolve its owner at click time. */
  const byId = useMemo(() => {
    const m = new Map<string, GlobePin>()
    for (const pin of pins) m.set(pin.id, pin)
    return m
  }, [pins])
  /*
   * The pool's click and hover listeners are bound once per SLOT, in a layout
   * effect, and outlive every render — so what they need is a mirror of the
   * latest props rather than a closure over one render's. Written in an effect
   * with no dependency array (the same idiom `useLabelLayer` uses): a ref
   * assigned during render is a render side effect, and this file has enough
   * imperative surface without adding one.
   */
  const byIdRef = useRef(byId)
  const selectRef = useRef(onSelectPin)
  const hoverRef = useRef(onHoverPin)

  useEffect(() => {
    byIdRef.current = byId
    selectRef.current = onSelectPin
    hoverRef.current = onHoverPin
  })

  const poolRef = useRef<LogoPool | null>(null)

  /**
   * Which company each slot is currently dressed as, so the DOM is written on
   * change rather than per frame. Keyed by id and reset whenever the feed moves:
   * an index means a different company after a refetch, and a slot that trusted
   * its index would keep showing the previous tenant's logo.
   */
  const slotDressed = useMemo<Array<string | null>>(
    () => new Array(MAX_LOGO_MARKERS).fill(null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data],
  )

  useLayoutEffect(() => {
    if (!surface) return undefined

    const container = surface.ownerDocument.createElement('div')
    container.className = 'world-logo-pins'
    // First child, so the text pills paint above the tiles. They rarely meet —
    // the collision layout resolves them against each other — but when a pill
    // and a tile do share a pixel, the words win.
    surface.insertBefore(container, surface.firstChild)

    const pool = createLogoPool(
      container,
      MAX_LOGO_MARKERS,
      (id) => {
        const pin = byIdRef.current.get(id)
        if (pin) selectRef.current?.(pin)
      },
      (id) => {
        hoverRef.current?.(id === null ? null : (byIdRef.current.get(id) ?? null))
      },
    )
    poolRef.current = pool
    // A fresh pool has empty slots; anything the previous one was dressed as is
    // now a lie that would keep a tile blank.
    slotDressed.fill(null)

    return () => {
      poolRef.current = null
      pool.dispose()
      container.remove()
    }
  }, [surface, slotDressed])

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

  // A marker that is no longer offered must not leave a stale entry behind, or
  // a plot pill would keep stepping around a tile that is not there.
  useLayoutEffect(
    () => () => {
      claimed?.current?.clear()
    },
    [claimed],
  )

  useLabelLayer({
    collect(out, frame) {
      const s = scratch
      s.boxes.reset()
      s.idx.length = 0
      s.alpha.length = 0
      s.x.length = 0
      s.y.length = 0
      const claims = claimed?.current
      claims?.clear()

      if (!enabled || data.count === 0 || !poolRef.current) return

      const { camX, camY, camZ, horizon, horizonTop, width, height, distance } =
        frame
      const invBand = 1 / Math.max(horizonTop - horizon, 1e-4)

      // One continuous zoom number per layer, rather than a tier switch: paid
      // tiles resolve as the camera leaves orbit, seed tiles a good deal later,
      // and each fades over the same 0.35 radii instead of appearing.
      const paidGate = clamp01((PAID_DISTANCE + GATE_FADE - distance) / GATE_FADE)
      const seedGate = clamp01((SEED_DISTANCE + GATE_FADE - distance) / GATE_FADE)
      if (paidGate <= 0 && data.alwaysCount === 0) return

      let taken = 0
      let seedsTaken = 0
      for (let k = 0; k < data.count && taken < MAX_LOGO_MARKERS; k += 1) {
        const i = data.order[k]
        const paid = data.isPaid[i] === 1

        // Paid sorts above every seed, so once the imported sub-cap is full
        // there is nothing but more imports below it.
        if (!paid && seedsTaken >= MAX_SEED_LOGOS) break

        // The top-ranked paid plots are exempt from the distance gate entirely;
        // that exemption is what they bought.
        const gate = k < data.alwaysCount ? 1 : paid ? paidGate : seedGate
        if (gate <= 0.01) {
          // The order is paid-then-seed, so once paid is gated out there is
          // nothing left below it either.
          if (paid) break
          continue
        }

        const o = i * 3
        const dx = data.dirs[o]
        const dy = data.dirs[o + 1]
        const dz = data.dirs[o + 2]

        const facing = dx * camX + dy * camY + dz * camZ
        if (facing <= horizon) continue

        const t = facing >= horizonTop ? 1 : (facing - horizon) * invBand
        const alpha = t * t * (3 - 2 * t) * gate
        if (alpha < 0.02) continue

        if (!frame.project(dx, dy, dz, MARKER_RADIUS)) continue
        const px = frame.px
        const py = frame.py
        const box = data.size[i]
        const half = box / 2
        if (
          px < -half ||
          px > width + half ||
          py < -half ||
          py > height + half
        ) {
          continue
        }

        const pin = pins[i]
        out.push(
          s.boxes.take(
            `l${pin.id}`,
            px - half,
            py - half,
            box,
            box,
            /*
             * Above every text layer except a promoted pin's own "Promoted"
             * disclosure, which sits at 1e12 in `PlotLabels` and must never
             * lose: paid placement is always labelled as paid placement.
             *
             * The tiebreak inside a class is RANK, not size. Two plots in the
             * same city are the same 42px box, and while they tied the greedy
             * pass resolved them by whatever order the box list happened to be
             * in — so on a globe where the best-funded plot and its neighbour
             * were 2.6 km apart, the winner alternated frame to frame and the
             * plot that had paid the most flickered. `k` is the index into an
             * order already sorted by `logoPriority`, so subtracting it makes
             * the winner deterministic AND makes it the one that paid for it.
             */
            (paid ? 1e10 : 1e5) + (data.count - k),
          ),
        )
        claims?.set(pin.id, half)
        s.idx.push(i)
        s.alpha.push(alpha)
        s.x.push(px - half)
        s.y.push(py - half)
        taken += 1
        if (!paid) seedsTaken += 1
      }
    },

    commit(placed, frame) {
      const pool = poolRef.current
      if (!pool) return

      pool.begin()

      const s = scratch
      for (let k = 0; k < s.idx.length; k += 1) {
        const i = s.idx[k]
        const pin = pins[i]
        if (!placed.has(`l${pin.id}`)) continue

        const slot = pool.show(pin.id, s.x[k], s.y[k], s.alpha[k])
        if (slot < 0) continue

        if (slotDressed[slot] !== pin.id) {
          slotDressed[slot] = pin.id
          pool.dress(slot, pin, data.size[i])
        }
      }

      pool.end(frame.dt, frame.reducedMotion)
    },
  })

  return null
}
