import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from 'react'
import { Canvas } from '@react-three/fiber'
import type { GlobePin } from '../../../lib/worldApi'
import { WorldCard } from '../ui'
import { paletteFor, stakeBand } from './geo'
import { GlobeScene, type WorldGlobeFocus } from './GlobeScene'

/**
 * The globe, and the four ways it can fail to be a globe.
 *
 * WebGL missing, WebGL crashing mid-scene, a first render before layout, and
 * the device not being able to keep up — each has a landing spot here. A
 * centrepiece that white-screens is worse than no centrepiece, because the
 * claim flow is on the other side of it.
 *
 * The component renders full-bleed in its container, handles its own fallback
 * card, and never navigates on its own — every intent leaves through a
 * callback.
 */

/** The /api/world/globe pin shape — the one type both sides code against. */
export type GlobePlot = GlobePin

export interface WorldGlobeProps {
  plots: GlobePlot[]
  darkMode: boolean
  focus?: WorldGlobeFocus | null
  /** Click the globe → lat/lng for the claim flow. Crosshair affordance. */
  pickMode?: boolean
  onPick?: (p: { lat: number; lng: number }) => void
  onSelectPlot?: (id: number) => void
  onSelectCountry?: (iso: string) => void
  className?: string
}

let webglProbe: boolean | null = null

/**
 * Probed once per page load, during render rather than in an effect, so the
 * fallback never flashes in after a frame of empty canvas.
 */
function hasWebGL(): boolean {
  if (typeof window === 'undefined') return false
  if (webglProbe !== null) return webglProbe
  try {
    const canvas = document.createElement('canvas')
    webglProbe = Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') ?? canvas.getContext('webgl')),
    )
  } catch {
    webglProbe = false
  }
  return webglProbe
}

/**
 * Rough device tier, sampled once.
 *
 * `deviceMemory` and `hardwareConcurrency` are blunt, but they are the only
 * signals available before the first frame, and the alternative — render at 2x
 * and find out — is a stutter on exactly the devices that can least afford it.
 * `PerformanceMonitor` corrects the guess from inside the scene.
 */
function detectLowPower(): boolean {
  if (typeof navigator === 'undefined') return false
  const nav = navigator as Navigator & { deviceMemory?: number }
  if ((nav.hardwareConcurrency ?? 8) <= 4) return true
  if ((nav.deviceMemory ?? 8) <= 4) return true
  if (
    window.matchMedia('(pointer: coarse)').matches &&
    window.innerWidth < 900
  ) {
    return true
  }
  return false
}

/**
 * Both failure states, as a floating card in World's own idiom.
 *
 * It used to be monospace, which was the terminal styling this feature is
 * leaving: this is a sentence explaining what went wrong, and sentences are set
 * in the sans face. `WorldCard` brings the surface, the 16px radius, the
 * hairline border and the elevation with it, so a globe that cannot draw itself
 * still leaves something that looks deliberate — and looks like the rest of the
 * page rather than like a console.
 */
function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 grid place-items-center p-8">
      <WorldCard className="max-w-xs px-6 py-5 text-center">
        <p className="world-muted text-sm leading-relaxed">{children}</p>
      </WorldCard>
    </div>
  )
}

/**
 * The two token sets the tooltip paints itself with.
 *
 * Written out rather than read from `--w-*` for the same reason the label pills
 * carry their own: this element is driven by the globe's `darkMode` prop, while
 * the CSS custom properties are driven by the `dark` class on <html>. Those are
 * the same switch today and a light tooltip on a dark globe the day they are
 * not. Values mirror `world.css`; keep them in step by hand.
 */
const TOOLTIP_TONE = {
  light: {
    card: '#FFFFFF',
    ink: '#17212F',
    muted: '#56657E',
    border: 'rgba(23, 33, 47, 0.14)',
    press: '#C2410C',
    shadow: '0 1px 2px rgba(23, 43, 77, 0.10), 0 8px 24px rgba(23, 43, 77, 0.16)',
  },
  dark: {
    card: '#1E2631',
    ink: '#EAF0F7',
    muted: '#9FB0C4',
    border: 'rgba(234, 240, 247, 0.20)',
    press: '#9A3412',
    shadow: '0 1px 2px rgba(0, 0, 0, 0.45), 0 8px 24px rgba(0, 0, 0, 0.35)',
  },
} as const

const TOOLTIP_SANS =
  'ui-rounded, "SF Pro Rounded", "Segoe UI Variable", Inter, system-ui, sans-serif'
const TOOLTIP_MONO =
  'ui-monospace, SFMono-Regular, "SF Mono", "JetBrains Mono", Menlo, monospace'

/**
 * What a pin is worth, said honestly.
 *
 * The globe feed ships a stake BUCKET, never an amount, so this is a band or it
 * is "unknown" — see `stakeBand`. There is deliberately no branch that turns a
 * bucket into a single number: a plausible-looking "$127" nobody staked is
 * worse than the word unknown, and this product's whole pitch is that its
 * numbers are real.
 */
