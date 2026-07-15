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

function LeaderboardRow({ entry }: { entry: FounderLeaderboardEntry }) {
  const { founder, stats, headline_stat, rank } = entry;
  return (
    <Link
      to={`/founder/${founder.slug}`}
      className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 border-b border-border/50 hover:bg-muted/20 transition-colors group"
    >
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
  );
}

export function FounderLeaderboardPage() {
  const { stats } = useApp();
  const [metric, setMetric] = useState<FounderMetric>('serial');
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
            subtitle="The most prolific Y Combinator founders, ranked. Grab your shareable rank card."
          />
        </motion.div>

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
                  className={`flex items-center justify-center gap-2 h-10 px-3 text-xs sm:text-sm font-mono border rounded-sm transition-colors ${
                    active
                      ? 'bg-[#FB651E]/10 border-[#FB651E]/50 text-[#FB651E] font-semibold'
                      : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{METRIC_LABELS[key]}</span>
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
                results.map((entry) => (
                  <LeaderboardRow key={entry.founder.id} entry={entry} />
                ))
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
