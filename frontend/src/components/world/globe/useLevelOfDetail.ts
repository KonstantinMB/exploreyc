/* eslint-disable react-hooks/immutability -- three.js/DOM resources are
   GPU-adjacent objects written imperatively per frame; there is no pure-React
   formulation of that. Same deliberate call as the donor codebase. */
/*
 * Everything held here is a long-lived imperative resource — three.js matrices,
 * DOM nodes, typed arrays of opacity — written to sixty times a second from
 * inside a frame callback. There is no pure-React formulation of "move a
 * hundred and twenty divs this frame", and attempting one is precisely the
 * mistake this module exists to avoid.
 */

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactElement,
  type ReactNode,
} from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  LIMB_BAND,
  LIMB_INSET,
  MAX_LABELS,
  STICKY_PRIORITY_BONUS,
  horizonDot,
  layoutLabels,
  populationFloor,
  tierForDistance,
  type LabelBox,
  type LodTier,
} from './labelLayout'

/**
 * The machinery under the three label layers.
 *
 * One frame callback runs the whole system. Each layer offers candidates, a
 * single greedy pass resolves collisions across all of them at once, and each
 * layer is then told which of its candidates survived. Doing the layout once
 * globally rather than once per layer is not tidiness — it is the only way the
 * 120-label cap and the no-overlap rule can be true *between* a city name and a
 * country name, which is exactly where labels collide in practice.
 *
 * Nothing in here calls `setState`. React renders the label DOM once, as an
 * empty pool of divs, and from then on the frame loop writes
 * `style.transform`, `style.opacity` and `textContent` directly.
 */

// ---------------------------------------------------------------------------
// Public shape
// ---------------------------------------------------------------------------

/** Which of the three type roles a string is measured and rendered in. */
export type LabelFontRole = 'name' | 'title' | 'meta'

export interface LabelFrame {
  /** Camera distance from the globe centre, in globe radii. */
  distance: number
  tier: LodTier
  popFloor: number
  /** `log10(popFloor + 1)`, precomputed — every hot loop wants it. */
  logPopFloor: number
  /** Facing value at which a label starts to appear round the limb. */
  horizon: number
  /** …and at which it is fully opaque. */
  horizonTop: number
  /** Viewport, in CSS pixels. */
  width: number
  height: number
  /** Seconds since the previous frame, already clamped. */
  dt: number
  /** True when the visitor asked for less motion; fades snap instead of easing. */
  reducedMotion: boolean
  /** Unit vector from the globe centre toward the camera. */
  camX: number
  camY: number
  camZ: number
  /** Written by `project`. CSS pixels from the top-left of the canvas. */
  px: number
  py: number
  /**
   * Project a point at `radius` along the unit direction (dx, dy, dz).
   * Returns false when the point is behind the camera; `px`/`py` are then
   * meaningless and must not be read.
   */
  project(dx: number, dy: number, dz: number, radius: number): boolean
  /** Width in CSS pixels of `text`, set in `role`. Cached, never lays out. */
  measure(text: string, role: LabelFontRole): number
}

export interface LabelLayer {
  /** Push this layer's candidates. Called once per frame, before layout. */
  collect(out: LabelBox[], frame: LabelFrame): void
  /** Told which ids won. Called once per frame, after layout. */
  commit(placed: ReadonlySet<string>, frame: LabelFrame): void
}

