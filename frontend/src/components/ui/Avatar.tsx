import { useEffect, useState } from 'react'

/** Round avatar: shows the image if present, else an initial on an orange chip.
 * Falls back to the initial chip when the image fails to load (e.g. an expired
 * signed avatar URL), so broken-image icons never leak into the UI. */
export function Avatar({
  src,
  name,
  size = 32,
  className = '',
}: {
  src?: string | null
  name?: string
  size?: number
  className?: string
}) {
  const [errored, setErrored] = useState(false)
  // Reset the error state if the source changes (component instance reuse).
  useEffect(() => setErrored(false), [src])

  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?'
  const style = { width: size, height: size }

  if (src && !errored) {
    return (
      <img
        src={src}
        alt=""
        style={style}
        onError={() => setErrored(true)}
        className={`rounded-full object-cover border border-border ${className}`}
        draggable={false}
      />
    )
  }
  return (
    <div
      style={style}
      className={`rounded-full bg-[#FB651E]/15 text-[#FB651E] flex items-center justify-center font-bold select-none ${className}`}
    >
      <span style={{ fontSize: Math.round(size * 0.45) }}>{initial}</span>
    </div>
  )
}
