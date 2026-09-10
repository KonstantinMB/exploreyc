/*
 * Every three.js object in a react-three-fiber scene is a memoised geometry,
 * material, texture or canvas context written to imperatively — per frame, in
 * the case of uniforms. The objects are GPU resources, not React state.
 */

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { GlobePin } from '../../../lib/worldApi'
import {
  GLOBE_RADIUS,
  YC_ORANGE,
  latLngToVector3,
  markerColor,
  tierToHeight,
  type GlobePalette,
} from './geo'

/**
 * Every pin on the globe, as one draw call.
 *
 * A single `InstancedMesh` — at 22,000 seed pins the alternative is 22,000
 * meshes, matrix updates and draw calls per frame, and the frame budget is
 * gone before anything is drawn. The per-instance transform goes in through a
 * shared dummy `Object3D`; the colour through `setColorAt`.
 *
 * A pin is a *marker*: a small opaque bead in its colour with a white ring and
 * darker rim, sitting on the surface. The bead is a camera-facing quad, not a
 * sphere — two triangles, with the roundness done by a `length()` in the
 * fragment shader — and it is opaque, so the clusters around London and Tokyo
 * resolve by depth instead of accumulating into a smear.
 *
 * Three states, told apart at a glance:
 *  - **seed** (an imported company nobody claimed): `SEED_RADIUS`, two thirds
 *    the width of the cheapest paid pin, in the palest colour on the map.
 *    Present, clearly unowned, obviously claimable — never mistakable for a
 *    stake, and never so small it stops being a mark at all.
 *  - **plot** (someone paid): full radius, slate ramp deepening with tier.
 *  - **promoted**: YC orange — the only saturated hue on the globe — plus a
 *    pulsing beacon ring so it reads from any distance. The always-visible
 *    "Promoted" text lives in `PlotLabels`, which never drops promoted pills.
 *
 * Whichever bead the cursor finds also gets an orange halo, so "which of these
 * am I about to click" is answered before the tooltip says a word.
 *
 * Hover is deliberately *not* wired through r3f pointer events, which raycast
 * every registered object on every pointermove. The mesh opts out and this
 * component runs its own throttled nearest-pin scan from `useFrame`.
 */

/**
 * Marker radius per unit of `tierToHeight`, in globe radii.
 *
 * FIVE TIMES the 0.072 this shipped with, and that was not a taste call. At the
 * default camera (distance 3.45, fov 38) one globe radius is about 295 CSS
 * pixels on a 700px-tall canvas, so the old scale drew the cheapest paid pin at
 * a radius of 0.0025 radii — three quarters of ONE PIXEL — and a seed at a
 * quarter of a pixel. The map was covered in marks nobody could see, let alone
 * aim at. At 0.36 the same ladder measures roughly:
 *
 *   seed (tier 0, x0.78) .....  3px across
 *   tier 1 ($5-$49) ..........  7px
 *   tier 2 ($50-$249) ........ 11px
 *   tier 3 ($250-$999) ....... 15px
 *   tier 4 ($1,000+) ......... 18px
 *
 * — a legible ladder where stake is readable as size, and every paid pin is a
 * target a hand can hit.
 */
const MARKER_SCALE = 0.36

/**
 * Seed radius, as a multiple of the tier-0 rung of the same ladder.
 *
 * Raised from 0.78, and it crosses 1.0 on purpose. **Tier 0 is the seed's own
 * rung** — `stakeBand` in geo.ts spells out the backend's buckets, and a paid
 * plot is never below tier 1 — so nothing on the ladder is being overtaken;
 * this is a seed being sized against a rung no stake occupies.
 *
 * The old 0.78 drew a seed 3.0 px across, and the marker shader spends the
 * outer 40% of every bead on its white ring and the outer 14% on the darker
 * edge. At 3 px that leaves 1.8 px of actual colour and one pixel of ring: the
 * three-zone marker collapses into a grey speck, which is most of why a globe
 * carrying 5,579 pins read as an empty globe. At 1.30 the ladder measures:
 *
 *   seed (tier 0, x1.30) .....  5.0px    <- was 3.0px
 *   tier 1 ($5-$49) ..........  7.4px
 *   tier 2 ($50-$249) ........ 11.0px
 *   tier 3 ($250-$999) ....... 14.7px
 *   tier 4 ($1,000+) ......... 18.3px
 *
 * A seed is still two thirds of the cheapest paid pin's width and under half
 * its area, still the palest colour on the map, and still the only mark that
 * never pops. Smaller and quieter — but no longer a rendering artefact.
 */
