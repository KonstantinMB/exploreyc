/* eslint-disable react-hooks/immutability -- three.js/DOM resources are
   GPU-adjacent objects written imperatively per frame; there is no pure-React
   formulation of that. Same deliberate call as the donor codebase. */
/*
 * Retuning the live camera's near plane per frame — see `Rig` — is a write to
 * a GPU-adjacent resource, not to React state; there is no pure formulation of
 * "narrow the frustum as the ground gets closer".
 */

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { OrbitControls, PerformanceMonitor } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { GlobePin } from '../../../lib/worldApi'
import {
  GLOBE_RADIUS,
  vector3ToLatLng,
  type GlobePalette,
} from './geo'
import { Atmosphere } from './Atmosphere'
import { CityLabels } from './CityLabels'
import { CountryBorders, type CountryInfo } from './CountryBorders'
import { CountryLabels } from './CountryLabels'
import { PlotColumns, type PinHitTest } from './PlotColumns'
import { PlotLabels } from './PlotLabels'
import { Shockwave } from './Shockwave'
import {
  CAMERA_MAX_DISTANCE,
  CAMERA_MIN_DISTANCE,
  rotateSpeedForDistance,
  zoomSpeedForDistance,
} from './labelLayout'
import { LabelSurface, type LodSample } from './useLevelOfDetail'
import {
  useGlobeCamera,
  usePrefersReducedMotion,
  type OrbitLike,
} from './useGlobeCamera'

/**
 * Everything inside the `<Canvas>`.
 *
 * The globe is a toy, not a render of Earth. There is no photographic texture
 * anywhere in this file: the body is a two-step blue gradient with a thin
 * light rim, the grid is drawn, the countries are drawn, and every pin is a
 * solid marker sitting on the surface. Nothing blends additively — additive
 * light is a dark-theme idiom, and this globe has to hold up in both themes.
 */

// --- camera envelope -------------------------------------------------------

const MIN_DISTANCE = CAMERA_MIN_DISTANCE
const MAX_DISTANCE = CAMERA_MAX_DISTANCE
/** Idle time before the globe starts turning again after a drag. */
const IDLE_RESUME_MS = 3000
/** Pointer travel, in pixels, above which a click was really a drag. */
const DRAG_SLOP = 4

const ZOOM_SPEED_BASE = 0.62
const ROTATE_SPEED_BASE = 0.42
/** Idle spin, also scaled with distance — at close range the ground whips past. */
const AUTO_ROTATE_BASE = 0.28

/**
 * How much of the angle between the cursor and the screen centre a single
 * wheel gesture eats. Zoom-toward-cursor as a *rotation* of the camera rather
 * than by moving the orbit target — moving the target is a one-way trip on a
 * globe with panning disabled.
 */
const CURSOR_ZOOM_PULL = 0.25

// --- globe body ------------------------------------------------------------

const BODY_VERT = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vNormalWorld;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormalWorld = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const BODY_FRAG = /* glsl */ `
  uniform vec3 uCore;
  uniform vec3 uEdge;
  uniform vec3 uRim;
  uniform vec3 uKey;

  varying vec3 vWorld;
  varying vec3 vNormalWorld;

  void main() {
    vec3 n = normalize(vNormalWorld);
    vec3 v = normalize(cameraPosition - vWorld);
    float facing = max(dot(n, v), 0.0);

    // Barely a light. Enough that the sphere is not a flat disc, not so much
    // that it starts to look like a photograph of a planet.
    float key = 0.5 + 0.5 * dot(n, normalize(uKey));

    vec3 col = mix(uEdge, uCore, pow(facing, 0.62));
    col *= 0.95 + 0.09 * key;

    // Light rim, mixed toward the theme's rim colour rather than added.
    // Additive on a pale sphere just clips to white and eats the last of the
    // blue; a mix keeps the edge crisp and the hue intact.
    col = mix(col, uRim, pow(1.0 - facing, 6.0) * 0.55);

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`

/** Analytic ray/sphere test, replacing the 18k-triangle default. */
const SPHERE = new THREE.Sphere(new THREE.Vector3(0, 0, 0), GLOBE_RADIUS)
const HIT = new THREE.Vector3()

