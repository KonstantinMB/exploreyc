// Shared field styling for the World's form controls.
//
// Lived in `claim/styles.ts` until the claim wizard was deleted; it moved up a
// level because the two things that still use it — <StakeModal> and
// <CountryPicker> — are not part of any wizard.
//
// The primitives in ../ui.tsx cover buttons, cards, headings, chips and
// numerals. Form controls are the gap: `<input>`, `<textarea>` and `<select>`
// do NOT inherit the page font, so the face has to be set on them explicitly.
//
// Everything here is the PLATFORM's vocabulary, matching the batch <select> on
// /founders/leaderboard: a hairline `border-border` box on `bg-background/50`,
// `rounded-sm`, monospace, orange on focus.
//
// Rules encoded here so no call site has to remember them:
//   - Monospace, like the rest of ExploreYC. Figures additionally get
//     `tabular-nums` so a stake does not shuffle as you type it.
//   - Errors are the accent, never a second hue. They are always paired with an
//     icon and a word, so colour is never the only signal (SC 1.4.1).
//   - Every control is at least 44px tall — a real touch target.
//   - Focus comes from `world-focus`, the platform's orange ring.

import type { CSSProperties } from 'react'
import { cn } from '../../lib/utils'

/** The platform face. Form controls need it applied explicitly. */
export const SANS: CSSProperties = {
  fontFamily: "'IBM Plex Mono', 'JetBrains Mono', ui-monospace, monospace",
}

/** Tabular numerals — money and other figures only. */
export const TABULAR: CSSProperties = {
  fontFamily: "'IBM Plex Mono', 'JetBrains Mono', ui-monospace, monospace",
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum" 1',
}

/** Small label above a control. */
export const LABEL = 'text-sm font-semibold leading-tight text-foreground'

/** Muted helper text under a control. */
export const HINT = 'text-xs leading-snug text-muted-foreground font-mono'

/** Small label over a block ("Read this", "Your spot"). */
export const SECTION_LABEL =
  'font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'

/**
 * Error text. Accent-coloured (the only hue in the system) and always rendered
 * next to an AlertCircle, so it does not depend on colour to be understood.
 */
export const ERROR_TEXT =
  'flex items-start gap-1.5 font-mono text-xs font-semibold leading-snug text-[#FB651E]'

/** A text input, select or anything that behaves like one. */
export const INPUT = cn(
  'world-focus block w-full min-h-[2.75rem] rounded-sm px-3 py-2',
  'border border-border bg-background/50 font-mono',
  'text-sm text-foreground placeholder:text-muted-foreground',
  'outline-none transition-colors duration-150',
  'hover:border-[#FB651E]/40 focus:border-[#FB651E]/60',
  'motion-reduce:transition-none',
)

/** Same, for a control currently reporting an error. */
export const INPUT_INVALID = 'border-[#FB651E] bg-[#FB651E]/[0.05]'

/** Multi-line variant — same skin, taller, no resize handle. */
export const TEXTAREA = cn(INPUT, 'resize-none leading-snug')

/**
 * A clickable surface that is not one of the ../ui.tsx primitives: the scope
 * rows in the amount step, the step pills, city results. Gives the same signals
 * every clickable in the app owes the visitor — pointer, hover, focus ring.
 */
export const PRESSABLE = cn(
  'world-focus cursor-pointer select-none transition-[background-color,border-color,color]',
  'duration-150 ease-out motion-reduce:transition-none',
)
