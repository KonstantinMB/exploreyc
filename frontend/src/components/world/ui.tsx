/**
 * ExploreYC World — shared UI primitives.
 *
 * The whole World feature is built from these. They exist so the surfaces stop
 * looking like a terminal and start looking like something you can press:
 * bright, physical, one accent (YC orange), and identical physicality in light
 * and dark. Tokens and every visual rule live in ./world.css — this file only
 * decides structure, semantics and keyboard behaviour.
 *
 * House rules encoded here, not left to callers:
 *   - Monospace is only ever reached through <Money> and <Rank>. Everything
 *     else renders in the rounded sans face.
 *   - <Money cents={null}> prints "unknown". There is no code path that
 *     invents a number.
 *   - <WorldChip tone="promoted" | "sponsor"> defaults its own label, so a paid
 *     placement can't be rendered without the word being visible.
 *   - Anything clickable gets a pointer cursor, a hover state, a press state, a
 *     focus-visible ring, and — where it navigates — a chevron.
 *
 * Usage: put `world-root` on the outermost element of a World page/panel.
 *   <div className="world-root min-h-screen">…</div>
 * Each primitive also carries `world-tokens`, so it still themes correctly when
 * React portals it out of that tree.
 */

import type {
  ButtonHTMLAttributes,
  ElementType,
  HTMLAttributes,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  Ref,
} from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import { formatDollars } from './constants'

// world.css is imported globally from src/index.css rather than here on
// purpose: loading it before `@tailwind utilities` keeps Tailwind utilities
// winning ties, so callers can still override any primitive with a utility
// class. Importing it from this module would put it in the lazy /world chunk,
// i.e. *after* the utilities, and silently invert that.

/** Class for the outermost element of any World surface. */
export const WORLD_ROOT_CLASS = 'world-root'

/**
 * Put this on any clickable that isn't one of the primitives below and it gets
 * the same focus ring as the rest of the feature. Please use it rather than
 * hand-rolling a ring: the layered one in world.css is what clears 3:1 against
 * both the card and the page ground, in both themes.
 */
export const WORLD_FOCUS_CLASS = 'world-focus'

/* ────────────────────────────────────────────────────────────────────────────
   WorldButton
   ──────────────────────────────────────────────────────────────────────────── */

export type WorldButtonVariant = 'primary' | 'secondary' | 'ghost'
export type WorldButtonSize = 'lg' | 'md' | 'sm'

/**
 * Class list for the physical pill. Exported so anchors and <Link>s can look
 * identical to a real button without this module having to grow a polymorphic
 * `as` prop for every element it might become.
 */
export function worldButtonClass(
  variant: WorldButtonVariant = 'primary',
  size: WorldButtonSize = 'md',
  options?: { block?: boolean; className?: string }
): string {
  return cn(
    'world-tokens world-btn',
    `world-btn--${variant}`,
    `world-btn--${size}`,
    options?.block && 'world-btn--block',
    options?.className
  )
}

export interface WorldButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: WorldButtonVariant
  size?: WorldButtonSize
  /** Stretch to the full width of the container. */
  block?: boolean
  ref?: Ref<HTMLButtonElement>
}

/**
 * The press: a 4px hard edge under the pill that collapses when you push it.
 * `type` defaults to "button" so a button inside a form never submits by
 * accident — opt in with type="submit".
 */
