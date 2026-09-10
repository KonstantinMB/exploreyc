/**
 * DEPRECATED — renders nothing. Delete this file with its last import.
 *
 * WHAT IT USED TO BE: a World-only nav bar (ExploreYC mark, five section
 * links, a theme toggle) mounted by /world/c/:iso, /world/p/:id and
 * /world/claimed, because those pages sat OUTSIDE the app's <Layout> and had
 * no chrome of their own.
 *
 * WHY IT IS EMPTY: they are inside <Layout> now. The real <Navbar> — the
 * actual one, with the real sections, the real account menu and the real ⌘K —
 * renders above every World surface, which is what the owner asked for:
 * "the exploreyc platform must be visible when on map, like the navbar".
 * Keeping this would put a second, lesser nav bar directly under the first.
 *
 * WHY IT IS A NO-OP RATHER THAN A DELETED FILE: its three callers live under
 * pages/world/, which this change does not own. A stub keeps the build green
 * across that seam. Removing the three `import WorldChrome` lines and this
 * file is a two-minute follow-up and should happen in the same PR — nothing
 * depends on the stub surviving. Its CSS (`.world-nav*` in world.css) is
 * already gone.
 */

import type { FC, ReactNode } from 'react'

export interface WorldChromeProps {
  worldHref?: string
  action?: ReactNode
  className?: string
}

// Typed rather than a bare `() => null`: the prop shape has to keep compiling
// for the three callers that still mount this, including the `action` slot
// none of them currently pass.
export const WorldChrome: FC<WorldChromeProps> = () => null

export default WorldChrome
