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
  jitterSeeds,
  vector3ToLatLng,
  type GlobePalette,
} from './geo'
import { Atmosphere } from './Atmosphere'
import { CityDensity } from './CityDensity'
import { CityLabels } from './CityLabels'
import { CountryBorders, type CountryInfo } from './CountryBorders'
import { CountryLabels } from './CountryLabels'
import { LogoMarkers } from './LogoMarkers'
import { PlotColumns, type PinHitTest } from './PlotColumns'
import { PlotLabels } from './PlotLabels'
import {
  CAMERA_MAX_DISTANCE,
  CAMERA_MIN_DISTANCE,
  MAX_LABELS,
  rotateSpeedForDistance,
  zoomSpeedForDistance,
} from './labelLayout'
import { MAX_LOGO_MARKERS } from './LogoMarkers'
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
/**
 * Idle spin. ZERO, and that is a fix rather than a saving.
 *
 * The globe used to turn on its own forever, at 0.28, from the moment it
 * mounted. A visitor who opened /world and read the headline before looking up
 * found the planet had drifted a quarter turn west into open Pacific: Russia,
 * the Philippines, Papua New Guinea and several thousand kilometres of empty
 * blue, with every YC company off the far side of the world. The most common
 * first impression of the page was therefore a blank ocean, and no amount of
 * choosing a good STARTING view fixes a camera that leaves it.
 *
 * OrbitControls cannot bounce — clamping the azimuth would stall the spin at a
 * wall and clamp the visitor's own drag with it — so "alive" is carried by the
 * things that carry it on purpose instead: the promoted beacons, the pin pops,
 * the pulse ticker, the region rail and the hub tour. The camera holds the
 * dense hemisphere until somebody asks it to move.
 *
 * Left as a named constant, wired through, and scaled with distance exactly as
 * before, so restoring an idle drift is one number.
 */
const AUTO_ROTATE_BASE = 0

/**
 * How much of the angle between the cursor and the screen centre a single
 * wheel gesture eats. Zoom-toward-cursor as a *rotation* of the camera rather
 * than by moving the orbit target — moving the target is a one-way trip on a
 * globe with panning disabled.
 */
const CURSOR_ZOOM_PULL = 0.25

/**
 * The cheapest claim that can exist, in cents. The unit the claim ramp is
 * anchored in — see `claimRampT` — and the same $5 floor the claim flow
 * enforces.
 */
const STAKE_FLOOR_CENTS = 500

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

/**
 * How long the camera takes to ease onto a country you just clicked.
 *
 * A third of a scripted flight (`DEFAULT_DURATION`, 1400ms) and with no swoop
 * at all. A region jump is a tour and is allowed to feel like one; clicking a
 * country is an INSPECTION — the panel is already opening, and a camera that
 * takes a second and a half to arrive is a camera the visitor is waiting on.
 * Long enough that the planet does not teleport, short enough that nothing
 * about it reads as a production.
 */
const SELECT_FLIGHT_MS = 420

/**
 * The far end of the camera envelope a selection is allowed to leave you at.
 *
 * A selection never zooms IN — losing your own zoom level because you clicked
 * something is the most annoying thing a map can do — but from the far end of
 * the envelope a country is a smudge, so a flight that starts beyond this
 * arrives here. Inside it, the distance is left exactly where the visitor put
 * it.
 */
const SELECT_MAX_DISTANCE = 2.6

/** A country the panel is showing, resolved to a point for the camera. */
interface SelectFocus extends GlobeFocus {
  iso: string
}

