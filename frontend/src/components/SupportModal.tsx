import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Coffee, X, ArrowUpRight } from 'lucide-react';
import { SUPPORT_SEEN_KEY, SUPPORT_SUPPORTED_KEY, openSupport } from '../lib/support';

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
 * It arms on mount and reveals after a delay OR on meaningful scroll — whichever
 * comes first — then records the session so it never re-appears until a new one.
 * If the visitor ever clicks through to support, it's suppressed for good. The
 * footer link stays available regardless. Mounted inside the main Layout, so it
 * never shows on full-screen pages (validator, research, admin, share cards).
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
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[1001] bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[1001] w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 motion-reduce:animate-none">
          {/* Always-dark panel echoing ApiProCta — reads well on both themes */}
          <div className="relative rounded-xl bg-[#0a0c11] text-white overflow-hidden border border-white/10 shadow-2xl">
            {/* soft orange glow + subtle grain */}
            <div className="pointer-events-none absolute -top-16 -right-10 w-52 h-52 rounded-full bg-[#FB651E]/20 blur-3xl" />
            <div className="pointer-events-none absolute inset-0 opacity-[0.15] mix-blend-overlay [background-image:radial-gradient(rgba(255,255,255,0.4)_0.5px,transparent_0.5px)] [background-size:4px_4px]" />

            <DialogPrimitive.Close
              aria-label="Dismiss"
              className="absolute top-3 right-3 z-10 text-white/40 hover:text-white/90 transition-colors focus:outline-none"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>

            <div className="relative p-6 sm:p-7">
              <div className="inline-flex items-center gap-2 mb-4 font-mono text-[11px] uppercase tracking-widest text-[#FB651E]">
                <Coffee className="h-3.5 w-3.5" />
                Support the project
              </div>

              <DialogPrimitive.Title className="font-mono font-bold text-xl sm:text-2xl mb-2 leading-tight">
                Enjoying <span className="text-[#FB651E]">ExploreYC</span>?
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-sm text-white/60 font-mono leading-relaxed mb-6">
                It's free, fast, and ad-free — built and run by one person. If it's
                useful to you, a coffee helps keep it that way.
              </DialogPrimitive.Description>

              <div className="flex items-center gap-3">
                <button
                  onClick={support}
                  className="group flex-1 h-11 px-5 rounded-md bg-[#FB651E] hover:bg-[#ff7a33] text-white text-sm font-bold font-mono inline-flex items-center justify-center gap-2 transition-colors shadow-[0_0_24px_rgba(251,101,30,0.35)]"
                >
                  Buy me a coffee ☕
                  <ArrowUpRight className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </button>
                <DialogPrimitive.Close className="h-11 px-4 rounded-md text-sm font-mono text-white/45 hover:text-white/80 transition-colors whitespace-nowrap">
                  Maybe later
                </DialogPrimitive.Close>
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
