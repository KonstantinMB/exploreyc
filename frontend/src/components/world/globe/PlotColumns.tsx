/*
 * Every three.js object in a react-three-fiber scene is a memoised geometry,
 * material, texture or canvas context written to imperatively — per frame, in
 * the case of uniforms. The objects are GPU resources, not React state.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
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
import { densityFade, quantize, seedScaleForDensity } from './labelLayout'

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
 * NOTHING IS DRAWN AT THE POINTER. The bead the cursor finds is reported up
 * through `onHoverPin` and answered in HTML (a tooltip and a pointer cursor);
 * the orange hover halo that used to ring it is deleted, along with the
 * pick-mode ghost. The map's hover feedback is the country border and fill.
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
 *
 * RAISED AGAIN, to 0.48, after the globe was looked at on a real 1920 and 2560
 * screen with an empty paid layer. The legend read "911 companies" (5,585 in
 * production) and the map over the United States showed perhaps eight marks the
 * size of dust. Two things stacked: the bead is small, and `MARKER_FRAG` spends
 * the outer 40% of its radius on a WHITE ring — which on light land (#EDF2F8,
 * near-white) is invisible, so the mark a visitor could actually see was only
 * the 60% core. A 5px bead was a 3px dot. The ring has been narrowed alongside
 * this (see MARKER_FRAG), and together they take the visible core of a seed
 * from 3.0px to 4.8px.
 *
 *   seed (tier 0, x1.30) .....  6.7px    <- was 5.0px
 *   tier 1 ($5-$49) ..........  9.9px
 *   tier 2 ($50-$249) ........ 14.7px
 *   tier 3 ($250-$999) ....... 19.6px
 *   tier 4 ($1,000+) ......... 24.4px
 *
 * Everything sized against a marker — the beacon, the hover tolerance — is
 * pinned to this number below and moves with it.
 */
const MARKER_SCALE = 0.48

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
/**
 * The biggest bead the ladder actually draws, in globe radii.
 *
 * Tier 4 — `$1,000+`, the top bucket `backend/world.py` emits and the top rung
 * `stakeBand` knows how to name. Named, because three constants below are "some
 * multiple of the biggest bead" and used to be written as bare decimals that
 * silently stopped meaning that the moment MARKER_SCALE moved.
 */
const MAX_MARKER_RADIUS = tierToHeight(4) * MARKER_SCALE
/** Beacon quad half-width, in globe radii. Sized to ring the biggest bead. */
const BEACON_RADIUS = MAX_MARKER_RADIUS * 2
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
 *
 * Raised from 0.011 with the beads. Multiplied by the camera distance it
 * resolves to a chord in globe radii, so at the default 3.45 this is 0.050
 * radii — about 15 CSS pixels, still a little wider than the biggest bead the
 * ladder now draws (MAX_MARKER_RADIUS, 0.041 radii ≈ 12px). A tier-4 plot whose
 * outer ring does not answer the cursor would be the most expensive pin on the
 * map and the hardest one to hover.
 */
const HOVER_TOLERANCE = 0.0145
/**
 * Seed beads stop answering the cursor once the density cross-fade has taken
 * them below half size. Half, rather than the 0.15 floor, because a bead that is
 * on its way out is already too faint to be worth a tooltip.
 */
const SEED_PICKABLE_SCALE = 0.5

/**
 * Camera-facing billboard, sized in world units.
 *
 * The instance matrix is read directly rather than applied: column 3 is the
 * centre, and the length of column 0 is the radius. Offsetting in *view* space
 * after the model-view transform is what makes the quad face the camera.
 * Written to work with and without instancing.
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
    //
    // THE CORE RUNS TO 0.72, NOT 0.60. The ring used to take the outer 40% of
    // the radius — 64% of the bead's AREA — and the light theme's land is
    // #EDF2F8, i.e. very nearly the ring's own white. Over the United States,
    // which is where most of the feed is, the ring did not separate the bead
    // from the terrain; it ate it, and a 5px marker rendered as a 3px speck of
    // grey. At 0.72 the core is 52% of the area instead of 36%, the ring is
    // still a full ring, and the bead reads as a mark on both grounds.
    vec3 edgeCol = vFill * 0.62;

    float toRing = smoothstep(0.72, 0.80, d);
    float toEdge = smoothstep(0.88, 0.96, d);

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

/*
 * THE HOVER HALO IS GONE, along with the pick-mode ghost and its base ring.
 *
 * It was a pulsing orange donut drawn at whichever bead the cursor came within
 * ~15px of, which on a globe carrying 5,579 seed pins reads as an orange ring
 * chasing the pointer across the map — the exact thing the owner asked three
 * times to have removed. Hover feedback on this map is now the country's
 * emphasised BORDER and its FILL (see CountryBorders / CountryFills), plus the
 * pointer cursor and the tooltip the wrapper draws in HTML. Nothing in this
 * scene is drawn at the pointer any more.
 *
 * The hover SCAN below survives: it feeds `onHoverPin` (the tooltip) and the
 * cursor shape. It draws nothing.
 */

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
  onHoverPin?: (pin: GlobePin | null) => void
  /**
   * Handed back on mount: resolves a surface coordinate to the nearest pin
   * within ~10 screen pixels, or null. The scene's click handler uses it to
   * route a click to a pin before falling through to the country.
   */
  onHitTestReady?: (test: PinHitTest) => void
  reducedMotion?: boolean
  /**
   * The density layer is drawing, so the SEED field gets out of its way.
   *
   * This is the other half of the cross-fade described in `CityDensity`: as the
   * discs come up, seed beads shrink to 15% and stop answering the cursor, so
   * the same 5,579 rows are never drawn twice at full strength. **Paid plots are
   * untouched at every step of it** — an aggregate blob never stands in front of
   * something somebody bought.
   */
  density?: boolean
}