interface RigProps {
  focus?: GlobeFocus | null
  /**
   * The selected country's centroid, or null.
   *
   * Separate from `focus` rather than merged into it, because the two have
   * different owners and different lifetimes: `focus` is a page-level camera
   * instruction that persists after it lands (a region jump, a search result),
   * while this changes every time a visitor clicks a different country. Merging
   * them would mean a page holding a stale `focus` could silently swallow every
   * selection ease. Both go through the same `flyTo`, so whichever fires last
   * simply replaces the flight in progress — they cannot fight over the camera.
   */
  selectFocus?: SelectFocus | null
  reducedMotion: boolean
  /** Nudge the point under the cursor toward the centre while zooming in. */
  zoomToCursor?: boolean
  /**
   * The visitor took hold of the camera — a drag, a pinch, a wheel.
   *
   * The 2D map called this `onUserInteraction`, and it existed for one reason:
   * an automated camera (its tour, ours) that keeps yanking the view back while
   * somebody is trying to look at something is hostile. Fired on the gesture's
   * START, so a tour stops on the first pixel of the drag rather than at the end
   * of it.
   */
  onInteract?: () => void
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
function Rig({
  focus,
  selectFocus,
  reducedMotion,
  zoomToCursor = true,
  onInteract,
}: RigProps) {
  const controlsRef = useRef<OrbitTunable | null>(null)
  const resumeAt = useRef(0)
  const { flyTo, flying } = useGlobeCamera()
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)

  useFrame(() => {
    const controls = controlsRef.current
    if (!controls) return

    controls.autoRotate =
      AUTO_ROTATE_BASE > 0 &&
      !reducedMotion &&
      !flying.current &&
      performance.now() >= resumeAt.current

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

  /**
   * The selection ease.
   *
   * Gated on the ISO rather than on the object, because the centroid list is
   * rebuilt when the 10m topology replaces the 110m one — without the gate,
   * that upgrade would yank the camera back to the selected country several
   * seconds after the visitor had dragged away from it.
   */
  const flownTo = useRef<string | null>(null)

  useEffect(() => {
    const iso = selectFocus?.iso ?? null
    if (iso === flownTo.current) return
    flownTo.current = iso
    if (!selectFocus) return

    resumeAt.current = performance.now() + IDLE_RESUME_MS
    flyTo(selectFocus.lat, selectFocus.lng, {
      distance: Math.min(
        camera.position.length() || SELECT_MAX_DISTANCE,
        SELECT_MAX_DISTANCE,
      ),
      duration: SELECT_FLIGHT_MS,
      // No swoop. The camera is answering a click, not performing.
      arc: 0,
    })
  }, [selectFocus, flyTo, camera])

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
      autoRotate={AUTO_ROTATE_BASE > 0 && !reducedMotion}
      autoRotateSpeed={AUTO_ROTATE_BASE}
      onStart={() => {
        resumeAt.current = Number.POSITIVE_INFINITY
        onInteract?.()
      }}
      onEnd={() => {
        resumeAt.current = performance.now() + IDLE_RESUME_MS
      }}
    />
  )
}

// --- cursor ----------------------------------------------------------------

/**
 * One owner for the canvas cursor.
 *
 * Three things have an opinion about it — pick mode, a hovered country, a
 * hovered pin — and when they each wrote it themselves they fought: leaving a
 * pin over land cleared the cursor the country hover had just set, so the
 * pointer flickered back to an arrow over something that was still clickable.
 * Everything now reports upward and this writes the resolved answer once.
 */
function CanvasCursor({ cursor }: { cursor: string }) {
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    const el = gl.domElement
    el.style.cursor = cursor
    return () => {
      el.style.cursor = ''
    }
  }, [gl, cursor])

  return null
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
      onHover(null)
    }
    el.addEventListener('pointerenter', enter)
    el.addEventListener('pointerleave', leave)
    return () => {
      el.removeEventListener('pointerenter', enter)
      el.removeEventListener('pointerleave', leave)
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
    // A country is clickable; open water is not. The cursor says so — but it
    // is `CanvasCursor` that writes it, because a pin hover has an opinion too.
    onHover(iso2)
  })

  return null
}

// --- scene -----------------------------------------------------------------

/**
 * The `focus` shape the public component accepts.
 *
 * `distance` is optional on both arms and names the rung of the ladder to arrive
 * at — without it a coordinate lands at 1.8 and a country at 2.2, which is what
 * every existing caller keeps getting. It exists because the region jumps ported
 * from the 2D map are *framings*, not just centres: "Europe" at the same
 * distance as a single plot is a different tool than the one the old map had.
 * `tour.ts` converts those framings out of Mercator zoom.
 */
