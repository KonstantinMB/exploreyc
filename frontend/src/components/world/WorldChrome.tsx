/**
 * ExploreYC chrome for the World's content sub-pages.
 *
 * WHY THIS EXISTS: /world/c/:iso, /world/p/:id and /world/claimed are real
 * pages people land on from a share link, and until now they had a single
 * "Back to the globe" text link and nothing else — no brand mark, no way into
 * the rest of ExploreYC. They read as a different website. This is the same
 * furniture the main app's <Navbar> puts on every other page: the ExploreYC
 * mark, the same primary sections in the same order, the same orange
 * "you are here", the same dark-mode toggle.
 *
 * WHAT IT IS DELIBERATELY NOT: the main <Navbar> itself. That component is
 * `font-mono`, subtitles the logo with "$ startup-db", and resolves its colours
 * from the app's near-black terminal theme — all three are precisely what the
 * World was redesigned away from. So this aligns on BRAND (the mark, the
 * sections, YC orange, the sticky bar, the spacing) and renders it in the
 * World's own rounded sans on the World's own surfaces. Alignment, not
 * transplantation.
 *
 * WHERE IT MUST NOT GO: /world and /world/claim. The map is the page — a nav
 * bar over the globe is the product principle those two surfaces exist to
 * honour. They carry their own floating "ExploreYC" back control instead.
 */

import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useApp } from '../../contexts/AppContext'
import { Logo } from '../ui/Logo'
import { WORLD_FOCUS_CLASS } from './ui'

/**
 * The same primary sections the app navbar lists, in the same order, minus
 * World itself (which is spelled out by the brand lockup on the left).
 */
const SECTIONS: { label: string; to: string }[] = [
  { label: 'Home', to: '/' },
  { label: 'Database', to: '/database' },
  { label: 'Analytics', to: '/analytics' },
  { label: 'Hiring', to: '/hiring' },
  { label: 'Map', to: '/map' },
]

export interface WorldChromeProps {
  /**
   * Where the "World" half of the brand lockup points. Defaults to the globe;
   * a country page can point it at itself if that ever reads better.
   */
  worldHref?: string
  /** Optional right-hand slot — a claim CTA on pages that want one. */
  action?: ReactNode
  className?: string
}

export function WorldChrome({ worldHref = '/world', action, className }: WorldChromeProps) {
  const { darkMode, setDarkMode } = useApp()
  const location = useLocation()

  return (
    <header className={cn('world-tokens world-nav', className)}>
      <nav
        aria-label="ExploreYC"
        className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5"
      >
        {/* Brand lockup. The mark is the app's real <Logo> rather than a
            World-only re-draw: a different logo on one route is the opposite of
            branded. The wordmark beside it is set in the World sans and drops
            the navbar's "$ startup-db" subtitle, which is the terminal string
            this feature is not bringing along. */}
        {/* `flex-none`, and the wordmark does NOT truncate. Measured at 375px:
            with the lockup allowed to shrink, the link strip beside it won the
            space and "ExploreYC" collapsed to nothing — the brand was the first
            thing off the bar, on the narrowest screen, which is the exact
            opposite of the point. The lockup keeps its ~172px and the links
            scroll instead; scrolling a nav strip is a much smaller cost than
            losing the logo. */}
        <Link
          to={worldHref}
          className={`${WORLD_FOCUS_CLASS} -m-1 flex flex-none items-center gap-2 rounded-[10px] p-1`}
        >
          <Logo size={28} />
          <span className="flex items-baseline gap-1.5">
            <span className="text-[0.9375rem] font-extrabold tracking-[-0.02em] text-[var(--w-ink)]">
              ExploreYC
            </span>
            <span className="world-tokens world-chip world-chip--accent">World</span>
          </span>
        </Link>

        {/* The sections. A horizontally scrolling strip on phones rather than a
            burger: five short words fit in one swipe, and a menu that has to be
            opened is a worse answer than a row that has to be nudged.
            `[scrollbar-width:none]` because src/index.css already hides bars
            app-wide and a lone visible one here would look like a bug. */}
        <div className="world-nav__links ml-auto flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SECTIONS.map((s) => {
            const active =
              s.to === '/' ? location.pathname === '/' : location.pathname.startsWith(s.to)
            return (
              <Link
                key={s.to}
                to={s.to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  WORLD_FOCUS_CLASS,
                  'world-navlink',
                  active && 'world-navlink--active'
                )}
              >
                {s.label}
              </Link>
            )
          })}
        </div>

        <div className="flex flex-none items-center gap-2">
          {action}
          {/* The World sub-pages sit outside the app's <Layout>, so this is the
              only theme control a visitor who landed here from a share link
              can reach. Both themes are a design requirement; being unable to
              switch between them on half the feature was an oversight. */}
          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
            className={`${WORLD_FOCUS_CLASS} grid h-9 w-9 place-items-center rounded-[10px] text-[var(--w-muted)] transition-colors hover:bg-[var(--w-ground)] hover:text-[var(--w-ink)]`}
          >
            {darkMode ? (
              <Sun className="h-[1.125rem] w-[1.125rem]" aria-hidden />
            ) : (
              <Moon className="h-[1.125rem] w-[1.125rem]" aria-hidden />
            )}
          </button>
        </div>
      </nav>
    </header>
  )
}

export default WorldChrome
