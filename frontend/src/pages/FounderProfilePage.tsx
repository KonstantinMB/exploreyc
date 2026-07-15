import { useRef, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Linkedin,
  Twitter,
  Trophy,
  Building2,
  DollarSign,
  TrendingUp,
  Users,
  Sparkles,
  Repeat,
  Download,
  Loader2,
  Share2,
  ExternalLink,
  Info,
} from 'lucide-react';
import { apiClient, resolveMediaUrl } from '../lib/api';
import { HackerCard } from '../components/ui/hacker-card';
import { DotPattern } from '../components/ui/dot-pattern';
import { Avatar } from '../components/ui/Avatar';
import { FounderRankCard } from '../components/share/FounderRankCard';
import { SocialShareButtons } from '../components/share/SocialShareButtons';
import { useImageExport } from '../hooks/useImageExport';
import { Button } from '../components/ui/button';
import type {
  FounderMetric,
  FounderRank,
  FounderProfileResponse,
} from '../types/founders';
import { METRIC_LABELS, METRIC_BADGE_LABELS } from '../types/founders';

function formatFunding(v?: number | null): string {
  if (!v) return '—';
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

function formatCount(v?: number | null): string {
  return v != null ? v.toLocaleString() : '—';
}

/** Pick the "best" rank/metric to feature on the shareable card (lowest rank wins). */
function pickFeaturedRank(ranks: FounderRank[]): FounderRank | null {
  if (!ranks.length) return null;
  return [...ranks].sort((a, b) => a.rank - b.rank)[0];
}

/** Build the big headline stat for the rank card from the featured metric. */
function headlineForMetric(
  metric: FounderMetric,
  stats: FounderProfileResponse['stats'],
): { label: string; value: string } {
  switch (metric) {
    case 'funded':
      return { label: 'Total Raised', value: formatFunding(stats.total_funding_usd) };
    case 'exits':
      return {
        label: 'Best Exit',
        value: stats.best_exit_type
          ? stats.best_exit_acquirer
            ? `${stats.best_exit_type} → ${stats.best_exit_acquirer}`
            : stats.best_exit_type
          : '—',
      };
    case 'unicorns':
      return { label: 'Peak Valuation', value: formatFunding(stats.max_valuation_usd) };
    case 'serial':
    default:
      return {
        label: 'YC Companies Founded',
        value: `${stats.companies_count}`,
      };
  }
}

const METRIC_ICON: Record<FounderMetric, React.ComponentType<{ className?: string }>> = {
  serial: Repeat,
  funded: DollarSign,
  exits: Trophy,
  unicorns: Sparkles,
};

export function FounderProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const cardRef = useRef<HTMLDivElement>(null);
  const { exporting, exportAsImage, error: exportError } = useImageExport(cardRef);
  const [shareOpen, setShareOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['founder', slug],
    queryFn: () => apiClient.getFounder(slug!).then((r) => r.data),
    enabled: !!slug,
    staleTime: 1000 * 60 * 5,
  });

  const featured = useMemo(() => (data ? pickFeaturedRank(data.ranks) : null), [data]);
  const headline = useMemo(
    () => (data && featured ? headlineForMetric(featured.metric, data.stats) : null),
    [data, featured],
  );

  const profileUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/founder/${slug}` : '';

  const handleExport = async () => {
    await new Promise((r) => setTimeout(r, 100));
    await exportAsImage(`${slug}-rank-card`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#FB651E] mx-auto mb-4" />
          <p className="text-muted-foreground font-mono text-sm">Loading founder…</p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto bg-[#FB651E]/10 rounded-2xl flex items-center justify-center mb-6">
            <Trophy className="h-8 w-8 text-[#FB651E]" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Founder not found</h2>
          <p className="text-muted-foreground font-mono mb-6 text-sm">
            We couldn't find this founder. They may not be in our dataset yet.
          </p>
          <Link
            to="/founders/leaderboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FB651E] hover:bg-[#E65C00] text-white text-sm font-semibold rounded-sm transition-colors"
          >
            <Trophy className="h-4 w-4" />
            Browse leaderboards
          </Link>
        </div>
      </div>
    );
  }

  const { founder, stats, companies, ranks, enrichment } = data;

  const statCards = [
    {
      label: 'Companies',
      value: formatCount(stats.companies_count),
      icon: Building2,
      color: 'text-[#FB651E]',
      glow: 'orange' as const,
    },
    {
      label: 'Total Funding',
      value: formatFunding(stats.total_funding_usd),
      icon: DollarSign,
      color: 'text-emerald-500',
      glow: 'green' as const,
    },
    {
      label: 'Peak Valuation',
      value: formatFunding(stats.max_valuation_usd),
      icon: TrendingUp,
      color: 'text-blue-500',
      glow: 'blue' as const,
    },
    {
      label: 'Total Employees',
      value: formatCount(stats.total_employee_count),
      icon: Users,
      color: 'text-violet-500',
      glow: 'purple' as const,
    },
  ];

  const shareData = {
    title: `${founder.full_name} — YC Founder`,
    text: featured
      ? `${founder.full_name} is the #${featured.rank} ${METRIC_BADGE_LABELS[featured.metric]} 🏆\n\nSee the founder leaderboards:`
      : `${founder.full_name} on ExploreYC founder leaderboards 🏆`,
    url: profileUrl,
  };

  return (
    <div className="relative min-h-screen bg-background overflow-x-hidden">
      <Helmet>
        <title>{founder.full_name} — YC founder profile | ExploreYC</title>
        <meta
          name="description"
          content={`${founder.full_name}${founder.title ? `, ${founder.title}` : ''} — Y Combinator founder. ${stats.companies_count} ${stats.companies_count === 1 ? 'company' : 'companies'}, ${formatFunding(stats.total_funding_usd)} raised. See their leaderboard ranks.`}
        />
        <link rel="canonical" href={`https://exploreyc.com/founder/${slug}`} />
      </Helmet>

      <DotPattern color="hsl(var(--primary) / 0.12)" size={24} radius={0.5} />

      <div className="container relative mx-auto px-4 py-8 max-w-[1000px]">
        <Link
          to="/founders/leaderboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-[#FB651E] font-mono mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to leaderboards
        </Link>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <HackerCard className="p-5 sm:p-6 mb-4" glowColor="orange">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <Avatar
                src={resolveMediaUrl(founder.avatar_url)}
                name={founder.full_name}
                size={80}
                className="shrink-0"
              />
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  {founder.full_name}
                </h1>
                {founder.title && (
                  <p className="text-muted-foreground font-mono text-sm mt-1">{founder.title}</p>
                )}
                {founder.bio && (
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed line-clamp-4">
                    {founder.bio}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  {founder.linkedin_url && (
                    <a
                      href={founder.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono border border-border rounded-sm text-muted-foreground hover:text-[#FB651E] hover:border-[#FB651E]/40 transition-colors"
                    >
                      <Linkedin className="w-3.5 h-3.5" /> LinkedIn
                    </a>
                  )}
                  {founder.twitter_url && (
                    <a
                      href={founder.twitter_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono border border-border rounded-sm text-muted-foreground hover:text-[#FB651E] hover:border-[#FB651E]/40 transition-colors"
                    >
                      <Twitter className="w-3.5 h-3.5" /> X
                    </a>
                  )}
                </div>
              </div>
              {/* Share card CTA */}
              <button
                onClick={() => setShareOpen((v) => !v)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FB651E] hover:bg-[#E65C00] text-white text-sm font-semibold font-mono rounded-sm transition-colors shrink-0 self-start"
              >
                <Share2 className="w-4 h-4" />
                Share card
              </button>
            </div>
          </HackerCard>
        </motion.div>

        {/* Rank badges */}
        {ranks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-wrap gap-2 mb-4"
          >
            {ranks.map((r) => {
              const Icon = METRIC_ICON[r.metric];
              return (
                <span
                  key={r.metric}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm border border-[#FB651E]/40 bg-[#FB651E]/10 text-[#FB651E] text-xs font-mono font-semibold"
                  title={`Ranked #${r.rank} on the ${METRIC_LABELS[r.metric]} leaderboard`}
                >
                  <Icon className="w-3.5 h-3.5" />#{r.rank} {METRIC_LABELS[r.metric]}
                </span>
              );
            })}
          </motion.div>
        )}

        {/* Share card panel */}
        {shareOpen && headline && featured && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-4"
          >
            <HackerCard className="p-5 sm:p-6" glowColor="orange">
              <h3 className="text-lg font-bold mb-4 font-mono">
                <span className="text-[#FB651E]">$</span> Share rank card
              </h3>
              {/* Preview (scaled down) */}
              <div
                className="mx-auto overflow-hidden flex justify-center w-full max-w-[420px] mb-5"
                style={{ aspectRatio: '1080 / 1350' }}
              >
                <div
                  className="origin-top shrink-0"
                  style={{ transform: 'scale(0.388)', transformOrigin: 'top center' }}
                >
                  <FounderRankCard
                    founder={founder}
                    stats={stats}
                    metric={featured.metric}
                    rank={featured.rank}
                    headline={headline}
                    profileUrl={profileUrl}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3 mb-4">
                <Button
                  onClick={handleExport}
                  disabled={exporting}
                  className="bg-[#FB651E] hover:bg-[#E65C00]"
                >
                  {exporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Exporting…
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" /> Download PNG
                    </>
                  )}
                </Button>
              </div>
              {exportError && (
                <p className="text-red-500 text-sm mb-3 font-mono">{exportError}</p>
              )}
              <p className="text-sm text-muted-foreground mb-3 font-mono">Share on social:</p>
              <SocialShareButtons
                shareData={shareData}
                hashtags={['YCombinator', 'Founders', 'Startups']}
              />
            </HackerCard>
          </motion.div>
        )}

        {/* Stats grid */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4"
        >
          {statCards.map((s) => (
            <HackerCard key={s.label} className="p-3" glowColor={s.glow}>
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
                <span className="text-xs text-muted-foreground font-mono">{s.label}</span>
              </div>
              <div className={`text-lg font-bold font-mono tabular-nums ${s.color}`}>
                {s.value}
              </div>
            </HackerCard>
          ))}
        </motion.div>

        {/* Companies */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-4"
        >
          <HackerCard className="overflow-hidden" glowColor="orange">
            <div className="px-4 py-3 border-b border-border bg-muted/20">
              <h2 className="text-sm font-bold font-mono flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#FB651E]" />
                Companies ({companies.length})
              </h2>
            </div>
            {companies.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No companies on record.
              </div>
            ) : (
              companies.map((c) => (
                <Link
                  key={c.slug}
                  to={`/company/${c.slug}`}
                  className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-b-0 hover:bg-muted/20 transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-sm truncate group-hover:text-[#FB651E] transition-colors">
                        {c.name}
                      </span>
                      {c.batch && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-[#FB651E]/10 text-[#FB651E] whitespace-nowrap">
                          {c.batch}
                        </span>
                      )}
                      {c.status && (
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded-sm whitespace-nowrap ${
                            c.status === 'Active'
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {c.status}
                        </span>
                      )}
                    </div>
                    {(c.title || c.one_liner) && (
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {c.title ? <span className="text-foreground/70">{c.title}</span> : null}
                        {c.title && c.one_liner ? <span className="opacity-40"> · </span> : null}
                        {c.one_liner}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0 hidden sm:block">
                    {c.funding_total_usd ? (
                      <div className="text-xs font-mono tabular-nums text-emerald-500">
                        {formatFunding(c.funding_total_usd)}
                      </div>
                    ) : null}
                    {c.team_size ? (
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {c.team_size} people
                      </div>
                    ) : null}
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-[#FB651E] transition-colors shrink-0" />
                </Link>
              ))
            )}
          </HackerCard>
        </motion.div>

        {/* Enrichment — supplementary, web-sourced, clearly labeled */}
        {enrichment && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <HackerCard className="overflow-hidden" glowColor="purple">
              <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold font-mono flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-500" />
                  Web-sourced signals
                </h2>
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded-sm bg-violet-500/10 text-violet-400 border border-violet-500/30"
                  title="These figures are estimated and gathered from public web sources, not YC's authoritative data. They never affect leaderboard rankings."
                >
                  <Info className="w-3 h-3" />
                  estimated · web-sourced
                </span>
              </div>

              <div className="p-4 space-y-4">
                {/* Follower / count metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {enrichment.twitter_followers != null && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
                        X followers
                      </div>
                      <div className="text-sm font-bold font-mono tabular-nums">
                        {enrichment.twitter_followers.toLocaleString()}
                      </div>
                    </div>
                  )}
                  {enrichment.linkedin_followers != null && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
                        LinkedIn followers
                      </div>
                      <div className="text-sm font-bold font-mono tabular-nums">
                        {enrichment.linkedin_followers.toLocaleString()}
                      </div>
                    </div>
                  )}
                  {enrichment.angel_investments_count != null && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
                        Angel investments
                      </div>
                      <div className="text-sm font-bold font-mono tabular-nums">
                        {enrichment.angel_investments_count.toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>

                {/* List sections */}
                {enrichment.education && enrichment.education.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                      Education
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {enrichment.education.map((e, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-1 rounded-sm bg-muted text-muted-foreground"
                        >
                          {typeof e === 'string'
                            ? e
                            : `${e.school}${e.degree ? ` · ${e.degree}` : ''}`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {enrichment.awards && enrichment.awards.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                      Awards
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {enrichment.awards.map((a, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-1 rounded-sm bg-muted text-muted-foreground"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {enrichment.notable_exits && enrichment.notable_exits.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                      Notable exits
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {enrichment.notable_exits.map((x, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-1 rounded-sm bg-muted text-muted-foreground"
                          title={typeof x === 'string' ? undefined : x.detail ?? undefined}
                        >
                          {typeof x === 'string'
                            ? x
                            : `${x.company}${x.type ? ` — ${x.type}` : ''}`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Citations */}
                {enrichment.citations && enrichment.citations.length > 0 && (
                  <div className="pt-2 border-t border-border/50">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
                      Sources
                    </div>
                    <div className="flex flex-col gap-1">
                      {enrichment.citations.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-400 hover:underline truncate"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          <span className="truncate">{url}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {(enrichment.confidence || enrichment.enriched_at) && (
                  <div className="pt-2 border-t border-border/50 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground font-mono">
                    {enrichment.confidence && <span>confidence: {enrichment.confidence}</span>}
                    {enrichment.enriched_at && (
                      <span>updated: {new Date(enrichment.enriched_at).toLocaleDateString()}</span>
                    )}
                  </div>
                )}
              </div>
            </HackerCard>
          </motion.div>
        )}
      </div>

      {/* Hidden full-size rank card for PNG export (avoids html2canvas transform bugs) */}
      {headline && featured && (
        <div
          aria-hidden="true"
          className="fixed z-[-1]"
          style={{ left: -9999, top: 0, width: 1080, height: 1350 }}
        >
          <FounderRankCard
            ref={cardRef}
            founder={founder}
            stats={stats}
            metric={featured.metric}
            rank={featured.rank}
            headline={headline}
            profileUrl={profileUrl}
          />
        </div>
      )}
    </div>
  );
}