const SEED_RADIUS_FACTOR = 1.3

/**
 * The seed bead's radius, in globe radii.
 *
 * Pinned to tier 0 rather than read off `pin.tier`, so a feed that ever ships a
 * seed carrying a stake bucket cannot inflate an unclaimed company to the size
 * of a $1,000 stake. A seed is tier 0 by definition; this makes it so by
 * construction.
 */
const SEED_RADIUS = tierToHeight(0) * MARKER_SCALE * SEED_RADIUS_FACTOR

/** Seconds between pops. Slow enough to be an event, not a strobe. */
const POP_INTERVAL = 2.4
/** Seconds a single pop lasts. */
const POP_DURATION = 0.9
/**
 * Peak extra radius, as a fraction of the pin's own.
 *
 * Halved when the beads grew fivefold: 1.6 on a pin you could barely see was a
 * flourish that made it findable, and the same 1.6 on a tier-4 bead is a 47px
 * disc erupting out of a city. The pop is meant to read as a heartbeat.
 */
const POP_GAIN = 0.85
/** Peak extra lift off the surface, as a fraction of the pin's own radius. */
const POP_LIFT = 1.4

/* Module-scope scratch objects: the pop loop runs every frame and allocating a
   Vector3 and an Object3D per frame is garbage the collector has to chase. */
const popDummy = new THREE.Object3D()
const popDir = new THREE.Vector3()
/** Ghost marker radius. Larger than any real pin — it is a cursor, not a bid. */
const GHOST_RADIUS = 0.046
/** Beacon quad half-width, in globe radii. Sized to ring the biggest bead. */
const BEACON_RADIUS = 0.062
/** Hover halo half-width, as a multiple of the pin's own radius. */
const HALO_GAIN = 2.6
/** …and never smaller than this, so a hovered seed still gets a real ring. */
const HALO_MIN = 0.02
/** Instance capacity is rounded up to this, so a trickle of new pins does not
 *  reallocate the buffer on every arrival. */
const CAPACITY_STEP = 512
/**
 * Hover slack as a fraction of camera distance.
 *
 * Constant in SCREEN terms by construction — the projected size of a world-unit
 * length is inversely proportional to camera distance, so scaling the tolerance
 * with distance keeps the grab radius the same everywhere. At 0.011 that is
 * roughly eleven pixels, which is a little wider than the largest bead: the
 * cursor should be able to sit just off a pin and still find it, because
 * hovering a pin is how a visitor discovers a pin is a thing at all.
 */
const HOVER_TOLERANCE = 0.011

/**
 * Camera-facing billboard, sized in world units.
 *
 * The instance matrix is read directly rather than applied: column 3 is the
 * centre, and the length of column 0 is the radius. Offsetting in *view* space
 * after the model-view transform is what makes the quad face the camera.
 * Written to work with and without instancing, so the pending-pick ghost can
 * share the material and stay identical to a real marker.
 */
const MARKER_VERT = /* glsl */ `
  uniform float uScale;
  uniform vec3 uTint;

  varying vec2 vQuad;
  varying vec3 vFill;

  void main() {
    vQuad = position.xy;

    vec3 tint = uTint;
    #ifdef USE_INSTANCING_COLOR
      tint *= instanceColor;
    #endif
    vFill = tint;

    vec3 centre = vec3(0.0);
    float size = uScale;
    #ifdef USE_INSTANCING
      centre = instanceMatrix[3].xyz;
      size *= length(instanceMatrix[0].xyz);
    #endif

    vec4 mv = modelViewMatrix * vec4(centre, 1.0);
    mv.xy += position.xy * size;
    gl_Position = projectionMatrix * mv;
  }
`

const MARKER_FRAG = /* glsl */ `
  varying vec2 vQuad;
  varying vec3 vFill;

  void main() {
    float d = length(vQuad);
    if (d > 1.0) discard;

    // A flat sticker, in three concentric zones:
    //
    //     solid core  |  white ring  |  thin darker edge
    //
    // The white ring is borrowed from printed maps: a pin surrounded by paper
    // reads at any size against any background, so tier colour can keep
    // meaning rank instead of fighting the terrain underneath it.
    vec3 edgeCol = vFill * 0.62;

    float toRing = smoothstep(0.60, 0.70, d);
    float toEdge = smoothstep(0.86, 0.94, d);

    vec3 col = mix(vFill, vec3(1.0), toRing);
    col = mix(col, edgeCol, toEdge);

    // Alpha feathers the last texel of the circle. The material is opaque and
    // uses alpha-to-coverage, so this is antialiasing, not transparency — the
    // markers still depth-sort against each other and never blend into mud.
    float a = 1.0 - smoothstep(0.94, 1.0, d);
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }
`

