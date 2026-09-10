/* eslint-disable react-hooks/immutability -- three.js resources are
   GPU-adjacent objects written imperatively per frame; there is no pure-React
   formulation of that. Same deliberate call as the rest of this directory. */
/*
 * Every three.js object in a react-three-fiber scene is a memoised geometry,
 * material or typed array written to imperatively — per frame, in the case of
 * uniforms. The objects are GPU resources, not React state.
 */

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { GlobePin } from '../../../lib/worldApi'
import { GLOBE_RADIUS, YC_ORANGE, type GlobePalette } from './geo'
import { countPinsPerCity, useCityIndex } from './cityIndex'
import { densityFade, quantize } from './labelLayout'

/**
 * Where the map is crowded, as one disc per city.
 *
 * This is the globe's answer to the deck.gl map's `HexagonLayer`, and it is
 * deliberately not a port of it. `HexagonLayer` is a GPU aggregation pipeline
 * with a `SolidPolygonLayer` underneath and an extruded-column shader on top;
 * none of that exists in three.js, and rebuilding it would be several hundred
 * lines to answer a question the globe can already answer better. The globe
 * knows about CITIES — it fetches a 7,328-row gazetteer, snaps pins to it with
 * the same 50 km radius the database uses, and names the contested ones — so
 * "where is this map crowded" is one call to `countPinsPerCity` away, and the
 * answer is a place with a name rather than a hexagon nobody lives in.
 *
 * What IS ported is the behaviour that made the hexagon layer feel good: its
 * strength came from one continuous zoom number, quantized, so it cross-faded
 * with the pin field instead of switching on. Here that is `densityFade` —
 * nothing from orbit, full at continent range, gone by the time individual pins
 * are worth aiming at — and its other half is in `PlotColumns`, where the SEED
 * beads shrink by exactly the amount these discs fade in.
 *
 * **Paid plots never fade for this layer.** A disc is an aggregate; a plot is
 * something somebody bought. The aggregate is never allowed to stand in front of
 * the product, so the colour split is the whole point: a city with money in it
 * is drawn in YC orange, a city holding only imported listings is drawn in the
 * seed slate, and a glance at the crowded view still answers "where has anyone
 * actually paid".
 */

/** Smallest and largest disc radius, in globe radii. */
const DISC_MIN = 0.018
const DISC_MAX = 0.072

/** Instance capacity is rounded up to this so a refetch does not reallocate. */
const CAPACITY_STEP = 128

const DENSITY_VERT = /* glsl */ `
  varying vec2 vQuad;
  varying vec3 vFill;
  varying float vFacing;

  void main() {
    vQuad = position.xy;

    // Guarded, because three only declares these when the mesh actually has an
    // instance colour buffer — and setColorAt creates that buffer lazily, one
    // commit after the material's first compile.
    vec3 tint = vec3(1.0);
    #ifdef USE_INSTANCING_COLOR
      tint = instanceColor;
    #endif
    vFill = tint;

    vec3 centre = vec3(0.0);
    float size = 1.0;
    #ifdef USE_INSTANCING
      centre = instanceMatrix[3].xyz;
      size = length(instanceMatrix[0].xyz);
    #endif

    vec4 world = modelMatrix * vec4(centre, 1.0);
    vFacing = dot(normalize(world.xyz), normalize(cameraPosition - world.xyz));

    vec4 mv = modelViewMatrix * vec4(centre, 1.0);
    mv.xy += position.xy * size;
    gl_Position = projectionMatrix * mv;
  }
`

const DENSITY_FRAG = /* glsl */ `
  uniform float uOpacity;

  varying vec2 vQuad;
  varying vec3 vFill;
  varying float vFacing;

  void main() {
    // Round the back of the planet. A disc drawn there would slide across the
    // limb as a bright crescent, which reads as a rendering fault.
    if (vFacing < 0.04) discard;
    float limb = smoothstep(0.04, 0.20, vFacing);

    float d = length(vQuad);
    if (d > 1.0) discard;

    // A soft body with a defined edge: the body says "there is weight here",
    // the edge stops a field of overlapping discs melting into one wash.
    float body = pow(1.0 - smoothstep(0.0, 1.0, d), 1.6) * 0.55;
    float edge = (1.0 - smoothstep(0.05, 0.13, abs(d - 0.86))) * 0.42;

    float a = clamp(body + edge, 0.0, 1.0) * uOpacity * limb;
    if (a < 0.004) discard;

    gl_FragColor = vec4(vFill, a);
    #include <colorspace_fragment>
  }
`

