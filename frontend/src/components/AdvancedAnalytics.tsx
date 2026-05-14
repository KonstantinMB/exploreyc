import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { HackerCard } from './ui/hacker-card';
import { TrendingUp, Building2, Globe2, Briefcase, Zap, Calendar } from 'lucide-react';
import type { Stats } from '../lib/api';

interface AdvancedAnalyticsProps {
  stats: Stats;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export function AdvancedAnalytics({ stats }: AdvancedAnalyticsProps) {
  // Prepare batch timeline data (last 20 batches)
  const batchTimelineData = useMemo(() => {
    return Object.entries(stats.by_batch)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-20)
      .map(([batch, count]) => ({
        batch: batch.replace(/^(Summer|Winter|Spring|Fall)\s(\d{4})$/, (_, season, year) => `${season.slice(0, 1)}${year.slice(-2)}`),
        fullBatch: batch,
        companies: count,
      }));
  }, [stats.by_batch]);

  const maxBatchValue = Math.max(...batchTimelineData.map(d => d.companies));

  // Prepare industry data (top 10)
  const industryData = useMemo(() => {
    return Object.entries(stats.by_industry)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([industry, count]) => ({ name: industry, value: count }));
  }, [stats.by_industry]);

  const maxIndustryValue = Math.max(...industryData.map(d => d.value));

  // Prepare country data (top 10)
  const countryData = useMemo(() => {
    return Object.entries(stats.by_country)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([country, count]) => ({ name: country, value: count }));
  }, [stats.by_country]);

  const maxCountryValue = Math.max(...countryData.map(d => d.value));

  // Status distribution
  const statusData = useMemo(() => {
    return Object.entries(stats.by_status).map(([status, count]) => ({ name: status, value: count }));
  }, [stats.by_status]);

  const maxStatusValue = Math.max(...statusData.map(d => d.value));

  // Hiring metrics
  const hiringRate = stats.total_companies > 0
    ? (stats.hiring / stats.total_companies) * 100
    : 0;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Batch Timeline - Area Chart */}
      <motion.div variants={item}>
        <HackerCard glowColor="orange" className="p-6">
          <div className="flex items-center gap-2 mb-4 font-mono">
            <TrendingUp className="h-5 w-5 text-[#FB651E]" />
            <span className="text-muted-foreground">$</span>
            <h3 className="font-bold">Batch Growth Timeline</h3>
            <span className="text-xs text-muted-foreground ml-auto">last 20 batches</span>
          </div>

          <div className="w-full h-[280px] relative">
            {/* Custom SVG Area Chart */}
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

              {/* Area path */}
              <defs>
                <linearGradient id="batchGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FB651E" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#FB651E" stopOpacity="0.05" />
                </linearGradient>
              </defs>

              {/* Create area path */}
              {batchTimelineData.length > 0 && (
                <>
                  <path
                    d={`
                      M 0,100
                      ${batchTimelineData.map((d, i) => {
                        const x = (i / (batchTimelineData.length - 1)) * 100;
                        const y = 100 - (d.companies / maxBatchValue) * 100;
                        return `L ${x},${y}`;
                      }).join(' ')}
                      L 100,100
                      Z
                    `}
                    fill="url(#batchGradient)"
                  />
                  <path
                    d={`
                      M ${batchTimelineData.map((d, i) => {
                        const x = (i / (batchTimelineData.length - 1)) * 100;
                        const y = 100 - (d.companies / maxBatchValue) * 100;
                        return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
                      }).join(' ')}
                    `}
                    stroke="#FB651E"
                    strokeWidth="0.4"
                    fill="none"
                    vectorEffect="non-scaling-stroke"
                  />
                </>
              )}
            </svg>

            {/* X-axis labels */}
            <div className="absolute -bottom-6 left-0 right-0 flex justify-between px-2 text-xs text-muted-foreground font-mono">
              <span>{batchTimelineData[0]?.batch}</span>
              <span>{batchTimelineData[Math.floor(batchTimelineData.length / 2)]?.batch}</span>
              <span>{batchTimelineData[batchTimelineData.length - 1]?.batch}</span>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-border flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span className="text-[#FB651E]">&gt;</span>
            Peak: {maxBatchValue} companies
          </div>
        </HackerCard>
      </motion.div>

      {/* Two column layout for Industry & Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Industries - Horizontal Bars */}
        <motion.div variants={item}>
          <HackerCard glowColor="blue" className="p-6 h-full">
            <div className="flex items-center gap-2 mb-4 font-mono">
              <Building2 className="h-5 w-5 text-blue-500" />
              <span className="text-muted-foreground">$</span>
              <h3 className="font-bold">Top Industries</h3>
            </div>

            <div className="space-y-3">
              {industryData.map((item, index) => {
                const percentage = (item.value / maxIndustryValue) * 100;
                return (
                  <div key={item.name} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-mono truncate flex-1 pr-2">
                        <span className="text-muted-foreground text-xs">{index + 1}.</span> {item.name.length > 25 ? item.name.slice(0, 25) + '...' : item.name}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono tabular-nums">
                        {item.value.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted/30 overflow-hidden">
                      <motion.div
                        className="h-full bg-blue-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.8, delay: 0.1 + index * 0.05 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </HackerCard>
        </motion.div>

        {/* Company Status */}
        <motion.div variants={item}>
          <HackerCard glowColor="green" className="p-6 h-full">
            <div className="flex items-center gap-2 mb-4 font-mono">
              <Briefcase className="h-5 w-5 text-emerald-500" />
              <span className="text-muted-foreground">$</span>
              <h3 className="font-bold">Company Status</h3>
            </div>

            <div className="space-y-3">
              {statusData.map((item, index) => {
                const percentage = (item.value / maxStatusValue) * 100;
                const color = item.name === 'Active' ? 'emerald' : item.name === 'Inactive' ? 'red' : 'amber';
                return (
                  <div key={item.name} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-mono">
                        {item.name}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono tabular-nums">
                        {item.value.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted/30 overflow-hidden">
                      <motion.div
                        className={`h-full bg-${color}-500`}
                        style={{ backgroundColor: color === 'emerald' ? '#10b981' : color === 'red' ? '#ef4444' : '#f59e0b' }}
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.8, delay: 0.1 + index * 0.05 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </HackerCard>
        </motion.div>
      </div>

      {/* Geographic Distribution */}
      <motion.div variants={item}>
        <HackerCard glowColor="purple" className="p-6">
          <div className="flex items-center gap-2 mb-4 font-mono">
            <Globe2 className="h-5 w-5 text-violet-500" />
            <span className="text-muted-foreground">$</span>
            <h3 className="font-bold">Geographic Distribution</h3>
            <span className="text-xs text-muted-foreground ml-auto">top 10 countries</span>
          </div>

          <div className="space-y-3">
            {countryData.map((item, index) => {
              const percentage = (item.value / maxCountryValue) * 100;
              return (
                <div key={item.name} className="group">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-mono truncate flex-1 pr-2">
                      <span className="text-muted-foreground text-xs">{index + 1}.</span> {item.name}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono tabular-nums">
                      {item.value.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted/30 overflow-hidden">
                    <motion.div
                      className="h-full bg-violet-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.8, delay: 0.1 + index * 0.05 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </HackerCard>
      </motion.div>

      {/* Key Metrics Grid */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <HackerCard glowColor="orange" className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-[#FB651E]" />
            <span className="text-xs font-mono text-muted-foreground">hiring</span>
          </div>
          <div className="text-2xl font-bold font-mono text-[#FB651E]">
            {hiringRate.toFixed(1)}%
          </div>
        </HackerCard>

        <HackerCard glowColor="green" className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-mono text-muted-foreground">batches</span>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-500">
            {Object.keys(stats.by_batch).length}
          </div>
        </HackerCard>

        <HackerCard glowColor="purple" className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Globe2 className="h-4 w-4 text-violet-500" />
            <span className="text-xs font-mono text-muted-foreground">countries</span>
          </div>
          <div className="text-2xl font-bold font-mono text-violet-500">
            {Object.keys(stats.by_country).length}
          </div>
        </HackerCard>

        <HackerCard glowColor="blue" className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-mono text-muted-foreground">industries</span>
          </div>
          <div className="text-2xl font-bold font-mono text-blue-500">
            {Object.keys(stats.by_industry).length}
          </div>
        </HackerCard>
      </motion.div>
    </motion.div>
  );
}