function sphereRaycast(
  this: THREE.Object3D,
  raycaster: THREE.Raycaster,
  intersects: THREE.Intersection[],
) {
  if (!raycaster.ray.intersectSphere(SPHERE, HIT)) return
  const distance = raycaster.ray.origin.distanceTo(HIT)
  if (distance < raycaster.near || distance > raycaster.far) return
  intersects.push({
    distance,
    point: HIT.clone(),
    object: this,
    normal: HIT.clone().normalize(),
  })
}

interface GlobeBodyProps {
  palette: GlobePalette
  onPick?: (lat: number, lng: number) => void
}

function GlobeBody({ palette, onPick }: GlobeBodyProps) {
  const geometry = useMemo(
    () => new THREE.SphereGeometry(GLOBE_RADIUS, 128, 72),
    [],
  )

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: BODY_VERT,
        fragmentShader: BODY_FRAG,
        uniforms: {
          uCore: { value: new THREE.Color(palette.ocean) },
          uEdge: { value: new THREE.Color(palette.oceanDeep) },
          uRim: { value: new THREE.Color(palette.rim) },
          uKey: { value: new THREE.Vector3(-0.45, 0.62, 0.65) },
        },
        toneMapped: false,
      }),
    // Theme changes write into the existing uniforms below rather than
    // rebuilding: rebuilding would force a shader recompile on every toggle,
    // which is a visible hitch for a colour swap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useEffect(() => {
    material.uniforms.uCore.value.set(palette.ocean)
    material.uniforms.uEdge.value.set(palette.oceanDeep)
    material.uniforms.uRim.value.set(palette.rim)
  }, [material, palette])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!onPick) return
    // r3f accumulates pointer travel since pointerdown into `delta`. Without
    // this every orbit drag that happens to end over the globe places a pin.
    if (event.delta > DRAG_SLOP) return
    event.stopPropagation()
    const { lat, lng } = vector3ToLatLng(event.point)
    onPick(lat, lng)
  }

  return (
    <mesh
      geometry={geometry}
      material={material}
      raycast={sphereRaycast}
      onClick={onPick ? handleClick : undefined}
      renderOrder={1}
    />
  )
}

// --- graticule -------------------------------------------------------------

/** Grid spacing in degrees. 15 is the convention and it looks like one. */
const GRID_STEP = 15

function buildGraticule(radius: number, minor: string, major: string) {
  const positions: number[] = []
  const colors: number[] = []
  const minorColor = new THREE.Color(minor)
  const majorColor = new THREE.Color(major)

  const push = (lat: number, lng: number, isMajor: boolean) => {
    const phi = (90 - lat) * (Math.PI / 180)
    const theta = (lng + 180) * (Math.PI / 180)
    const s = Math.sin(phi)
    positions.push(
      -radius * s * Math.cos(theta),
      radius * Math.cos(phi),
      radius * s * Math.sin(theta),
    )
    const c = isMajor ? majorColor : minorColor
    colors.push(c.r, c.g, c.b)
  }

  // Meridians.
  for (let lng = -180; lng < 180; lng += GRID_STEP) {
    const isMajor = lng === 0
    for (let lat = -90; lat < 90; lat += 2) {
      push(lat, lng, isMajor)
      push(lat + 2, lng, isMajor)
    }
  }

  // Parallels. The poles are skipped; a circle of radius zero is a dot.
  for (let lat = -90 + GRID_STEP; lat < 90; lat += GRID_STEP) {
    const isMajor = lat === 0
    for (let lng = -180; lng < 180; lng += 2) {
      push(lat, lng, isMajor)
      push(lat, lng + 2, isMajor)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(positions), 3),
  )
  geometry.setAttribute(
    'color',
    new THREE.BufferAttribute(new Float32Array(colors), 3),
  )
  geometry.computeBoundingSphere()
  return geometry
}

