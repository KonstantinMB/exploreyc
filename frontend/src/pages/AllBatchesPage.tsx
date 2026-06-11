import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../contexts/AppContext';
import { getSortedBatches, batchToShortFormat } from '../lib/batchUtils';
import { HackerCard } from '../components/ui/hacker-card';
import { DotPattern } from '../components/ui/dot-pattern';
import { GridPattern } from '../components/ui/grid-pattern';
import { TrendingUp, Building2, Users, Calendar, Globe2, Briefcase, Terminal, ArrowLeft } from 'lucide-react';
import { BatchIndustryChart } from '../components/BatchIndustryChart';
import { Link } from 'react-router-dom';

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

export function AllBatchesPage() {
  const { stats } = useApp();

  // Get all batches sorted chronologically
  const sortedBatches = useMemo(() => {
    return stats?.by_batch ? getSortedBatches(stats.by_batch) : [];
  }, [stats?.by_batch]);

  // Calculate batch statistics
  const batchStats = useMemo(() => {
    if (!sortedBatches.length) return null;

    const totalCompanies = sortedBatches.reduce((sum, b) => sum + b.count, 0);
    const avgBatchSize = Math.round(totalCompanies / sortedBatches.length);
    const largestBatch = sortedBatches.reduce((max, b) => b.count > max.count ? b : max, sortedBatches[0]);
    const smallestBatch = sortedBatches.reduce((min, b) => b.count < min.count ? b : min, sortedBatches[0]);

    // Calculate growth rate (comparing most recent vs oldest)
    const oldestBatch = sortedBatches[sortedBatches.length - 1];
    const newestBatch = sortedBatches[0];
    const growthRate = oldestBatch.count > 0
      ? ((newestBatch.count - oldestBatch.count) / oldestBatch.count * 100)
      : 0;

    return {
      totalBatches: sortedBatches.length,
      totalCompanies,
      avgBatchSize,
      largestBatch,
      smallestBatch,
      growthRate,
      oldestBatch,
      newestBatch,
    };
  }, [sortedBatches]);

  // Prepare data for batch size trend chart (reversed to show oldest to newest)
  const chartData = useMemo(() => {
    return [...sortedBatches].reverse();
  }, [sortedBatches]);

  // Calculate max value for chart scaling
  const maxBatchSize = Math.max(...sortedBatches.map(b => b.count));

  // Industry trends across batches
  const industryTrends = useMemo(() => {
    if (!stats?.by_industry) return [];
    return Object.entries(stats.by_industry)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([industry, count]) => ({ industry, count }));
  }, [stats?.by_industry]);

  const maxIndustryValue = Math.max(...industryTrends.map(i => i.count), 1);

  // Country trends across batches
  const countryTrends = useMemo(() => {
    if (!stats?.by_country) return [];
    return Object.entries(stats.by_country)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([country, count]) => ({ country, count }));
  }, [stats?.by_country]);

  const maxCountryValue = Math.max(...countryTrends.map(c => c.count), 1);

  if (!batchStats) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground font-mono">$ loading batch analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background">
      <DotPattern color="hsl(var(--primary) / 0.15)" size={24} radius={0.5} />
      <GridPattern size={32} className="opacity-50" />

      <div className="container relative mx-auto px-4 py-8">
        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-6"
        >
          <Link
            to="/analytics"
            className="inline-flex items-center gap-2 font-mono text-sm text-muted-foreground hover:text-[#FB651E] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>$ cd ../analytics</span>
          </Link>
        </motion.div>

        {/* Header - Terminal style */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center gap-2 mb-4 font-mono text-sm text-muted-foreground">
            <Terminal className="h-4 w-4 text-[#FB651E]" />
            <span>$ analyze --all-batches --verbose</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            <span className="text-[#FB651E]">&gt;</span>{' '}
            <span className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
              All Batches Analytics
            </span>
          </h1>
          <p className="text-muted-foreground font-mono">
            Comprehensive trends and insights across all YC batches
          </p>
        </motion.div>

        {/* Key Metrics Grid */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          <motion.div variants={item}>
            <HackerCard glowColor="orange" className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-[#FB651E]" />
                <span className="text-xs font-mono text-muted-foreground">batches</span>
              </div>
              <div className="text-2xl md:text-3xl font-bold font-mono text-[#FB651E]">
                {batchStats.totalBatches}
              </div>
            </HackerCard>
          </motion.div>

          <motion.div variants={item}>
            <HackerCard glowColor="blue" className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-mono text-muted-foreground">avg size</span>
              </div>
              <div className="text-2xl md:text-3xl font-bold font-mono text-blue-500">
                {batchStats.avgBatchSize}
              </div>
            </HackerCard>
          </motion.div>

          <motion.div variants={item}>
            <HackerCard glowColor="green" className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-mono text-muted-foreground">growth</span>
              </div>
              <div className="text-2xl md:text-3xl font-bold font-mono text-emerald-500">
                {batchStats.growthRate > 0 ? '+' : ''}{batchStats.growthRate.toFixed(1)}%
              </div>
            </HackerCard>
          </motion.div>

          <motion.div variants={item}>
            <HackerCard glowColor="purple" className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-4 w-4 text-violet-500" />
                <span className="text-xs font-mono text-muted-foreground">largest</span>
              </div>
              <div className="text-2xl md:text-3xl font-bold font-mono text-violet-500">
                {batchStats.largestBatch.count}
              </div>
            </HackerCard>
          </motion.div>
        </motion.div>

        {/* Batch Size Evolution Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <HackerCard glowColor="orange" className="p-6">
            <div className="flex items-center gap-2 mb-4 font-mono">
              <TrendingUp className="h-5 w-5 text-[#FB651E]" />
              <span className="text-muted-foreground">$</span>
              <h3 className="font-bold">Batch Size Evolution</h3>
              <span className="text-xs text-muted-foreground ml-auto">oldest → newest</span>
            </div>

            <div className="w-full h-[280px] relative">
              {/* Custom SVG Bar Chart */}
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* Grid lines */}
                {[0, 25, 50, 75, 100].map(y => (
                  <line
                    key={y}
                    x1="0"
                    y1={y}
                    x2="100"
                    y2={y}
                    stroke="currentColor"
                    strokeWidth="0.15"
                    opacity="0.1"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}

                {/* Bars */}
                {chartData.map((batch, index) => {
                  const barWidth = 100 / chartData.length;
                  const barHeight = (batch.count / maxBatchSize) * 100;
                  const x = index * barWidth;
                  const y = 100 - barHeight;

                  return (
                    <g key={batch.name}>
                      <rect
                        x={x + barWidth * 0.1}
                        y={y}
                        width={barWidth * 0.8}
                        height={barHeight}
                        fill="#FB651E"
                        opacity="0.8"
                        className="hover:opacity-100 transition-opacity"
                      >
                        <title>{batch.name}: {batch.count} companies</title>
                      </rect>
                    </g>
                  );
                })}
              </svg>

              {/* X-axis labels */}
              <div className="absolute -bottom-6 left-0 right-0 flex justify-between px-2 text-xs text-muted-foreground font-mono">
                {chartData[0] && <span>{batchToShortFormat(chartData[0].name)}</span>}
                {chartData[Math.floor(chartData.length / 2)] && <span>{batchToShortFormat(chartData[Math.floor(chartData.length / 2)].name)}</span>}
                {chartData[chartData.length - 1] && <span>{batchToShortFormat(chartData[chartData.length - 1].name)}</span>}
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-border flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <span className="text-[#FB651E]">&gt;</span>
              Range: {batchStats.smallestBatch.count} - {batchStats.largestBatch.count} companies per batch
            </div>
          </HackerCard>
        </motion.div>

        {/* Industry Mix by Batch */}
        {stats?.by_batch_industry && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mb-8"
          >
            <BatchIndustryChart
              byBatch={stats.by_batch}
              byBatchIndustry={stats.by_batch_industry}
            />
          </motion.div>
        )}

        {/* Two Column Layout for Industry and Country Trends */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Top Industries */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <HackerCard glowColor="blue" className="p-6 h-full">
              <div className="flex items-center gap-2 mb-4 font-mono">
                <Briefcase className="h-5 w-5 text-blue-500" />
                <span className="text-muted-foreground">$</span>
                <h3 className="font-bold">Top Industries</h3>
              </div>

              <div className="space-y-3">
                {industryTrends.map((item, index) => {
                  const percentage = (item.count / maxIndustryValue) * 100;
                  return (
                    <div key={item.industry}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-mono truncate flex-1 pr-2">
                          <span className="text-muted-foreground text-xs">{index + 1}.</span> {item.industry}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono tabular-nums">
                          {item.count.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted/30 overflow-hidden">
                        <motion.div
                          className="h-full bg-blue-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 0.8, delay: 0.3 + index * 0.05 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </HackerCard>
          </motion.div>

          {/* Top Countries */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <HackerCard glowColor="purple" className="p-6 h-full">
              <div className="flex items-center gap-2 mb-4 font-mono">
                <Globe2 className="h-5 w-5 text-violet-500" />
                <span className="text-muted-foreground">$</span>
                <h3 className="font-bold">Top Countries</h3>
              </div>

              <div className="space-y-3">
                {countryTrends.map((item, index) => {
                  const percentage = (item.count / maxCountryValue) * 100;
                  return (
                    <div key={item.country}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-mono truncate flex-1 pr-2">
                          <span className="text-muted-foreground text-xs">{index + 1}.</span> {item.country}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono tabular-nums">
                          {item.count.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted/30 overflow-hidden">
                        <motion.div
                          className="h-full bg-violet-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 0.8, delay: 0.3 + index * 0.05 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </HackerCard>
          </motion.div>
        </div>

        {/* All Batches Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <HackerCard glowColor="green" className="p-6">
            <div className="flex items-center gap-2 mb-4 font-mono">
              <Calendar className="h-5 w-5 text-emerald-500" />
              <span className="text-muted-foreground">$</span>
              <h3 className="font-bold">Complete Batch History</h3>
              <span className="text-xs text-muted-foreground ml-auto">{batchStats.totalBatches} batches</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full font-mono text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 text-xs text-muted-foreground font-mono">#</th>
                    <th className="text-left py-3 px-2 text-xs text-muted-foreground font-mono">batch</th>
                    <th className="text-left py-3 px-2 text-xs text-muted-foreground font-mono">short</th>
                    <th className="text-right py-3 px-2 text-xs text-muted-foreground font-mono">companies</th>
                    <th className="text-right py-3 px-2 text-xs text-muted-foreground font-mono">%</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedBatches.map((batch, index) => {
                    const percentage = ((batch.count / batchStats.totalCompanies) * 100).toFixed(1);
                    const isLargest = batch.name === batchStats.largestBatch.name;
                    const isNewest = index === 0;

                    return (
                      <tr
                        key={batch.name}
                        className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${
                          isLargest ? 'bg-violet-500/5' : isNewest ? 'bg-[#FB651E]/5' : ''
                        }`}
                      >
                        <td className="py-3 px-2 text-muted-foreground">
                          {index + 1}
                        </td>
                        <td className="py-3 px-2">
                          {batch.name}
                          {isLargest && (
                            <span className="ml-2 px-2 py-0.5 bg-violet-500/20 text-violet-400 text-xs border border-violet-500/30">
                              largest
                            </span>
                          )}
                          {isNewest && (
                            <span className="ml-2 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs border border-emerald-500/30">
                              latest
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-muted-foreground">
                          {batchToShortFormat(batch.name)}
                        </td>
                        <td className="py-3 px-2 text-right tabular-nums">
                          {batch.count.toLocaleString()}
                        </td>
                        <td className="py-3 px-2 text-right text-muted-foreground tabular-nums">
                          {percentage}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </HackerCard>
        </motion.div>

        {/* Terminal-style Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 border border-border p-4 bg-card/30"
        >
          <div className="font-mono text-xs text-muted-foreground">
            <span className="text-[#FB651E]">&gt;</span> Showing analytics for {batchStats.totalBatches} batches spanning {batchStats.totalCompanies.toLocaleString()} companies
          </div>
        </motion.div>
      </div>
    </div>
  );
}
