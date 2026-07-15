import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../contexts/AppContext';
import { apiClient, type Source } from '../lib/api';
import { SourceBadge } from '../components/ui/SourceBadge';
import { getSecondMostRecentBatch, batchToShortFormat as batchToShort } from '../lib/batchUtils';
import { Globe2, Sparkles, ArrowRight, Terminal, ChevronUp, Trophy } from 'lucide-react';
import { HeroAnswerBox } from '../components/HeroAnswerBox';
import { DatabasePreview } from '../components/DatabasePreview';
import { FoundersPreview } from '../components/FoundersPreview';
import { PlatformCapabilities } from '../components/PlatformCapabilities';
import { ApiShowcase } from '../components/ApiShowcase';
import { HomeFaq } from '../components/HomeFaq';
import { EmailSubscription } from '../components/EmailSubscription';
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
                href="#database-preview"
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

        {/* API access showcase — lead with the API right under the hero */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5 }}
          className="border-t border-border py-14"
        >
          <ApiShowcase />
        </motion.section>

        {/* Database Preview Section */}
        <motion.section
          id="database-preview"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5 }}
          className="border-t border-border py-12"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2 font-mono">
              <Terminal className="h-5 w-5 text-[#FB651E]" />
              <span className="text-muted-foreground">$</span>
              <h2 className="text-xl font-bold">Companies Database</h2>
            </div>
            {/* The interactive map now lives on its own page */}
            <Link
              to="/map"
              className="group inline-flex items-center gap-2 px-4 py-2 border border-border hover:border-[#FB651E]/50 font-mono text-xs bg-background/50 transition-all duration-200 rounded-sm"
            >
              <Globe2 className="h-4 w-4 text-[#FB651E]" />
              Explore the interactive world map
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
          <DatabasePreview />
        </motion.section>

        {/* Founder Leaderboards — the people behind the companies, right beside the DB */}
        <motion.section
          id="founder-leaderboards"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5 }}
          className="border-t border-border py-12"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2 font-mono">
              <Trophy className="h-5 w-5 text-[#FB651E]" />
              <span className="text-muted-foreground">$</span>
              <h2 className="text-xl font-bold">Founder Leaderboards</h2>
              <span className="hidden sm:inline text-xs text-muted-foreground">— the people behind the companies</span>
            </div>
            <Link
              to="/founders/leaderboard"
              className="group inline-flex items-center gap-2 px-4 py-2 border border-border hover:border-[#FB651E]/50 font-mono text-xs bg-background/50 transition-all duration-200 rounded-sm"
            >
              <Sparkles className="h-4 w-4 text-[#FB651E]" />
              Who's raised the most? Grab a rank card
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
          <FoundersPreview />
        </motion.section>

        {/* Daily YC Updates — right below the database */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5 }}
          className="border-t border-border py-12"
        >
          <EmailSubscription />
        </motion.section>

        {/* Platform capabilities — anchors into every data surface */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5 }}
          className="border-t border-border py-14"
        >
          <PlatformCapabilities />
        </motion.section>

        {/* FAQ — GEO answer content + FAQPage structured data */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5 }}
          className="border-t border-border py-14"
        >
          <HomeFaq />
        </motion.section>

        {/* Latest batch wrapped — footer */}
        {wrappedBatch && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="border-t border-border pt-10 mt-4 pb-4"
          >
            <div className="flex items-center gap-2 mb-4 font-mono text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-[#FB651E]" />
              <span>$ batch --latest --wrapped</span>
            </div>
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

        {selectedCompany && (
          <CompanyDetailModal
            company={selectedCompany}
            open={true}
            onClose={() => setSelectedCompany(null)}
          />
        )}
      </div>
    </div>
  );
}
