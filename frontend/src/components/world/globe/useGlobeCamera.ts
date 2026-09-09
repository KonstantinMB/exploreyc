import { useCallback, useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { latLngToVector3 } from './geo'

/**
 * Camera choreography for the globe.
 *
 * Two things live here because they are the same concern: how the camera moves,
 * and whether it is allowed to move at all.
 */

export interface FlyToOptions {
  /** Camera distance from the globe centre at the end of the flight. */
  distance?: number
  /** Flight time in milliseconds. */
  duration?: number
  /** Jump straight there. Also what a reduced-motion visitor always gets. */
  immediate?: boolean
}

export interface GlobeCameraApi {
  /** Rotate the globe so (lat, lng) faces the camera. */
  flyTo: (lat: number, lng: number, opts?: FlyToOptions) => void
  /** Abandon the current flight and leave the camera where it is. */
  cancel: () => void
  /**
   * True while a flight is running. A ref, not state, so `useFrame` callbacks
   * can gate on it without dragging the whole scene through a re-render sixty
   * times a second.
   */
  flying: React.RefObject<boolean>
}

/**
 * Structural view of drei's OrbitControls.
 *
 * Typed by shape rather than by importing `three-stdlib`, so this module never
 * depends on drei's internals being resolvable from application code.
 */
export interface OrbitLike {
  update: () => unknown
  target: THREE.Vector3
  enabled: boolean
  autoRotate: boolean
  autoRotateSpeed: number
}

const IDENTITY = new THREE.Quaternion()
const DEFAULT_DURATION = 1400

/** Cubic in-out. Slow departure, slow arrival, no linear middle to give it away. */
function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

/**
 * `prefers-reduced-motion`, live.
 *
 * Starts `false` and corrects itself in an effect, so the first render is
 * deterministic. Vestibular disorders are not a preference to be sampled once
 * at load either — the listener stays attached.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  return reduced
}

/**
 * Must be called from inside the `<Canvas>` — it reads the camera and the
 * default controls out of the r3f store.
 */
export function useGlobeCamera(): GlobeCameraApi {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as OrbitLike | null
  const reduced = usePrefersReducedMotion()

  const flying = useRef(false)
  const flight = useRef({
    active: false,
    startedAt: 0,
    duration: DEFAULT_DURATION,
    fromDir: new THREE.Vector3(0, 0, 1),
    rotation: new THREE.Quaternion(),
    fromDistance: 2.6,
    toDistance: 2.6,
    dir: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
  })

  const place = useCallback(
    (dir: THREE.Vector3, distance: number) => {
      camera.position.copy(dir).multiplyScalar(distance)
      camera.up.set(0, 1, 0)
      camera.lookAt(0, 0, 0)
    },
    [camera],
  )

  const cancel = useCallback(() => {
    flight.current.active = false
    flying.current = false
  }, [])

  const flyTo = useCallback(
    (lat: number, lng: number, opts: FlyToOptions = {}) => {
      const f = flight.current

      // Poles are a gimbal trap: a camera directly above one has no unambiguous
      // "up", and OrbitControls snaps to a random azimuth on the next drag.
      const target = latLngToVector3(
        THREE.MathUtils.clamp(lat, -85, 85),
        lng,
        1,
      ).normalize()

      const fromDistance = camera.position.length() || 2.6
      const toDistance = opts.distance ?? fromDistance

      f.fromDir.copy(camera.position)
      if (f.fromDir.lengthSq() < 1e-8) f.fromDir.set(0, 0, 1)
      f.fromDir.normalize()
      f.rotation.setFromUnitVectors(f.fromDir, target)
      f.fromDistance = fromDistance
      f.toDistance = toDistance

      const duration =
        opts.immediate || reduced ? 0 : (opts.duration ?? DEFAULT_DURATION)

      if (duration <= 0) {
        f.active = false
        flying.current = false
        place(target, toDistance)
        controls?.update()
        return
      }

      f.startedAt = performance.now()
      f.duration = duration
      f.active = true
      flying.current = true
    },
    [camera, controls, place, reduced],
  )

  useFrame(() => {
    const f = flight.current
    if (!f.active) return

    const raw = THREE.MathUtils.clamp(
      (performance.now() - f.startedAt) / f.duration,
      0,
      1,
    )
    const k = easeInOutCubic(raw)

    // Slerp the *direction*, not the position. Lerping positions cuts a chord
    // through the globe and the camera dives at the surface halfway across.
    f.quat.copy(IDENTITY).slerp(f.rotation, k)
    f.dir.copy(f.fromDir).applyQuaternion(f.quat)

    // Pull back a little at the midpoint. Costs nothing and is the difference
    // between "a camera moved" and "two numbers were interpolated".
    const arc = 1 + Math.sin(Math.PI * k) * 0.14
    place(f.dir, THREE.MathUtils.lerp(f.fromDistance, f.toDistance, k) * arc)
    controls?.update()

    if (raw >= 1) {
      f.active = false
      flying.current = false
    }
  })

  return { flyTo, cancel, flying }
}
