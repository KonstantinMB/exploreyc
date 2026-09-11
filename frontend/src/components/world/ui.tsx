/**
 * ExploreYC World — shared UI primitives.
 *
 * These used to render a bespoke design system: a rounded sans face, 16px
 * cards, full-pill buttons with a 4px press edge, and its own `--w-*` palette
 * declared in ./world.css. Sitting under the real ExploreYC <Navbar> that read
 * as two products stacked on one screen, so the whole thing is retired. The
 * component APIs are unchanged — every call site still asks for a
 * <WorldCard>, a <WorldRowButton>, a <Money> — but what they RENDER is now the
 * platform's own vocabulary, taken straight from the surfaces the owner named
 * as the reference (/founders/leaderboard, PageHeader, HackerCard):
 *
 *   - IBM Plex / JetBrains Mono for everything (`font-mono`), because the
 *     platform is a terminal-flavoured product and a rounded sans is the single
 *     loudest "different app" signal a screen can send.
 *   - `rounded-sm` (the platform's own `--radius` minus 4px, i.e. 2px), thin
 *     `border-border` hairlines, `bg-card/50` with a backdrop blur — the exact
 *     HackerCard recipe.
 *   - ONE accent, YC orange #FB651E, for money, active state and hover, exactly
 *     as FounderLeaderboardPage uses it.
 *   - Gold / silver / bronze `MEDALS` shared with the founders podium, so the
 *     two leaderboards wear the same metal.
 *
 * Colours come from the platform's HSL custom properties (`--background`,
 * `--card`, `--border`, `--muted-foreground`, …) which src/index.css declares
 * for both `:root` and `.dark`, so light and dark are handled by the same
 * mechanism as the rest of the app rather than by a second token set.
 *
 * House rules still encoded here, not left to callers:
 *   - <Money cents={null}> prints "unknown". There is no code path that
 *     invents a number.
 *   - <Rank> renders a medal badge for the top three and a visually-hidden
 *     "Rank 2" / "Joint rank 2" for every rank, so the standing never depends
 *     on either colour or a bare glyph.
 *   - <WorldChip tone="promoted" | "sponsor"> defaults its own label, so a paid
 *     placement can't be rendered without the word being visible.
 *   - Anything clickable gets a pointer cursor, a hover state, a focus-visible
 *     ring, and — where it navigates — an arrow.
 *   - NO `$ command` prompt in here. The platform's rule is one terminal
 *     eyebrow per PAGE, via <PageHeader>; a prompt on every panel is the
 *     over-use the owner rejected.
 */

import { useId, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import type {
  ButtonHTMLAttributes,
  ElementType,
  HTMLAttributes,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  Ref,
} from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Info } from 'lucide-react'
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
 * the same focus ring as the rest of the app. The rule lives in world.css and
 * is a plain 2px `#FB651E` outline with an offset — the platform's `--ring`.
 */
export const WORLD_FOCUS_CLASS = 'world-focus'

/** YC orange. The one accent, spelled the way the rest of the codebase spells it. */
export const ACCENT = '#FB651E'

/**
 * Gold · silver · bronze. Identical to the `MEDALS` array in
 * FounderLeaderboardPage — the two podiums have to wear the same metal or the
 * "same product" illusion breaks on the one screen that compares them.
 */
export const MEDALS = ['#FFC93C', '#C7CCD1', '#E08A4B'] as const

/* ────────────────────────────────────────────────────────────────────────────
   WorldCard — the platform's HackerCard, without the entry animation
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The exact class list HackerCard applies. Kept as a constant so a World card
 * and a platform card are the same object rather than two things that look
 * similar. Exported for the handful of places that need the card skin on an
 * element this component can't be (a Radix Content, a portalled sheet).
 */
export const WORLD_CARD_CLASS =
  'relative rounded-sm border border-border/80 bg-card/50 backdrop-blur-sm ' +
  'transition-all duration-300 ease-out ' +
  'hover:border-[#FB651E]/60 hover:shadow-[0_0_20px_rgba(251,101,30,0.15)] ' +
  'dark:border-white/5 dark:bg-white/[0.02]'