export interface CityDensityProps {
  /**
   * The pins to aggregate — the FEED pins, not the jittered ones. The jitter is
   * a rendering trick worth about 7 km and the snap radius is 50 km, so it can
   * only ever change the answer for a pin already sitting on the boundary; feed
   * coordinates are simply the honest input.
   */
  pins: readonly GlobePin[]
  palette: GlobePalette
  enabled?: boolean
}

export function CityDensity({ pins, palette, enabled = false }: CityDensityProps) {
  const index = useCityIndex(enabled)

  const counts = useMemo(
    () => (enabled && index ? countPinsPerCity(index, pins) : null),
    [enabled, index, pins],
  )

  const cities = counts?.occupied.length ?? 0
  const capacity = Math.max(
    CAPACITY_STEP,
    Math.ceil(Math.max(cities, 1) / CAPACITY_STEP) * CAPACITY_STEP,
  )

  const geometry = useMemo(() => new THREE.PlaneGeometry(2, 2, 1, 1), [])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: DENSITY_VERT,
        fragmentShader: DENSITY_FRAG,
        uniforms: { uOpacity: { value: 0 } },
        transparent: true,
        depthWrite: false,
        // Straight alpha, never additive: additive light is a dark-theme idiom
        // and this globe has to hold up on a near-white page too.
        blending: THREE.NormalBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  )

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  const meshRef = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const instanced = meshRef.current
    if (!instanced || !index || !counts) return

    const dummy = new THREE.Object3D()
    const color = new THREE.Color()
    const paidColor = new THREE.Color(YC_ORANGE)
    const seedColor = new THREE.Color(palette.markers.seed)
    const logMax = Math.log10(counts.max + 1)

    for (let n = 0; n < counts.occupied.length; n += 1) {
      const c = counts.occupied[n]
      // Log-scaled, like every other magnitude on this globe: San Francisco
      // holds 2,819 pins and the next city holds tens, and a linear radius would
      // draw one continent-sized disc and 300 invisible ones.
      const t = logMax > 0 ? Math.log10(counts.total[c] + 1) / logMax : 1
      const radius = DISC_MIN + (DISC_MAX - DISC_MIN) * t

      dummy.position.set(
        index.dirs[c * 3],
        index.dirs[c * 3 + 1],
        index.dirs[c * 3 + 2],
      )
      // Just off the ground, under the markers: an aggregate is context for the
      // pins, never a thing drawn over them.
      dummy.position.multiplyScalar(GLOBE_RADIUS + 0.0022)
      dummy.scale.setScalar(radius)
      dummy.updateMatrix()
      instanced.setMatrixAt(n, dummy.matrix)

      color.copy(counts.paid[c] > 0 ? paidColor : seedColor)
      instanced.setColorAt(n, color)
    }

    instanced.count = counts.occupied.length
    instanced.instanceMatrix.needsUpdate = true
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true
    instanced.computeBoundingSphere()
  }, [index, counts, palette, capacity])

  /**
   * One continuous zoom number, quantized, exactly as the 2D map did it.
   *
   * The uniform is cheap enough to write every frame, but the value is snapped
   * to twentieths anyway so that everything else keyed on the same number —
   * notably the seed beads' instance buffer over in `PlotColumns` — is rebuilt
   * twenty times across the whole envelope instead of once per frame.
   */
  useFrame(({ camera }) => {
    const mesh = meshRef.current
    if (!mesh) return
    const strength = enabled ? quantize(densityFade(camera.position.length())) : 0
    mesh.visible = strength > 0.001 && mesh.count > 0
    material.uniforms.uOpacity.value = strength
  })

  if (!enabled || cities === 0) return null

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, capacity]}
      renderOrder={4}
      frustumCulled={false}
      visible={false}
    />
  )
}