export type WorldGlobeFocus =
  | { lat: number; lng: number; distance?: number }
  | { iso: string; distance?: number }

export interface GlobeSceneProps {
  pins: GlobePin[]
  palette: GlobePalette
  darkMode: boolean
  focus?: WorldGlobeFocus | null
  /**
   * ISO-3166 alpha-2 of the country the page is showing, or null.
   *
   * The globe does NOT own this. It reports a click through `onSelectCountry`
   * and then draws whatever comes back down here — so the map and the panel
   * cannot disagree about what is selected, and a selection arriving from
   * somewhere else entirely (a URL, a board row, the back button) lights the
   * territory exactly as a click would.
   */
  selectedIso?: string | null
  /** Click-to-place mode for the claim flow. */
  pickMode?: boolean
  onPick?: (p: { lat: number; lng: number }) => void
  onSelectPlot?: (id: number) => void
  /**
   * A seed was clicked — an imported company nobody has staked yet.
   *
   * Without this a seed click falls through to its country, which is the right
   * default for a mark with no detail page but the wrong one once something
   * upstairs can offer to claim it. The pin handed over carries the pin's
   * ORIGINAL feed coordinates, not the jittered ones this scene draws.
   */
  onSelectSeed?: (pin: GlobePin) => void
  onSelectCountry?: (iso: string) => void
  /**
   * The pin under the cursor, or null. Fires on change only — never per frame —
   * so the wrapper can put a tooltip beside it.
   */
  onHoverPin?: (pin: GlobePin | null) => void
  /** Raised when the frame rate will not hold; the wrapper drops pixel ratio. */
  onPerformanceDecline?: () => void
  /** Level-of-detail telemetry, throttled to ~4Hz. For a dev harness. */
  onLodSample?: (sample: LodSample) => void
  /**
   * Company logos on their pins. On by default, and forced off in pick mode —
   * a tile that eats a click is the last thing a flow asking for a coordinate
   * needs. See `LogoMarkers`.
   */
  logoMarkers?: boolean
  /** The city-density overlay. Off by default; see `CityDensity`. */
  density?: boolean
  /** The visitor grabbed the camera. Wired to the tour's stop button. */
  onInteract?: () => void
}

