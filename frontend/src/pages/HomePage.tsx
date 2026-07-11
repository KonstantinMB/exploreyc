import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../contexts/AppContext';
import { apiClient, type Source } from '../lib/api';
import { SourceBadge } from '../components/ui/SourceBadge';
import { getSecondMostRecentBatch, batchToShortFormat as batchToShort } from '../lib/batchUtils';
import { Map, BarChart3, Wrench, TrendingUp, Building2, Globe2, Sparkles, ArrowRight, BookOpen, Terminal, ChevronUp } from 'lucide-react';
import { HeroAnswerBox } from '../components/HeroAnswerBox';
import { OptimizedMap } from '../components/OptimizedMap';
import { EmailSubscription } from '../components/EmailSubscription';
import { CompaniesBrowser } from '../components/CompaniesBrowser';
import { CompanyDetailModal } from '../components/CompanyDetailModal';
import { HackerCard } from '../components/ui/hacker-card';
import { DotPattern } from '../components/ui/dot-pattern';
import { GridPattern } from '../components/ui/grid-pattern';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export function HomePage() {
  const { stats, selectedCompany, setSelectedCompany } = useApp();

  // Data provenance: which sources the companies come from, with live counts.
  const [sources, setSources] = useState<Source[]>([]);
  useEffect(() => {
    apiClient
      .getSources()
      .then((r) =>
        setSources(
          (r.data.sources || [])
            .filter((s) => s.count > 0)
            .sort((a, b) => b.count - a.count),
        ),
      )
      .catch(() => {});
  }, []);

  // Second-most recent batch (latest may not have started yet, e.g. Summer 2026 vs Spring 2026)
  const wrappedBatch = getSecondMostRecentBatch(stats?.by_batch);

  const totalCompanies = stats?.total_all_companies ?? stats?.total_companies ?? 0;
  const totalCountries = stats?.by_country ? Object.keys(stats.by_country).length : 0;
  const totalIndustries = stats?.by_industry ? Object.keys(stats.by_industry).length : 0;

  return (
    <div className="relative min-h-screen bg-background">
      <DotPattern color="hsl(var(--primary) / 0.15)" size={24} radius={0.5} />
      <GridPattern size={32} className="opacity-50" />

      <div className="container relative mx-auto px-4 py-12">
        {/* Hero — centered agentic search */}
        <div className="relative mb-20 overflow-hidden pt-4 pb-2">
          {/* ambient breathing glow anchored behind the search */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[46%] -z-0 h-[440px] w-[820px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FB651E]/12 blur-[130px]"
            animate={{ opacity: [0.5, 0.85, 0.5], scale: [1, 1.06, 1] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          />

          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="relative z-10 flex flex-col items-center text-center"
          >
            {/* eyebrow chip */}
            <motion.div
              variants={item}
              className="mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3.5 py-1.5 font-mono text-xs text-muted-foreground backdrop-blur"
            >
              <Terminal className="h-3.5 w-3.5 text-[#FB651E]" />
              <span>$ explore-yc --init</span>
              <span className="ml-0.5 inline-block h-3 w-[7px] animate-pulse bg-[#FB651E]" />
            </motion.div>

            {/* headline */}
            <motion.h1
              variants={item}
              className="max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl"
            >
              <span className="text-[#FB651E]">&gt;</span>{' '}
              <span className="bg-gradient-to-br from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent">
                Explore YC, a16z &amp; top startups
              </span>
            </motion.h1>

            {/* subline */}
            <motion.p
              variants={item}
              className="mt-5 max-w-xl font-mono text-base leading-relaxed text-muted-foreground"
            >
              Ask anything about {totalCompanies.toLocaleString()}+ startups from Y&nbsp;Combinator,
              Hacker&nbsp;News, Product&nbsp;Hunt, a16z &amp; more — instant answers on a free, open-source API.
            </motion.p>

            {/* SEARCH — the centerpiece */}
            <motion.div variants={item} className="mt-9 flex w-full justify-center">
              <HeroAnswerBox />
            </motion.div>

            {/* Live stats — compact terminal status row */}
            <motion.div
              variants={item}
              className="mt-9 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono text-sm"
            >
              <span className="text-muted-foreground/50">$</span>
              <span className="text-muted-foreground">
                <span className="font-bold text-[#FB651E]">{totalCompanies.toLocaleString()}</span> companies
              </span>
              <span className="text-border">·</span>
              <span className="text-muted-foreground">
                <span className="font-bold text-[#FB651E]">{totalCountries}+</span> countries
              </span>
              <span className="text-border">·</span>
              <span className="text-muted-foreground">
                <span className="font-bold text-[#FB651E]">{totalIndustries}+</span> industries
              </span>
            </motion.div>

            {/* Data provenance — where the company data is sourced from */}
            {sources.length > 0 && (
              <motion.div
                variants={item}
                className="mt-6 flex flex-col items-center gap-2"
              >
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground/60">
                  Sourced from
                </span>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {sources.map((s) => (
                    <span
                      key={s.key}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-2.5 py-1 font-mono text-xs"
                      title={`${s.display_name}: ${s.count.toLocaleString()} companies`}
                    >
                      <SourceBadge source={s.key} />
                      <span className="text-foreground">{s.display_name}</span>
                      <span className="font-bold text-[#FB651E]">{s.count.toLocaleString()}</span>
                    </span>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Primary CTAs */}
            <motion.div
              variants={item}
              className="mt-8 flex flex-wrap items-center justify-center gap-3"
            >
              <a
                href="#map"
                className="group inline-flex items-center gap-2 px-5 py-2.5 bg-[#FB651E] hover:bg-[#E65C00] text-white font-mono text-sm border border-[#FB651E]/50 transition-all duration-200 hover:shadow-[0_0_20px_rgba(251,101,30,0.3)]"
              >
                Start Exploring
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </a>
              <Link
                to="/analytics"
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-border hover:border-[#FB651E]/50 font-mono text-sm bg-background/50 transition-all duration-200"
              >
                View Analytics
              </Link>
            </motion.div>

            <motion.div
              variants={item}
              className="mt-8 flex flex-wrap items-center justify-center gap-4"
            >
            <motion.a
              href="https://www.producthunt.com/products/yc-company-explorer?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-exploreyc-2"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Upvote ExploreYC on Product Hunt"
              className="group relative inline-flex shrink-0 items-center"
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            >
              {/* Animated upvote nudge — anchored over the badge's vote arrow */}
              <motion.span
                aria-hidden="true"
                className="pointer-events-none absolute -top-2.5 right-3 z-10 flex items-center gap-0.5 rounded-full border border-[#FB651E]/60 bg-background/95 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-[#FB651E] shadow-[0_0_12px_rgba(251,101,30,0.4)]"
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              >
                <ChevronUp className="h-3 w-3" />
                Upvote
              </motion.span>

              <img
                src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1190010&theme=light&t=1783529184370"
                alt="ExploreYC — Open-source API for Y Combinator &amp; a16z company data | Product Hunt"
                width={250}
                height={54}
                className="h-[54px] w-auto max-w-full rounded-md transition-shadow duration-200 group-hover:shadow-[0_0_22px_rgba(251,101,30,0.35)]"
              />
            </motion.a>

            {/* Product Hunt — #1 Product of the Day badge (proof we ranked first) */}
            <a
              href="https://www.producthunt.com/products/yc-company-explorer?embed=true&utm_source=badge-top-post-badge&utm_medium=badge&utm_campaign=badge-exploreyc-2"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="ExploreYC — #1 Product of the Day on Product Hunt"
              className="group shrink-0 inline-flex items-center"
            >
              <img
                src="https://api.producthunt.com/widgets/embed-image/v1/top-post-badge.svg?post_id=1190010&theme=light&period=daily&t=1783772611367"
                alt="ExploreYC — Open-source API for Y Combinator &amp; a16z company data | Product Hunt"
                width={250}
                height={54}
                className="h-[54px] w-auto max-w-full rounded-md transition-shadow duration-200 group-hover:shadow-[0_0_22px_rgba(251,101,30,0.35)]"
              />
            </a>
            </motion.div>
          </motion.div>
        </div>

        {/* Batch Wrapped Banner - hacker card */}
        {wrappedBatch && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="mb-8"
          >
            <Link
              to={`/batch/${batchToShort(wrappedBatch.name)}/wrapped`}
              className="group block"
            >
              <HackerCard glowColor="orange" className="p-6 border-[#FB651E]/30 hover:border-[#FB651E]/60">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#FB651E] flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold font-mono">{wrappedBatch.name} Wrapped</h3>
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-mono border border-emerald-500/30">
                        NEW
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground font-mono">
                      Spotify-style stats for {wrappedBatch.count.toLocaleString()} companies
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-[#FB651E] group-hover:translate-x-1 transition-all" />
                </div>
              </HackerCard>
            </Link>
          </motion.div>
        )}

        {/* Map Section */}
        <motion.section
          id="map"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5 }}
          className="border-t border-border py-12"
        >
          <div className="flex items-center gap-2 mb-6 font-mono">
            <Map className="h-5 w-5 text-[#FB651E]" />
            <span className="text-muted-foreground">$</span>
            <h2 className="text-xl font-bold">Interactive World Map</h2>
          </div>
          <OptimizedMap />
        </motion.section>

        {/* Daily YC Updates */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5 }}
          className="py-12"
        >
          <EmailSubscription />
        </motion.section>

        {/* Companies List */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5 }}
          className="py-12"
        >
          <div className="flex items-center gap-2 mb-6 font-mono">
            <span className="text-muted-foreground">$</span>
            <h2 className="text-xl font-bold">Browse All Companies</h2>
            <span className="text-muted-foreground text-sm">({(stats?.total_companies ?? 0).toLocaleString()} startups)</span>
          </div>
          <CompaniesBrowser refreshTrigger={stats?.total_companies || 0} />
        </motion.section>

        {selectedCompany && (
          <CompanyDetailModal
            company={selectedCompany}
            open={true}
            onClose={() => setSelectedCompany(null)}
          />
        )}

        {/* Bento-style feature grid */}
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto"
        >
          <Link to="#map" className="group">
            <HackerCard glowColor="orange" delay={0} className="p-5 h-full">
              <Map className="h-8 w-8 text-[#FB651E] mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="font-bold font-mono mb-1">Interactive Map</h3>
              <p className="text-sm text-muted-foreground">
                Explore companies by location on a global map
              </p>
              <span className="inline-flex items-center gap-1 mt-3 text-xs text-[#FB651E] font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                view <ArrowRight className="h-3 w-3" />
              </span>
            </HackerCard>
          </Link>

          <Link to="/analytics" className="group">
            <HackerCard glowColor="blue" delay={0.05} className="p-5 h-full">
              <BarChart3 className="h-8 w-8 text-blue-500 mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="font-bold font-mono mb-1">Analytics</h3>
              <p className="text-sm text-muted-foreground">
                Batches, industries, hiring trends
              </p>
              <span className="inline-flex items-center gap-1 mt-3 text-xs text-blue-500 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                open <ArrowRight className="h-3 w-3" />
              </span>
            </HackerCard>
          </Link>

          <Link to="/founders" className="group">
            <HackerCard glowColor="green" delay={0.1} className="p-5 h-full">
              <BookOpen className="h-8 w-8 text-emerald-500 mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="font-bold font-mono mb-1">For Founders</h3>
              <p className="text-sm text-muted-foreground">
                PG essays, daily YC updates
              </p>
              <span className="inline-flex items-center gap-1 mt-3 text-xs text-emerald-500 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                read <ArrowRight className="h-3 w-3" />
              </span>
            </HackerCard>
          </Link>

          <Link to="/tools" className="group">
            <HackerCard glowColor="purple" delay={0.15} className="p-5 h-full">
              <Wrench className="h-8 w-8 text-violet-500 mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="font-bold font-mono mb-1">Founder Tools</h3>
              <p className="text-sm text-muted-foreground">
                Idea validator, batch wrapped, fundraising tracker
              </p>
              <span className="inline-flex items-center gap-1 mt-3 text-xs text-violet-500 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                launch <ArrowRight className="h-3 w-3" />
              </span>
            </HackerCard>
          </Link>

          {/* Stats cards - compact */}
          {stats?.by_status && (
            <HackerCard glowColor="green" delay={0.2} className="p-5 col-span-1">
              <TrendingUp className="h-6 w-6 text-emerald-500 mb-2" />
              <div className="text-2xl font-bold font-mono text-emerald-500">
                {stats.by_status['Active']?.toLocaleString() || 0}
              </div>
              <div className="text-xs text-muted-foreground font-mono">Active</div>
            </HackerCard>
          )}
          {stats?.by_industry && (
            <HackerCard glowColor="orange" delay={0.25} className="p-5 col-span-1">
              <Building2 className="h-6 w-6 text-[#FB651E] mb-2" />
              <div className="text-xl font-bold font-mono text-[#FB651E] truncate">
                {Object.entries(stats.by_industry).sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A'}
              </div>
              <div className="text-xs text-muted-foreground font-mono">Top Industry</div>
            </HackerCard>
          )}
          {stats?.by_country && (
            <HackerCard glowColor="purple" delay={0.3} className="p-5 col-span-1">
              <Globe2 className="h-6 w-6 text-violet-500 mb-2" />
              <div className="text-lg font-bold font-mono text-violet-500 truncate">
                {Object.entries(stats.by_country).sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A'}
              </div>
              <div className="text-xs text-muted-foreground font-mono">Top Country</div>
            </HackerCard>
          )}
        </motion.div>

        {/* Terminal footer */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-16 max-w-4xl mx-auto border border-border p-6 bg-card/30"
        >
          <div className="font-mono text-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[#FB651E]">&gt;</span>
              <span className="text-muted-foreground">Ready to explore?</span>
            </div>
            <div className="flex flex-wrap gap-4">
              <a href="#map" className="text-[#FB651E] hover:underline font-mono">
                $ view map
              </a>
              <Link to="/analytics" className="text-[#FB651E] hover:underline font-mono">
                $ see charts
              </Link>
              <Link to="/validator" className="text-[#FB651E] hover:underline font-mono">
                $ validate idea
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
