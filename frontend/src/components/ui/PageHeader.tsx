import { Terminal } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Standardized page header used across the platform: a terminal `$ command`
 * line, a `> Title`, an optional subtitle, and optional right-aligned actions.
 * Consolidates the copy/paste header pattern that had drifted per-page.
 */
export function PageHeader({
  command,
  title,
  subtitle,
  actions,
  className = '',
}: {
  command: string
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={`mb-6 ${className}`}>
      <div className="flex items-center gap-2 mb-2 font-mono text-sm text-muted-foreground">
        <Terminal className="h-4 w-4 text-[#FB651E]" />
        <span className="truncate">{command}</span>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold mb-1">
            <span className="text-[#FB651E]">&gt;</span> {title}
          </h1>
          {subtitle && <p className="text-muted-foreground font-mono text-sm">{subtitle}</p>}
        </div>
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </div>
    </div>
  )
}