/* ────────────────────────────────────────────────────────────────────────────
   The overlay system — every island that floats ON the globe
   ────────────────────────────────────────────────────────────────────────────

   ONE LEFT EDGE, ONE HEIGHT, ONE PADDING, ONE RADIUS.

   The stage used to carry six floating things built six ways: the stats strip
   was a <WorldCard flat> at `px-2.5 py-1.5`, the region rail was a hand-rolled
   `border-border/80 bg-card/80` box at `p-1` with `py-1.5` children inside it,
   the legend was a two-line card at `px-3 py-2`, and the Layers trigger was a
   `size="sm"` WorldButton at `min-h-[2rem] px-3`. Stacked in a corner they did
   not line up with each other, because nothing said they had to — which is the
   exact pair of pills the owner photographed.

   So the rules are named here and imported, never retyped:

     WORLD_OVERLAY_SURFACE — the skin. Same hairline, same 95% card fill, same
       blur, same `rounded-sm`.

       BOTH BACKGROUND HALVES MUST STAY TOGETHER. <WorldCard> ends with
       `dark:bg-white/[0.02]`, and tailwind-merge cannot cancel that with an
       unprefixed `bg-card/95` — they are different variants, so both survive
       and the `dark:` one wins the cascade. That was measured, not theorised:
       every panel over the globe computed to `rgba(255,255,255,0.02)` in dark
       mode, a 2%-opaque card with body text on it floating over a lit sphere.
       Light mode was correct, which is exactly why it survived review. Naming
       the dark variant explicitly is what cancels it; drop either half and the
       bug comes back in one theme.
     WORLD_OVERLAY_PILL — the skin plus the GEOMETRY: 2.25rem tall, 0.75rem of
       horizontal padding. Anything single-line that floats on the globe uses
       it, so two of them stacked are the same height and share an edge.

   2.25rem, not 2rem: it is the height of the search field in <CountryPicker>
   and comfortably over the 24px AAA target minimum, while staying visibly
   lighter than the 2.5rem `md` button that is a real call to action. */

export const WORLD_OVERLAY_SURFACE =
  'rounded-sm border border-border/80 bg-card/95 backdrop-blur-md ' +
  'dark:border-white/10 dark:bg-card/95'

/** …plus the one height and the one padding every floating pill shares. */
export const WORLD_OVERLAY_PILL = cn(
  WORLD_OVERLAY_SURFACE,
  'flex min-h-[2.25rem] items-center gap-2 px-3 py-0',
)

export interface WorldCardProps extends HTMLAttributes<HTMLElement> {
  /** Element to render. Defaults to a plain div; use "section"/"article"/"li". */
  as?: ElementType
  /**
   * Forwarded to the rendered element. React 19 takes `ref` as an ordinary
   * prop on a function component, so this is a type declaration rather than a
   * forwardRef wrapper. <CountryPanel> needs it: a panel that opens has to be
   * able to take focus, or the keyboard route into it does not exist.
   */
  ref?: Ref<HTMLElement>
  /**
   * Drop the hover glow. The platform card glows because it is nearly always a
   * link; a purely informational panel (a legend, a status note) should not
   * imply it can be pressed.
   */
  flat?: boolean
}

/** Thin-bordered, small-radius, translucent card. No padding — callers set
 *  their own spacing so utility classes stay in charge of layout. */
