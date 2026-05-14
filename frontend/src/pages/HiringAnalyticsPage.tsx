import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, Building2, Globe, DollarSign, Zap, ArrowLeft, TrendingUp, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis,
  CartesianGrid, Tooltip
} from 'recharts';
import { HackerCard } from '../components/ui/hacker-card';
import { DotPattern } from '../components/ui/dot-pattern';
import { GridPattern } from '../components/ui/grid-pattern';
import type { HiringAnalytics } from '../types/hiring-analytics';

const COLORS = ['#FB651E', '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

export function HiringAnalyticsPage() {
  const { data: analytics, isLoading, error } = useQuery({
    queryKey: ['hiring-analytics'],
    queryFn: async () => {
      const response = await fetch('/api/hiring/analytics');
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json() as Promise<HiringAnalytics>;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Error Loading Analytics</h2>
          <p className="text-muted-foreground mb-6">Failed to load hiring analytics data</p>
          <Link to="/hiring" className="text-[#FB651E] hover:underline">
            ← Back to Hiring Board
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading || !analytics) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Zap className="h-12 w-12 text-[#FB651E] mx-auto mb-4 animate-spin" />
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>YC Hiring Analytics - Salary Trends & Job Market Insights</title>
        <meta name="description" content="Real-time hiring analytics from 1000+ jobs at Y Combinator companies. Explore salary ranges, top roles, and market trends." />
        <meta property="og:title" content="YC Hiring Analytics" />
        <meta property="og:description" content="Market intelligence on YC startup hiring" />
      </Helmet>

      <div className="relative min-h-screen bg-background">
        <DotPattern className="pointer-events-none absolute inset-0 opacity-20" />
        <GridPattern className="pointer-events-none absolute inset-0 opacity-5" />

        <div className="relative z-10 px-4 py-6 sm:px-4 lg:px-8">
          <div className="max-w-6xl mx-auto">
          {/* Main Content */}
          <div>
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Link to="/hiring" className="inline-flex items-center gap-2 text-[#FB651E] hover:text-orange-400 mb-4">
              <ArrowLeft className="h-4 w-4" />
              Back to Hiring Board
            </Link>
            <h1 className="mb-2 bg-gradient-to-r from-[#FB651E] via-orange-400 to-red-400 bg-clip-text text-4xl font-bold text-transparent md:text-5xl">
              YC Hiring Market Intelligence
            </h1>
            <p className="text-lg text-muted-foreground">
              Real-time insights from {analytics.totalJobs.toLocaleString()} jobs at {analytics.totalCompanies} Y Combinator companies
            </p>
          </motion.div>

          {/* Navigation to Company Analytics */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <Link to="/analytics" className="group block">
              <HackerCard glowColor="orange" className="p-6 border-[#FB651E]/30 hover:border-[#FB651E]/60">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#FB651E] flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold font-mono">YC Portfolio Analytics</h3>
                      <span className="px-2 py-0.5 bg-[#FB651E]/20 text-[#FB651E] text-xs font-mono border border-[#FB651E]/30">
                        INSIGHTS
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground font-mono">
                      Explore funding trends, company demographics, and batch distribution across the entire YC portfolio
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-[#FB651E] group-hover:translate-x-1 transition-all" />
                </div>
              </HackerCard>
            </Link>
          </motion.div>

          {/* Quick Stats */}
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4"
          >
            {[
              { icon: DollarSign, label: 'Avg Salary', value: analytics.avgSalary ? `$${(analytics.avgSalary / 1000).toFixed(0)}K` : 'N/A', color: 'green' },
              { icon: Briefcase, label: 'Total Jobs', value: analytics.totalJobs.toLocaleString(), color: 'orange' },
              { icon: Globe, label: '% Remote', value: `${analytics.remoteStats.remotePercentage}%`, color: 'blue' },
              { icon: Building2, label: 'Companies', value: analytics.totalCompanies, color: 'purple' },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div key={i} variants={item} whileHover={{ y: -4 }}>
                  <HackerCard glowColor={stat.color as any} className="p-4">
                    <div className="flex items-center gap-3">
                      <Icon className="h-6 w-6 text-[#FB651E]" />
                      <div>
                        <p className="text-xs text-muted-foreground font-mono">{stat.label}</p>
                        <p className="text-2xl font-bold font-mono">{stat.value}</p>
                      </div>
                    </div>
                  </HackerCard>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Salary Insights Section */}
          <motion.section variants={item} className="mb-8">
            <h2 className="mb-6 text-2xl font-bold font-mono text-[#FB651E]">
              💰 Salary Insights
            </h2>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Salary by Role */}
              <HackerCard className="p-6">
                <h3 className="mb-4 font-mono text-lg font-semibold">Average Salary by Role</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.salaryByRole}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="role" stroke="#666" style={{ fontSize: '12px' }} angle={-45} textAnchor="end" height={80} />
                    <YAxis stroke="#666" />
                    <Tooltip
                      formatter={(value: any) => `$${(value / 1000).toFixed(0)}K`}
                      contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #FB651E' }}
                    />
                    <Bar dataKey="avg" fill="#FB651E" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </HackerCard>

              {/* Salary Distribution by Role */}
              <HackerCard className="p-6">
                <h3 className="mb-4 font-mono text-lg font-semibold">Top Roles (Job Count)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.roleDistribution.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis type="number" stroke="#666" />
                    <YAxis dataKey="role" type="category" stroke="#666" style={{ fontSize: '12px' }} width={100} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #FB651E' }}
                    />
                    <Bar dataKey="count" fill="#10b981" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </HackerCard>
            </div>
          </motion.section>

          {/* Highest Paying Insights */}
          <motion.section variants={item} className="mb-8">
            <h2 className="mb-6 text-2xl font-bold font-mono text-[#FB651E]">
              💎 Highest Paying Opportunities
            </h2>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Highest Paying Roles */}
              <HackerCard className="p-6">
                <h3 className="mb-4 font-mono text-lg font-semibold">Top Paying Roles</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {analytics.highestPayingRoles?.slice(0, 8).map((role: any, i: number) => (
                    <Link key={i} to={`/hiring?role=${encodeURIComponent(role.role)}`} className="flex items-center justify-between py-2 border-b border-muted/20 last:border-0 hover:bg-muted/10 px-2 -mx-2 rounded transition">
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-sm font-semibold text-[#FB651E] hover:underline">{role.role}</p>
                        <p className="text-xs text-muted-foreground">{role.jobCount} positions</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <p className="font-mono font-bold text-lg">${(role.avgSalary / 1000).toFixed(0)}K</p>
                        <p className="text-xs text-muted-foreground">${(role.minSalary / 1000).toFixed(0)}K - ${(role.maxSalary / 1000).toFixed(0)}K</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </HackerCard>

              {/* Top Paying Companies */}
              <HackerCard className="p-6">
                <h3 className="mb-4 font-mono text-lg font-semibold">Top Paying Companies</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {analytics.topPayingCompanies?.slice(0, 8).map((company: any) => (
                    <Link key={company.id} to={`/company/${company.slug}`} className="flex items-center justify-between py-2 border-b border-muted/20 last:border-0 hover:bg-muted/10 px-2 -mx-2 rounded transition">
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-sm font-semibold truncate hover:text-[#FB651E]">{company.name}</p>
                        <p className="text-xs text-muted-foreground">{company.jobCount} positions</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <p className="font-mono font-bold text-lg text-[#FB651E]">${(company.avgSalary / 1000).toFixed(0)}K</p>
                        <p className="text-xs text-muted-foreground">{company.batch}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </HackerCard>
            </div>
          </motion.section>

          {/* Job Market Overview */}
          <motion.section variants={item} className="mb-8">
            <h2 className="mb-6 text-2xl font-bold font-mono text-[#FB651E]">
              📊 Job Market Overview
            </h2>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Role Distribution */}
              <HackerCard className="p-6">
                <h3 className="mb-4 font-mono text-lg font-semibold">Role Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.roleDistribution.slice(0, 6)}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ role, percentage }: any) => `${role}: ${percentage}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {COLORS.map((color, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => `${value} jobs`}
                      contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #FB651E' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </HackerCard>

              {/* Remote vs Onsite */}
              <HackerCard className="p-6">
                <h3 className="mb-4 font-mono text-lg font-semibold">Remote vs On-site</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Remote', value: analytics.remoteStats.remote },
                        { name: 'On-site', value: analytics.remoteStats.onsite },
                      ]}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }: any) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#3b82f6" />
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #FB651E' }} />
                  </PieChart>
                </ResponsiveContainer>
              </HackerCard>

              {/* Job Type Distribution */}
              <HackerCard className="p-6">
                <h3 className="mb-4 font-mono text-lg font-semibold">Job Type Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.jobTypeBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="type" stroke="#666" style={{ fontSize: '12px' }} />
                    <YAxis stroke="#666" />
                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #FB651E' }} />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </HackerCard>
            </div>
          </motion.section>

          {/* Top Batches & Companies */}
          <motion.section variants={item} className="mb-8">
            <h2 className="mb-6 text-2xl font-bold font-mono text-[#FB651E]">
              🚀 Hiring Activity by Batch
            </h2>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Top Batches */}
              <HackerCard className="p-6">
                <h3 className="mb-4 font-mono text-lg font-semibold">Top 10 Batches by Jobs</h3>
                <div className="space-y-3">
                  {analytics.topBatches.map((batch, i) => (
                    <div key={batch.batch} className="flex items-center justify-between">
                      <span className="font-mono text-sm">{batch.batch}</span>
                      <div className="flex items-center gap-2 flex-1 ml-4">
                        <div className="h-2 bg-muted/30 flex-1 rounded">
                          <motion.div
                            className="h-full bg-[#FB651E] rounded"
                            initial={{ width: 0 }}
                            animate={{ width: `${(batch.count / analytics.totalJobs) * 100}%` }}
                            transition={{ duration: 0.8, delay: i * 0.05 }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground font-mono w-12 text-right">{batch.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </HackerCard>

              {/* Top Hiring Companies */}
              <HackerCard className="p-6">
                <h3 className="mb-4 font-mono text-lg font-semibold">Top 10 Hiring Companies</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {analytics.topHiringCompanies.map((company) => (
                    <Link key={company.id} to={`/company/${company.slug}`} className="flex items-center justify-between py-2 border-b border-muted/20 last:border-0 hover:bg-muted/10 px-2 -mx-2 rounded transition">
                      <div className="flex items-center gap-3 min-w-0">
                        {company.small_logo_url && (
                          <img
                            src={company.small_logo_url}
                            alt={company.name}
                            className="h-6 w-6 object-contain rounded"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="font-mono text-sm truncate hover:text-[#FB651E]">{company.name}</p>
                          <p className="text-xs text-muted-foreground">{company.batch}</p>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-[#FB651E] ml-2 flex-shrink-0">{company.jobCount}</span>
                    </Link>
                  ))}
                </div>
              </HackerCard>
            </div>
          </motion.section>

          {/* Geographic Insights */}
          <motion.section variants={item} className="mb-8">
            <h2 className="mb-6 text-2xl font-bold font-mono text-[#FB651E]">
              🌍 Geographic Insights
            </h2>
            <HackerCard className="p-6">
              <h3 className="mb-4 font-mono text-lg font-semibold">Top 15 Hiring Locations</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={analytics.locationBreakdown} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis type="number" stroke="#666" />
                  <YAxis dataKey="location" type="category" stroke="#666" width={120} style={{ fontSize: '11px' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #FB651E' }}
                    formatter={(value: any) => `${value} jobs`}
                  />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </HackerCard>
          </motion.section>

          {/* Early Stage Stats */}
          <motion.section variants={item} className="mb-8">
            <h2 className="mb-6 text-2xl font-bold font-mono text-[#FB651E]">
              ⚡ Early Stage Hiring
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {[
                { label: 'Early-Stage Companies', value: analytics.earlyStageStats.earlyStageCompanies, total: `${analytics.earlyStageStats.earlyStagePercentage}%` },
                { label: 'Early-Stage Jobs', value: analytics.earlyStageStats.earlyStageJobs, total: `of ${analytics.totalJobs}` },
                { label: 'Growth-Stage Jobs', value: analytics.earlyStageStats.growthStageJobs, total: `of ${analytics.totalJobs}` },
              ].map((stat) => (
                <motion.div key={stat.label} variants={item} whileHover={{ y: -4 }}>
                  <HackerCard glowColor="orange" className="p-6">
                    <p className="text-xs font-mono text-muted-foreground mb-2">{stat.label}</p>
                    <p className="text-3xl font-bold font-mono text-[#FB651E] mb-1">{stat.value}</p>
                    <p className="text-xs text-muted-foreground font-mono">{stat.total}</p>
                  </HackerCard>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center py-8 text-xs text-muted-foreground font-mono border-t border-muted/20"
          >
            <p>Last updated: {new Date(analytics.lastUpdated).toLocaleString()}</p>
            <p className="mt-2">Data includes {analytics.jobsWithSalaryPercentage}% of jobs with salary information</p>
          </motion.div>
          </div>
        </div>
        </div>
      </div>
    </>
  );
}
