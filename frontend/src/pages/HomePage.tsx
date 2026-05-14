import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../contexts/AppContext';
import { getSecondMostRecentBatch, batchToShortFormat as batchToShort } from '../lib/batchUtils';
import { Map, BarChart3, Wrench, TrendingUp, Building2, Globe2, Sparkles, ArrowRight, BookOpen, Terminal } from 'lucide-react';
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

  // Second-most recent batch (latest may not have started yet, e.g. Summer 2026 vs Spring 2026)
  const wrappedBatch = getSecondMostRecentBatch(stats?.by_batch);

  const totalCompanies = stats?.total_companies || 0;
  const totalCountries = stats?.by_country ? Object.keys(stats.by_country).length : 0;
  const totalIndustries = stats?.by_industry ? Object.keys(stats.by_industry).length : 0;

  return (
    <div className="relative min-h-screen bg-background">
      <DotPattern color="hsl(var(--primary) / 0.15)" size={24} radius={0.5} />
      <GridPattern size={32} className="opacity-50" />

      <div className="container relative mx-auto px-4 py-12">
        {/* Hero - terminal style */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-16"
        >
          <div className="flex items-center gap-2 mb-6 font-mono text-sm text-muted-foreground">
            <Terminal className="h-4 w-4 text-[#FB651E]" />
            <span>$ explore-yc --init</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
            <span className="text-[#FB651E]">&gt;</span>{' '}
            <span className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
              Explore YC Companies
            </span>
          </h1>
          <p className="text-lg text-muted-foreground font-mono max-w-2xl mb-8">
            Search, analyze, and discover insights from Y Combinator's portfolio. {totalCompanies.toLocaleString()}+ companies, {totalCountries}+ countries.
          </p>

          {/* Live Stats - inline terminal style */}
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="flex flex-wrap gap-3 mb-8"
          >
            {[
              { val: totalCompanies.toLocaleString(), label: 'companies', color: 'text-[#FB651E]' },
              { val: `${totalCountries}+`, label: 'countries', color: 'text-[#FB651E]' },
              { val: `${totalIndustries}+`, label: 'industries', color: 'text-[#FB651E]' },
            ].map((s) => (
              <motion.div
                key={s.label}
                variants={item}
                className="flex items-baseline gap-2 font-mono"
              >
                <span className="text-muted-foreground">$</span>
                <span className={`text-2xl font-bold ${s.color}`}>{s.val}</span>
                <span className="text-sm text-muted-foreground">{s.label}</span>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex flex-wrap gap-3"
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-6"
          >
            <a
              href="https://www.producthunt.com/products/yc-company-explorer?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-exploreyc-yc-company-explorer"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              <img
                src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1140202&theme=light&t=1778138682064"
                alt="ExploreYC - YC Company Explorer - Your data layer for Y Combinator's startup ecosystem | Product Hunt"
                width="250"
                height="54"
              />
            </a>
          </motion.div>
        </motion.div>

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