/**
 * The beacon over a promoted pin: a ring that breathes outward and fades, on a
 * camera-facing quad just above the bead. Its own shader rather than a reuse
 * of the marker's because the ring animates in sample space — the quad never
 * changes size, so the instance buffer is never touched.
 *
 * With reduced motion the ring holds still at ~70% radius: the *presence* of
 * the beacon is information (this pin paid for placement) and must survive;
 * only the pulse is decoration.
 */
const BEACON_VERT = /* glsl */ `
  uniform float uScale;

  varying vec2 vQuad;
  varying float vFacing;

  void main() {
    vQuad = position.xy;

    vec3 centre = vec3(0.0);
    float size = uScale;
    #ifdef USE_INSTANCING
      centre = instanceMatrix[3].xyz;
      size *= length(instanceMatrix[0].xyz);
    #endif

    vec4 world = modelMatrix * vec4(centre, 1.0);
    vFacing = dot(normalize(world.xyz), normalize(cameraPosition - world.xyz));

    vec4 mv = modelViewMatrix * vec4(centre, 1.0);
    mv.xy += position.xy * size;
    gl_Position = projectionMatrix * mv;
  }
`

const BEACON_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uStatic;

  varying vec2 vQuad;
  varying float vFacing;

  void main() {
    // The pin is on the far side of the planet. Nothing to signal.
    if (vFacing < 0.04) discard;
    float limb = smoothstep(0.04, 0.18, vFacing);

    float d = length(vQuad);
    if (d > 1.0) discard;

    float a;
    if (uStatic > 0.5) {
      // Reduced motion: a steady double ring.
      float ring = 1.0 - smoothstep(0.05, 0.10, abs(d - 0.68));
      float core = 1.0 - smoothstep(0.02, 0.07, abs(d - 0.34));
      a = max(ring, core * 0.7) * 0.85;
    } else {
      // A front that expands from the bead and dissolves, twice a period so
      // the beacon never goes fully dark between pulses.
      float t = fract(uTime * 0.55);
      float r1 = t;
      float r2 = fract(t + 0.5);
      float w1 = (1.0 - smoothstep(0.0, 0.09, abs(d - r1))) * (1.0 - r1);
      float w2 = (1.0 - smoothstep(0.0, 0.09, abs(d - r2))) * (1.0 - r2);
      a = clamp(w1 + w2, 0.0, 1.0) * 0.9;
    }

    gl_FragColor = vec4(uColor, a * limb);
    #include <colorspace_fragment>
  }
`

/**
 * The hover halo: a ring around the bead the cursor has found.
 *
 * The same camera-facing quad as everything else here, drawn without instancing
 * — there is only ever one hovered pin — and positioned by moving the mesh
 * itself. Its job is to answer "which of these am I about to click?" before the
 * tooltip has said anything, so it is YC orange and it is unmissable at the
 * size the pins are now drawn.
 *
 * Under reduced motion the ring simply holds still; the *presence* of the ring
 * is the information, the breathing is decoration.
 */
const HALO_VERT = /* glsl */ `
  uniform float uScale;

  varying vec2 vQuad;

  void main() {
    vQuad = position.xy;
    // Never instanced: the mesh's own transform is the pin's position.
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mv.xy += position.xy * uScale;
    gl_Position = projectionMatrix * mv;
  }
`

const HALO_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uStatic;
  /** 1 while the pointer is held down on the hovered pin. */
  uniform float uPress;

  varying vec2 vQuad;

  void main() {
    float d = length(vQuad);
    if (d > 1.0) discard;

    float r = uStatic > 0.5 ? 0.74 : 0.70 + 0.05 * sin(uTime * 3.6);
    // The press: the ring snaps in against the bead. A canvas has no :active,
    // so the only way a pin can acknowledge being pressed is to draw it — and a
    // control that does not acknowledge the press is a control people click
    // twice.
    r *= mix(1.0, 0.82, uPress);
    float ring = 1.0 - smoothstep(0.0, 0.13, abs(d - r));
    // A faint wash inside the ring so the halo reads as a highlighted target
    // rather than as a second, hollow pin.
    float wash = (1.0 - smoothstep(0.0, r, d)) * 0.16;

    gl_FragColor = vec4(uColor, clamp(ring * 0.9 + wash, 0.0, 1.0));
    #include <colorspace_fragment>
  }
`

