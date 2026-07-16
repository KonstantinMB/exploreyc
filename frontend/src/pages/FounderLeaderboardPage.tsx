import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Trophy,
  Repeat,
  DollarSign,
  LogOut,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Linkedin,
  Twitter,
  Users,
  ArrowRight,
  Crown,
} from 'lucide-react';
import { apiClient, resolveMediaUrl } from '../lib/api';
import { useApp } from '../contexts/AppContext';
import { HackerCard } from '../components/ui/hacker-card';
import { DotPattern } from '../components/ui/dot-pattern';
import { PageHeader } from '../components/ui/PageHeader';
import { Avatar } from '../components/ui/Avatar';
import type { FounderMetric, FounderLeaderboardEntry } from '../types/founders';
import { METRIC_LABELS } from '../types/founders';

const PAGE_SIZE = 25;

const MEDALS = ['#FFC93C', '#C7CCD1', '#E08A4B']; // gold · silver · bronze
const PODIUM_ORDER = [1, 0, 2]; // render 2nd, 1st, 3rd (classic podium)

const METRICS: {
  key: FounderMetric;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: 'serial', icon: Repeat },
  { key: 'funded', icon: DollarSign },
  { key: 'exits', icon: LogOut },
  { key: 'unicorns', icon: Sparkles },
];

// Friendly empty-state copy per metric — several boards stay sparse until company
// funding data is enriched, so we explain that rather than showing a bare "no results".
const EMPTY_COPY: Record<FounderMetric, string> = {
  serial: 'No serial founders yet — this fills in as we map founders across their companies.',
  funded:
    'No funded founders yet. This board fills in as company funding data gets enriched.',
  exits:
    'No exits recorded yet. This board fills in as acquisition & IPO data gets enriched.',
  unicorns:
    'No unicorn founders yet. This board fills in as company valuation data gets enriched.',
};

/** Rank badge — gold/silver/bronze for the podium, muted chip otherwise. */
function RankBadge({ rank }: { rank: number }) {
  const styles =
    rank === 1
      ? 'bg-amber-400/15 text-amber-500 border-amber-400/40'
      : rank === 2
        ? 'bg-zinc-400/15 text-zinc-400 border-zinc-400/40'
        : rank === 3
          ? 'bg-orange-700/15 text-orange-600 border-orange-700/40'
          : 'bg-muted text-muted-foreground border-border';
  return (
    <span
      className={`inline-flex items-center justify-center w-9 h-9 rounded-sm border text-sm font-bold font-mono tabular-nums shrink-0 ${styles}`}
    >
      {rank}
    </span>
  );
}

