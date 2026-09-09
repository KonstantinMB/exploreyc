// Small formatting helpers shared by the World boards / pulse / featured surfaces.

/** ISO-3166 alpha-2 -> regional-indicator flag emoji. Unknown input -> globe. */
export function isoFlag(iso: string): string {
  const code = (iso || '').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return '🌐'
  return String.fromCodePoint(
    0x1f1e6 + (code.charCodeAt(0) - 65),
    0x1f1e6 + (code.charCodeAt(1) - 65)
  )
}

/** Compact relative time: "12s", "4m", "2h", "3d". Never guesses beyond days. */
export function timeAgo(at: string, now: number = Date.now()): string {
  const then = new Date(at).getTime()
  if (Number.isNaN(then)) return ''
  const s = Math.max(0, Math.floor((now - then) / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

/** "Mar 2026" style date for pioneer rows. */
export function shortDate(at: string): string {
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}
