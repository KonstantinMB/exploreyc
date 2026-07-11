import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { AdvancedAnalytics } from '../components/AdvancedAnalytics';
import { useApp } from '../contexts/AppContext';
import { TrendingUp, Building2, Globe2, Calendar, ArrowRight, Sparkles, Briefcase, Target } from 'lucide-react';
import { HackerCard } from '../components/ui/hacker-card';
import { DotPattern } from '../components/ui/dot-pattern';
import { GridPattern } from '../components/ui/grid-pattern';
import { PageHeader } from '../components/ui/PageHeader';

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

export function AnalyticsPage() {
  const { stats } = useApp();

  const activeCompanies = stats?.by_status?.['Active'] || 0;
  const totalBatches = stats?.by_batch ? Object.keys(stats.by_batch).length : 0;
  const totalCountries = stats?.by_country ? Object.keys(stats.by_country).length : 0;
  const totalIndustries = stats?.by_industry ? Object.keys(stats.by_industry).length : 0;

  return (
    <div className="relative min-h-screen bg-background">
      <DotPattern color="hsl(var(--primary) / 0.15)" size={24} radius={0.5} />
      <GridPattern size={32} className="opacity-50" />

      <div className="container relative mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_200px] gap-6 lg:gap-8 max-w-7xl mx-auto">
          {/* Left Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="hidden lg:flex flex-col gap-4"
          >
            {/* Company Insights Card */}
            <HackerCard glowColor="green" className="p-4 sticky top-20">
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-emerald-500" />
                <h3 className="font-mono text-sm font-semibold">Company Insights</h3>
              </div>
              <ul className="space-y-2 text-xs font-mono text-muted-foreground">
                <li>• 3,997 active YC companies</li>
                <li>• 48 different batches</li>
                <li>• 10+ industry verticals</li>
                <li>• Global distribution</li>
              </ul>
            </HackerCard>

            {/* Explore Hiring Card */}
            <HackerCard glowColor="blue" className="p-4">
              <h3 className="font-mono text-sm font-semibold mb-3">Explore Hiring</h3>
              <Link to="/hiring/analytics" className="inline-flex items-center gap-2 w-full justify-center px-3 py-2 bg-blue-500/20 text-blue-400 rounded text-xs font-mono hover:bg-blue-500/30 transition mb-3">
                Hiring Analytics
                <ArrowRight className="h-3 w-3" />
              </Link>
              <p className="text-xs text-muted-foreground font-mono text-center">
                Discover 1,000+ jobs and salary insights
              </p>
            </HackerCard>
          </motion.div>

          {/* Main Content */}
          <div>
        {/* Header - Terminal style */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <PageHeader
            command="$ analyze --data yc-portfolio"
            title="YC Portfolio Analytics"
            subtitle="Insights and trends across the Y Combinator portfolio"
          />
        </motion.div>

        {/* Quick Stats Grid */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          <motion.div variants={item}>
            <HackerCard glowColor="green" className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-mono text-muted-foreground">active</span>
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-500">
                {activeCompanies.toLocaleString()}
              </div>
            </HackerCard>
          </motion.div>

          <motion.div variants={item}>
            <HackerCard glowColor="orange" className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-4 w-4 text-[#FB651E]" />
                <span className="text-xs font-mono text-muted-foreground">industries</span>
              </div>
              <div className="text-2xl font-bold font-mono text-[#FB651E]">
                {totalIndustries}
              </div>
            </HackerCard>
          </motion.div>

          <motion.div variants={item}>
            <HackerCard glowColor="purple" className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Globe2 className="h-4 w-4 text-violet-500" />
                <span className="text-xs font-mono text-muted-foreground">countries</span>
              </div>
              <div className="text-2xl font-bold font-mono text-violet-500">
                {totalCountries}
              </div>
            </HackerCard>
          </motion.div>

          <motion.div variants={item}>
            <HackerCard glowColor="blue" className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-mono text-muted-foreground">batches</span>
              </div>
              <div className="text-2xl font-bold font-mono text-blue-500">
                {totalBatches}
              </div>
            </HackerCard>
          </motion.div>
        </motion.div>

        {/* Banners Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8"
          initial="hidden"
          animate="show"
          variants={container}
        >
          {/* All Batches Banner */}
          <motion.div variants={item}>
            <Link to="/analytics/batches" className="group block h-full">
              <HackerCard glowColor="orange" className="p-6 border-[#FB651E]/30 hover:border-[#FB651E]/60 h-full">
                <div className="flex flex-col gap-4 h-full">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold font-mono">All Batches Analytics</h3>
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-mono border border-emerald-500/30">
                          NEW
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground font-mono">
                        Comprehensive trends and insights across all {totalBatches} YC batches
                      </p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-[#FB651E] group-hover:translate-x-1 transition-all flex-shrink-0" />
                  </div>
                  <div className="w-10 h-10 bg-[#FB651E] flex items-center justify-center flex-shrink-0 self-start">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                </div>
              </HackerCard>
            </Link>
          </motion.div>

          {/* Hiring Board Analytics Banner */}
          <motion.div variants={item}>
            <Link to="/hiring/analytics" className="group block h-full">
              <HackerCard glowColor="blue" className="p-6 border-blue-500/30 hover:border-blue-500/60 h-full">
                <div className="flex flex-col gap-4 h-full">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold font-mono">Hiring Board Analytics</h3>
                        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs font-mono border border-blue-500/30">
                          LIVE
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground font-mono">
                        Salary insights, hiring trends, and job market intelligence from 1,400+ YC companies
                      </p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-blue-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
                  </div>
                  <div className="w-10 h-10 bg-blue-500 flex items-center justify-center flex-shrink-0 self-start">
                    <Briefcase className="w-5 h-5 text-white" />
                  </div>
                </div>
              </HackerCard>
            </Link>
          </motion.div>
        </motion.div>

        {/* Charts Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex items-center gap-2 mb-6 font-mono"
        >
          <span className="text-muted-foreground">$</span>
          <h2 className="text-xl font-bold">Detailed Analytics</h2>
        </motion.div>

        {stats && <AdvancedAnalytics stats={stats} />}

        {/* Terminal footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-8 border border-border p-4 bg-card/30"
        >
          <div className="font-mono text-xs text-muted-foreground">
            <span className="text-[#FB651E]">&gt;</span> Data updated in real-time from YC portfolio
          </div>
        </motion.div>
          </div>

          {/* Right Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="hidden lg:flex flex-col gap-4"
          >
            {/* Hiring Stats Card */}
            <HackerCard glowColor="orange" className="p-4 sticky top-20">
              <div className="flex items-center gap-2 mb-3">
                <Briefcase className="h-4 w-4 text-[#FB651E]" />
                <h3 className="font-mono text-sm font-semibold">Hiring Stats</h3>
              </div>
              <div className="space-y-3 text-xs font-mono">
                <div>
                  <p className="text-muted-foreground mb-1">Total Jobs</p>
                  <p className="font-bold text-[#FB651E]">1,069</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Companies Hiring</p>
                  <p className="font-bold text-orange-400">606</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Avg Salary</p>
                  <p className="font-bold text-amber-500">$223K</p>
                </div>
              </div>
            </HackerCard>

            {/* Featured Section Card */}
            <HackerCard glowColor="purple" className="p-4">
              <h3 className="font-mono text-sm font-semibold mb-3">Featured</h3>
              <Link to="/analytics/batches" className="inline-flex items-center gap-2 w-full justify-center px-3 py-2 bg-violet-500/20 text-violet-400 rounded text-xs font-mono hover:bg-violet-500/30 transition">
                All Batches
                <ArrowRight className="h-3 w-3" />
              </Link>
              <p className="text-xs text-muted-foreground font-mono mt-3 text-center">
                Explore 48 YC batches in detail
              </p>
            </HackerCard>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