function LeaderboardRow({ entry, index }: { entry: FounderLeaderboardEntry; index: number }) {
  const { founder, stats, headline_stat, rank } = entry;
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.035, 0.45), duration: 0.3 }}
    >
    <Link
      to={`/founder/${founder.slug}`}
      className="relative flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 border-b border-border/50 hover:bg-[#FB651E]/[0.04] transition-colors group"
    >
      <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#FB651E] origin-center scale-y-0 group-hover:scale-y-100 transition-transform duration-200" />
      <RankBadge rank={rank} />
      <Avatar src={resolveMediaUrl(founder.avatar_url)} name={founder.full_name} size={40} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-sm truncate group-hover:text-[#FB651E] transition-colors">
            {founder.full_name}
          </span>
          {founder.linkedin_url && (
            <Linkedin className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0 hidden sm:inline-block" />
          )}
          {founder.twitter_url && (
            <Twitter className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0 hidden sm:inline-block" />
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
          {founder.title && <span className="truncate">{founder.title}</span>}
          {founder.title && stats.latest_batch && <span className="opacity-40">·</span>}
          {stats.latest_batch && (
            <span className="font-mono whitespace-nowrap">{stats.latest_batch}</span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-bold font-mono tabular-nums text-[#FB651E]">
          {headline_stat.value}
        </div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground hidden sm:block">
          {headline_stat.label}
        </div>
      </div>
      <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-[#FB651E] transition-colors shrink-0 hidden sm:inline-block" />
    </Link>
    </motion.div>
  );
}

/** Top-3 podium — crowned #1, medal-ringed avatars, metric-aware headline stat. */
function FounderPodium({ top3 }: { top3: FounderLeaderboardEntry[] }) {
  return (
    <div className="border-b border-border/60 bg-gradient-to-b from-[#FB651E]/[0.05] to-transparent px-4 pt-9 pb-5">
      <div className="mx-auto grid max-w-2xl grid-cols-3 items-end gap-2 sm:gap-4">
        {PODIUM_ORDER.map((idx, i) => {
          const entry = top3[idx];
          if (!entry) return <div key={i} />;
          const rank = entry.rank;
          const isFirst = rank === 1;
          const medal = MEDALS[rank - 1];
          return (
            <motion.div
              key={entry.founder.slug}
              initial={{ opacity: 0, y: 26, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.1 + i * 0.1, type: 'spring', stiffness: 220, damping: 20 }}
              className={`relative flex flex-col items-center ${isFirst ? 'sm:-mt-6' : ''}`}
            >
              <Link
                to={`/founder/${entry.founder.slug}`}
                className="group flex w-full flex-col items-center rounded-md border bg-background/70 px-2 pb-3 pt-5 text-center transition-all duration-300 hover:-translate-y-1"
                style={{
                  borderColor: isFirst ? medal : 'hsl(var(--border))',
                  boxShadow: isFirst ? `0 0 0 1px ${medal}55, 0 14px 44px -14px ${medal}88` : undefined,
                }}
              >
                {isFirst && (
                  <Crown className="absolute -top-3.5 h-6 w-6 drop-shadow" style={{ color: medal, fill: `${medal}33` }} />
                )}
                <div className="relative">
                  {isFirst && (
                    <span className="absolute inset-0 -m-1 rounded-full animate-ping" style={{ backgroundColor: `${medal}22` }} />
                  )}
                  <div className="rounded-full p-[2px]" style={{ background: `linear-gradient(135deg, ${medal}, transparent)` }}>
                    <Avatar
                      src={resolveMediaUrl(entry.founder.avatar_url)}
                      name={entry.founder.full_name}
                      size={isFirst ? 66 : 50}
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
                <div className="mb-1 line-clamp-1 text-[10px] font-mono text-muted-foreground">
                  {entry.founder.title || 'Founder'}
                </div>
                <div className={`text-base font-black font-mono tabular-nums ${isFirst ? 'text-[#FB651E]' : 'text-foreground'}`}>
                  {entry.headline_stat.value}
                </div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70">
                  {entry.headline_stat.label}
                </div>
              </Link>
              <div
                className="mt-1.5 w-full rounded-b-sm"
                style={{ height: isFirst ? 24 : 14, background: `linear-gradient(${medal}, ${medal}99)` }}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export function FounderLeaderboardPage() {
  const { stats } = useApp();
  const [metric, setMetric] = useState<FounderMetric>('funded');
  const [batch, setBatch] = useState('');
  const [page, setPage] = useState(1);

  const batches = useMemo(
    () => Object.keys(stats?.by_batch || {}).sort((a, b) => b.localeCompare(a)),
    [stats],
  );

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ['founder-leaderboard', metric, batch, page],
    queryFn: () =>
      apiClient
        .getFounderLeaderboard(metric, {
          batch: batch || undefined,
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
        })
        .then((r) => r.data),
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
  });

  const results = data?.results ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const switchMetric = (m: FounderMetric) => {
    setMetric(m);
    setPage(1);
  };

  return (
    <div className="relative min-h-screen bg-background overflow-x-hidden">
      <Helmet>
        <title>Founder leaderboards — top Y Combinator founders | ExploreYC</title>
        <meta
          name="description"
          content="Ranked leaderboards of Y Combinator founders — serial founders, most funded, biggest exits & unicorn founders. Grab your shareable founder rank card."
        />
        <link rel="canonical" href="https://exploreyc.com/founders/leaderboard" />
      </Helmet>

      <DotPattern color="hsl(var(--primary) / 0.12)" size={24} radius={0.5} />

      <div className="container relative mx-auto px-4 py-8 max-w-[1000px]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <PageHeader
            command="$ founders --leaderboard"
            title="Founder Leaderboards"
            subtitle="Y Combinator founders, ranked by what their companies raised. Grab your shareable rank card."
          />
        </motion.div>

        {/* YC provenance + Fall 2026 application anchor */}
        <motion.a
          href="https://www.ycombinator.com/apply"
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="group mb-4 flex flex-wrap items-center gap-3 rounded-sm border border-[#FB651E]/30 bg-[#FB651E]/[0.05] px-4 py-3 transition-colors hover:border-[#FB651E]/60"
        >
          <img src="/yc-logo.png" alt="Y Combinator" className="h-9 w-9 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">
              Every founder here came through <span className="text-[#FB651E]">Y&nbsp;Combinator</span> — ranked by what their companies raised.
            </div>
            <div className="font-mono text-xs text-muted-foreground">
              Building something? Applications are open for the YC&nbsp;Fall&nbsp;2026 batch.
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-sm bg-[#FB651E] px-3 py-2 font-mono text-xs font-semibold text-white transition-colors group-hover:bg-[#E65C00]">
            Apply — Fall 2026
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </motion.a>

        {/* Metric segmented control */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-4"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {METRICS.map(({ key, icon: Icon }) => {
              const active = metric === key;
              return (
                <button
                  key={key}
                  onClick={() => switchMetric(key)}
                  className={`relative overflow-hidden flex items-center justify-center gap-2 h-10 px-3 text-xs sm:text-sm font-mono border rounded-sm transition-colors ${
                    active
                      ? 'border-[#FB651E]/50 text-[#FB651E] font-semibold'
                      : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="metric-active-pill"
                      className="absolute inset-0 bg-[#FB651E]/12"
                      style={{ backgroundColor: 'rgba(251,101,30,0.12)' }}
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    />
                  )}
                  <Icon className="w-4 h-4 shrink-0 relative z-10" />
                  <span className="truncate relative z-10">{METRIC_LABELS[key]}</span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Batch filter */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-4"
        >
          <HackerCard className="p-3" glowColor="orange">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground font-mono">Filter:</span>
              <select
                value={batch}
                onChange={(e) => {
                  setBatch(e.target.value);
                  setPage(1);
                }}
                className="h-8 px-2 text-xs font-mono bg-background/50 border border-border rounded-sm text-foreground focus:outline-none focus:border-[#FB651E]/50 min-w-[130px]"
              >
                <option value="">All Batches</option>
                {batches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              {!isLoading && (
                <span className="text-xs text-muted-foreground font-mono ml-auto">
                  <Users className="w-3 h-3 inline-block mr-1" />
                  {total.toLocaleString()} founders
                </span>
              )}
            </div>
          </HackerCard>
        </motion.div>

        {/* Leaderboard */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <HackerCard className="overflow-hidden" glowColor="orange">
            <div className={isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
              {isLoading && results.length === 0 ? (
                <div className="px-4 py-20 text-center text-muted-foreground">
                  <div className="w-6 h-6 border-2 border-[#FB651E] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <span className="text-xs font-mono">Loading founders…</span>
                </div>
              ) : isError ? (
                <div className="px-4 py-16 text-center text-muted-foreground">
                  <Trophy className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Couldn't load this leaderboard right now.</p>
                  <p className="text-xs mt-1 font-mono">Please try again in a moment.</p>
                </div>
              ) : results.length === 0 ? (
                <div className="px-4 py-16 text-center text-muted-foreground">
                  <Trophy className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm max-w-md mx-auto leading-relaxed">
                    {batch
                      ? `No ${METRIC_LABELS[metric].toLowerCase()} in ${batch} yet.`
                      : EMPTY_COPY[metric]}
                  </p>
                  {batch && (
                    <button
                      onClick={() => {
                        setBatch('');
                        setPage(1);
                      }}
                      className="mt-3 text-xs text-[#FB651E] hover:underline"
                    >
                      Clear batch filter
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {page === 1 && !batch && results.length >= 3 && (
                    <FounderPodium top3={results.slice(0, 3)} />
                  )}
                  {(page === 1 && !batch && results.length >= 3
                    ? results.slice(3)
                    : results
                  ).map((entry, i) => (
                    <LeaderboardRow key={entry.founder.id} entry={entry} index={i} />
                  ))}
                </>
              )}
            </div>

            {/* Pagination */}
            {results.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 border-t border-border bg-muted/10">
                <div className="hidden sm:block text-xs text-muted-foreground font-mono">
                  Showing{' '}
                  <span className="text-foreground">
                    {((page - 1) * PAGE_SIZE + 1).toLocaleString()}–
                    {Math.min(page * PAGE_SIZE, total).toLocaleString()}
                  </span>{' '}
                  of <span className="text-foreground">{total.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs border border-border rounded-sm disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#FB651E]/40 hover:text-[#FB651E] transition-colors font-mono"
                  >
                    <ChevronLeft className="w-3 h-3" />
                    Prev
                  </button>
                  <span className="text-xs font-mono text-muted-foreground px-1">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs border border-border rounded-sm disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#FB651E]/40 hover:text-[#FB651E] transition-colors font-mono"
                  >
                    Next
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </HackerCard>
        </motion.div>
      </div>
    </div>
  );
}