function makeMarkerMaterial(
  scale: number,
  tint = '#ffffff',
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: MARKER_VERT,
    fragmentShader: MARKER_FRAG,
    uniforms: {
      uScale: { value: scale },
      uTint: { value: new THREE.Color(tint) },
    },
    // Opaque on purpose. Transparent markers with depth writes off would blend
    // wherever a cluster overlaps, and a cluster is exactly where the map is
    // most interesting. `alphaToCoverage` recovers the smooth circle edge from
    // the multisample buffer instead.
    transparent: false,
    depthWrite: true,
    alphaToCoverage: true,
    // The quad is built in view space, so its winding is whatever the vertex
    // shader leaves it as. Cheaper to draw both faces than to reason about it.
    side: THREE.DoubleSide,
    toneMapped: false,
  })
}

/** Coordinate → the pin under it, with the same slack the hover scan uses. */
export type PinHitTest = (lat: number, lng: number) => GlobePin | null

export interface PlotColumnsProps {
  pins: readonly GlobePin[]
  palette: GlobePalette
  /** Ghost marker at the coordinate the visitor is choosing. */
  pendingPick?: { lat: number; lng: number } | null
  /**
   * Turn the hover scan (and with it the halo) off.
   *
   * Pick mode does exactly this: the visitor is choosing a coordinate, every
   * pixel is a valid answer, and ringing whichever existing pin happens to be
   * nearby would promise an action the click will not perform.
   */
  hoverEnabled?: boolean
  onHoverPin?: (pin: GlobePin | null) => void
  /**
   * Handed back on mount: resolves a surface coordinate to the nearest pin
   * within ~10 screen pixels, or null. The scene's click handler uses it to
   * route a click to a pin before falling through to the country.
   */
  onHitTestReady?: (test: PinHitTest) => void
  reducedMotion?: boolean
}

