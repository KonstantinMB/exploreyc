import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Trophy, Crown, ArrowRight, Medal, Sparkles } from 'lucide-react';
import { apiClient, resolveMediaUrl } from '../lib/api';
import { formatFunding } from '../lib/shareUtils';
import { Avatar } from './ui/Avatar';
import { HackerCard } from './ui/hacker-card';
import { METRIC_LABELS, type FounderMetric, type FounderLeaderboardEntry } from '../types/founders';

const PREVIEW_LIMIT = 7;
const MEDALS = ['#FFC93C', '#C7CCD1', '#E08A4B']; // gold · silver · bronze
const PODIUM_ORDER = [1, 0, 2]; // render 2nd, 1st, 3rd (classic podium)
const METRIC_CHIPS: FounderMetric[] = ['serial', 'funded', 'exits', 'unicorns'];

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Ease-out count-up for a number, kicked off once its container scrolls into view. */
function useCountUp(target: number, active: boolean, duration = 1100): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (prefersReduced() || !target) {
      setVal(target);
      return;
    }
    let raf = 0;
    let startTs = 0;
    const step = (ts: number) => {
      if (!startTs) startTs = ts;
      const t = Math.min(1, (ts - startTs) / duration);
      setVal(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, active, duration]);
  return val;
}

function AnimatedFunding({ usd, active, className = '' }: { usd: number; active: boolean; className?: string }) {
  const v = useCountUp(usd, active);
  return <span className={`tabular-nums ${className}`}>{usd ? formatFunding(v) : '—'}</span>;
}

/** A podium tile for a top-3 founder. #1 is crowned, elevated, and glows. */
function PodiumTile({ entry, active, delay }: { entry: FounderLeaderboardEntry; active: boolean; delay: number }) {
  const rank = entry.rank;
  const isFirst = rank === 1;
  const medal = MEDALS[rank - 1];
  return (
    <motion.div
      initial={{ opacity: 0, y: 28, scale: 0.94 }}
      animate={active ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ delay, type: 'spring', stiffness: 220, damping: 20 }}
      className={`relative flex flex-col items-center ${isFirst ? 'sm:-mt-6' : 'sm:mt-2'}`}
    >
      <Link
        to={`/founder/${entry.founder.slug}`}
        className="group flex w-full flex-col items-center rounded-md border bg-background/60 px-3 pb-3 pt-5 text-center transition-all duration-300 hover:-translate-y-1"
        style={{
          borderColor: isFirst ? `${medal}` : 'hsl(var(--border))',
          boxShadow: isFirst ? `0 0 0 1px ${medal}55, 0 12px 40px -12px ${medal}77` : undefined,
        }}
      >
        {isFirst && (
          <motion.div
            initial={{ y: -6, opacity: 0 }}
            animate={active ? { y: 0, opacity: 1 } : {}}
            transition={{ delay: delay + 0.25 }}
            className="absolute -top-3.5"
          >
            <Crown className="h-6 w-6 drop-shadow" style={{ color: medal, fill: `${medal}33` }} />
          </motion.div>
        )}
        {/* avatar with medal ring; #1 gets a breathing pulse */}
        <div className="relative">
          {isFirst && (
            <span
              className="absolute inset-0 -m-1 rounded-full animate-ping"
              style={{ backgroundColor: `${medal}22` }}
            />
          )}
          <div className="rounded-full p-[2px]" style={{ background: `linear-gradient(135deg, ${medal}, transparent)` }}>
            <Avatar
              src={resolveMediaUrl(entry.founder.avatar_url)}
              name={entry.founder.full_name}
              size={isFirst ? 60 : 48}
            />
          </div>
          <span
            className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-black shadow"
            style={{ backgroundColor: medal }}
          >
            {rank}
          </span>
        </div>
        <div className="mt-2.5 line-clamp-1 text-sm font-bold group-hover:text-[#FB651E]">
          {entry.founder.full_name}
        </div>
        <div className="mb-1.5 line-clamp-1 text-[10px] font-mono text-muted-foreground">
          {entry.founder.title || 'Founder'}
        </div>
        <AnimatedFunding
          usd={entry.stats.total_funding_usd || 0}
          active={active}
          className={`text-base font-black font-mono ${isFirst ? 'text-[#FB651E]' : 'text-foreground'}`}
        />
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70">raised</div>
      </Link>
      {/* podium base */}
      <div
        className="mt-1.5 w-full rounded-b-sm font-mono text-[10px] font-bold text-center text-black/70"
        style={{ height: isFirst ? 22 : 14, background: `linear-gradient(${medal}, ${medal}99)` }}
      />
    </motion.div>
  );
}

