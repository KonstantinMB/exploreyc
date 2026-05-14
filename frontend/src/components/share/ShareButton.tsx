import { Share2 } from 'lucide-react';
import { Button } from '../ui/button';

interface ShareButtonProps {
  onClick: () => void;
  label?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

export function ShareButton({
  onClick,
  label = 'Share',
  variant = 'outline',
  size = 'default',
  className,
}: ShareButtonProps) {
  return (
    <Button
      onClick={onClick}
      variant={variant}
      size={size}
      className={`flex items-center gap-2 ${className}`}
    >
      <Share2 className="h-4 w-4" />
      {label}
    </Button>
  );
}