export function WorldButton({
  variant = 'primary',
  size = 'md',
  block = false,
  className,
  type = 'button',
  children,
  ...rest
}: WorldButtonProps) {
  return (
    <button
      type={type}
      className={worldButtonClass(variant, size, { block, className })}
      {...rest}
    >
      {children}
    </button>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
   WorldCard
   ──────────────────────────────────────────────────────────────────────────── */

export interface WorldCardProps extends HTMLAttributes<HTMLElement> {
  /** Element to render. Defaults to a plain div; use "section"/"article"/"li". */
  as?: ElementType
  /** Drop the elevation shadow but keep surface, border and radius. */
  flat?: boolean
}

/** 16px radius, card surface, hairline border, soft elevation. No padding —
 *  callers set their own spacing so utility classes stay in charge of layout. */
export function WorldCard({ as, flat = false, className, children, ...rest }: WorldCardProps) {
  // Cast to a concrete intrinsic tag: `ElementType` collapses the children
  // prop to `never` under JSX resolution. Everything we pass through is plain
  // HTMLAttributes, so a div's prop shape is a safe stand-in for any host tag.
  const Tag = (as ?? 'div') as 'div'
  return (
    <Tag
      className={cn('world-tokens world-card', flat && 'world-card--flat', className)}
      {...rest}
    >
      {children}
    </Tag>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
   WorldHeading
   ──────────────────────────────────────────────────────────────────────────── */

export interface WorldHeadingProps extends Omit<HTMLAttributes<HTMLHeadingElement>, 'children'> {
  /** Heading rank, 1–4. Picks both the tag and the type scale. */
  level?: 1 | 2 | 3 | 4
  children: ReactNode
  /** Optional right-aligned slot: a link, a count, a small button. */
  action?: ReactNode
  /** Class for the wrapper (heading + action row). */
  className?: string
}

/**
 * A plain sentence-case heading. Deliberately has no "$ " prefix, no ">_",
 * no blinking cursor — the World is a place, not a shell prompt.
 */
export function WorldHeading({
  level = 2,
  children,
  action,
  className,
  ...rest
}: WorldHeadingProps) {
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4'
  return (
    <div className={cn('world-tokens world-heading', `world-heading--${level}`, className)}>
      <Tag className="world-heading__text" {...rest}>
        {children}
      </Tag>
      {action ? <div className="world-heading__action">{action}</div> : null}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
   WorldChip
   ──────────────────────────────────────────────────────────────────────────── */

export type WorldChipTone = 'neutral' | 'accent' | 'promoted' | 'sponsor'

export interface WorldChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: WorldChipTone
  /** Omit for the paid-placement tones — they label themselves. */
  children?: ReactNode
}

/** Default copy for the disclosure tones. A promoted row cannot be rendered
 *  without the word "Promoted" appearing on it. */
const CHIP_DEFAULT_LABEL: Partial<Record<WorldChipTone, string>> = {
  promoted: 'Promoted',
  sponsor: 'Sponsor',
}

export function WorldChip({ tone = 'neutral', className, children, ...rest }: WorldChipProps) {
  const label = children ?? CHIP_DEFAULT_LABEL[tone] ?? null
  return (
    <span className={cn('world-tokens world-chip', `world-chip--${tone}`, className)} {...rest}>
      {label}
    </span>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
   Money / Rank — the only monospace primitives
   ──────────────────────────────────────────────────────────────────────────── */

export interface MoneyProps extends HTMLAttributes<HTMLSpanElement> {
  /** Integer cents. `null`/`undefined` means genuinely unknown — never guessed. */
  cents: number | null | undefined
  /** Prefix positive amounts with "+" (deltas, 24h movement). */
  plus?: boolean
  /** Copy shown when `cents` is null. Keep it a word, not a number. */
  unknownLabel?: string
}

/**
 * Tabular money. When the backend has no figure, this renders "unknown" in the
 * prose face — the honesty rule is enforced by the component, not by discipline
 * at every call site.
 */
export function Money({
  cents,
  plus = false,
  unknownLabel = 'unknown',
  className,
  ...rest
}: MoneyProps) {
  if (cents == null) {
    return (
      <span className={cn('world-tokens world-unknown', className)} {...rest}>
        {unknownLabel}
      </span>
    )
  }
  const sign = plus && cents > 0 ? '+' : ''
  return (
    <span className={cn('world-tokens world-money', className)} {...rest}>
      {sign}
      {formatDollars(cents)}
    </span>
  )
}

export interface RankProps extends HTMLAttributes<HTMLSpanElement> {
  n: number
  /** True when this rank ties the row above it; prints "=4" instead of "4". */
  joint?: boolean
}

/** Right-aligned tabular rank numeral. */
export function Rank({ n, joint = false, className, ...rest }: RankProps) {
  return (
    <span className={cn('world-tokens world-rank', className)} {...rest}>
      {joint ? `=${n}` : n}
    </span>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
   WorldRowButton — the leaderboard row primitive
   ──────────────────────────────────────────────────────────────────────────── */

export type WorldRowButtonProps = Omit<
  HTMLAttributes<HTMLElement>,
  'title' | 'children' | 'onClick'
> & {
  /** Rank, flag, avatar — anything that identifies the row at a glance. */
  leading?: ReactNode
  /** Primary line. Truncates rather than wrapping so rows stay one height. */
  title: ReactNode
  /** Optional second line in muted type. */
  subtitle?: ReactNode
  /** Right-hand content before the chevron — usually <Money> or a chip. */
  trailing?: ReactNode
  /** Internal route. Renders a react-router <Link>. */
  to?: string
  /** External URL. Renders an <a> with safe rel. */
  href?: string
  onClick?: (event: ReactMouseEvent<HTMLElement>) => void
  disabled?: boolean
  /** Hide the chevron for rows that act rather than navigate. */
  showChevron?: boolean
}

/**
 * A full-width row that looks like a button, because it is one. Hover and
 * keyboard focus both lift it, reveal a 3px orange leading edge and nudge the
 * chevron — three simultaneous signals, so "what am I clicking" is never a
 * question. Renders <Link> for `to`, <a> for `href`, <button> otherwise.
 */
export function WorldRowButton({
  leading,
  title,
  subtitle,
  trailing,
  to,
  href,
  onClick,
  disabled = false,
  showChevron = true,
  className,
  ...rest
}: WorldRowButtonProps) {
  const inner = (
    <>
      {leading != null ? <span className="world-row__leading">{leading}</span> : null}
      <span className="world-row__body">
        <span className="world-row__title">{title}</span>
        {subtitle != null ? <span className="world-row__subtitle">{subtitle}</span> : null}
      </span>
      {trailing != null ? <span className="world-row__trailing">{trailing}</span> : null}
      {showChevron ? <ChevronRight className="world-row__chevron" aria-hidden="true" /> : null}
    </>
  )

  const classes = cn('world-tokens world-row', className)

  // Disabled navigation degrades to an inert button rather than a dead link.
  if (to && !disabled) {
    return (
      <Link to={to} className={classes} onClick={onClick} {...rest}>
        {inner}
      </Link>
    )
  }

  if (href && !disabled) {
    return (
      <a
        href={href}
        className={classes}
        onClick={onClick}
        rel="noopener noreferrer"
        target="_blank"
        {...rest}
      >
        {inner}
      </a>
    )
  }

  return (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      disabled={disabled}
      {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {inner}
    </button>
  )
}
