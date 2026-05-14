import { cn } from '../../lib/utils';

interface DotPatternProps {
  className?: string;
  size?: number;
  radius?: number;
  color?: string;
}

export function DotPattern({ className, size = 4, radius = 1, color = 'currentColor' }: DotPatternProps) {
  return (
    <div
      className={cn('absolute inset-0 -z-10 opacity-[0.4] dark:opacity-[0.15]', className)}
      style={{
        backgroundImage: `radial-gradient(${color} ${radius}px, transparent ${radius}px)`,
        backgroundSize: `${size}px ${size}px`,
      }}
    />
  );
}
