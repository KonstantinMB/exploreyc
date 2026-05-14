import { cn } from '../../lib/utils';

interface GridPatternProps {
  className?: string;
  size?: number;
}

export function GridPattern({ className, size = 40 }: GridPatternProps) {
  return (
    <div
      className={cn('absolute inset-0 -z-10', className)}
      style={{
        backgroundImage: `
          linear-gradient(to right, hsl(var(--border) / 0.3) 1px, transparent 1px),
          linear-gradient(to bottom, hsl(var(--border) / 0.3) 1px, transparent 1px)
        `,
        backgroundSize: `${size}px ${size}px`,
      }}
    />
  );
}