function PinTooltipBody({ pin }: { pin: GlobePin }) {
  if (pin.kind === 'seed') {
    return <>Unclaimed &mdash; nothing staked here yet</>
  }
  const band = stakeBand(pin.tier, pin.kind)
  if (band === null) {
    return (
      <>
        Staked{' '}
        <span style={{ fontFamily: TOOLTIP_SANS, fontWeight: 600 }}>
          unknown
        </span>
      </>
    )
  }
  return (
    <>
      Staked{' '}
      <span
        style={{
          fontFamily: TOOLTIP_MONO,
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 600,
        }}
      >
        {band}
      </span>
    </>
  )
}

class GlobeBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[world-globe] scene failed', error)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

const WorldGlobe: FC<WorldGlobeProps> = ({
  plots,
  darkMode,
  focus,
  pickMode = false,
  onPick,
  onSelectPlot,
  onSelectCountry,
  className,
}) => {
  const [lowPower, setLowPower] = useState(detectLowPower)
  const handleDecline = useCallback(() => setLowPower(true), [])
  const palette = paletteFor(darkMode)

  /**
   * The pin under the cursor.
   *
   * State, but cheap: the scene reports transitions, not frames, so this
   * re-renders once when the cursor finds a pin and once when it leaves.
   */
  const [hoverPin, setHoverPin] = useState<GlobePin | null>(null)
  const handleHoverPin = useCallback((pin: GlobePin | null) => {
    setHoverPin((prev) => (prev?.id === pin?.id ? prev : pin))
  }, [])

  /**
   * Make r3f measure its container, because sometimes it never does.
   *
   * react-three-fiber sizes the canvas from a ResizeObserver on the wrapper.
   * When the wrapper already has its final size at mount — which is always
   * true here, since it fills a fixed-height route — the observer can deliver
   * no initial entry and then never fire again, because the size genuinely
   * never changes. The canvas is left at the HTML default of 300x150 behind a
   * full-size element. Nothing errors: WebGL is alive, the scene is built, the
   * labels never mount, and the page just looks empty.
   *
   * This checks the outcome instead of trying to arrange the cause: shortly
   * after mount, if the canvas is still at the default, dispatch the resize
   * every measurement path is already listening for. Self-healing, fires at
   * most a handful of times, and stops the moment the canvas has a real size.
   */
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    let tries = 0

    const check = () => {
      const canvas = wrap.current?.querySelector('canvas')

      /*
       * A NULL CANVAS IS NOT A REASON TO STOP: the Canvas sits behind a lazy
       * route and a Suspense boundary, so on the frame after mount there may
       * be no canvas in the tree yet. Keep looking until one appears, then
       * keep nudging until it has a real size.
       */
      if (canvas && canvas.clientWidth > 300) return
      if (tries > 60) return

      if (canvas) window.dispatchEvent(new Event('resize'))
      tries += 1
      // Every 100ms rather than every frame: this can run for a few seconds
      // while the globe chunk downloads, and sixty resize events a second
      // during that is a lot of layout for no gain.
      timer = setTimeout(check, 100)
    }

    timer = setTimeout(check, 0)
    return () => clearTimeout(timer)
  }, [])

  /*
   * The tooltip follows the cursor, written straight to the DOM.
   *
   * Not React state: the pointer moves at whatever rate the mouse reports, and
   * a setState per pointermove would re-render a tree containing a
   * 22,000-instance mesh. The element's transform is the only thing that
   * changes, so the element is the only thing written.
   *
   * The container's rect is cached rather than measured per move —
   * getBoundingClientRect inside a pointermove handler is a forced layout on
   * every pixel — and refreshed on the two things that can invalidate it.
   */
  const tipRef = useRef<HTMLDivElement>(null)
  const rectRef = useRef<DOMRect | null>(null)
  /** Last cursor position, in container pixels. */
  const cursorRef = useRef({ x: 0, y: 0 })

  const placeTip = useCallback(() => {
    const tip = tipRef.current
    const rect = rectRef.current
    if (!tip || !rect) return

    const { x, y } = cursorRef.current
    // Flip to the left of the cursor near the right edge, using a percentage
    // translate so the element's own width never has to be measured.
    const flip = x > rect.width - 220
    const top = Math.min(Math.max(y, 44), Math.max(rect.height - 12, 44))
    tip.style.transform =
      `translate3d(${Math.round(flip ? x - 16 : x + 16)}px, ${Math.round(top)}px, 0)` +
      ` translate(${flip ? '-100%' : '0'}, -50%)`
  }, [])

  useEffect(() => {
    const host = wrap.current
    if (!host) return undefined

    const remeasure = () => {
      rectRef.current = host.getBoundingClientRect()
    }
    remeasure()

    const move = (event: PointerEvent) => {
      const rect = rectRef.current
      if (!rect) return
      // Recorded whether or not a tooltip exists yet — see the layout effect
      // below, which is what stops a tooltip appearing in the top-left corner
      // when the cursor comes to rest ON a pin and then stops moving.
      cursorRef.current.x = event.clientX - rect.left
      cursorRef.current.y = event.clientY - rect.top
      placeTip()
    }

    host.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('resize', remeasure, { passive: true })
    window.addEventListener('scroll', remeasure, { passive: true })
    return () => {
      host.removeEventListener('pointermove', move)
      window.removeEventListener('resize', remeasure)
      window.removeEventListener('scroll', remeasure)
    }
  }, [placeTip])

  // The hover scan runs at 16Hz, so the tooltip is mounted some frames after
  // the pointermove that caused it — and possibly after the pointer has
  // stopped. Place it the moment it exists, before the browser paints.
  useLayoutEffect(() => {
    if (hoverPin) placeTip()
  }, [hoverPin, placeTip])

  const tone = darkMode ? TOOLTIP_TONE.dark : TOOLTIP_TONE.light

  if (!hasWebGL()) {
    return (
      <div className={className} style={{ position: 'relative', width: '100%', height: '100%' }}>
        <Notice>
          This browser cannot draw the globe. Everything else on the page — the
          boards, the claim flow — works without it.
        </Notice>
      </div>
    )
  }

  return (
    <div
      ref={wrap}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        // The globe is clickable and, in pick mode, that has to read from the
        // cursor alone. Set here rather than on the canvas element so it
        // survives context loss.
        cursor: pickMode ? 'crosshair' : undefined,
        // /world sets viewport behaviour so pinch does not fight the controls;
        // this keeps single-finger drags on the canvas from scrolling the page.
        touchAction: 'none',
      }}
    >
      <GlobeBoundary
        fallback={
          <Notice>
            The globe stopped responding. Reload to bring it back — nothing you
            have done has been lost.
          </Notice>
        }
      >
        <Canvas
          /*
           * Explicit size, and a zero-debounce resize: if the container
           * already has its final size when the Canvas mounts, the observer
           * may never fire a change — see the self-heal effect above.
           */
          style={{ width: '100%', height: '100%', display: 'block' }}
          resize={{ debounce: 0, scroll: false }}
          // Retina is worth paying for; 3x on a phone is not.
          // PerformanceMonitor walks this down further if the frame rate says
          // so.
          dpr={lowPower ? [1, 1.25] : [1, 2]}
          camera={{ position: [0.92, 1.12, 3.45], fov: 38, near: 0.1, far: 24 }}
          gl={{
            antialias: !lowPower,
            // Transparent, and cleared to nothing: the page shows through, so
            // the canvas has no opinion about the background and both themes
            // get their own ground for free. It also buys the marker
            // antialiasing — `alphaToCoverage` on the pins needs the
            // multisample buffer that `antialias` asks for here.
            alpha: true,
            powerPreference: 'high-performance',
            stencil: false,
          }}
          // No tone mapping. ACES would roll the claim colours off toward
          // pastel, and the whole point of them is that they are loud.
          flat
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0)
          }}
        >
          <Suspense fallback={null}>
            <GlobeScene
              pins={plots}
              palette={palette}
              darkMode={darkMode}
              focus={focus}
              pickMode={pickMode}
              onPick={onPick}
              onSelectPlot={onSelectPlot}
              onSelectCountry={onSelectCountry}
              onHoverPin={handleHoverPin}
              onPerformanceDecline={lowPower ? undefined : handleDecline}
            />
          </Suspense>
        </Canvas>
      </GlobeBoundary>

      {/*
        The hover tooltip.

        Rendered only while a pin is hovered, but its POSITION is written by the
        effect above on every pointermove — so it is already in the right place
        on the frame it appears. Inert to the pointer, so it can never eat a
        click meant for the globe underneath it, and aria-hidden because it
        duplicates a bead that is not itself a keyboard target: announcing it
        would put a name in a screen reader's ear that its user cannot reach.
      */}
      {hoverPin && (
        <div
          ref={tipRef}
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            zIndex: 3,
            pointerEvents: 'none',
            maxWidth: '15rem',
            padding: '0.5rem 0.75rem',
            borderRadius: 12,
            background: tone.card,
            border: `1px solid ${tone.border}`,
            boxShadow: tone.shadow,
            color: tone.ink,
            fontFamily: TOOLTIP_SANS,
            fontSize: 13,
            lineHeight: 1.4,
          }}
        >
          <div
            style={{
              fontWeight: 700,
              letterSpacing: '-0.01em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {hoverPin.name}
          </div>
          <div style={{ color: tone.muted, fontSize: 12, fontWeight: 600 }}>
            <PinTooltipBody pin={hoverPin} />
          </div>
          {/*
            Paid placement is disclosed wherever the pin is surfaced, and this
            is one of those places. White on --w-press: 5.18:1 light, 7.31:1
            dark.
          */}
          {hoverPin.promoted && (
            <div
              style={{
                display: 'inline-block',
                marginTop: 6,
                padding: '2px 7px',
                borderRadius: 6,
                background: tone.press,
                color: '#FFFFFF',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.01em',
              }}
            >
              Promoted
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default WorldGlobe
