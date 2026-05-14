import { useState } from 'react';
import { Twitter, Linkedin, MessageSquare, Link2, Check } from 'lucide-react';
import { Button } from '../ui/button';
import { shareOnTwitter, shareOnLinkedIn, shareOnReddit, copyToClipboard, type ShareData } from '../../lib/shareUtils';

interface SocialShareButtonsProps {
  shareData: ShareData;
  hashtags?: string[];
  className?: string;
}

export function SocialShareButtons({ shareData, hashtags, className }: SocialShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    const success = await copyToClipboard(shareData.url);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      <Button
        onClick={() => shareOnTwitter(shareData, hashtags)}
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
      >
        <Twitter className="h-4 w-4" />
        Share on X
      </Button>

      <Button
        onClick={() => shareOnLinkedIn(shareData)}
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
      >
        <Linkedin className="h-4 w-4" />
        Share on LinkedIn
      </Button>

      <Button
        onClick={() => shareOnReddit(shareData)}
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
      >
        <MessageSquare className="h-4 w-4" />
        Share on Reddit
      </Button>

      <Button
        onClick={handleCopyLink}
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 text-green-500" />
            Copied!
          </>
        ) : (
          <>
            <Link2 className="h-4 w-4" />
            Copy Link
          </>
        )}
      </Button>
    </div>
  );
}
