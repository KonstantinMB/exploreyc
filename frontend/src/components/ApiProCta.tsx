import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Check, Loader2, Mail, ArrowRight, X, Sparkles } from 'lucide-react';
import { apiClient } from '../lib/api';

// Two demand signals, tracked separately server-side via /api/feature-interest:
const FEATURE_PAY = 'api-pro-5usd';
const FEATURE_NOTIFY = 'api-pro-notify';
const LS_DONE = 'eyc_api_pro_interest';
const LS_DISMISSED = 'eyc_api_pro_dismissed';

function getClientId(): string {
  let id = localStorage.getItem('roadmap-user-id');
  if (!id) {
    id = `user-${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem('roadmap-user-id', id);
  }
  return id;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ApiProCta({
  defaultEmail = '',
  className = '',
}: {
  defaultEmail?: string;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const [email, setEmail] = useState(defaultEmail);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle');
  const [count, setCount] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(LS_DONE) === 'true') setStatus('done');
    if (localStorage.getItem(LS_DISMISSED) === 'true') setDismissed(true);
  }, []);

  const submit = async (feature: string) => {
    if (!EMAIL_RE.test(email.trim())) return;
    setStatus('submitting');
    try {
      const { data } = await apiClient.submitFeatureInterest({
        feature,
        email: email.trim(),
        user_identifier: getClientId(),
      });
      setCount(data.count ?? null);
      localStorage.setItem(LS_DONE, 'true');
      setStatus('done');
    } catch {
      setStatus('idle');
    }
  };

  const dismiss = () => {
    localStorage.setItem(LS_DISMISSED, 'true');
    setDismissed(true);
  };

  if (dismissed && status !== 'done') return null;

  const emailValid = EMAIL_RE.test(email.trim());

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 24, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ type: 'spring', stiffness: 220, damping: 22 }}
      className={`relative rounded-xl p-[1.5px] overflow-hidden ${className}`}
    >
      {/* Rotating conic-gradient border — the "sexy" detail */}
      {!reduced && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[160%] -translate-x-1/2 -translate-y-1/2"
          style={{
            background:
              'conic-gradient(from 0deg, transparent 0deg, #FB651E 40deg, #ffb27a 70deg, transparent 130deg, transparent 230deg, #FB651E 300deg, transparent 340deg)',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 7, ease: 'linear', repeat: Infinity }}
        />
      )}
      {/* Static fallback ring for reduced motion */}
      {reduced && <div aria-hidden className="pointer-events-none absolute inset-0 rounded-xl border border-[#FB651E]/40" />}

      {/* Inner panel — always dark for contrast on both themes */}
      <div className="relative rounded-[calc(0.75rem-1.5px)] bg-[#0a0c11] text-white overflow-hidden">
        {/* soft glow + grain atmosphere */}
        <div className="pointer-events-none absolute -top-16 -right-10 w-52 h-52 rounded-full bg-[#FB651E]/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.15] mix-blend-overlay [background-image:radial-gradient(rgba(255,255,255,0.4)_0.5px,transparent_0.5px)] [background-size:4px_4px]" />

        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute top-3 right-3 z-10 text-white/30 hover:text-white/80 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative p-6 sm:p-7">
          {/* badge */}
          <div className="inline-flex items-center gap-2 mb-4 font-mono text-[11px] uppercase tracking-widest text-[#FB651E]">
            <span className="relative flex h-2 w-2">
              {!reduced && (
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#FB651E] opacity-60 animate-ping" />
              )}
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FB651E]" />
            </span>
            API Pro · help us price it
          </div>

          <AnimatePresence mode="wait">
            {status === 'done' ? (
              <motion.div
                key="done"
                initial={reduced ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3"
              >
                <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                  <Check className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-mono font-bold text-lg mb-1">You're in. Thank you.</h3>
                  <p className="text-sm text-white/60 font-mono leading-relaxed">
                    We'll email you the moment API Pro is live.
                    {count !== null && (
                      <>
                        {' '}You're one of{' '}
                        <span className="text-[#FB651E] font-bold tabular-nums">{count.toLocaleString()}</span>{' '}
                        {count === 1 ? 'developer' : 'developers'} who want it.
                      </>
                    )}
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <h3 className="font-mono font-bold text-xl sm:text-2xl mb-2 leading-tight">
                  Would you pay <span className="text-[#FB651E]">$5/mo</span> for higher rate limits?
                </h3>
                <p className="text-sm text-white/55 font-mono leading-relaxed max-w-xl mb-5">
                  The free tier is 5 requests/day. We're weighing an API&nbsp;Pro tier at{' '}
                  <span className="text-white/80">$5/month</span> for a big rate-limit bump. Your answer decides
                  whether we ship it.
                </p>

                <div className="flex flex-col sm:flex-row gap-2.5 max-w-xl">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && submit(FEATURE_PAY)}
                      placeholder="you@startup.com"
                      className="w-full h-11 pl-9 pr-3 rounded-md bg-white/[0.04] border border-white/10 text-sm font-mono text-white placeholder:text-white/25 outline-none focus:border-[#FB651E]/60 focus:bg-white/[0.06] transition-colors"
                    />
                  </div>
                  <button
                    onClick={() => submit(FEATURE_PAY)}
                    disabled={!emailValid || status === 'submitting'}
                    className="group h-11 px-5 rounded-md bg-[#FB651E] hover:bg-[#ff7a33] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold font-mono inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shadow-[0_0_24px_rgba(251,101,30,0.35)]"
                  >
                    {status === 'submitting' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Sending
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4" /> Yes, I'd pay $5/mo
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                      </>
                    )}
                  </button>
                </div>

                <button
                  onClick={() => submit(FEATURE_NOTIFY)}
                  disabled={!emailValid || status === 'submitting'}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-mono text-white/45 hover:text-white/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Not sure yet — just keep me posted
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