function Graticule({ palette }: { palette: GlobePalette }) {
  // Rebuilt on theme toggle. The build is a few ms, paid only when the user
  // flips the switch — a uniform-based scheme would complicate every frame to
  // save an event that happens twice a session.
  const geometry = useMemo(
    () =>
      buildGraticule(GLOBE_RADIUS * 1.0006, palette.gridMinor, palette.gridMajor),
    [palette],
  )
  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        // White, so the vertex colours pass through unchanged.
        color: new THREE.Color('#ffffff'),
        vertexColors: true,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  )

  useEffect(
    () => () => {
      geometry.dispose()
    },
    [geometry],
  )
  useEffect(
    () => () => {
      material.dispose()
    },
    [material],
  )

  return <lineSegments geometry={geometry} material={material} renderOrder={0} />
}

// --- controls --------------------------------------------------------------

/**
 * Where the camera is asked to go. `distance` names a rung of the
 * level-of-detail ladder to arrive at; without one the flight keeps the
 * distance it started from.
 */
export interface GlobeFocus {
  lat: number
  lng: number
  distance?: number
}

interface RigProps {
  focus?: GlobeFocus | null
  reducedMotion: boolean
  /** Nudge the point under the cursor toward the centre while zooming in. */
  zoomToCursor?: boolean
}

/** The two knobs `OrbitLike` does not declare, retuned every frame. */
interface OrbitTunable extends OrbitLike {
  zoomSpeed: number
  rotateSpeed: number
}

const CENTRED = new THREE.Quaternion()

/**
 * Orbit controls, idle auto-rotation, and the camera flights.
 *
 * Auto-rotation is toggled from `useFrame` against a deadline held in a ref
 * rather than from React state. State would re-render the whole scene twice
 * per drag, and this component's siblings include a 22,000-instance mesh.
 */
function Rig({ focus, reducedMotion, zoomToCursor = true }: RigProps) {
  const controlsRef = useRef<OrbitTunable | null>(null)
  const resumeAt = useRef(0)
  const { flyTo, flying } = useGlobeCamera()
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)

  useFrame(() => {
    const controls = controlsRef.current
    if (!controls) return

    controls.autoRotate =
      !reducedMotion && !flying.current && performance.now() >= resumeAt.current

    const distance = camera.position.length()
    controls.zoomSpeed = zoomSpeedForDistance(distance, ZOOM_SPEED_BASE)
    controls.rotateSpeed = rotateSpeedForDistance(distance, ROTATE_SPEED_BASE)
    controls.autoRotateSpeed = rotateSpeedForDistance(
      distance,
      AUTO_ROTATE_BASE,
    )

    /*
     * Near plane, tracked to altitude rather than fixed.
     *
     * With a fixed 0.1 near plane, everything the camera points at near the
     * zoom floor sits *inside* the frustum's near wall and is clipped away —
     * the last stop of the zoom renders an empty map. Scaled at a fifth of
     * altitude, so the nearest ground is always five near planes away, and
     * clamped at 0.1 so nothing above ~1.5 changes at all.
     */
    const perspective = camera as THREE.PerspectiveCamera
    if (perspective.isPerspectiveCamera) {
      const near = Math.min(0.1, Math.max(0.002, (distance - 1) * 0.2))
      // Rewriting the projection matrix is not free and this runs every frame;
      // only do it when the value has actually moved a meaningful amount.
      if (Math.abs(perspective.near - near) > near * 0.02) {
        perspective.near = near
        perspective.updateProjectionMatrix()
      }
    }
  })

  useEffect(() => {
    if (!focus) return
    resumeAt.current = performance.now() + IDLE_RESUME_MS
    flyTo(focus.lat, focus.lng, { distance: focus.distance })
  }, [focus, flyTo])

  // ---- zoom toward the cursor --------------------------------------------

  useEffect(() => {
    if (!zoomToCursor) return undefined

    const element = gl.domElement
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const hit = new THREE.Vector3()
    const heading = new THREE.Vector3()
    const toward = new THREE.Quaternion()
    const partial = new THREE.Quaternion()

    const onWheel = (event: WheelEvent) => {
      // Only on the way in, and never while a scripted flight owns the camera.
      if (event.deltaY >= 0 || flying.current) return

      const rect = element.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return

      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(pointer, camera)
      // Off the globe entirely — pulling toward empty space would spin the
      // planet away from whatever the user was actually looking at.
      if (!raycaster.ray.intersectSphere(SPHERE, hit)) return

      hit.normalize()
      heading.copy(camera.position).normalize()
      if (heading.dot(hit) > 0.99995) return

      toward.setFromUnitVectors(heading, hit)

      // Scaled by how hard the wheel was turned, so a trackpad's stream of
      // four-pixel deltas converges at the same rate a mouse notch does.
      const strength =
        Math.min(Math.abs(event.deltaY) / 120, 1) * CURSOR_ZOOM_PULL

      partial.copy(CENTRED).slerp(toward, strength)
      camera.position.applyQuaternion(partial)
      // Orientation is left to OrbitControls, which re-derives it from the new
      // position at frame priority -1, before anything else reads the camera.
    }

    element.addEventListener('wheel', onWheel, { passive: true })
    return () => element.removeEventListener('wheel', onWheel)
  }, [camera, gl, zoomToCursor, flying])

  return (
    <OrbitControls
      makeDefault
      ref={(instance) => {
        controlsRef.current = instance as unknown as OrbitTunable | null
      }}
      // Panning slides the target off the origin and the globe drifts out of
      // frame with no way back. There is nothing to pan to.
      enablePan={false}
      enableDamping
      dampingFactor={0.055}
      rotateSpeed={ROTATE_SPEED_BASE}
      zoomSpeed={ZOOM_SPEED_BASE}
      minDistance={MIN_DISTANCE}
      maxDistance={MAX_DISTANCE}
      autoRotate={!reducedMotion}
      autoRotateSpeed={AUTO_ROTATE_BASE}
      onStart={() => {
        resumeAt.current = Number.POSITIVE_INFINITY
      }}
      onEnd={() => {
        resumeAt.current = performance.now() + IDLE_RESUME_MS
      }}
    />
  )
}

