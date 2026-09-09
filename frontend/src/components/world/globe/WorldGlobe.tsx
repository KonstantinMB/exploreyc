import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from 'react'
import { Canvas } from '@react-three/fiber'
import type { GlobePin } from '../../../lib/worldApi'
import { paletteFor } from './geo'
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
 * Both failure states, as a floating card in the repo's own idiom: monospace,
 * bordered, both themes. A globe that cannot draw itself still leaves
 * something that looks deliberate.
 */
function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 grid place-items-center p-8">
      <div className="max-w-xs rounded-lg border border-border bg-card px-6 py-5 text-center shadow-sm">
        <p className="font-mono text-sm leading-relaxed text-muted-foreground">
          {children}
        </p>
      </div>
    </div>
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
              onPerformanceDecline={lowPower ? undefined : handleDecline}
            />
          </Suspense>
        </Canvas>
      </GlobeBoundary>
    </div>
  )
}

export default WorldGlobe