export function PlotColumns({
  pins,
  palette,
  onHoverPin,
  onHitTestReady,
  reducedMotion = false,
  density = false,
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

  useFrame((state) => {
    beaconMaterial.uniforms.uTime.value = state.clock.elapsedTime
    // The beacon tracks the marker's own screen-size compensation, so a
    // promoted ring never drifts out of step with its bead.
    beaconMaterial.uniforms.uScale.value = markerScaleRef.current
  })

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
      beaconMaterial.dispose()
    },
    [geometry, material, beaconMaterial],
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
  /** 1 for a seed, 0 for a paid plot. Read by the scale ramp and the hit test. */
  const seedFlags = useRef(new Uint8Array(0))
  /** index -> the clock time its pop started. */
  const pops = useRef(new Map<number, number>())
  const nextPop = useRef(0)
  /**
   * How much of its size a seed bead is currently keeping, quantized.
   *
   * 1 whenever the density layer is off, which is every caller that does not ask
   * for it, so the field this ref governs is untouched in the default globe.
   */
  const seedScale = useRef(1)

  useLayoutEffect(() => {
    const instanced = meshRef.current
    if (!instanced) return

    const dummy = new THREE.Object3D()
    const color = new THREE.Color()
    const dir = new THREE.Vector3()
    const dirs = new Float32Array(pins.length * 3)
    const radii = new Float32Array(pins.length)
    const seeds = new Uint8Array(pins.length)
    const paid: number[] = []
    const scale = seedScale.current

    for (let i = 0; i < pins.length; i += 1) {
      const pin = pins[i]
      /*
        A SEED IS NOT A BID, so it does not get a bid's presence: a fixed
        SEED_RADIUS below every paid rung, in the palest colour on the map.
        Present and obviously claimable, never mistakable for a stake.
      */
      const isSeed = pin.kind === 'seed'
      const radius = isSeed
        ? SEED_RADIUS * scale
        : tierToHeight(pin.tier) * MARKER_SCALE

      dir.copy(latLngToVector3(pin.lat, pin.lng, 1))
      dirs[i * 3] = dir.x
      dirs[i * 3 + 1] = dir.y
      dirs[i * 3 + 2] = dir.z

      radii[i] = radius
      seeds[i] = isSeed ? 1 : 0
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
    seedFlags.current = seeds
    paidIndices.current = paid
    pops.current.clear()
    instanced.count = pins.length
    instanced.instanceMatrix.needsUpdate = true
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true
    instanced.computeBoundingSphere()
  }, [pins, palette, capacity])

  /**
   * Re-scale the SEED beads in place, without rebuilding anything else.
   *
   * Only the seeds' matrices are rewritten — their direction, their colour, the
   * paid index and every paid matrix are left exactly as they were, which is
   * what makes this safe to call from a frame callback. It runs at most once per
   * quantized step of the ramp (about twenty times across the whole envelope),
   * never per frame.
   */
  const applySeedScale = useCallback((scale: number) => {
    const instanced = meshRef.current
    if (!instanced) return
    const dirs = directions.current
    const radii = baseRadii.current
    const seeds = seedFlags.current
    if (seeds.length === 0) return

    const dummy = popDummy
    const dir = popDir
    for (let i = 0; i < seeds.length; i += 1) {
      if (seeds[i] === 0) continue
      const radius = SEED_RADIUS * scale
      radii[i] = radius
      dir.set(dirs[i * 3], dirs[i * 3 + 1], dirs[i * 3 + 2])
      dummy.position.copy(dir).multiplyScalar(GLOBE_RADIUS + radius * 0.62)
      dummy.scale.setScalar(radius)
      dummy.updateMatrix()
      instanced.setMatrixAt(i, dummy.matrix)
    }
    instanced.instanceMatrix.needsUpdate = true
  }, [])

  /**
   * The cross-fade, driven by one continuous zoom number and quantized.
   *
   * Straight out of the deck.gl map, where every layer's strength came from the
   * same `zoom` and was rounded to twentieths so the expensive work happened on
   * meaningful steps rather than on every frame of a wheel flick. Here the
   * expensive work is 5,579 instance matrices, and twentieths turn a per-frame
   * rewrite into twenty of them.
   */
  useFrame(({ camera: cam }) => {
    const target = density
      ? quantize(seedScaleForDensity(densityFade(cam.position.length())))
      : 1
    if (target === seedScale.current) return
    seedScale.current = target
    applySeedScale(target)
  })

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

      /*
       * A bead the density layer has faded down to a fraction of a pixel is not
       * a target. Aiming at something you cannot see is not aiming, and a
       * tooltip for an invisible mark reads as the map hallucinating — so while
       * the cross-fade is up, seeds drop out of the hover scan AND out of the
       * click hit test together, and a click on the crowded view falls through
       * to its country exactly as it does over empty land.
       */
      const seeds = seedFlags.current
      const skipSeeds = seedScale.current < SEED_PICKABLE_SCALE

      const tolerance = HOVER_TOLERANCE * camera.position.length()
      let best = tolerance * tolerance
      let id = -1
      for (let i = 0; i < count; i += 1) {
        if (skipSeeds && seeds[i] === 1) continue
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
      if (hoverState.current.id !== -1) {
        hoverState.current.id = -1
        onHoverPin?.(null)
      }
    }
    el.addEventListener('pointermove', move, { passive: true })
    el.addEventListener('pointerleave', leave)
    return () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
    }
  }, [gl, onHoverPin])

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
    // Nothing is drawn here. The scan's only outputs are `onHoverPin` (the
    // HTML tooltip) and the cursor shape the scene derives from it.
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
        </>
      )}
    </group>
  )
}