// --- hover -----------------------------------------------------------------

/**
 * Resolves the country under the cursor, ~30 times a second.
 *
 * Deliberately NOT react-three-fiber pointer events. r3f raycasts every
 * registered object on every `pointermove`, which against a 128x72 sphere plus
 * thousands of pin instances is a full scene traversal per mouse pixel. The
 * raycast here is against a mathematical sphere: one ray/sphere intersection,
 * then an array lookup in the country index.
 */
function CountryHoverPicker({
  enabled,
  lookupRef,
  onHover,
}: {
  enabled: boolean
  lookupRef: React.RefObject<((lat: number, lng: number) => string | null) | null>
  onHover: (iso2: string | null) => void
}) {
  const { camera, gl, pointer } = useThree()
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const sphere = useMemo(
    () => new THREE.Sphere(new THREE.Vector3(0, 0, 0), GLOBE_RADIUS),
    [],
  )
  const hit = useMemo(() => new THREE.Vector3(), [])
  const state = useRef({ inside: false, at: 0, last: null as string | null })

  useEffect(() => {
    const el = gl.domElement
    const enter = () => {
      state.current.inside = true
    }
    const leave = () => {
      state.current.inside = false
      state.current.last = null
      el.style.cursor = ''
      onHover(null)
    }
    el.addEventListener('pointerenter', enter)
    el.addEventListener('pointerleave', leave)
    return () => {
      el.removeEventListener('pointerenter', enter)
      el.removeEventListener('pointerleave', leave)
      el.style.cursor = ''
    }
  }, [gl, onHover])

  useFrame((frame) => {
    if (!enabled) return
    const s = state.current
    if (!s.inside) return

    const now = frame.clock.elapsedTime
    if (now - s.at < 0.033) return
    s.at = now

    raycaster.setFromCamera(pointer, camera)
    let iso2: string | null = null
    if (raycaster.ray.intersectSphere(sphere, hit)) {
      const { lat, lng } = vector3ToLatLng(hit)
      iso2 = lookupRef.current?.(lat, lng) ?? null
    }

    if (iso2 === s.last) return
    s.last = iso2
    // A country is clickable; open water is not. Saying so with the cursor is
    // the cheapest affordance there is.
    gl.domElement.style.cursor = iso2 ? 'pointer' : ''
    onHover(iso2)
  })

  return null
}

