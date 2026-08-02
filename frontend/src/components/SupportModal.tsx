import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from './ui/dialog';
import { BuyMeCoffeeLogo } from './BuyMeCoffeeLogo';
import { SUPPORT_SEEN_KEY, SUPPORT_SUPPORTED_KEY, openSupport } from '../lib/support';

// Buy Me a Coffee brand yellow — used for the badge + CTA so the platform is
// instantly recognisable.
const BMC_YELLOW = '#FFDD00';
const BMC_YELLOW_HOVER = '#FFE21A';
const BMC_INK = '#0D0C22';

// Developer-portal pages where a "support" nudge would collide with a more
// important ask (sign up / log in / manage keys).
const SUPPRESSED_PREFIXES = ['/signup', '/login', '/dashboard'];
// Wait this long before the modal may appear — never interrupt arrival.
const DELAY_MS = 40_000;
// ...or reveal early once the visitor scrolls half a viewport (a sign of engagement).
const SCROLL_TRIGGER = 0.5;

/**
 * A tasteful, once-per-session "Support the project" pop-up.
 *
 * Light + theme-aware (uses the shared Dialog), branded with the Buy Me a Coffee
 * mark. It arms on mount and reveals after a delay OR on meaningful scroll —
 * whichever comes first — then records the session so it never re-appears until
 * a new one. Once the visitor clicks through to support, it's suppressed for
 * good. The footer link stays available regardless. Mounted inside the main
 * Layout, so it never shows on full-screen pages (validator, research, admin).
 */
export function SupportModal() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alreadySeen = false;
    let alreadySupported = false;
    try {
      alreadySeen = sessionStorage.getItem(SUPPORT_SEEN_KEY) === 'true';
      alreadySupported = localStorage.getItem(SUPPORT_SUPPORTED_KEY) === 'true';
    } catch {
      /* storage disabled (private mode) — fall through, still gated per mount */
    }
    if (alreadySeen || alreadySupported) return;
    if (SUPPRESSED_PREFIXES.some((p) => location.pathname.startsWith(p))) return;

    let timer = 0;
    function reveal() {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
      try {
        sessionStorage.setItem(SUPPORT_SEEN_KEY, 'true');
      } catch {
        /* non-fatal */
      }
      setOpen(true);
    }
    function onScroll() {
      if (window.scrollY / Math.max(window.innerHeight, 1) >= SCROLL_TRIGGER) reveal();
    }

    timer = window.setTimeout(reveal, DELAY_MS);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
    };
    // Arm once on mount; route suppression uses the entry path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const support = () => {
    openSupport('modal');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md w-[95vw] sm:w-full">
        <DialogHeader>
          <div
            className="mb-1 flex h-12 w-12 items-center justify-center rounded-full shadow-sm mx-auto sm:mx-0"
            style={{ backgroundColor: BMC_YELLOW }}
          >
            <BuyMeCoffeeLogo className="h-6 w-6" />
          </div>
          <DialogTitle className="text-xl sm:text-2xl">
            Enjoying <span className="text-[#FB651E]">ExploreYC</span>?
          </DialogTitle>
          <DialogDescription className="leading-relaxed">
            It's free, fast, and ad-free — built and run by one person. If it's useful
            to you, a coffee helps keep it that way.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-1 flex flex-col gap-3">
          <button
            onClick={support}
            style={{ backgroundColor: BMC_YELLOW, color: BMC_INK }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = BMC_YELLOW_HOVER)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = BMC_YELLOW)}
            className="group inline-flex h-12 items-center justify-center gap-2.5 rounded-md px-5 text-[15px] font-bold transition-colors"
          >
            <BuyMeCoffeeLogo className="h-5 w-5" />
            Buy me a coffee
            <ArrowUpRight className="h-4 w-4 opacity-70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>

          <div className="flex items-center justify-between gap-3">
            <a
              href="https://www.buymeacoffee.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <BuyMeCoffeeLogo className="h-3.5 w-3.5" />
              Powered by Buy Me a Coffee
            </a>
            <DialogClose className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Maybe later
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
