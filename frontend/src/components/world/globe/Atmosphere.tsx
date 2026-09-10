import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { GLOBE_PALETTE_LIGHT } from './geo'

/**
 * The halo outside the globe's silhouette.
 *
 * A back-faced shell a little larger than the planet, with the intensity driven
 * by how edge-on the surface is to the camera. Everything inside the silhouette
 * is depth-rejected by the opaque globe, so what survives is a ring exactly
 * where the planet ends — the thing that makes a sphere read as an object with
 * air around it rather than a flat disc.
 *
 * Blended normally, and blue rather than white. A soft haze blended *over* the
 * page moves in the direction the page has room to move, and reads as
 * atmosphere for the same reason distant hills look blue. Deliberately not a
 * "sky": no scattering model, no sun.
 */

const VERT = /* glsl */ `
  varying vec3 vNormalView;

  void main() {
    vNormalView = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uPower;
  uniform float uCoefficient;
  uniform float uStrength;

  varying vec3 vNormalView;

  void main() {
    // In view space +Z points at the camera, so this is the grazing angle.
    float facing = dot(normalize(vNormalView), vec3(0.0, 0.0, 1.0));
    float intensity = pow(max(uCoefficient - facing, 0.0), uPower);
    float a = clamp(intensity * uStrength, 0.0, 1.0);
    gl_FragColor = vec4(uColor, a);
    #include <colorspace_fragment>
  }
`

export interface AtmosphereProps {
  /** Shell radius as a multiple of the globe radius. */
  scale?: number
  /**
   * The air around the planet — pass the theme's `halo`.
   *
   * It used to be `oceanDeep`, which is the wrong colour to judge here: this
   * shell is blended over the PAGE, not over the water. On the soft dark ground
   * (#151A22) the dark theme's `oceanDeep` measures 1.24:1 and the halo simply
   * was not there; `halo` clears 2:1 in both themes by construction.
   */
  color?: string
  /** Overall density. Above ~0.8 it stops reading as a rim and starts to fog. */
  strength?: number
}

export function Atmosphere({
  scale = 1.09,
  color = GLOBE_PALETTE_LIGHT.halo,
  strength = 0.52,
}: AtmosphereProps) {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        // Soft falloff: a tight rim reads as a hard glowing edge; what is
        // wanted here is a haze that fades into the page.
        uPower: { value: 2.8 },
        uCoefficient: { value: 0.62 },
        uStrength: { value: strength },
      },
      // BackSide is the whole trick: we shade the far wall of the shell, which
      // is only visible in the annulus outside the planet's outline.
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    })
  }, [color, strength])

  const geometry = useMemo(() => new THREE.SphereGeometry(1, 64, 40), [])

  // r3f does not own resources handed to it by prop, so they are ours to free.
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  return (
    <mesh
      geometry={geometry}
      material={material}
      scale={scale}
      renderOrder={4}
      frustumCulled={false}
    />
  )
}
