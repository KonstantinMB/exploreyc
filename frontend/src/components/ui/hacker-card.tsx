import { motion } from 'framer-motion';
import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

interface HackerCardProps extends React.HTMLAttributes<HTMLDivElement> {
  glowColor?: 'orange' | 'green' | 'blue' | 'purple';
  delay?: number;
  as?: 'div' | 'a' | 'button';
  href?: string;
}

const glowColors = {
  orange: 'hover:border-[#FB651E]/60 hover:shadow-[0_0_20px_rgba(251,101,30,0.15)]',
  green: 'hover:border-emerald-500/60 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]',
  blue: 'hover:border-blue-500/60 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]',
  purple: 'hover:border-violet-500/60 hover:shadow-[0_0_20px_rgba(139,92,246,0.15)]',
};

export const HackerCard = forwardRef<HTMLDivElement, HackerCardProps>(
  ({ className, glowColor = 'orange', delay = 0, as = 'div', href, children, ...props }, ref) => {
    const Comp = as === 'a' ? motion.a : as === 'button' ? motion.button : motion.div;

    return (
      <Comp
        ref={ref as any}
        href={href}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
        className={cn(
          'group relative overflow-hidden rounded-sm border border-border/80 bg-card/50 backdrop-blur-sm',
          'transition-all duration-300 ease-out',
          glowColors[glowColor],
          'dark:border-white/5 dark:bg-white/[0.02]',
          className
        )}
        {...(props as any)}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[rgba(251,101,30,0.03)] opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />
        {children}
      </Comp>
    );
  }
);

HackerCard.displayName = 'HackerCard';