export interface LodSample {
  distance: number
  tier: LodTier
  popFloor: number
  candidates: number
  placed: number
  collided: number
  capped: number
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface LabelSurfaceApi {
  /** The shared absolutely-positioned overlay every label element lives in. */
  surface: HTMLDivElement | null
  register(holder: { current: LabelLayer | null }): () => void
}

const LabelSurfaceContext = createContext<LabelSurfaceApi | null>(null)

/**
 * Register a label layer.
 *
 * `layer` may be a fresh object every render — it is read through a ref, so a
 * layer whose closure captures thousands of cities does not re-subscribe on
 * every parent render.
 */
export function useLabelLayer(layer: LabelLayer | null): void {
  const api = useContext(LabelSurfaceContext)
  const holder = useRef<LabelLayer | null>(null)

  // Deliberately no dependency array: this is a mirror of the latest render,
  // not a subscription.
  useEffect(() => {
    holder.current = layer
  })

  useEffect(() => {
    if (!api) return undefined
    return api.register(holder)
  }, [api])
}

/** The overlay element, for layers that need to build their DOM pool. */
export function useLabelSurface(): HTMLDivElement | null {
  return useContext(LabelSurfaceContext)?.surface ?? null
}

// ---------------------------------------------------------------------------
// Type measurement
// ---------------------------------------------------------------------------

/**
 * THE PLATFORM'S FACE. Not a stack of this feature's own.
 *
 * This used to be `ui-rounded, "SF Pro Rounded", …` — the retired World design
 * system's rounded sans, kept alive here long after `world.css` dropped it. It
 * was the single loudest "this is a different app" signal on the page: on macOS
 * `ui-rounded` resolves to SF Pro Rounded, so the *largest text on the stage* —
 * every country and city name across the globe — rendered in a soft rounded
 * sans while the navbar directly above it, the hero beside it, and every other
 * ExploreYC route were monospace.
 *
 * It is now `body`'s own stack from src/index.css, byte for byte. One face on
 * the page.
 *
 * The string is shared between the injected stylesheet and the canvas probe on
 * purpose: measuring one family and rendering another is the single easiest
 * way to end up with labels that overlap despite a collision test that works.
 */
const LABEL_FONT =
  "'IBM Plex Mono', 'JetBrains Mono', ui-monospace, monospace"

/**
 * Kept in step with the stylesheet below, by hand.
 *
 * On the platform's type scale — 12px for a name, 11px for meta — rather than
 * the 12/13/11 grab-bag this carried. `title` is the country pill's own role
 * and is the same SIZE as a city name now, distinguished by weight: monospace
 * is wider than the sans this replaced, and a 13px country pill priced several
 * neighbours off the map for a difference nobody could see.
 */
const FONT_SPEC: Record<
  LabelFontRole,
  { weight: string; size: number; family: string }
> = {
  name: { weight: '600', size: 12, family: LABEL_FONT },
  title: { weight: '700', size: 12, family: LABEL_FONT },
  meta: { weight: '600', size: 11, family: LABEL_FONT },
}

/**
 * Text width without touching layout.
 *
 * A canvas 2D context measures the same glyphs the browser will draw, provided
 * it is handed the same resolved family — which is why the family is read off
 * a probe element rather than trusted as written: the webfont may not be
 * loaded, and the fallback that actually renders is what must be measured.
 *
 * The alternative — read `offsetWidth` after writing the text — forces a
 * synchronous layout of the whole document, per label, per frame.
 */
function createMeasurer(host: HTMLElement) {
  const cache = new Map<string, number>()
  const canvas =
    typeof document === 'undefined' ? null : document.createElement('canvas')
  const ctx = canvas?.getContext('2d') ?? null

  // Replaced by `resolve()` with the family the browser actually picked; these
  // are only what gets measured in the frames before that runs.
  const fonts: Record<LabelFontRole, string> = {
    name: `600 12px ${LABEL_FONT}`,
    title: `700 12px ${LABEL_FONT}`,
    meta: `600 11px ${LABEL_FONT}`,
  }

  function resolve() {
    if (typeof document === 'undefined' || !host.isConnected) return
    for (const role of Object.keys(FONT_SPEC) as LabelFontRole[]) {
      const spec = FONT_SPEC[role]
      const probe = document.createElement('span')
      probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;font-family:${spec.family};`
      host.appendChild(probe)
      const family = getComputedStyle(probe).fontFamily
      probe.remove()
      if (family) fonts[role] = `${spec.weight} ${spec.size}px ${family}`
    }
    cache.clear()
  }

  function measure(text: string, role: LabelFontRole): number {
    if (!text) return 0
    const key = `${role} ${text}`
    const hit = cache.get(key)
    if (hit !== undefined) return hit
    let w: number
    if (ctx) {
      ctx.font = fonts[role]
      w = ctx.measureText(text).width
    } else {
      // Never reached in a browser. A crude estimate beats a crash.
      w = text.length * FONT_SPEC[role].size * 0.62
    }
    cache.set(key, w)
    return w
  }

  return { measure, resolve, clear: () => cache.clear() }
}

// ---------------------------------------------------------------------------
// Candidate pooling
// ---------------------------------------------------------------------------

export interface BoxPool {
  reset(): void
  take(
    id: string,
    x: number,
    y: number,
    w: number,
    h: number,
    priority: number,
  ): LabelBox
}

/**
 * Reusable `LabelBox` objects.
 *
 * Four hundred candidates a frame is 24,000 short-lived objects a second. V8
 * copes, but it copes by collecting — and a young-generation pause lands
 * exactly where it is least welcome, in the middle of a flick of the wheel.
 */
export function createBoxPool(): BoxPool {
  const pool: LabelBox[] = []
  let n = 0
  return {
    reset() {
      n = 0
    },
    take(id, x, y, w, h, priority) {
      let box = pool[n]
      if (box === undefined) {
        box = { id: '', x: 0, y: 0, w: 0, h: 0, priority: 0 }
        pool[n] = box
      }
      n += 1
      box.id = id
      box.x = x
      box.y = y
      box.w = w
      box.h = h
      box.priority = priority
      return box
    },
  }
}

// ---------------------------------------------------------------------------
// The DOM pool
// ---------------------------------------------------------------------------

export type LabelVariant = 'city' | 'country' | 'plot'

/**
 * Pill heights, in CSS pixels. Mirrored in the injected stylesheet.
 *
 * The country pill is a *button* — pressable, keyboard-reachable, and the one
 * label a visitor is meant to aim at — so it is the tallest of the three and
 * comfortably past the 24px that stops a target being a game of skill on a
 * trackpad. City and plot pills are captions and stay quieter.
 */
export const LABEL_HEIGHT: Record<LabelVariant, number> = {
  city: 20,
  country: 26,
  plot: 22,
}

/** Horizontal gap between a marker on the surface and the pill beside it. */
export const LABEL_LEADER = 9

/** Padding inside a pill, per side. */
export const LABEL_PAD_X = 8
/**
 * …and inside a country pill, which is wider because it is a button.
 *
 * Exported rather than written twice: `CountryLabels` adds it into the width it
 * offers the layout, and the layout is what guarantees a pill never runs off
 * the edge of the frame. A padding that lived only in the stylesheet would make
 * every country pill wider than the rectangle collision resolved for it.
 */
export const LABEL_PAD_COUNTRY = 11
/**
 * The pill's hairline border, per side.
 *
 * A real border rather than the `box-shadow: 0 0 0 1px` this used to fake one
 * with, because the pressable pill needs its border to turn orange
 * independently of the hard edge and the elevation, and one element has one
 * box-shadow stack. The cost is that a border on an auto-width element makes it
 * 2px wider than its content — height is unaffected, `box-sizing` is
 * border-box — so every width the layout is offered has to include it. Small
 * enough to shrug at, exactly the kind of small that turns into a clipped label
 * at a frame edge six months later.
 */
export const LABEL_BORDER = 1
/** Gap between the pill's own children. */
export const LABEL_GAP = 5
/** Width of the coloured swatch some pills carry. */
export const LABEL_SWATCH = 9
/**
 * Width of the chevron on a pressable country pill, gap included.
 *
 * The glyph is drawn in CSS (a rotated corner) rather than typed, so it has no
 * measurable text width — this constant is the whole story the layout gets, and
 * it must match `.world-lod__chevron` below.
 */
export const LABEL_CHEVRON = 9 + LABEL_GAP
/**
 * Extra width the "Promoted" chip's own padding adds to its measured text.
 *
 * The paid-placement label is a filled chip, not plain meta text — that is what
 * makes it survive any terrain it lands on — and its padding is part of the
 * pill's width whether the layout knows about it or not. Better that it knows.
 */
export const LABEL_CHIP_PAD = 12

const CSS_ID = 'world-lod-label-styles'

/*
 * Contrast, deliberately solved by the substrate rather than by the ink.
 *
 * The map underneath a label is pale blue in one place, near-white land in
 * another, and a saturated claim fill in a third — there is no single text
 * colour that clears 4.5:1 against all of them. A solid pill removes the
 * question, and the pill's own pairs are now the PLATFORM's, mirroring the
 * `--card` / `--foreground` / `--muted-foreground` / `--border` values
 * src/index.css declares for `:root` and `.dark`:
 *
 *   light: ink #0A0A0A on card #FFFFFF = 19.83:1,  muted #737373 = 4.74:1
 *   dark:  ink #FAFAFA on card #0A0A0A = 18.94:1,  muted #A3A3A3 = 7.34:1
 *   Promoted chip: #FFFFFF on #C2410C = 5.18:1 (light) / on #9A3412 = 7.31:1
 *
 * All clear WCAG AA (most AAA) everywhere, at every zoom, over every country.
 *
 * They used to be the retired World system's slate-blue set (#17212F ink on a
 * #1E2631 card) — legible, and a second palette. A blue-grey pill floating over
 * a page whose every other card is neutral is the same "two products on one
 * screen" problem the rounded sans was.
 *
 * WHY THE VALUES ARE COPIED RATHER THAN INHERITED. These pills are appended
 * next to the canvas and are driven by the globe's own `darkMode` prop, which
 * is the same boolean the terrain palette reads. Inheriting the HSL custom
 * properties from an ancestor `.world-root` would instead couple them to the
 * `dark` class on <html>, so a globe rendered with `darkMode` set one way
 * inside a page themed the other would produce dark pills on a light map.
 * Local `--lod-*` tokens, seeded from the platform's own values, keep pills and
 * terrain incapable of disagreeing. Keep them in step with index.css by hand.
 *
 * No backticks anywhere in this stylesheet — it lives inside a template
 * literal and a backtick closes it.
 */
const LABEL_CSS = `
.world-lod-surface {
  --lod-card: #ffffff;
  /* A white pill cannot brighten, so the light theme's hover warms instead:
     the accent at a few percent over white, the same wash the platform's rows
     use. ink #0A0A0A on it is 18.9:1, muted #737373 is 4.58:1 — both still
     clear AA. */
  --lod-card-hi: #fff8f4;
  --lod-ink: #0a0a0a;
  --lod-muted: #737373;
  --lod-border: #e5e5e5;
  --lod-accent: #fb651e;
  --lod-accent-text: #c2410c;
  --lod-press: #c2410c;
  --lod-press-ink: #ffffff;
  --lod-shadow: 0 1px 2px rgba(0, 0, 0, 0.10), 0 4px 12px rgba(0, 0, 0, 0.12);
  --lod-shadow-hi: 0 2px 4px rgba(0, 0, 0, 0.14), 0 10px 22px rgba(0, 0, 0, 0.18);
}
.world-lod-surface.world-lod-dark {
  --lod-card: #0a0a0a;
  /* --muted / --secondary in the dark theme. ink 14.5:1, muted 5.99:1. */
  --lod-card-hi: #262626;
  --lod-ink: #fafafa;
  --lod-muted: #a3a3a3;
  --lod-border: #262626;
  --lod-accent-text: #fb651e;
  --lod-press: #9a3412;
  --lod-shadow: 0 1px 2px rgba(0, 0, 0, 0.45), 0 4px 12px rgba(0, 0, 0, 0.35);
  --lod-shadow-hi: 0 2px 4px rgba(0, 0, 0, 0.5), 0 10px 22px rgba(0, 0, 0, 0.45);
}
.world-lod {
  position: absolute;
  left: 0;
  top: 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: ${LABEL_GAP}px;
  height: ${LABEL_HEIGHT.city}px;
  padding: 0 ${LABEL_PAD_X}px;
  /* rounded-sm — calc(var(--radius) - 4px), the same 4px every card, button
     and chip on the platform wears. It used to be 10px here and 9999px on the
     country pill, i.e. a chip radius and a full pill that exist nowhere else in
     ExploreYC. Which labels are buttons is said by the chevron, the hard edge
     and the hover state, none of which needed a bespoke shape to carry them. */
  border-radius: 4px;
  background: var(--lod-card);
  border: 1px solid var(--lod-border);
  box-shadow: var(--lod-shadow);
  color: var(--lod-ink);
  font-family: ${LABEL_FONT};
  font-weight: 600;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transform: translate3d(-9999px, -9999px, 0);
  transform-origin: 0 50%;
  contain: layout style paint;
}
.world-lod--plot {
  height: ${LABEL_HEIGHT.plot}px;
}
.world-lod--country {
  height: ${LABEL_HEIGHT.country}px;
  padding: 0 ${LABEL_PAD_COUNTRY}px;
  font-weight: 700;
}
/*
  Country pills are the one label layer you can press.

  The surface itself is pointer-events:none so the globe stays draggable
  everywhere, and this opts a single layer back in. City pills stay inert
  deliberately: they are dense, they overlap, and turning them into targets
  would put a hundred small click-eaters over a sphere whose main interaction
  is a drag. They also keep the flat shadow and carry no chevron, so a passive
  caption never wears a button's clothes.

  THE HARD PRESS EDGE IS GONE. This used to layer a "0 3px 0" offset shadow
  under the pill and collapse it on :active — the retired World design system's
  physical-button idiom, the exact thing ui.tsx's own header says was removed
  from every other control ("full-pill buttons with a 4px press edge … All of it
  is gone"). It survived here because these pills are injected CSS rather than
  Tailwind. The affordance is now the platform's, and identical to
  WorldRowButton's: a hairline border that turns orange, the ground washing
  toward the accent, and the chevron nudging right.
*/
.world-lod--country.is-pressable {
  pointer-events: auto;
  cursor: pointer;
  transition: box-shadow 90ms ease-out, background-color 90ms ease-out,
    border-color 90ms ease-out;
}
/*
  NO TRANSFORM ON THIS ELEMENT. Not translate, not scale.

  The frame loop writes a translate3d transform on this exact element sixty
  times a second to position it against the sphere, and anything declared here
  is overwritten on the next frame. Any motion in a state below therefore has to
  live on a DESCENDANT — which is why the hover nudge is on the chevron.
*/
.world-lod--country.is-pressable:hover {
  background: var(--lod-card-hi);
  border-color: var(--lod-accent);
  box-shadow: var(--lod-shadow-hi);
}
.world-lod--country.is-pressable:focus-visible {
  outline: none;
  border-color: var(--lod-accent);
  background: var(--lod-card-hi);
  /* Same layered ring as .world-focus in world.css: card halo, accent ring,
     then a hairline of --lod-accent-text so the indicator clears 3:1 against
     pale land as well as against the pill. */
  box-shadow: 0 0 0 2px var(--lod-card), 0 0 0 5px var(--lod-accent),
    0 0 0 6px var(--lod-accent-text), var(--lod-shadow-hi);
}
.world-lod--country.is-pressable:active {
  background: var(--lod-card);
  box-shadow: var(--lod-shadow);
}
.world-lod__name,
.world-lod__meta,
.world-lod__chevron {
  display: inline-flex;
  align-items: center;
  transition: transform 60ms ease-out, color 90ms ease-out;
}
.world-lod__meta {
  font-family: ${LABEL_FONT};
  font-weight: 600;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--lod-muted);
}
/*
  Paid placement, always labelled as paid placement.

  A filled chip rather than muted text, because this one is a disclosure: it has
  to stay legible over orange claim fills, over water, and at every zoom, and
  muted grey on white does not survive being drawn over a promoted pin's own
  beacon. White on --lod-press measures 5.18:1 in light and 7.31:1 in dark.
*/
.world-lod__meta--promoted {
  padding: 2px 6px;
  border-radius: 2px;
  background: var(--lod-press);
  color: var(--lod-press-ink);
  font-weight: 700;
  letter-spacing: 0.01em;
}
/*
  The affordance glyph: this pill navigates somewhere.

  Drawn with a rotated corner rather than typed as a character, so it is the
  same weight and size in every font stack and its width is a constant the
  layout can be told about (LABEL_CHEVRON).
*/
.world-lod__chevron {
  position: relative;
  flex: none;
  width: 9px;
  height: ${LABEL_HEIGHT.country}px;
  color: var(--lod-muted);
  display: none;
}
.world-lod--country.is-pressable .world-lod__chevron {
  display: inline-flex;
}
.world-lod__chevron::before {
  content: "";
  position: absolute;
  left: 1px;
  top: 50%;
  width: 5px;
  height: 5px;
  margin-top: -3px;
  border-top: 2px solid currentColor;
  border-right: 2px solid currentColor;
  border-top-right-radius: 1px;
  transform: rotate(45deg);
}
.world-lod--country.is-pressable:hover .world-lod__chevron,
.world-lod--country.is-pressable:focus-visible .world-lod__chevron {
  color: var(--lod-accent-text);
  transform: translateX(2px);
}
/*
  A pressed pill is always also a hovered pill, and these two rules have equal
  specificity — so this one has to come last or the press would not read at all.
  The chevron travels a little further in, then springs back on release.
*/
.world-lod--country.is-pressable:active .world-lod__chevron {
  transform: translateX(4px);
}
.world-lod--country.is-pressable:hover .world-lod__meta,
.world-lod--country.is-pressable:focus-visible .world-lod__meta {
  color: var(--lod-ink);
}
.world-lod__swatch {
  width: ${LABEL_SWATCH}px;
  height: ${LABEL_SWATCH}px;
  flex: none;
  border-radius: 999px;
  box-shadow: inset 0 0 0 1.5px var(--lod-card);
}
/*
  Reduced motion: every state above still arrives, it just stops moving. The
  chevron keeps its colour change, hover keeps its border and its ground, and
  the content stops sliding — nothing that carries information is
  animation-only.
*/
@media (prefers-reduced-motion: reduce) {
  .world-lod--country.is-pressable,
  .world-lod__name,
  .world-lod__meta,
  .world-lod__chevron {
    transition-duration: 1ms;
  }
  .world-lod--country.is-pressable:active .world-lod__chevron {
    transform: none;
  }
  .world-lod--country.is-pressable:hover .world-lod__chevron,
  .world-lod--country.is-pressable:focus-visible .world-lod__chevron {
    transform: none;
  }
}
/*
  Forced colours drops box-shadow entirely, which is where all of this pill's
  chrome lives — so the focus ring falls back to a real outline and the
  pressable pill states a border.
*/
@media (forced-colors: active) {
  .world-lod {
    border: 1px solid ButtonBorder;
  }
  .world-lod--country.is-pressable {
    border: 2px solid ButtonBorder;
  }
  .world-lod--country.is-pressable:focus-visible {
    outline: 3px solid Highlight;
    outline-offset: 2px;
  }
}
`

export interface LabelPool {
  /** Element per slot. Layers write text into its children. */
  readonly nodes: readonly HTMLDivElement[]
  readonly names: readonly HTMLSpanElement[]
  readonly metas: readonly HTMLSpanElement[]
  readonly swatches: readonly HTMLSpanElement[]
  /** Start a frame: every slot's target opacity drops to zero. */
  begin(): void
  /**
   * Claim (or keep) the slot for `id` and place it. Returns the slot index, or
   * -1 when the pool is exhausted.
   */
  show(id: string, x: number, y: number, alpha: number): number
  /** Ease every slot toward its target and write the result to the DOM. */
  end(dt: number, snap: boolean): void
  /**
   * Make every slot pressable, reporting the id the slot currently holds.
   *
   * The handler is bound ONCE PER SLOT, not once per label. Slots are recycled
   * between countries as the camera moves, so binding per label would mean
   * rebinding listeners on every frame where the visible set changed. The slot
   * resolves its own current owner at click time instead.
   *
   * Passing null makes the layer inert again and removes the listeners.
   */
  setActivate(handler: ((id: string) => void) | null): void
  /**
   * Report which label the cursor is over, by the same slot-resolves-its-owner
   * trick `setActivate` uses.
   *
   * Why a pill needs this at all: the pill sits ON TOP of the canvas, so while
   * the cursor is over it the globe's own raycast picker has been sent a
   * pointerleave and believes nothing is hovered. Without this, moving onto a
   * country's label would put the country's highlight OUT — the exact moment a
   * visitor is deciding whether to click it. Handing the hover back up keeps
   * the pill and the territory lit together.
   */
  setHover(handler: ((id: string | null) => void) | null): void
  dispose(): void
}

/** Opacity easing rate. `1 - e^(-14 dt)` is ~150ms to settle at 60fps. */
const FADE_RATE = 14

export function createLabelPool(
  surface: HTMLElement,
  size: number,
  variant: LabelVariant,
): LabelPool {
  const doc = surface.ownerDocument
  if (!doc.getElementById(CSS_ID)) {
    const style = doc.createElement('style')
    style.id = CSS_ID
    style.textContent = LABEL_CSS
    doc.head.appendChild(style)
  }

  const nodes: HTMLDivElement[] = []
  const names: HTMLSpanElement[] = []
  const metas: HTMLSpanElement[] = []
  const swatches: HTMLSpanElement[] = []

  for (let i = 0; i < size; i += 1) {
    const el = doc.createElement('div')
    el.className = `world-lod world-lod--${variant}`
    /*
     * Inert until proven otherwise.
     *
     * The surface used to carry a blanket aria-hidden, which silenced a hundred
     * and twenty duplicated place names — correct — but also silenced the
     * country pills, which are real buttons with real tabindex. Focusable
     * content inside an aria-hidden subtree is a control a keyboard user can
     * reach and a screen reader will not name. Hiding each pill individually
     * keeps the silence and lets `setActivate` lift it for the one layer that
     * is actually operable.
     */
    el.setAttribute('aria-hidden', 'true')

    const swatch = doc.createElement('span')
    swatch.className = 'world-lod__swatch'
    swatch.style.display = 'none'

    const name = doc.createElement('span')
    name.className = 'world-lod__name'

    const meta = doc.createElement('span')
    meta.className = 'world-lod__meta'
    meta.style.display = 'none'

    // Hidden by CSS unless the pill is pressable. Present in every slot so
    // becoming pressable is a class change, not a DOM build.
    const chevron = doc.createElement('span')
    chevron.className = 'world-lod__chevron'

    el.append(swatch, name, meta, chevron)
    surface.appendChild(el)

    nodes.push(el)
    names.push(name)
    metas.push(meta)
    swatches.push(swatch)
  }

  const alpha = new Float32Array(size)
  const target = new Float32Array(size)
  const written = new Float32Array(size).fill(-1)
  const visible = new Uint8Array(size)
  const owner: (string | null)[] = new Array(size).fill(null)
  const slotOf = new Map<string, number>()

  /** One listener set per SLOT, held so they can be removed again. */
  const listeners: (((event: Event) => void) | null)[] = new Array(size).fill(
    null,
  )
  const keyHandlers: (((event: KeyboardEvent) => void) | null)[] = new Array(
    size,
  ).fill(null)
  const enterHandlers: (((event: Event) => void) | null)[] = new Array(
    size,
  ).fill(null)
  const leaveHandlers: (((event: Event) => void) | null)[] = new Array(
    size,
  ).fill(null)

  // Slots are handed out from the back so that a label keeps the same DOM node
  // between frames; a shuffling assignment would make every fade animate the
  // wrong element.
  const free: number[] = []
  for (let i = size - 1; i >= 0; i -= 1) free.push(i)

  return {
    nodes,
    names,
    metas,
    swatches,

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
        // A brand new slot starts invisible so it fades in rather than
        // teleporting into place at full strength.
        alpha[slot] = 0
      }
      target[slot] = a
      nodes[slot].style.transform =
        `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      return slot
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
          // Fully faded and not wanted: hand the slot back so a newly
          // interesting label can take it.
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

    setActivate(handler) {
      // Rebind from scratch: called rarely (a prop changing), and the
      // alternative is tracking which slots already carry a listener.
      for (const [i, el] of nodes.entries()) {
        const existing = listeners[i]
        if (existing) {
          el.removeEventListener('click', existing)
          el.removeEventListener('keydown', keyHandlers[i]!)
          listeners[i] = null
          keyHandlers[i] = null
        }

        if (!handler) {
          el.classList.remove('is-pressable')
          el.removeAttribute('role')
          el.removeAttribute('tabindex')
          el.setAttribute('aria-hidden', 'true')
          continue
        }

        const onClick = (event: Event) => {
          // The globe's own click handler lives on the canvas underneath. A
          // press on a label must open that country, not also drop a pin at
          // whichever pixel of ocean happens to be behind the pill.
          event.stopPropagation()
          const id = owner[i]
          if (id) handler(id)
        }
        const onKey = (event: KeyboardEvent) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          event.stopPropagation()
          const id = owner[i]
          if (id) handler(id)
        }

        el.addEventListener('click', onClick)
        el.addEventListener('keydown', onKey)
        listeners[i] = onClick
        keyHandlers[i] = onKey

        el.classList.add('is-pressable')
        // A div that responds to a click is a button as far as assistive tech
        // is concerned, and has to say so, be reachable, and — unlike the
        // decorative pills around it — be announced. Its text content (country
        // name plus "3 pins" / "unclaimed") is the accessible name; the chevron
        // is CSS and contributes nothing to read out.
        el.setAttribute('role', 'button')
        el.setAttribute('tabindex', '0')
        el.removeAttribute('aria-hidden')
      }
    },

    setHover(handler) {
      for (const [i, el] of nodes.entries()) {
        const enter = enterHandlers[i]
        if (enter) {
          el.removeEventListener('pointerenter', enter)
          el.removeEventListener('pointerleave', leaveHandlers[i]!)
          enterHandlers[i] = null
          leaveHandlers[i] = null
        }

        if (!handler) continue

        const onEnter = () => {
          const id = owner[i]
          if (id) handler(id)
        }
        const onLeave = () => handler(null)

        el.addEventListener('pointerenter', onEnter)
        el.addEventListener('pointerleave', onLeave)
        enterHandlers[i] = onEnter
        leaveHandlers[i] = onLeave
      }
    },
    dispose() {
      for (const [i, el] of nodes.entries()) {
        const onClick = listeners[i]
        if (onClick) el.removeEventListener('click', onClick)
        const onKey = keyHandlers[i]
        if (onKey) el.removeEventListener('keydown', onKey)
        const onEnter = enterHandlers[i]
        if (onEnter) el.removeEventListener('pointerenter', onEnter)
        const onLeave = leaveHandlers[i]
        if (onLeave) el.removeEventListener('pointerleave', onLeave)
        el.remove()
      }
      nodes.length = 0
      listeners.length = 0
      keyHandlers.length = 0
      enterHandlers.length = 0
      leaveHandlers.length = 0
      slotOf.clear()
    },
  }
}

