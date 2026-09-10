// Shared field styling for the claim wizard.
//
// The primitives in ../ui.tsx cover buttons, cards, headings, chips and
// numerals. Form controls are the gap: `<input>`, `<textarea>` and `<select>`
// do NOT inherit the page font, and the app's global Tailwind theme still
// resolves `border-input` / `bg-background` to the old near-black terminal
// palette. So every control in this directory is dressed from the World tokens
// declared on `.world-root` / `.world-tokens` (see ../world.css) instead.
//
// Rules encoded here so no call site has to remember them:
//   - Prose, labels, hints and controls use --w-sans. Only the money input
//     uses --w-mono, because a stake is a numeral.
//   - Errors are the accent, never a second hue (non-negotiable #4). They are
//     always paired with an icon and a word, so colour is never the only
//     signal (SC 1.4.1).
//   - Every control is at least 44px tall — a real touch target.
//   - Focus comes from `world-focus`, the one ring that clears 3:1 on both the
//     card and the page ground in both themes. Controls are radius-chip (10px)
//     to match the radius that class applies.

import type { CSSProperties } from 'react'
import { cn } from '../../../lib/utils'

/** The friendly sans. Form controls need it applied explicitly. */
export const SANS: CSSProperties = { fontFamily: 'var(--w-sans)' }

/** Tabular numerals — money and other figures only. */
export const MONO: CSSProperties = { fontFamily: 'var(--w-mono)' }

/** Small sentence-case label above a control. Not uppercase, not a command. */
export const LABEL = 'text-[0.9375rem] font-semibold leading-tight text-[color:var(--w-ink)]'

/** Muted helper text under a control. */
export const HINT = 'text-[0.8125rem] leading-snug text-[color:var(--w-muted)]'

/**
 * Small label over a block ("Read this", "Your spot"). Sentence case, in the
 * sans face: the old surface set these in uppercase mono with wide tracking,
 * which is the exact typographic tell of the terminal look we are replacing.
 */
export const SECTION_LABEL = 'text-[0.8125rem] font-bold text-[color:var(--w-muted)]'

/**
 * Error text. Accent-coloured (the only hue in the system) and always rendered
 * next to an AlertCircle, so it does not depend on colour to be understood.
 */
export const ERROR_TEXT =
  'flex items-start gap-1.5 text-[0.8125rem] font-semibold leading-snug text-[color:var(--w-accent-text)]'

/** A text input, select or anything that behaves like one. */
export const INPUT = cn(
  'world-focus block w-full min-h-[2.75rem] rounded-[10px] px-3.5 py-2',
  'border border-[color:var(--w-border)] bg-[color:var(--w-card)]',
  'text-[0.9375rem] text-[color:var(--w-ink)] placeholder:text-[color:var(--w-muted)]',
  'outline-none transition-colors duration-150',
  'hover:border-[color:var(--w-accent)] focus:border-[color:var(--w-accent)]',
  'motion-reduce:transition-none',
)

/** Same, for a control currently reporting an error. */
export const INPUT_INVALID = 'border-[color:var(--w-accent)] bg-[color:var(--w-tint)]'

/** Multi-line variant — same skin, taller, no resize handle. */
export const TEXTAREA = cn(INPUT, 'resize-none leading-snug')

/**
 * A clickable surface that is not one of the ../ui.tsx primitives: the scope
 * rows in the amount step, the step pills, city results. Gives the same four
 * signals every clickable in the World owes the visitor — pointer, hover,
 * press, focus ring.
 *
 * `world-focus` no longer forces a radius while focused (it used to, and pills
 * wearing it snapped to a 10px square on tab), so a control keeps whatever
 * `rounded-*` it declares. Anything that is already a pill and behaves like a
 * button is still better off as a <WorldButton>, which owns its own ring.
 */
export const PRESSABLE = cn(
  'world-focus cursor-pointer select-none transition-[transform,background-color,border-color,box-shadow]',
  'duration-[120ms] ease-out active:translate-y-[1px]',
  'motion-reduce:transition-none motion-reduce:active:translate-y-0',
)