export function WorldCard({ as, flat = false, className, children, ref, ...rest }: WorldCardProps) {
  // Cast to a concrete intrinsic tag: `ElementType` collapses the children
  // prop to `never` under JSX resolution. Everything we pass through is plain
  // HTMLAttributes, so a div's prop shape is a safe stand-in for any host tag.
  const Tag = (as ?? 'div') as 'div'
  return (
    <Tag
      ref={ref as Ref<HTMLDivElement>}
      className={cn(
        WORLD_CARD_CLASS,
        flat && 'hover:border-border/80 hover:shadow-none dark:hover:border-white/5',
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
   WorldButton
   ──────────────────────────────────────────────────────────────────────────── */

export type WorldButtonVariant = 'primary' | 'secondary' | 'ghost'
export type WorldButtonSize = 'lg' | 'md' | 'sm'

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-sm border font-mono font-semibold ' +
  'text-center [text-wrap:balance] min-w-0 cursor-pointer select-none ' +
  'transition-colors duration-150 motion-reduce:transition-none ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FB651E] ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
  'disabled:cursor-not-allowed disabled:opacity-40 aria-disabled:cursor-not-allowed aria-disabled:opacity-40'

const BUTTON_VARIANT: Record<WorldButtonVariant, string> = {
  // The platform's own CTA — solid orange, white mono label, darker on hover.
  // Lifted verbatim from the "Apply — Fall 2026" button on the leaderboard.
  primary: 'border-[#FB651E] bg-[#FB651E] text-white hover:bg-[#E65C00] hover:border-[#E65C00]',
  // The platform's outline control: hairline border that turns orange on hover,
  // exactly like the leaderboard's Prev/Next pagination buttons.
  secondary:
    'border-border bg-background/60 text-foreground hover:border-[#FB651E]/40 hover:text-[#FB651E]',
  ghost:
    'border-transparent bg-transparent text-muted-foreground hover:text-[#FB651E] hover:bg-[#FB651E]/[0.06]',
}

const BUTTON_SIZE: Record<WorldButtonSize, string> = {
  lg: 'min-h-[2.75rem] px-4 py-2 text-sm',
  md: 'min-h-[2.5rem] px-3.5 py-2 text-xs sm:text-sm',
  sm: 'min-h-[2rem] px-3 py-1.5 text-xs',
}

/**
 * Class list for the button. Exported so anchors and <Link>s can look identical
 * to a real button without this module having to grow a polymorphic `as` prop
 * for every element it might become.
 */
export function worldButtonClass(
  variant: WorldButtonVariant = 'primary',
  size: WorldButtonSize = 'md',
  options?: { block?: boolean; className?: string }
): string {
  return cn(
    BUTTON_BASE,
    BUTTON_VARIANT[variant],
    BUTTON_SIZE[size],
    options?.block && 'flex w-full',
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

const HEADING_SIZE: Record<1 | 2 | 3 | 4, string> = {
  1: 'text-2xl sm:text-3xl',
  2: 'text-xl',
  3: 'text-base sm:text-lg',
  4: 'text-sm',
}

/**
 * A section heading in the platform's face: bold monospace, sentence case.
 *
 * Deliberately carries NO `$` prompt and no blinking cursor. The house rule is
 * one terminal eyebrow per page, rendered by <PageHeader> at the top of the
 * route; repeating it on every panel is exactly the "too much terminal" the
 * owner rejected.
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
    <div className={cn('flex items-baseline justify-between gap-4', className)}>
      <Tag
        className={cn(
          'min-w-0 font-mono font-bold leading-tight [text-wrap:balance]',
          HEADING_SIZE[level]
        )}
        {...rest}
      >
        {children}
      </Tag>
      {action ? (
        <div className="flex-none self-center font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          {action}
        </div>
      ) : null}
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

const CHIP_TONE: Record<WorldChipTone, string> = {
  neutral: 'border-border bg-muted/40 text-muted-foreground',
  accent: 'border-[#FB651E]/40 bg-[#FB651E]/[0.08] text-[#FB651E]',
  // Solid fills so the disclosure survives any backdrop — these are a promise
  // the product makes, not decoration.
  promoted: 'border-[#FB651E] bg-[#FB651E] text-white',
  sponsor: 'border-foreground bg-foreground text-background',
}

export function WorldChip({ tone = 'neutral', className, children, ...rest }: WorldChipProps) {
  const label = children ?? CHIP_DEFAULT_LABEL[tone] ?? null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 py-0.5',
        'font-mono text-[10px] font-semibold uppercase tracking-wide leading-relaxed',
        CHIP_TONE[tone],
        className
      )}
      {...rest}
    >
      {label}
    </span>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
   Money / Rank — the score primitives
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Class list for a money figure, so <CountUp> (which owns its own element) can
 * render one that is byte-identical to <Money>.
 *
 * `score` is the leaderboard treatment — the big orange figure on the right of
 * a row, which is how FounderLeaderboardPage sets its headline stat. `xl` is
 * the win screen.
 */
export function moneyClass(score: boolean | 'xl' = false, className?: string): string {
  return cn(
    'font-mono font-bold tabular-nums',
    score && 'text-[#FB651E]',
    score === true && 'text-sm sm:text-base',
    score === 'xl' && 'block text-4xl font-black tracking-tight sm:text-5xl',
    className
  )
}

export interface MoneyProps extends HTMLAttributes<HTMLSpanElement> {
  /** Integer cents. `null`/`undefined` means genuinely unknown — never guessed. */
  cents: number | null | undefined
  /** Prefix positive amounts with "+" (deltas, 24h movement). */
  plus?: boolean
  /** Copy shown when `cents` is null. Keep it a word, not a number. */
  unknownLabel?: string
  /**
   * Score type: bigger, heavier and orange, for the surfaces where the amount
   * IS the row rather than a detail on it. `"xl"` is the win screen.
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
      <span className={cn('font-mono font-medium text-muted-foreground', className)} {...rest}>
        {unknownLabel}
      </span>
    )
  }
  const sign = plus && cents > 0 ? '+' : ''
  return (
    <span className={moneyClass(score, className)} {...rest}>
      {sign}
      {formatDollars(cents)}
    </span>
  )
}

export interface RankProps extends HTMLAttributes<HTMLSpanElement> {
  n: number
  /** True when this rank ties the row above it; prints "=4" instead of "4". */
  joint?: boolean
  /**
   * Medal treatment for ranks 1–3. On by default — pass `false` in dense
   * contexts where a badge would set the row height.
   */
  medal?: boolean
}

/**
 * A standing, rendered as the platform's own RankBadge.
 *
 * This is the same square, hairline-bordered, tabular-mono badge
 * FounderLeaderboardPage puts at the head of every leaderboard row: amber for
 * #1, zinc for #2, dark orange for #3, muted for everybody else. Three
 * independent channels carry the information, so no single one is load-bearing:
 *
 *   - the DIGIT, at full contrast on its own tint (SC 1.4.1: the rank is never
 *     the colour);
 *   - the TINT — a coloured wash versus the flat muted chip — which says
 *     "top three";
 *   - a visually-hidden "Rank 2" / "Joint rank 2", so a screen reader hears a
 *     standing rather than a loose number in the middle of a row.
 *
 * Joint ranks keep working: `=1` fits because the badge flexes on padding
 * rather than being a fixed square, and two joint firsts both wear amber,
 * which is what a tie for first means.
 */
export function Rank({ n, joint = false, medal = true, className, ...rest }: RankProps) {
  const tone =
    medal && n === 1
      ? 'bg-amber-400/15 text-amber-500 border-amber-400/40'
      : medal && n === 2
        ? 'bg-zinc-400/15 text-zinc-500 border-zinc-400/40 dark:text-zinc-300'
        : medal && n === 3
          ? 'bg-orange-700/15 text-orange-600 border-orange-700/40 dark:text-orange-400'
          : 'bg-muted text-muted-foreground border-border'
  return (
    <span
      className={cn(
        'inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-sm border px-1',
        'font-mono text-xs font-bold tabular-nums sm:h-9 sm:min-w-9 sm:text-sm',
        tone,
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
  const base =
    'grid flex-none place-items-center overflow-hidden rounded-sm border border-border ' +
    'bg-muted/50 object-cover font-mono font-bold leading-none text-muted-foreground'
  if (!src) {
    return (
      <span aria-hidden="true" className={cn(base, className)} style={box}>
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
      className={cn(base, className)}
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
  /** Right-hand content before the arrow — usually <Money> or a chip. */
  trailing?: ReactNode
  /** Internal route. Renders a react-router <Link>. */
  to?: string
  /** External URL. Renders an <a> with safe rel. */
  href?: string
  onClick?: (event: ReactMouseEvent<HTMLElement>) => void
  disabled?: boolean
  /** Hide the arrow for rows that act rather than navigate. */
  showChevron?: boolean
}

/**
 * A full-width leaderboard row — the platform's LeaderboardRow, exactly.
 *
 * Rows are separated by a hairline `border-b` rather than being individual
 * floating cards, they wash orange on hover, a 3px orange edge grows from the
 * left, the name turns orange and the arrow nudges. Renders <Link> for `to`,
 * <a> for `href`, <button> otherwise.
 *
 * Because a row is now a divided list item rather than a card, the LISTS that
 * hold these must not add their own gap — see WorldBoards / the country page,
 * which stack them flush inside a single <WorldCard>.
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
      {/* The leading edge — 3px of orange that grows on hover/focus so there is
          never a doubt about which row is under the cursor. */}
      <span
        aria-hidden="true"
        className="absolute bottom-0 left-0 top-0 w-[3px] origin-center scale-y-0 bg-[#FB651E] transition-transform duration-200 group-hover:scale-y-100 group-focus-visible:scale-y-100 motion-reduce:transition-none"
      />
      {leading != null ? (
        <span className="flex flex-none items-center gap-2 sm:gap-2.5">{leading}</span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold transition-colors group-hover:text-[#FB651E]">
          {title}
        </span>
        {subtitle != null ? (
          <span className="block truncate font-mono text-xs text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
      {trailing != null ? (
        <span className="flex flex-none items-center gap-2 text-right">{trailing}</span>
      ) : null}
      {showChevron ? (
        <ArrowRight
          className="hidden h-4 w-4 flex-none text-muted-foreground/40 transition-colors group-hover:text-[#FB651E] sm:inline-block"
          aria-hidden="true"
        />
      ) : null}
    </>
  )

  const classes = cn(
    'group relative flex w-full items-center gap-3 border-b border-border/50 px-3 py-3 text-left sm:gap-4 sm:px-4',
    'transition-colors last:border-b-0 motion-reduce:transition-none',
    disabled
      ? 'cursor-not-allowed opacity-60'
      : 'cursor-pointer hover:bg-[#FB651E]/[0.04] focus-visible:bg-[#FB651E]/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FB651E]',
    className
  )

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

/* ────────────────────────────────────────────────────────────────────────────
   InfoTip — the explanation that is not a paragraph
   ──────────────────────────────────────────────────────────────────────────── */

export interface InfoTipProps {
  /**
   * The accessible name of the trigger — "what the tip is about", not the tip
   * itself. Spoken as "How rank works, button" before the description.
   */
  label: string
  /** The explanation. One or two short sentences; this is not a document. */
  children: ReactNode
  /**
   * Which edge of the bubble lines up with the trigger. `end` for anything in
   * the right-hand rail, `start` on the left — a centred bubble on a 320px
   * screen is how a panel gains a horizontal scrollbar.
   */
  align?: 'start' | 'center' | 'end'
  className?: string
}

/**
 * A small ⓘ whose explanation appears on hover, on focus and on press.
 *
 * THE REASON THIS EXISTS: the World surfaces used to teach with prose — a
 * muted paragraph under every control explaining what rank is, what a top-up
 * costs, what "planted" means. The owner's instruction was the opposite:
 * "add info hover ons/buttons icons to give the explanations as opposed to
 * writing them down". So the paragraphs come out and this goes in.
 *
 * The accessibility is not an afterthought and it is deliberately simple:
 *
 *   - The description lives in the DOM at all times and the trigger points at
 *     it with `aria-describedby`, so a screen reader hears the explanation on
 *     focus whether or not the bubble is visually open. Closed, it is
 *     `sr-only` — visually absent, never removed from the accessibility tree.
 *   - The trigger is a real `<button type="button">`: Tab reaches it, Enter and
 *     Space toggle it, and it never submits a form it happens to be inside.
 *   - Escape closes it, and the key is swallowed so it does not also close the
 *     dialog the tip is sitting in.
 *   - Pointer hover opens it, focus opens it, and a press toggles it — which is
 *     the only one of the three a touch device has.
 *
 * The bubble is `absolute` inside an `inline-flex` wrapper, so it never
 * contributes to layout and never widens the panel it sits in.
 */
export function InfoTip({ label, children, align = 'start', className }: InfoTipProps) {
  const id = useId()
  const [open, setOpen] = useState(false)

  const onKeyDown = (event: ReactKeyboardEvent<HTMLSpanElement>) => {
    if (event.key !== 'Escape' || !open) return
    event.stopPropagation()
    setOpen(false)
  }

  return (
    <span
      className={cn('relative inline-flex align-middle', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        /*
         * Keyboard focus opens it (the ARIA tooltip pattern requires that);
         * focus arriving any other way does not. The difference matters because
         * a dialog that autofocuses its first tabbable child will land here —
         * and a tooltip that unfurls over the form the moment a modal opens is
         * a bug, not help. `:focus-visible` is exactly the browser's own
         * "did a keyboard put you here" answer, so we ask it rather than
         * tracking input modality ourselves.
         */
        onFocus={(event) => {
          if (event.currentTarget.matches(':focus-visible')) setOpen(true)
        }}
        onBlur={() => setOpen(false)}
        className={cn(
          'inline-grid h-5 w-5 shrink-0 cursor-help place-items-center rounded-sm',
          'text-muted-foreground transition-colors duration-150 motion-reduce:transition-none',
          'hover:text-[#FB651E] focus-visible:outline-none focus-visible:ring-2',
          'focus-visible:ring-[#FB651E] focus-visible:ring-offset-1 focus-visible:ring-offset-background',
          open && 'text-[#FB651E]'
        )}
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </button>
      <span
        id={id}
        role="tooltip"
        className={
          open
            ? cn(
                // 13rem, and clamped to the viewport under it. The bubble is
                // absolutely positioned, so the only thing stopping it running
                // off the edge of a 20rem rail is its own width and the `align`
                // the call site picked — keep both honest.
                'absolute top-full z-50 mt-1.5 w-[min(13rem,calc(100vw-2rem))]',
                'rounded-sm border border-border bg-card px-2.5 py-2 shadow-lg',
                'font-mono text-[11px] font-normal normal-case leading-snug tracking-normal text-foreground',
                align === 'end' ? 'right-0' : align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0'
              )
            : 'sr-only'
        }
      >
        {children}
      </span>
    </span>
  )
}