// ---------------------------------------------------------------------------
// The surface + director
// ---------------------------------------------------------------------------

export interface LabelSurfaceProps {
  children?: ReactNode
  /** Global cap. Nothing beyond this is drawn at any zoom. */
  maxLabels?: number
  reducedMotion?: boolean
  /** Switches the pills to their dark palette. Same flag as the terrain's. */
  darkMode?: boolean
  /** Throttled to ~4Hz. For a dev readout; never per frame. */
  onSample?: (sample: LodSample) => void
}

/** How far outside the canvas a label may sit before it is culled. */
const CULL_MARGIN = 56
/** Longest frame the fade easing will honour; a tab-switch is not a frame. */
const MAX_DT = 0.1
const SAMPLE_INTERVAL = 0.25

/**
 * Mounts the overlay, runs the per-frame layout, drives every registered layer.
 *
 * Must sit *after* the camera rig in the scene tree. drei's OrbitControls
 * updates at frame priority -1 and so is always ahead of this, but the flight
 * animation in `useGlobeCamera` runs at 0 — and subscriptions at equal priority
 * fire in mount order. A label layer that projects with last frame's camera is
 * a label layer that visibly trails its own marker during a fly-to.
 */
export function LabelSurface({
  children,
  maxLabels = MAX_LABELS,
  reducedMotion = false,
  darkMode = false,
  onSample,
}: LabelSurfaceProps): ReactElement {
  const gl = useThree((s) => s.gl)

  const surface = useMemo(() => {
    if (typeof document === 'undefined') return null
    const el = document.createElement('div')
    /*
     * The class carries the pills' own `--lod-*` tokens; `world-lod-dark` is
     * toggled onto it below.
     *
     * Decorative by contract, but hidden PER PILL rather than here — see
     * `createLabelPool`. Every one of these names duplicates data that already
     * exists in the boards and the plot pages, and a screen reader that
     * announces a hundred and twenty city names on zoom is strictly worse than
     * one that announces none. The country pills are the exception, because
     * they are operable controls, and an operable control inside an
     * aria-hidden subtree is a trap rather than a courtesy.
     */
    el.className = 'world-lod-surface'
    el.style.cssText =
      'position:absolute;inset:0;overflow:hidden;pointer-events:none;contain:layout paint;'
    return el
  }, [])

  useEffect(() => {
    if (!surface) return
    surface.classList.toggle('world-lod-dark', darkMode)
  }, [surface, darkMode])

  // A plain array rather than a Set: it is walked three times a frame, and a
  // Set iterator is an allocation each time.
  const layers = useMemo<Array<{ current: LabelLayer | null }>>(() => [], [])

  const api = useMemo<LabelSurfaceApi>(
    () => ({
      surface,
      register(holder) {
        layers.push(holder)
        return () => {
          const i = layers.indexOf(holder)
          if (i >= 0) layers.splice(i, 1)
        }
      },
    }),
    [surface, layers],
  )

  const measurer = useMemo(
    () => (surface ? createMeasurer(surface) : null),
    [surface],
  )

  useEffect(() => {
    if (!surface) return undefined
    const parent = gl.domElement.parentElement
    if (!parent) return undefined
    parent.appendChild(surface)
    measurer?.resolve()

    // Web fonts land after first paint, and every width measured before then
    // is a system-font width. Re-resolve once they are in.
    let cancelled = false
    void document.fonts?.ready.then(() => {
      if (!cancelled) measurer?.resolve()
    })

    return () => {
      cancelled = true
      surface.remove()
    }
  }, [gl, surface, measurer])

  const scratch = useRef({
    viewProjection: new THREE.Matrix4(),
    cameraInverse: new THREE.Matrix4(),
    candidates: [] as LabelBox[],
    previous: new Set<string>(),
    sampleAt: 0,
  })

  /**
   * The per-frame scratch object, built once.
   *
   * `project` and `measure` are defined here rather than reassigned each frame
   * so that the frame callback allocates nothing at all.
   */
  const frame = useMemo<LabelFrame>(() => {
    const self: LabelFrame = {
      distance: 3,
      tier: 'far',
      popFloor: Number.POSITIVE_INFINITY,
      logPopFloor: Number.POSITIVE_INFINITY,
      horizon: 1,
      horizonTop: 1,
      width: 0,
      height: 0,
      dt: 0,
      reducedMotion: false,
      camX: 0,
      camY: 0,
      camZ: 1,
      px: 0,
      py: 0,
      project(dx, dy, dz, radius) {
        const e = scratch.current.viewProjection.elements
        const x = dx * radius
        const y = dy * radius
        const z = dz * radius
        const w = e[3] * x + e[7] * y + e[11] * z + e[15]
        // Behind the eye. The perspective divide would flip it onto the screen
        // upside down and about right, which is worse than losing it.
        if (w <= 1e-6) return false
        const inv = 1 / w
        self.px =
          ((e[0] * x + e[4] * y + e[8] * z + e[12]) * inv * 0.5 + 0.5) *
          self.width
        self.py =
          (0.5 - (e[1] * x + e[5] * y + e[9] * z + e[13]) * inv * 0.5) *
          self.height
        return true
      },
      measure(text, role) {
        return measurer ? measurer.measure(text, role) : 0
      },
    }
    return self
  }, [measurer])

  useFrame((state, delta) => {
    if (!surface) return

    const s = scratch.current
    const camera = state.camera

    // OrbitControls has already moved the camera this frame, but nothing has
    // recomputed its world inverse — the renderer does that later, inside
    // `render`. Projecting against a stale matrix puts every label one frame
    // behind the globe, which during a fast drag is a visible slide.
    camera.updateMatrixWorld()
    s.cameraInverse.copy(camera.matrixWorld).invert()
    s.viewProjection.multiplyMatrices(camera.projectionMatrix, s.cameraInverse)

    const width = state.size.width
    const height = state.size.height
    const distance = camera.position.length()
    const invDistance = distance > 1e-6 ? 1 / distance : 0

    const floor = populationFloor(distance)
    const horizon = horizonDot(distance) + LIMB_INSET

    frame.distance = distance
    frame.tier = tierForDistance(distance)
    frame.popFloor = floor
    frame.logPopFloor = Number.isFinite(floor)
      ? Math.log10(floor + 1)
      : Number.POSITIVE_INFINITY
    frame.horizon = horizon
    frame.horizonTop = horizon + LIMB_BAND
    frame.width = width
    frame.height = height
    frame.dt = Math.min(delta, MAX_DT)
    frame.reducedMotion = reducedMotion
    frame.camX = camera.position.x * invDistance
    frame.camY = camera.position.y * invDistance
    frame.camZ = camera.position.z * invDistance

    const candidates = s.candidates
    candidates.length = 0
    for (let i = 0; i < layers.length; i += 1) {
      layers[i].current?.collect(candidates, frame)
    }

    // Hysteresis, applied here rather than inside the layout so the layout
    // stays a pure function of the boxes it is handed. Without it two labels
    // of near-equal importance swap the same slot as the projection jitters,
    // and the flicker lands during motion — which is when someone is looking.
    if (s.previous.size > 0) {
      for (let i = 0; i < candidates.length; i += 1) {
        if (s.previous.has(candidates[i].id)) {
          candidates[i].priority *= STICKY_PRIORITY_BONUS
        }
      }
    }

    const result = layoutLabels(candidates, {
      maxLabels,
      padding: 2,
      viewportWidth: width,
      viewportHeight: height,
      margin: CULL_MARGIN,
    })

    for (let i = 0; i < layers.length; i += 1) {
      layers[i].current?.commit(result.placedSet, frame)
    }

    s.previous = result.placedSet

    if (onSample) {
      s.sampleAt += frame.dt
      if (s.sampleAt >= SAMPLE_INTERVAL) {
        s.sampleAt = 0
        onSample({
          distance,
          tier: frame.tier,
          popFloor: floor,
          candidates: result.considered,
          placed: result.placed.length,
          collided: result.collided,
          capped: result.capped,
        })
      }
    }
  })

  return createElement(LabelSurfaceContext.Provider, { value: api }, children)
}
