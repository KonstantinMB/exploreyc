import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../contexts/AppContext';
import { getSecondMostRecentBatch, batchToShortFormat as batchToShort } from '../lib/batchUtils';
import { Earth, Sparkles, ArrowRight, Terminal, ChevronUp, Trophy } from 'lucide-react';
import { HeroAnswerBox } from '../components/HeroAnswerBox';
import { DatabasePreview } from '../components/DatabasePreview';
import { FoundersPreview } from '../components/FoundersPreview';
import { PlatformCapabilities } from '../components/PlatformCapabilities';
import { ApiShowcase } from '../components/ApiShowcase';
import { HomeFaq } from '../components/HomeFaq';
import { EmailSubscription } from '../components/EmailSubscription';
import { HomeWorld } from '../components/home/HomeWorld';
import { CountUp } from '../components/world/boards/CountUp';
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

/**
 * One live figure in the hero strip.
 *
 * <CountUp> starts at whatever value it is first handed, so these ramp from 0
 * to the real number the moment /api/stats lands — and snap silently under
 * prefers-reduced-motion, which CountUp handles itself.
 */
function HeroStat({ value, label, plus = false }: { value: number; label: string; plus?: boolean }) {
  return (
    <div className="bg-background/60 px-3 py-2.5 text-center backdrop-blur sm:px-4">
      <div className="font-mono text-xl font-bold tabular-nums text-[#FB651E] sm:text-2xl">
        <CountUp value={value} />
        {plus ? '+' : ''}
      </div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

/** Column count as a literal class — Tailwind cannot see an interpolated one. */
const STAT_COLS: Record<number, string> = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
};

export function HomePage() {
  // The company detail modal is hosted once in <Layout> (see App.tsx) rather
  // than per page, so ⌘K → a company opens it from anywhere. HomePage used to
  // carry its own copy; keeping it would render the same modal twice.
  const { stats } = useApp();

  // Second-most recent batch (latest may not have started yet, e.g. Summer 2026 vs Spring 2026)
  const wrappedBatch = getSecondMostRecentBatch(stats?.by_batch);

  const totalCompanies = stats?.total_all_companies ?? stats?.total_companies ?? 0;
  const totalCountries = stats?.by_country ? Object.keys(stats.by_country).length : 0;
  const totalIndustries = stats?.by_industry ? Object.keys(stats.by_industry).length : 0;
  const totalBatches = stats?.by_batch ? Object.keys(stats.by_batch).length : 0;

  // A figure we do not have is not printed. An empty facet counts as "do not
  // have" — a hero cell reading "0 countries" is worse than one fewer cell.
  const heroStats = [
    { label: 'companies', value: totalCompanies, plus: false },
    { label: 'countries', value: totalCountries, plus: true },
    { label: 'industries', value: totalIndustries, plus: true },
    { label: 'batches', value: totalBatches, plus: false },
  ].filter((s) => s.value > 0);

  return (
    <div className="relative min-h-screen bg-background">
      <DotPattern color="hsl(var(--primary) / 0.15)" size={24} radius={0.5} />
      <GridPattern size={32} className="opacity-50" />

      <div className="container relative mx-auto px-4 py-12">
        {/* Hero — centered agentic search.
            No subline, no provenance badges, no third CTA: the headline says
            what this is, the numbers say how much of it there is, and the
            search box is the product. */}
        <div className="relative mb-12 overflow-hidden pt-4 pb-2">
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

            {/* SEARCH — the centerpiece */}
            <motion.div variants={item} className="mt-8 flex w-full justify-center">
              <HeroAnswerBox />
            </motion.div>

            {/* Live stats — counters instead of a sentence. */}
            {heroStats.length > 0 && (
              <motion.div
                variants={item}
                className={`mt-8 grid w-full max-w-xl grid-cols-2 gap-px overflow-hidden rounded-sm border border-border bg-border ${STAT_COLS[heroStats.length] ?? 'sm:grid-cols-4'}`}
              >
                {heroStats.map((s) => (
                  <HeroStat key={s.label} value={s.value} label={s.label} plus={s.plus} />
                ))}
              </motion.div>
            )}

            {/* Two CTAs. One explores, one buys. */}
            <motion.div
              variants={item}
              className="mt-7 flex flex-wrap items-center justify-center gap-3"
            >
              <a
                href="#database-preview"
                className="group inline-flex items-center gap-2 rounded-sm border border-[#FB651E]/50 bg-[#FB651E] px-5 py-2.5 font-mono text-sm text-white transition-all duration-200 hover:bg-[#E65C00] hover:shadow-[0_0_20px_rgba(251,101,30,0.3)]"
              >
                Start Exploring
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
              {/* The paid surface. Priced in the label because the price is the
                  pitch — $5 is the whole objection handled before the click. */}
              <a
                href="#world"
                className="group inline-flex items-center gap-2 rounded-sm border border-[#FB651E]/50 bg-[#FB651E]/[0.06] px-5 py-2.5 font-mono text-sm transition-all duration-200 hover:border-[#FB651E] hover:bg-[#FB651E]/[0.12]"
              >
                <Earth className="h-4 w-4 text-[#FB651E]" />
                Claim your plot — $5
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </a>
            </motion.div>

            <motion.div
              variants={item}
              className="mt-7 flex flex-wrap items-center justify-center gap-4"
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

        {/* ExploreYC World — the live globe, the companies that paid to be on
            it, and the price. It sits directly under the hero because it is the
            only thing on this page that takes money from a startup, and the
            logos in it are what those startups are buying. */}
        <HomeWorld />

        {/* API access showcase */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5 }}
          className="border-t border-border py-10"
        >
          <ApiShowcase />
        </motion.section>

        {/* ExploreYC World — the other paid surface. It sits directly under the
            API showcase because those are the only two things on this site that
            take money, and a visitor who scrolled past the API is exactly who
            might buy a plot instead. */}
        <motion.section
          id="world"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5 }}
          className="border-t border-border py-14"
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 max-w-xl">
              <div className="mb-4 inline-flex items-center gap-2 border border-[#FB651E]/40 bg-[#FB651E]/[0.06] px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-[#FB651E] rounded-sm">
                <Earth className="h-3.5 w-3.5" />
                Advertising space on a live globe
              </div>
              <h2 className="font-mono text-2xl font-bold sm:text-3xl">
                Put your startup on the map.
              </h2>
              <p className="mt-3 font-mono text-sm leading-relaxed text-muted-foreground">
                Stake on a country, plant your logo in it, and hold the top spot against
                anyone who wants it more. Every dollar counts toward your country on the
                world board.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  to="/world"
                  className="group inline-flex items-center gap-2 border border-[#FB651E]/50 bg-[#FB651E] px-5 py-2.5 font-mono text-sm text-white transition-all duration-200 hover:bg-[#E65C00] hover:shadow-[0_0_20px_rgba(251,101,30,0.3)] rounded-sm"
                >
                  Claim a spot — from $5
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  to="/world"
                  className="inline-flex items-center gap-2 border border-border bg-background/50 px-5 py-2.5 font-mono text-sm transition-all duration-200 hover:border-[#FB651E]/50 rounded-sm"
                >
                  <Trophy className="h-4 w-4 text-[#FB651E]" />
                  See the board
                </Link>
              </div>
              <p className="mt-3 font-mono text-[11px] text-muted-foreground">
                No prize, no payout, no refund.
              </p>
            </div>

            {/* Three lines, because the mechanic is genuinely this short. */}
            <ul className="grid w-full shrink-0 gap-px border border-border bg-border lg:w-[380px] rounded-sm overflow-hidden">
              {[
                ['Pick a country', 'Anywhere on Earth. Yours in one click.'],
                ['Plant your logo', 'It draws on the globe and on every board.'],
                ['Hold the top spot', 'Until somebody outstakes you for it.'],
              ].map(([title, desc], i) => (
                <li key={title} className="flex items-start gap-3 bg-background p-4">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-[#FB651E]/40 bg-[#FB651E]/[0.06] font-mono text-xs font-bold text-[#FB651E] rounded-sm">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-mono text-sm font-bold">{title}</span>
                    <span className="block font-mono text-xs text-muted-foreground">{desc}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </motion.section>

        {/* Database Preview Section */}
        <motion.section
          id="database-preview"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5 }}
          className="border-t border-border py-10"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2 font-mono">
              <Terminal className="h-5 w-5 text-[#FB651E]" />
              <span className="text-muted-foreground">$</span>
              <h2 className="text-xl font-bold">Companies Database</h2>
            </div>
            {/* One globe. The old 2D company map merged into ExploreYC World,
                so this is now the only geographic entry point on the site. */}
            <Link
              to="/world"
              className="group inline-flex items-center gap-2 px-4 py-2 border border-border hover:border-[#FB651E]/50 font-mono text-xs bg-background/50 transition-all duration-200 rounded-sm"
            >
              <Earth className="h-4 w-4 text-[#FB651E]" />
              On the globe
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
          className="border-t border-border py-10"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2 font-mono">
              <Trophy className="h-5 w-5 text-[#FB651E]" />
              <span className="text-muted-foreground">$</span>
              <h2 className="text-xl font-bold">Founder Leaderboards</h2>
            </div>
            <Link
              to="/founders/leaderboard"
              className="group inline-flex items-center gap-2 px-4 py-2 border border-border hover:border-[#FB651E]/50 font-mono text-xs bg-background/50 transition-all duration-200 rounded-sm"
            >
              <Sparkles className="h-4 w-4 text-[#FB651E]" />
              Grab a rank card
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
          <FoundersPreview />
        </motion.section>

        {/* Daily YC Updates */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5 }}
          className="border-t border-border py-10"
        >
          <EmailSubscription />
        </motion.section>

        {/* Platform capabilities — anchors into every data surface */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5 }}
          className="border-t border-border py-10"
        >
          <PlatformCapabilities />
        </motion.section>

        {/* FAQ — GEO answer content + FAQPage structured data */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5 }}
          className="border-t border-border py-10"
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
            className="border-t border-border pt-8 mt-4 pb-4"
          >
            <Link
              to={`/batch/${batchToShort(wrappedBatch.name)}/wrapped`}
              className="group block"
            >
              <HackerCard glowColor="orange" className="p-5 border-[#FB651E]/30 hover:border-[#FB651E]/60">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-[#FB651E] flex items-center justify-center flex-shrink-0 rounded-sm">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold font-mono">{wrappedBatch.name} Wrapped</h3>
                      <span className="px-2 py-0.5 bg-[#FB651E]/15 text-[#FB651E] text-[10px] font-mono font-bold uppercase tracking-wider border border-[#FB651E]/30 rounded-sm">
                        New
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

      </div>
    </div>
  );
}