// Non-interactive teaser of the founder leaderboards for the landing page.
export function FoundersPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });

  const { data, isLoading } = useQuery({
    queryKey: ['founders-preview'],
    queryFn: () => apiClient.getFounderLeaderboard('funded', { limit: PREVIEW_LIMIT }).then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });

  const results = data?.results ?? [];
  const total = data?.total ?? 0;
  const top3 = results.slice(0, 3);
  const rest = results.slice(3, 7);

  return (
    <HackerCard ref={ref} className="relative overflow-hidden" glowColor="orange">
      {/* animated scanline sheen */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, #FB651E 0 1px, transparent 1px 4px)' }} />

      {/* header */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-3">
        <div className="flex items-center gap-2 font-mono text-sm">
          <Trophy className="h-4 w-4 text-[#FB651E]" />
          <span className="font-semibold">Founder leaderboards</span>
          <span className="flex items-center gap-1 text-[10px] text-emerald-500">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            live
          </span>
          {total > 0 && <span className="text-xs text-muted-foreground">· {total.toLocaleString()} ranked</span>}
        </div>
        <Link to="/founders/leaderboard"
          className="group inline-flex items-center gap-1.5 font-mono text-xs text-[#FB651E] hover:underline">
          Open leaderboards
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* podium */}
      <div className="relative px-4 pt-6 pb-3">
        {isLoading && top3.length === 0 ? (
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-md bg-muted/30" />)}
          </div>
        ) : (
          <div className="grid grid-cols-3 items-end gap-2 sm:gap-3">
            {PODIUM_ORDER.map((idx, i) =>
              top3[idx] ? (
                <PodiumTile key={top3[idx].founder.slug} entry={top3[idx]} active={inView} delay={0.1 + i * 0.12} />
              ) : (
                <div key={i} />
              ),
            )}
          </div>
        )}
      </div>

      {/* runners-up */}
      {rest.length > 0 && (
        <div className="relative border-t border-border/60 px-2 py-1">
          {rest.map((entry, i) => (
            <motion.div
              key={entry.founder.slug}
              initial={{ opacity: 0, x: -12 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 0.5 + i * 0.07 }}
            >
              <Link
                to={`/founder/${entry.founder.slug}`}
                className="group flex items-center gap-3 rounded-sm px-2 py-2 transition-colors hover:bg-[#FB651E]/5"
              >
                <span className="w-5 text-center font-mono text-xs font-bold text-muted-foreground/70">
                  {entry.rank}
                </span>
                <Avatar src={resolveMediaUrl(entry.founder.avatar_url)} name={entry.founder.full_name} size={26} />
                <span className="flex-1 truncate text-sm font-medium group-hover:text-[#FB651E]">
                  {entry.founder.full_name}
                </span>
                <AnimatedFunding
                  usd={entry.stats.total_funding_usd || 0}
                  active={inView}
                  className="font-mono text-xs font-semibold text-muted-foreground"
                />
                <ArrowRight className="h-3 w-3 text-muted-foreground/30 transition-all group-hover:translate-x-0.5 group-hover:text-[#FB651E]" />
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {/* footer: metric chips + CTA */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/10 px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Medal className="h-3.5 w-3.5 text-[#FB651E]" />
          {METRIC_CHIPS.map((m) => (
            <Link
              key={m}
              to="/founders/leaderboard"
              className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-[#FB651E]/50 hover:text-[#FB651E]"
            >
              {METRIC_LABELS[m]}
            </Link>
          ))}
        </div>
        <Link
          to="/founders/leaderboard"
          className="group inline-flex items-center gap-2 rounded-sm bg-[#FB651E] px-4 py-2 font-mono text-xs font-semibold text-white transition-colors hover:bg-[#E65C00]"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Explore founder leaderboards
        </Link>
      </div>
    </HackerCard>
  );
}
