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
 *   - ONE face. There is no monospace anywhere in the World and no token left
 *     to reach for; <Money>, <Rank> and .world-num get their column alignment
 *     from `font-variant-numeric: tabular-nums`, not from a typewriter.
 *   - <Money cents={null}> prints "unknown". There is no code path that
 *     invents a number.
 *   - <Rank> renders a medal for the top three and a visually-hidden
 *     "Rank 2" / "Joint rank 2" for every rank, so the standing never depends
 *     on either colour or a bare glyph.
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
 * no blinking cursor and no monospace — the World is a place you play in, not
 * a shell prompt.
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
   Money / Rank — the score primitives
   ──────────────────────────────────────────────────────────────────────────── */

export interface MoneyProps extends HTMLAttributes<HTMLSpanElement> {
  /** Integer cents. `null`/`undefined` means genuinely unknown — never guessed. */
  cents: number | null | undefined
  /** Prefix positive amounts with "+" (deltas, 24h movement). */
  plus?: boolean
  /** Copy shown when `cents` is null. Keep it a word, not a number. */
  unknownLabel?: string
  /**
   * Score type: bigger and heavier, for the surfaces where the amount IS the
   * row rather than a detail on it. `"xl"` is the win screen.
   */
  score?: boolean | 'xl'
}

/**
 * Tabular money. When the backend has no figure, this renders "unknown" — the
 * honesty rule is enforced by the component, not by discipline at every call
 * site. `score` never applies to "unknown": inflating a non-number to 3rem
 * would make an absence look like a headline figure.
 */
export function Money({
  cents,
  plus = false,
  unknownLabel = 'unknown',
  score = false,
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
    <span
      className={cn(
        'world-tokens world-money',
        score && 'world-score',
        score === 'xl' && 'world-score--xl',
        className
      )}
      {...rest}
    >
      {sign}
      {formatDollars(cents)}
    </span>
  )
}

/** Which medal a standing earns. Anything past third is a plain numeral. */
const MEDAL_TONE: Record<number, 'gold' | 'silver' | 'bronze'> = {
  1: 'gold',
  2: 'silver',
  3: 'bronze',
}

export interface RankProps extends HTMLAttributes<HTMLSpanElement> {
  n: number
  /** True when this rank ties the row above it; prints "=4" instead of "4". */
  joint?: boolean
  /**
   * Medal treatment for ranks 1–3. On by default — pass `false` in dense
   * contexts where a 26px disc would set the row height.
   */
  medal?: boolean
}

/**
 * A standing.
 *
 * Ranks 1–3 get a gold / silver / bronze disc, because a leaderboard whose top
 * three are three identical grey numerals is a table, and this is supposed to
 * be a game. Three independent channels carry the information, so no single
 * one of them is load-bearing:
 *
 *   - the DIGIT, inside the disc, at 6–10:1 on its own fill (SC 1.4.1: the
 *     rank is never the colour);
 *   - the SHAPE — disc versus bare numeral — which says "top three" with no
 *     colour perception at all;
 *   - a visually-hidden "Rank 2" / "Joint rank 2", so a screen reader hears a
 *     standing rather than a loose number in the middle of a row.
 *
 * Joint ranks keep working: `=1` fits the pill (it flexes on padding rather
 * than being a fixed circle) and two joint firsts both wear gold, which is
 * what a tie for first means.
 */
export function Rank({ n, joint = false, medal = true, className, ...rest }: RankProps) {
  const tone = medal ? MEDAL_TONE[n] : undefined
  return (
    <span
      className={cn(
        'world-tokens world-rank',
        tone && `world-rank--medal world-rank--${tone}`,
        className
      )}
      {...rest}
    >
      <span className="sr-only">{joint ? `Joint rank ${n}` : `Rank ${n}`}</span>
      <span aria-hidden="true">{joint ? `=${n}` : n}</span>
    </span>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
   WorldLogo — a real ExploreYC company logo, or a letter that occupies the
   same box
   ──────────────────────────────────────────────────────────────────────────── */

export interface WorldLogoProps {
  /** `small_logo_thumb_url` from the companies table, or a plot's own logo. */
  src?: string | null
  /** The name the fallback letter comes from. */
  name: string
  /** Box size in px. */
  size?: number
  className?: string
}

/**
 * One tile for every company mark in the World.
 *
 * The fallback is not optional decoration: a lot of imported companies have no
 * thumb, and a board where some rows have a 28px tile and others have nothing
 * ripples the whole name column. Same box either way. `alt=""` because the
 * company name is always rendered as text right beside it — announcing it
 * twice is noise.
 */
export function WorldLogo({ src, name, size = 28, className }: WorldLogoProps) {
  const box = { width: size, height: size, fontSize: Math.round(size * 0.42) }
  if (!src) {
    return (
      <span aria-hidden="true" className={cn('world-logo', className)} style={box}>
        {name.slice(0, 1).toUpperCase()}
      </span>
    )
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      className={cn('world-logo', className)}
      style={box}
    />
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
