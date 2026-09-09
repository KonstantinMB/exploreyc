import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

/**
 * Count-up numeral: animates between successive values with an ease-out ramp.
 * With prefers-reduced-motion the number simply snaps — no tween ever runs.
 */
export function CountUp({
  value,
  format,
  duration = 600,
  className,
}: {
  value: number
  /** Formats the in-flight integer (e.g. formatDollars). Defaults to toLocaleString. */
  format?: (n: number) => string
  duration?: number
  className?: string
}) {
  const reduced = useReducedMotion()
  const [display, setDisplay] = useState(value)
  const prev = useRef(value)

  useEffect(() => {
    const from = prev.current
    prev.current = value
    if (reduced || from === value) {
      setDisplay(value)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.round(from + (value - from) * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, reduced, duration])

  return (
    <span className={className}>
      {format ? format(display) : display.toLocaleString('en-US')}
    </span>
  )
}

export default CountUp