// --- scene -----------------------------------------------------------------

/** The `focus` shape the public component accepts. */
export type WorldGlobeFocus = { lat: number; lng: number } | { iso: string }

export interface GlobeSceneProps {
  pins: GlobePin[]
  palette: GlobePalette
  darkMode: boolean
  focus?: WorldGlobeFocus | null
  /** Click-to-place mode for the claim flow. */
  pickMode?: boolean
  onPick?: (p: { lat: number; lng: number }) => void
  onSelectPlot?: (id: number) => void
  onSelectCountry?: (iso: string) => void
  /** Raised when the frame rate will not hold; the wrapper drops pixel ratio. */
  onPerformanceDecline?: () => void
  /** Level-of-detail telemetry, throttled to ~4Hz. For a dev harness. */
  onLodSample?: (sample: LodSample) => void
}

export function GlobeScene({
  pins,
  palette,
  darkMode,
  focus,
  pickMode = false,
  onPick,
  onSelectPlot,
  onSelectCountry,
  onPerformanceDecline,
  onLodSample,
}: GlobeSceneProps) {
  const reducedMotion = usePrefersReducedMotion()

  const [hoveredIso2, setHoveredIso2] = useState<string | null>(null)
  const lookupRef = useRef<((lat: number, lng: number) => string | null) | null>(
    null,
  )
  const pinHitRef = useRef<PinHitTest | null>(null)
  /** Bumped when the country lookup (re)builds, so derived memos recompute. */
  const [lookupVersion, setLookupVersion] = useState(0)

  const handleLookupReady = useCallback(
    (fn: (lat: number, lng: number) => string | null) => {
      lookupRef.current = fn
      setLookupVersion((v) => v + 1)
    },
    [],
  )

  const handlePinHitReady = useCallback((fn: PinHitTest) => {
    pinHitRef.current = fn
  }, [])

  const handleHover = useCallback((iso2: string | null) => {
    setHoveredIso2((prev) => (prev === iso2 ? prev : iso2))
  }, [])

  // ---- derived country data ------------------------------------------------

  const [countries, setCountries] = useState<CountryInfo[]>([])
  const handleCountriesReady = useCallback((list: CountryInfo[]) => {
    setCountries(list)
  }, [])

  const countryByIso = useMemo(() => {
    const m = new Map<string, CountryInfo>()
    for (const c of countries) m.set(c.iso2, c)
    return m
  }, [countries])

  /**
   * Which countries hold paid pins, and how heavily.
   *
   * The API does not ship a per-pin country, so paid pins are resolved through
   * the same point-in-polygon index the cursor uses. Seeds are excluded by
   * construction — an unclaimed company must never colour a country in. The
   * scan is a few dozen operations per paid pin and reruns only when the pins
   * or the topology change.
   */
  const countryAgg = useMemo(() => {
    const counts = new Map<string, number>()
    const weights = new Map<string, number>()
    const lookup = lookupRef.current
    if (lookup) {
      for (const p of pins) {
        if (p.kind !== 'plot') continue
        const iso = lookup(p.lat, p.lng)
        if (!iso) continue
        counts.set(iso, (counts.get(iso) ?? 0) + 1)
        weights.set(iso, (weights.get(iso) ?? 0) + 1 + Math.max(p.tier, 0))
      }
    }
    return { counts, weights }
    // lookupVersion stands in for lookupRef.current, which a ref cannot dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, lookupVersion])

  /** Paid pins only — the label/city layers must never mistake a seed for a stake. */
  const paidPins = useMemo(() => pins.filter((p) => p.kind === 'plot'), [pins])

  // ---- focus ---------------------------------------------------------------

  /**
   * The public focus shape resolved to a coordinate. An `{iso}` focus waits
   * until the topology has produced centroids; a coordinate focus flies
   * immediately. Each resolution mints a fresh object, which is what re-arms
   * the flight in `Rig`.
   */
  const resolvedFocus = useMemo<GlobeFocus | null>(() => {
    if (!focus) return null
    if ('iso' in focus) {
      const c = countryByIso.get(focus.iso.toUpperCase())
      return c ? { lat: c.lat, lng: c.lng, distance: 2.2 } : null
    }
    return { lat: focus.lat, lng: focus.lng, distance: 1.8 }
  }, [focus, countryByIso])

  // ---- picking -------------------------------------------------------------

  /** Ghost marker + shockwave at the last picked spot, pick mode only. */
  const [pendingPick, setPendingPick] = useState<{
    lat: number
    lng: number
  } | null>(null)

  useEffect(() => {
    if (!pickMode) setPendingPick(null)
  }, [pickMode])

  /**
   * A click resolves in strict order: pick mode wins outright (the claim flow
   * asked for a coordinate and gets exactly the pixel that was clicked), then
   * a paid pin under the cursor, then the country, then nothing. Seeds fall
   * through to their country — a seed has no detail page to open.
   */
  const handlePick = useCallback(
    (lat: number, lng: number) => {
      if (pickMode) {
        if (!onPick) return
        // A fresh object each time so the ghost and the shockwave both re-arm.
        setPendingPick({ lat, lng })
        onPick({ lat, lng })
        return
      }

      const pin = pinHitRef.current?.(lat, lng) ?? null
      if (pin && pin.kind === 'plot' && onSelectPlot) {
        const numeric = Number(pin.id)
        if (Number.isFinite(numeric)) {
          onSelectPlot(numeric)
          return
        }
      }

      const iso2 = lookupRef.current?.(lat, lng) ?? null
      if (iso2 && onSelectCountry) onSelectCountry(iso2)
    },
    [pickMode, onPick, onSelectPlot, onSelectCountry],
  )

  const clickable =
    pickMode || Boolean(onSelectCountry) || Boolean(onSelectPlot)

  return (
    <>
      {onPerformanceDecline && (
        <PerformanceMonitor onDecline={onPerformanceDecline} />
      )}

      <GlobeBody palette={palette} onPick={clickable ? handlePick : undefined} />
      <CountryHoverPicker
        // In pick mode the crosshair owns the cursor; a pointer cursor over
        // land would promise a different action than the one a click performs.
        enabled={Boolean(onSelectCountry) && !pickMode}
        lookupRef={lookupRef}
        onHover={handleHover}
      />
      <Graticule palette={palette} />

      {/* Borders load ~108kB of TopoJSON in a split chunk; the globe body,
          grid and pins are all up before it resolves. */}
      <Suspense fallback={null}>
        <CountryBorders
          claims={countryAgg.weights}
          palette={palette}
          hoveredIso2={pickMode ? null : hoveredIso2}
          onLookupReady={handleLookupReady}
          onCountriesReady={handleCountriesReady}
        />
      </Suspense>

      <PlotColumns
        pins={pins}
        palette={palette}
        pendingPick={pickMode ? pendingPick : null}
        onHitTestReady={handlePinHitReady}
        reducedMotion={reducedMotion}
      />

      <Shockwave at={pendingPick} reducedMotion={reducedMotion} />
      <Atmosphere color={palette.oceanDeep} />

      <Rig focus={resolvedFocus} reducedMotion={reducedMotion} />

      {/*
        After the rig, and that ordering is load-bearing. Frame callbacks at
        equal priority run in mount order, and `useGlobeCamera`'s flight sits
        at the default priority inside `Rig` — a label layer that subscribes
        first projects against the camera's previous position and visibly
        trails its own markers for the length of every fly-to.
      */}
      <LabelSurface
        reducedMotion={reducedMotion}
        darkMode={darkMode}
        onSample={onLodSample}
      >
        <CountryLabels
          countries={countries}
          counts={countryAgg.counts}
          onActivate={pickMode ? undefined : onSelectCountry}
        />
        <CityLabels plots={paidPins} />
        <PlotLabels pins={pins} palette={palette} />
      </LabelSurface>
    </>
  )
}
