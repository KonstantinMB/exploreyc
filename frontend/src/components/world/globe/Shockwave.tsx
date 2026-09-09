/* eslint-disable react-hooks/immutability -- three.js/DOM resources are
   GPU-adjacent objects written imperatively per frame; there is no pure-React
   formulation of that. Same deliberate call as the donor codebase. */
/*
 * Every three.js object here is a memoised GPU resource written imperatively —
 * per frame, in the case of uniforms. There is no pure-React formulation of
 * "set this shader uniform sixty times a second".
 */

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { GLOBE_RADIUS, YC_ORANGE, latLngToVector3 } from './geo'

/**
 * The ring a new plant fires across the surface.
 *
 * A solid orange band that expands and fades, not a glowing pulse. On a light
 * map a glow has nowhere to go — the ground is already near-white, so
 * "brighter" and "invisible" are the same thing. Opacity is the only channel
 * with any range left, so the ring is opaque and the animation is it fading
 * out.
 *
 * The important part is that it is *on* the sphere. A `RingGeometry` rotated to
 * face outward is a flat disc floating in front of the planet; it reads as a
 * decal pasted on the screen the moment the camera is anywhere but straight
 * overhead. So the ring is expanded in the *vertex shader* as a spherical cap:
 * local radius maps to an angular radius from the epicentre, and each vertex is
 * placed at `cos(theta) * up + sin(theta) * tangent`. The ring bends over the
 * horizon exactly like something drawn on the ground, because that is what it
 * is.
 */

/** Ring lives just clear of the surface so it is not in a fight with the sphere. */
const RING_RADIUS = GLOBE_RADIUS * 1.0025
/** How far the wave travels, in radians of arc. ~0.62 rad is roughly 4,000 km. */
const MAX_ANGLE = 0.62
/** Inner edge of the annulus, as a fraction of the outer. Sets the band width. */
const INNER = 0.75
/**
 * Radial subdivisions. Not cosmetic: the band spans ~0.16 rad of arc at full
 * expansion, and a single quad across that is a chord that dips 7e-3 below the
 * surface — far more than the 2.5e-3 the ring is lifted by, so the middle of
 * the wave would disappear inside the planet.
 */
const RADIAL_STEPS = 8

const VERT = /* glsl */ `
  uniform float uProgress;
  uniform float uMaxAngle;
  uniform float uRadius;
  uniform float uInner;

  varying float vBand;

  void main() {
    // Local radius runs from uInner to 1 across the annulus.
    float r = length(position.xy);
    vBand = clamp((r - uInner) / max(1.0 - uInner, 1e-4), 0.0, 1.0);

    // Angular distance from the epicentre. Scaling by r as well as progress
    // means the band widens as it travels, the way a real front does.
    float theta = uProgress * uMaxAngle * r;

    vec3 tangent = normalize(vec3(position.xy, 0.0));
    vec3 p = cos(theta) * vec3(0.0, 0.0, 1.0) + sin(theta) * tangent;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p * uRadius, 1.0);
  }
`

const FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uProgress;
  uniform float uStrength;

  varying float vBand;

  void main() {
    // A solid band with soft shoulders, not a glow: mostly opaque across its
    // width, feathered only at the two edges so it does not alias, and fading
    // as one solid object rather than dimming as a light.
    float front =
      smoothstep(0.0, 0.22, vBand) * (1.0 - smoothstep(0.72, 1.0, vBand));
    // Squaring the decay made the wave invisible for most of its life. A gentle
    // ease keeps it legible until it is genuinely gone.
    float life = pow(1.0 - uProgress, 1.25);
    float a = clamp(front * life * uStrength, 0.0, 1.0);
    gl_FragColor = vec4(uColor, a);
    #include <colorspace_fragment>
  }
`

export interface ShockwaveProps {
  /**
   * Fires whenever this object's *identity* changes. Two plants at the same
   * coordinate therefore still fire twice, as long as the caller hands over a
   * fresh object — which is what holding it in state naturally does.
   */
  at?: { lat: number; lng: number } | null
  /** Milliseconds. ~1.2s is about right. */
  duration?: number
  color?: string
  /** Skips the animation entirely. */
  reducedMotion?: boolean
}

export function Shockwave({
  at,
  duration = 1200,
  // YC orange: the ring a plant fires is the same signal colour as the button
  // that fired it.
  color = YC_ORANGE,
  reducedMotion = false,
}: ShockwaveProps) {
  const groupRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  /** -1 when idle. Firing is a ref flip, not a state change: a wave should not
   *  re-render a scene that contains a many-thousand-instance mesh. */
  const startedAt = useRef(-1)

  const geometry = useMemo(
    () => new THREE.RingGeometry(INNER, 1, 128, RADIAL_STEPS),
    [],
  )

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uProgress: { value: 0 },
          uMaxAngle: { value: MAX_ANGLE },
          uRadius: { value: RING_RADIUS },
          uInner: { value: INNER },
          uColor: { value: new THREE.Color(color) },
          // A solid ring wants an alpha that means what it says.
          uStrength: { value: 0.92 },
        },
        transparent: true,
        depthWrite: false,
        // Depth *test* stays on so the far half of the wave is hidden by the
        // planet, which is the whole reason it reads as being on the surface.
        depthTest: true,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [color],
  )

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  useEffect(() => {
    if (!at || reducedMotion) {
      startedAt.current = -1
      return
    }
    const group = groupRef.current
    if (group) {
      // Local +Z becomes the surface normal at the epicentre. The vertex shader
      // builds the cap around that axis and knows nothing about lat/lng.
      const normal = latLngToVector3(at.lat, at.lng, 1).normalize()
      group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
    }
    material.uniforms.uProgress.value = 0
    startedAt.current = performance.now()
  }, [at, reducedMotion, material])

  useFrame(() => {
    const ring = meshRef.current
    if (!ring) return

    if (startedAt.current < 0) {
      ring.visible = false
      return
    }

    const t = (performance.now() - startedAt.current) / duration
    if (t >= 1) {
      startedAt.current = -1
      ring.visible = false
      return
    }

    ring.visible = true
    material.uniforms.uProgress.value = t
  })

  return (
    <group ref={groupRef}>
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        visible={false}
        renderOrder={5}
        // The vertex shader moves every vertex onto the sphere, so the
        // geometry's own bounds are meaningless to the culler.
        frustumCulled={false}
      />
    </group>
  )
}
