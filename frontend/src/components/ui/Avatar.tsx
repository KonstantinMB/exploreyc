/** Round avatar: shows the image if present, else an initial on an orange chip. */
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
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?'
  const style = { width: size, height: size }
  if (src) {
    return <img src={src} alt="" style={style} className={`rounded-full object-cover border border-border ${className}`} draggable={false} />
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
