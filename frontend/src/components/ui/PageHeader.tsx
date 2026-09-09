import { type ReactNode } from 'react';
import { Terminal } from 'lucide-react';

/**
 * The one way every ExploreYC page opens: terminal eyebrow ($ command),
 * orange `>` prefix + mono title, muted mono subtitle, optional actions on
 * the right (stack below the title on mobile). Matches the Developer
 * Dashboard, which is the reference implementation of the house style.
 */
export function PageHeader({
  command,
  title,
  subtitle,
  actions,
  cursor = false,
  className = '',
}: {
  /** The terminal eyebrow, without the leading `$` (e.g. "exploreyc --analytics"). */
  command: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-side buttons/links; wrap below the title on small screens. */
  actions?: ReactNode;
  /** Blinking block cursor after the command — one per page, use on the primary surface. */
  cursor?: boolean;
  className?: string;
}) {
  const cmd = command.replace(/^\$\s*/, ''); // tolerate both "$ foo" and "foo"
  return (
    <div className={`mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-2 font-mono text-sm text-muted-foreground">
          <Terminal className="h-4 w-4 text-[#FB651E]" />
          <span className="truncate">
            $ {cmd}
            {cursor && <span className="terminal-cursor" aria-hidden />}
          </span>
        </div>
        <h1 className="text-3xl font-bold font-mono [text-wrap:balance]">
          <span className="text-[#FB651E]">&gt;</span> {title}
        </h1>
        {subtitle && <p className="text-sm text-muted-foreground font-mono mt-1 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}

/**
 * Section opener inside a page: `$` prompt + bold mono h2, optional action
 * on the right. Extracted from HomePage, now the shared vocabulary.
 */
export function SectionHeader({
  title,
  icon,
  action,
  className = '',
}: {
  title: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 mb-6 ${className}`}>
      <div className="flex items-center gap-2 font-mono">
        {icon}
        <span className="text-muted-foreground">$</span>
        <h2 className="text-xl font-bold">{title}</h2>
      </div>
      {action}
    </div>
  );
}