export function GlobeScene({
  pins: feedPins,
  palette,
  darkMode,
  focus,
  selectedIso = null,
  pickMode = false,
  onPick,
  onSelectPlot,
  onSelectSeed,
  onSelectCountry,
  onHoverPin,
  onPerformanceDecline,
  onLodSample,
  logoMarkers = true,
  density = false,
  onInteract,
}: GlobeSceneProps) {
  const reducedMotion = usePrefersReducedMotion()

  /**
   * The pin set every layer below this line works from.
   *
   * The jitter is applied HERE, at the top, and nowhere else. `countryAgg`,
   * `paidPins`, `PlotColumns`' instance matrices and its hit test, `PlotLabels`,
   * `CityLabels` and the LOD budget all derive from this one array — so what is
   * drawn, what the cursor finds and what a click resolves to are the same
   * coordinates by construction. Jitter applied further down would put the
   * markers somewhere the hit test could not find them, which is a worse bug
   * than the one it fixes.
   *
   * Paid plots pass through untouched, by reference — see `jitterSeeds`.
   */
  const pins = useMemo(() => jitterSeeds(feedPins), [feedPins])

  /**
   * Feed coordinates, by id, so a click can hand back the pin the SERVER sent.
   *
   * A consumer only needs id/name/company_slug, all of which survive the
   * jitter — but handing out a coordinate this file invented, to a caller that
   * might well store or display it, is how invented coordinates get into a
   * database. Cheap enough: one Map per data change.
   */
  const feedById = useMemo(() => {
    const m = new Map<string, GlobePin>()
    for (const p of feedPins) m.set(p.id, p)
    return m
  }, [feedPins])

  const [hoveredIso2, setHoveredIso2] = useState<string | null>(null)
  /**
   * Whether a pin is under the cursor — the cursor shape depends on it.
   *
   * State rather than a ref because it feeds a render, and cheap because it
   * changes only when the hovered pin CHANGES: the scan underneath runs at
   * 16Hz but reports on transitions.
   */
  const [pinHovered, setPinHovered] = useState(false)
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

  const handleHoverPin = useCallback(
    (pin: GlobePin | null) => {
      setPinHovered(Boolean(pin))
      onHoverPin?.(pin)
    },
    [onHoverPin],
  )

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
   * Which countries hold paid pins, and how heavily. This is the territory map.
   *
   * The API does not ship a per-pin country, so paid pins are resolved through
   * the same point-in-polygon index the cursor uses. Seeds are excluded by
   * construction — an unclaimed company must never colour a country in. The
   * scan is a few dozen operations per paid pin and reruns only when the pins
   * or the topology change.
   *
   * THE WEIGHT IS REAL MONEY WHERE THERE IS REAL MONEY. `total_cents` is the
   * exact stake and the globe feed carries it on every paid plot, so a country
   * sits on the claim ramp at the height its board actually paid for — which is
   * the whole promise of colouring countries in at all.
   *
   * Counted in $5 FLOORS rather than in dollars, because that is the unit
   * `claimRampT` documents its anchor in: one floor is the cheapest claim that
   * can exist, and it is the bottom of the ramp. A plot the feed sent without a
   * stake contributes exactly one floor — the smallest claim there is — rather
   * than a guess at what it might have been. Nothing here invents a number.
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
        const floors =
          typeof p.total_cents === 'number' && p.total_cents > 0
            ? Math.max(p.total_cents / STAKE_FLOOR_CENTS, 1)
            : 1
        weights.set(iso, (weights.get(iso) ?? 0) + floors)
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
      return c
        ? { lat: c.lat, lng: c.lng, distance: focus.distance ?? 2.2 }
        : null
    }
    return {
      lat: focus.lat,
      lng: focus.lng,
      // 1.8 remains the default — a plot, a pick, a search result all want to
      // arrive at the same rung. A caller that has an opinion (a region jump, a
      // hub tour stop) says so.
      distance: focus.distance ?? 1.8,
    }
  }, [focus, countryByIso])

  /**
   * The selected country, resolved to the point the camera eases onto.
   *
   * Waits for the topology: before the centroids exist there is nothing to fly
   * to, and re-running when `countryByIso` arrives is what makes a selection
   * restored from a URL land correctly on a cold load. `Rig` gates the actual
   * flight on the ISO, so the 110m→10m upgrade re-resolving this does not fire
   * a second one.
   */
  const selectFocus = useMemo<SelectFocus | null>(() => {
    if (!selectedIso) return null
    const iso = selectedIso.toUpperCase()
    const c = countryByIso.get(iso)
    return c ? { iso, lat: c.lat, lng: c.lng } : null
  }, [selectedIso, countryByIso])

  // ---- picking -------------------------------------------------------------

  /** Ghost marker at the last picked spot, pick mode only. */
  const [pendingPick, setPendingPick] = useState<{
    lat: number
    lng: number
  } | null>(null)

  useEffect(() => {
    if (!pickMode) setPendingPick(null)
  }, [pickMode])

  /**
   * THE COUNTRY IS THE UNIT. That is what this whole file is arranged around.
   *
   * A click resolves in strict order: pick mode wins outright (the refinement
   * flow asked for a coordinate and gets exactly the pixel that was clicked),
   * then a PAID plot under the cursor, then the country, then nothing.
   *
   * What changed, and why: a seed bead no longer eats a ground click. There are
   * 5,579 of them scattered over land, each answering the cursor within about
   * fifteen pixels, so with seeds in the chain "click a country" was a coin
   * flip over most of North America and Europe — the visitor aimed at Germany
   * and got a dialog about a company they had never heard of. Seeds are context
   * for the territory, not targets on it, so they now fall through to the
   * country underneath exactly as open land does.
   *
   * `onSelectSeed` is NOT dead: a seed is still opened from its logo tile,
   * which is a real DOM button, is reachable by keyboard, and is something the
   * visitor has to aim at deliberately. See `handleSelectPin`.
   */
  /**
   * Open a pin, or report that nobody upstairs wants it opened.
   *
   * Shared by the canvas click and the logo tiles, so a company opens the same
   * way whether the visitor aimed at its bead or at its logo. Returns false when
   * the click was not consumed, which is what lets each caller apply its own
   * fallback — the canvas falls through to the country under the CURSOR, the
   * tile to the country under the PIN.
   */
  const openPin = useCallback(
    (pin: GlobePin): boolean => {
      if (pin.kind === 'plot' && onSelectPlot) {
        const numeric = Number(pin.id)
        if (Number.isFinite(numeric)) {
          onSelectPlot(numeric)
          return true
        }
      }

      if (pin.kind === 'seed' && onSelectSeed) {
        // The feed's pin, not the drawn one: `pins` is jittered, and a
        // coordinate this file invented must not leave it. Falls back to the
        // drawn pin only if the id is somehow not in the feed map, which keeps
        // id/name/company_slug — the three fields a consumer actually needs —
        // correct either way.
        onSelectSeed(feedById.get(pin.id) ?? pin)
        return true
      }

      return false
    },
    [onSelectPlot, onSelectSeed, feedById],
  )

  const handlePick = useCallback(
    (lat: number, lng: number) => {
      if (pickMode) {
        if (!onPick) return
        // A fresh object each time, so the ghost re-arms on a repeat pick.
        setPendingPick({ lat, lng })
        onPick({ lat, lng })
        return
      }

      /*
       * THE VISITOR HAS TAKEN OVER.
       *
       * `onInteract` used to fire only on a camera gesture, which is how the
       * page stops the hub tour. A click was not a gesture — so a visitor who
       * picked a country while a tour was running got their selection, their
       * panel, their 420ms ease, and then, a few seconds later, the tour flying
       * the camera off to the next hub. An automated camera that overrides the
       * thing you just asked for is the worst version of the drift this page is
       * meant to have stopped doing. Choosing something IS taking control, and
       * it is reported as such.
       */
      onInteract?.()

      // Paid plots only. A seed under the cursor is treated as the ground it
      // is standing on — see the note above `openPin`.
      const pin = pinHitRef.current?.(lat, lng) ?? null
      if (pin && pin.kind === 'plot' && openPin(pin)) return

      const iso2 = lookupRef.current?.(lat, lng) ?? null
      if (iso2 && onSelectCountry) onSelectCountry(iso2)
    },
    [pickMode, onPick, openPin, onSelectCountry, onInteract],
  )

  /**
   * A country PILL was pressed — the keyboard-reachable way to do what a click
   * on the territory does, and the same handover of camera control with it.
   */
  const handleActivateCountry = useCallback(
    (iso2: string) => {
      onInteract?.()
      onSelectCountry?.(iso2)
    },
    [onInteract, onSelectCountry],
  )

  /** A logo tile was pressed. Same routing, its own country fallback. */
  const handleSelectPin = useCallback(
    (pin: GlobePin) => {
      onInteract?.()
      if (openPin(pin)) return
      const iso2 = lookupRef.current?.(pin.lat, pin.lng) ?? null
      if (iso2 && onSelectCountry) onSelectCountry(iso2)
    },
    [openPin, onSelectCountry, onInteract],
  )

  /**
   * Which pins are carrying a logo tile this frame, and how wide it is.
   *
   * A frame-scoped handoff between two sibling label layers — `LogoMarkers`
   * writes it, `PlotLabels` reads it to step its pill clear of the tile — held
   * in a ref because it is rewritten sixty times a second and neither layer is
   * a React consumer of it. Mount order in the surface below is what makes the
   * read fresh rather than a frame stale.
   */
  const logoClaims = useRef<Map<string, number> | null>(new Map())

  const clickable =
    pickMode ||
    Boolean(onSelectCountry) ||
    Boolean(onSelectPlot) ||
    Boolean(onSelectSeed)

  /**
   * The one cursor, resolved from every opinion at once.
   *
   * Pick mode wins outright: a crosshair over the canvas is now the WHOLE of
   * how "choose a spot" is said. It used to be half of it — the other half was
   * a shader-drawn target ring that tracked the cursor across the sphere,
   * pulsing an outward front once a second, under a second orange donut that
   * fired on every click. That was the animation the owner rejected, and it is
   * gone: three layers of orange ceremony in front of a decision that is now an
   * optional refinement after payment rather than a barrier before it.
   *
   * Below pick mode, anything the click would open makes a pointer.
   */
  const cursor = pickMode
    ? 'crosshair'
    : pinHovered || (hoveredIso2 && onSelectCountry)
      ? 'pointer'
      : ''

  return (
    <>
      {onPerformanceDecline && (
        <PerformanceMonitor onDecline={onPerformanceDecline} />
      )}

      <CanvasCursor cursor={cursor} />

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
          // In pick mode the map is a coordinate surface, not a board: draining
          // the world for a selected country would fight the one job it has.
          selectedIso2={pickMode ? null : selectedIso}
          reducedMotion={reducedMotion}
          onLookupReady={handleLookupReady}
          onCountriesReady={handleCountriesReady}
        />
      </Suspense>

      {/* Under the pins, over the ground: the aggregate is context for the
          markers, never something drawn on top of them. */}
      <CityDensity pins={feedPins} palette={palette} enabled={density} />

      <PlotColumns
        pins={pins}
        palette={palette}
        pendingPick={pickMode ? pendingPick : null}
        // In pick mode every pixel is a valid answer, so ringing the nearest
        // existing pin would promise an action the click will not perform.
        hoverEnabled={!pickMode}
        onHoverPin={handleHoverPin}
        onHitTestReady={handlePinHitReady}
        reducedMotion={reducedMotion}
        density={density}
      />

      <Atmosphere color={palette.halo} />

      <Rig
        focus={resolvedFocus}
        selectFocus={pickMode ? null : selectFocus}
        reducedMotion={reducedMotion}
        onInteract={onInteract}
      />

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
        /*
          The overlay's cap is shared by every layer registered with it, and the
          logo tiles are now one of those layers — at a priority above every text
          pill. Left at 120 they would simply take the whole budget in a crowded
          city and the place names would stop being drawn, which is the label
          system working exactly as designed and a map that is worse for it.
          Raised by the tiles' own cap, so the type budget is the 120 it always
          was and the tiles are additional to it rather than carved out of it.
        */
        maxLabels={MAX_LABELS + MAX_LOGO_MARKERS}
      >
        <CountryLabels
          countries={countries}
          counts={countryAgg.counts}
          selectedIso2={pickMode ? null : selectedIso}
          onActivate={
            pickMode || !onSelectCountry ? undefined : handleActivateCountry
          }
          // The pill covers the canvas while the cursor is on it, so without
          // this the country would go dark exactly as its label is being aimed
          // at. Off in pick mode, where the pills are not pressable at all.
          onHover={pickMode ? undefined : handleHover}
        />
        <CityLabels plots={paidPins} />
        {/*
          Ahead of PlotLabels, and that ordering is load-bearing: layers collect
          in mount order within a single frame, and the pill layer reads the
          claim map the tile layer has just written. Mounted unconditionally so
          that turning the tiles off still clears the map on the next frame,
          rather than leaving every pill stepping around a tile that is gone.
        */}
        <LogoMarkers
          pins={pins}
          enabled={logoMarkers && !pickMode}
          onSelectPin={handleSelectPin}
          onHoverPin={handleHoverPin}
          claimed={logoClaims}
        />
        <PlotLabels pins={pins} palette={palette} logoClaims={logoClaims} />
      </LabelSurface>
    </>
  )
}
