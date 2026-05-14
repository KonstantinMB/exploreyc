import { type ReactNode, forwardRef } from 'react';
import { cn } from '../../lib/utils';

interface ShareCardProps {
  children: ReactNode;
  className?: string;
  size?: 'square' | 'landscape' | 'portrait';
  watermark?: boolean;
}

export const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(
  ({ children, className, size = 'square', watermark = true }, ref) => {
    const sizeClasses = {
      square: 'w-[1200px] h-[1200px]',
      landscape: 'w-[1200px] h-[630px]',
      portrait: 'w-[1080px] h-[1350px]',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'relative bg-black text-white overflow-hidden',
          'font-mono',
          sizeClasses[size],
          className
        )}
        style={{
          boxSizing: 'border-box',
        }}
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `
                linear-gradient(rgba(251, 101, 30, 0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(251, 101, 30, 0.1) 1px, transparent 1px)
              `,
              backgroundSize: '32px 32px',
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 w-full h-full">
          {children}
        </div>

        {/* Watermark */}
        {watermark && (
          <div className="absolute bottom-6 right-6 flex items-center gap-2 text-white/60">
            <span className="text-sm font-mono">YC Explorer</span>
            <svg
              className="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
        )}
      </div>
    );
  }
);

ShareCard.displayName = 'ShareCard';