export function PlotColumns({
  pins,
  palette,
  pendingPick,
  hoverEnabled = true,
  onHoverPin,
  onHitTestReady,
  reducedMotion = false,
}: PlotColumnsProps) {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const pointer = useThree((s) => s.pointer)

  // Two triangles, corners at ±1. The fragment shader turns it into a circle.
  const geometry = useMemo(() => new THREE.PlaneGeometry(2, 2, 1, 1), [])

  // Instanced markers carry their size in the instance matrix, so the uniform
  // is a pass-through 1.
  const material = useMemo(() => makeMarkerMaterial(1), [])

  /**
   * Markers hold their size on SCREEN as the camera moves.
   *
   * Their radius is baked into the instance matrix in WORLD units, which is
   * correct for the globe view and wrong everywhere below it: a marker roughly
   * 100 km across is a pinhead from orbit and, at the camera floor, a quarter
   * of the frame. Compensating linearly with distance — the exact inverse of
   * how perspective shrinks things — makes a pin the same handful of pixels at
   * every zoom, which is what every map a visitor has ever used does and what
   * makes a pin reliably clickable rather than a moving target.
   *
   * (It used to be exponent 1.35, deliberately over-compensating so pins shrank
   * as you dove into a city. With pins this small that meant the closer you got
   * to a plot the harder it was to hit, which is precisely backwards.)
   *
   * Clamped at 1 above distance 2.9 so the world view keeps its composition and
   * the pins recede honestly as you pull away, and floored at 0.42 so the
   * bottom of the zoom cannot inflate them into saucers.
   */
  const markerScaleRef = useRef(1)

  useFrame(({ camera: cam }) => {
    const d = cam.position.length()
    const f = Math.min(1, Math.max(0.42, d / 2.9))
    markerScaleRef.current = f
    material.uniforms.uScale.value = f
  })

  const ghostMaterial = useMemo(
    () => makeMarkerMaterial(GHOST_RADIUS, YC_ORANGE),
    [],
  )

  const beaconMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: BEACON_VERT,
        fragmentShader: BEACON_FRAG,
        uniforms: {
          uScale: { value: 1 },
          uColor: { value: new THREE.Color(YC_ORANGE) },
          uTime: { value: 0 },
          uStatic: { value: reducedMotion ? 1 : 0 },
        },
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    // Reduced motion flips a uniform below rather than rebuilding the shader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useEffect(() => {
    beaconMaterial.uniforms.uStatic.value = reducedMotion ? 1 : 0
  }, [beaconMaterial, reducedMotion])

  /**
   * The hover halo's material. One mesh, moved to whichever pin is under the
   * cursor — see the hover scan below.
   */
  const haloMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: HALO_VERT,
        fragmentShader: HALO_FRAG,
        uniforms: {
          uScale: { value: HALO_MIN },
          uColor: { value: new THREE.Color(YC_ORANGE) },
          uTime: { value: 0 },
          uStatic: { value: reducedMotion ? 1 : 0 },
          uPress: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        // Over everything: the halo is a cursor state, and a cursor state that
        // can be occluded by the bead it is ringing is not a cursor state. Only
        // ever drawn on the near hemisphere, because that is where the hover
        // raycast can hit.
        depthTest: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    // Reduced motion flips a uniform below rather than rebuilding the shader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useEffect(() => {
    haloMaterial.uniforms.uStatic.value = reducedMotion ? 1 : 0
  }, [haloMaterial, reducedMotion])

  /** Halo half-width in world units before the zoom compensation below. */
  const haloBaseRef = useRef(HALO_MIN)

  useFrame((state) => {
    beaconMaterial.uniforms.uTime.value = state.clock.elapsedTime
    haloMaterial.uniforms.uTime.value = state.clock.elapsedTime
    // Beacon and halo track the marker's own screen-size compensation, so a
    // promoted ring and a hover ring never drift out of step with their bead.
    beaconMaterial.uniforms.uScale.value = markerScaleRef.current
    haloMaterial.uniforms.uScale.value =
      haloBaseRef.current * markerScaleRef.current
  })

  const ghostRingGeometry = useMemo(() => new THREE.RingGeometry(0.72, 1, 40), [])
  const ghostRingMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(YC_ORANGE),
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  )

  const capacity = Math.max(
    CAPACITY_STEP,
    Math.ceil(Math.max(pins.length, 1) / CAPACITY_STEP) * CAPACITY_STEP,
  )

  /** Promoted pins get their own tiny instanced mesh for the beacon quads. */
  const promoted = useMemo(() => pins.filter((p) => p.promoted), [pins])
  const beaconCapacity = Math.max(16, Math.ceil(promoted.length / 16) * 16)

  const meshRef = useRef<THREE.InstancedMesh>(null)
  const beaconRef = useRef<THREE.InstancedMesh>(null)

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
      ghostMaterial.dispose()
      beaconMaterial.dispose()
      haloMaterial.dispose()
      ghostRingGeometry.dispose()
      ghostRingMaterial.dispose()
    },
    [
      geometry,
      material,
      ghostMaterial,
      beaconMaterial,
      haloMaterial,
      ghostRingGeometry,
      ghostRingMaterial,
    ],
  )

  // ---- instance transforms -------------------------------------------------

  /** Unit surface direction per pin, xyz-interleaved. Rebuilt with `pins`. */
  const directions = useRef(new Float32Array(0))
  /*
    THE POP.

    Base radius per instance, plus the indices of the pins somebody actually
    paid for. Both are captured while the instance matrices are built. The pop
    must never touch a seed: 22,000 imported listings twitching would read as
    noise on the map; paying customers surfacing one after another reads as a
    heartbeat.
  */
  const baseRadii = useRef(new Float32Array(0))
  const paidIndices = useRef<number[]>([])
  /** index -> the clock time its pop started. */
  const pops = useRef(new Map<number, number>())
  const nextPop = useRef(0)

  useLayoutEffect(() => {
    const instanced = meshRef.current
    if (!instanced) return

    const dummy = new THREE.Object3D()
    const color = new THREE.Color()
    const dir = new THREE.Vector3()
    const dirs = new Float32Array(pins.length * 3)
    const radii = new Float32Array(pins.length)
    const paid: number[] = []

    for (let i = 0; i < pins.length; i += 1) {
      const pin = pins[i]
      /*
        A SEED IS NOT A BID, so it does not get a bid's presence: a fixed
        SEED_RADIUS below every paid rung, in the palest colour on the map.
        Present and obviously claimable, never mistakable for a stake.
      */
      const isSeed = pin.kind === 'seed'
      const radius = isSeed ? SEED_RADIUS : tierToHeight(pin.tier) * MARKER_SCALE

      dir.copy(latLngToVector3(pin.lat, pin.lng, 1))
      dirs[i * 3] = dir.x
      dirs[i * 3 + 1] = dir.y
      dirs[i * 3 + 2] = dir.z

      radii[i] = radius
      if (!isSeed) paid.push(i)

      // Lifted by most of its own radius so the bead sits *on* the ground
      // rather than half-buried in it.
      dummy.position.copy(dir).multiplyScalar(GLOBE_RADIUS + radius * 0.62)
      dummy.scale.setScalar(radius)
      dummy.updateMatrix()
      instanced.setMatrixAt(i, dummy.matrix)

      color.set(markerColor(palette.markers, pin.kind, pin.tier, pin.promoted))
      instanced.setColorAt(i, color)
    }

    directions.current = dirs
    baseRadii.current = radii
    paidIndices.current = paid
    pops.current.clear()
    instanced.count = pins.length
    instanced.instanceMatrix.needsUpdate = true
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true
    instanced.computeBoundingSphere()
  }, [pins, palette, capacity])

  /** Beacon quads, anchored just above each promoted bead. */
  useLayoutEffect(() => {
    const instanced = beaconRef.current
    if (!instanced) return

    const dummy = new THREE.Object3D()
    const dir = new THREE.Vector3()

    for (let i = 0; i < promoted.length; i += 1) {
      const pin = promoted[i]
      const radius = tierToHeight(pin.tier) * MARKER_SCALE
      dir.copy(latLngToVector3(pin.lat, pin.lng, 1))
      dummy.position.copy(dir).multiplyScalar(GLOBE_RADIUS + radius * 0.62)
      dummy.scale.setScalar(BEACON_RADIUS)
      dummy.updateMatrix()
      instanced.setMatrixAt(i, dummy.matrix)
    }

    instanced.count = promoted.length
    instanced.instanceMatrix.needsUpdate = true
    instanced.computeBoundingSphere()
  }, [promoted, beaconCapacity])

  // ---- hover ---------------------------------------------------------------

  /**
   * Nearest pin to where the cursor meets the sphere — not a ray/mesh
   * intersection. A marker is a handful of device pixels wide at the default
   * camera distance; requiring the ray to actually hit one makes hovering a
   * game of skill. Intersecting the sphere analytically and scanning a flat
   * Float32Array of surface directions is both kinder and roughly ten times
   * cheaper — 22,000 pins is 22,000 subtractions at 16Hz.
   */
  const hoverState = useRef({ inside: false, id: -1, at: 0 })
  const pickSphere = useMemo(
    () => new THREE.Sphere(new THREE.Vector3(0, 0, 0), GLOBE_RADIUS),
    [],
  )
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const surfaceHit = useMemo(() => new THREE.Vector3(), [])

  /** Shared by the hover scan and the click hit-test. */
  const nearestPin = useMemo(() => {
    const scan = (hx: number, hy: number, hz: number): number => {
      const dirs = directions.current
      const count = dirs.length / 3
      if (count === 0) return -1

      const tolerance = HOVER_TOLERANCE * camera.position.length()
      let best = tolerance * tolerance
      let id = -1
      for (let i = 0; i < count; i += 1) {
        const dx = dirs[i * 3] - hx
        const dy = dirs[i * 3 + 1] - hy
        const dz = dirs[i * 3 + 2] - hz
        const d2 = dx * dx + dy * dy + dz * dz
        if (d2 < best) {
          best = d2
          id = i
        }
      }
      return id
    }
    return scan
  }, [camera])

  /** The latest pins array, readable from stable closures. */
  const pinsRef = useRef(pins)
  useEffect(() => {
    pinsRef.current = pins
  }, [pins])

  useEffect(() => {
    if (!onHitTestReady) return
    const test: PinHitTest = (lat, lng) => {
      const dir = latLngToVector3(lat, lng, 1)
      const id = nearestPin(dir.x, dir.y, dir.z)
      return id === -1 ? null : (pinsRef.current[id] ?? null)
    }
    onHitTestReady(test)
  }, [onHitTestReady, nearestPin])

  /** The mesh carrying the hover halo. Moved, not rebuilt, as hover changes. */
  const haloRef = useRef<THREE.Mesh>(null)

  useEffect(() => {
    const el = gl.domElement
    // pointermove rather than pointerenter: synthetic pointer input, and a
    // pointer that is already over the canvas when the scene mounts, both skip
    // the enter event entirely.
    const move = () => {
      hoverState.current.inside = true
    }
    const leave = () => {
      hoverState.current.inside = false
      haloMaterial.uniforms.uPress.value = 0
      if (hoverState.current.id !== -1) {
        hoverState.current.id = -1
        if (haloRef.current) haloRef.current.visible = false
        onHoverPin?.(null)
      }
    }
    // The press state, which a canvas cannot express with CSS. Only ever set
    // when a pin is actually under the pointer, so a drag of the globe that
    // starts over empty ocean does not flash a ring at nothing.
    const down = () => {
      if (hoverState.current.id !== -1) {
        haloMaterial.uniforms.uPress.value = 1
      }
    }
    const up = () => {
      haloMaterial.uniforms.uPress.value = 0
    }
    el.addEventListener('pointermove', move, { passive: true })
    el.addEventListener('pointerleave', leave)
    el.addEventListener('pointerdown', down, { passive: true })
    el.addEventListener('pointerup', up, { passive: true })
    el.addEventListener('pointercancel', up, { passive: true })
    return () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
    // Deliberately NOT gated on `onHoverPin` any more: the halo is hover
    // feedback the globe owes the visitor whether or not anybody upstairs
    // wants a tooltip out of it.
  }, [gl, haloMaterial, onHoverPin])

  /** Drop the halo the moment hover is switched off (entering pick mode). */
  useEffect(() => {
    if (hoverEnabled) return
    hoverState.current.id = -1
    if (haloRef.current) haloRef.current.visible = false
    onHoverPin?.(null)
  }, [hoverEnabled, onHoverPin])

  /*
    Paid pins surface from the map, one at a time, forever.

    - ONLY PAID PINS. A seed never pops.
    - ONE AT A TIME, on an interval. Simultaneous pops read as a glitch; a
      staggered single pop reads as the map being alive.
    - ONLY ON THE NEAR SIDE. `dot(dir, cam)` cheaply rejects the far
      hemisphere, where a pop would spend its whole animation invisible.
    - IT ALWAYS SETTLES BACK to the exact base radius, so repeated pops cannot
      accumulate scale drift.

    The curve overshoots slightly and returns — the shape of something being
    planted, not something throbbing. Skipped entirely under reduced motion.
  */
  useFrame((state) => {
    if (reducedMotion) return
    const instanced = meshRef.current
    const paid = paidIndices.current
    if (!instanced || paid.length === 0) return

    const now = state.clock.elapsedTime
    const dirs = directions.current
    const radii = baseRadii.current
    const cam = state.camera.position

    if (now >= nextPop.current) {
      // Re-armed even when no candidate is visible, so a globe spun to empty
      // ocean does not queue up a burst the moment land comes back round.
      nextPop.current = now + POP_INTERVAL

      const visible: number[] = []
      for (const i of paid) {
        const dx = dirs[i * 3]
        const dy = dirs[i * 3 + 1]
        const dz = dirs[i * 3 + 2]
        if (dx * cam.x + dy * cam.y + dz * cam.z > 0) visible.push(i)
      }
      if (visible.length > 0) {
        const pick = visible[Math.floor(Math.random() * visible.length)]
        if (!pops.current.has(pick)) pops.current.set(pick, now)
      }
    }

    if (pops.current.size === 0) return

    const dummy = popDummy
    const dir = popDir
    let touched = false

    for (const [i, started] of pops.current) {
      const t = (now - started) / POP_DURATION
      const base = radii[i]

      if (t >= 1) {
        pops.current.delete(i)
        dir.set(dirs[i * 3], dirs[i * 3 + 1], dirs[i * 3 + 2])
        dummy.position.copy(dir).multiplyScalar(GLOBE_RADIUS + base * 0.62)
        dummy.scale.setScalar(base)
        dummy.updateMatrix()
        instanced.setMatrixAt(i, dummy.matrix)
        touched = true
        continue
      }

      // Rise and settle: a fast climb, a small overshoot, back to rest.
      const eased = Math.sin(t * Math.PI) * (1 - t * 0.35)
      const scale = base * (1 + eased * POP_GAIN)
      const lift = base * 0.62 + base * eased * POP_LIFT

      dir.set(dirs[i * 3], dirs[i * 3 + 1], dirs[i * 3 + 2])
      dummy.position.copy(dir).multiplyScalar(GLOBE_RADIUS + lift)
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      instanced.setMatrixAt(i, dummy.matrix)
      touched = true
    }

    if (touched) instanced.instanceMatrix.needsUpdate = true
  })

  useFrame((state) => {
    if (!hoverEnabled) return

    const h = hoverState.current
    if (!h.inside) return

    const now = state.clock.elapsedTime
    if (now - h.at < 0.06) return
    h.at = now

    let id = -1
    raycaster.setFromCamera(pointer, camera)
    if (raycaster.ray.intersectSphere(pickSphere, surfaceHit)) {
      surfaceHit.normalize()
      id = nearestPin(surfaceHit.x, surfaceHit.y, surfaceHit.z)
    }

    if (id !== h.id) {
      h.id = id
      onHoverPin?.(id === -1 ? null : (pins[id] ?? null))
    }

    /*
     * Park the halo on the hovered bead.
     *
     * Only ever at the scan rate, and that is enough: a pin's position is fixed
     * in WORLD space — the camera orbits, the planet does not — so the halo has
     * nothing to chase between scans. The quad re-faces the camera in the
     * vertex shader every frame regardless, and its size is re-applied every
     * frame beside the beacon, so a wheel zoom stays smooth.
     */
    const halo = haloRef.current
    if (!halo) return
    if (id === -1) {
      halo.visible = false
      return
    }
    const dirs = directions.current
    const radius = baseRadii.current[id] ?? HALO_MIN
    halo.position.set(dirs[id * 3], dirs[id * 3 + 1], dirs[id * 3 + 2])
    halo.position.multiplyScalar(GLOBE_RADIUS + radius * 0.62)
    halo.visible = true
    haloBaseRef.current = Math.max(HALO_MIN, radius * HALO_GAIN)
  })

  // ---- ghost ---------------------------------------------------------------

  const ghostRef = useRef<THREE.Group>(null)

  useLayoutEffect(() => {
    const ghost = ghostRef.current
    if (!ghost || !pendingPick) return
    // Orient the whole group so its local +Y is the surface normal; the marker
    // and the base ring then sit at fixed local offsets. The marker itself is a
    // billboard and ignores the rotation, but it still needs the position.
    const dir = latLngToVector3(pendingPick.lat, pendingPick.lng, 1)
    ghost.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
  }, [pendingPick])

  useFrame((state) => {
    if (!pendingPick) return
    // The ghost breathes rather than fades. Opacity is not available — the
    // marker material is opaque so that clusters stay clean — and a pulsing
    // size reads as "not placed yet" at least as clearly.
    const pulse = reducedMotion
      ? 0
      : 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 3.4)
    ghostMaterial.uniforms.uScale.value = GHOST_RADIUS * (1 + pulse * 0.16)
    ghostRingMaterial.opacity = 0.45 + pulse * 0.35
  })

  return (
    <group>
      {pins.length > 0 && (
        <>
          {/* No pointer handlers on purpose: that is what keeps this mesh out
              of r3f's per-pointermove raycast set. The manual scan above is
              the only thing that touches it. */}
          <instancedMesh
            ref={meshRef}
            args={[geometry, material, capacity]}
            renderOrder={6}
            frustumCulled={false}
          />
          {promoted.length > 0 && (
            <instancedMesh
              ref={beaconRef}
              args={[geometry, beaconMaterial, beaconCapacity]}
              renderOrder={8}
              frustumCulled={false}
            />
          )}
          {/* One halo, parked on whichever bead the cursor found. Starts
              invisible; the hover scan owns it from there. */}
          <mesh
            ref={haloRef}
            geometry={geometry}
            material={haloMaterial}
            visible={false}
            renderOrder={9}
            frustumCulled={false}
          />
        </>
      )}

      {pendingPick && (
        <group ref={ghostRef}>
          <mesh
            geometry={geometry}
            material={ghostMaterial}
            position={[0, GLOBE_RADIUS + GHOST_RADIUS * 0.62, 0]}
            renderOrder={7}
            frustumCulled={false}
          />
          <mesh
            geometry={ghostRingGeometry}
            material={ghostRingMaterial}
            position={[0, GLOBE_RADIUS + 0.001, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            // Wide enough to sit outside the bead. At the bead's own radius it
            // is simply hidden underneath it, which took a zoom to notice —
            // and the beads are five times the size they were.
            scale={0.095}
            renderOrder={7}
            frustumCulled={false}
          />
        </group>
      )}
    </group>
  )
}
