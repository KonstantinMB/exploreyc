import { useState } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { TrendingUp, Building2, Briefcase, Zap, ChevronLeft, ChevronRight, BarChart3, ArrowRight, Lightbulb, Star } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { apiClient } from '../lib/api';
import { JobCard } from '../components/hiring/JobCard';
import { JobFilters } from '../components/hiring/JobFilters';
import { HackerCard } from '../components/ui/hacker-card';
import { DotPattern } from '../components/ui/dot-pattern';
import { GridPattern } from '../components/ui/grid-pattern';
import type { HiringFilters, JobWithCompany } from '../types/hiring';

export function HiringBoardPagePaginated() {
  const [filters, setFilters] = useState<HiringFilters>({
    roles: [],
    batches: [],
    locations: [],
    jobTypes: [],
    experienceLevels: [],
    remote: 'all',
    salaryMin: null,
    salaryMax: null,
    searchQuery: '',
  });

  const [sortBy, setSortBy] = useState<'recent' | 'salary_high' | 'salary_low'>('recent');
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch hiring stats
  const { data: hiringStats } = useQuery({
    queryKey: ['hiring-stats'],
    queryFn: async () => {
      const response = await apiClient.getHiringStats();
      return response.data;
    },
    staleTime: 1000 * 60 * 60,
  });

  // Fetch hiring analytics for sidebars
  const { data: analytics } = useQuery({
    queryKey: ['hiring-analytics'],
    queryFn: async () => {
      const response = await fetch('/api/hiring/analytics');
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    },
    staleTime: 1000 * 60 * 60,
  });

  // Build query parameters
  const queryParams = new URLSearchParams();
  queryParams.set('page', String(currentPage));
  queryParams.set('per_page', '20');
  queryParams.set('sort_by', sortBy);

  if (filters.searchQuery) {
    queryParams.set('company_name', filters.searchQuery);
  }
  if (filters.roles.length > 0) {
    queryParams.set('role', filters.roles[0]); // First selected role
  }
  if (filters.locations.length > 0) {
    queryParams.set('location', filters.locations[0]); // First selected location
  }
  if (filters.batches.length > 0) {
    queryParams.set('batch', filters.batches[0]); // First selected batch
  }
  if (filters.jobTypes.length > 0) {
    queryParams.set('job_type', filters.jobTypes[0]); // First selected job type
  }
  if (filters.remote === 'yes') {
    queryParams.set('remote', 'true');
  } else if (filters.remote === 'no') {
    queryParams.set('remote', 'false');
  }

  // Fetch paginated jobs
  const { data: jobsData, isLoading, error } = useQuery({
    queryKey: ['hiring-jobs-paginated', currentPage, filters, sortBy],
    queryFn: async () => {
      const response = await fetch(
        `/api/hiring/jobs/paginated?${queryParams.toString()}`
      );
      if (!response.ok) throw new Error('Failed to fetch jobs');
      return response.json();
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const handleFilterChange = (newFilters: HiringFilters) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleSortChange = (newSort: 'recent' | 'salary_high' | 'salary_low') => {
    setSortBy(newSort);
    setCurrentPage(1); // Reset to first page when sort changes
  };

  const stats = hiringStats || {};
  const paginatedData = jobsData || { jobs: [], total: 0, page: 1, per_page: 20, total_pages: 1, has_next: false, has_prev: false };

  return (
    <>
      <Helmet>
        <title>
          {`YC Hiring Board - ${paginatedData.total} Jobs at Y Combinator Companies`}
        </title>
        <meta
          name="description"
          content={`Explore ${paginatedData.total} job opportunities at Y Combinator funded companies. Find roles in engineering, product, design, and more.`}
        />
        <meta property="og:title" content="YC Hiring Board - Latest Jobs" />
        <meta property="og:description" content={`${paginatedData.total} open positions at YC companies`} />
        <meta name="keywords" content="YC jobs, startup careers, engineering jobs, product jobs, Y Combinator" />
      </Helmet>

      <div className="relative min-h-screen bg-background">
        <DotPattern className="pointer-events-none absolute inset-0 opacity-20" />
        <GridPattern className="pointer-events-none absolute inset-0 opacity-5" />

        <div className="relative z-10 px-0 py-6 sm:px-0 lg:px-0">
          <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr_180px] gap-2 lg:gap-2 max-w-7xl mx-auto">
            {/* Left Sidebar */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="hidden lg:flex flex-col gap-4"
            >
              {/* Job Seeker Tips */}
              <HackerCard glowColor="blue" className="p-4 sticky top-20">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="h-4 w-4 text-blue-500" />
                  <h3 className="font-mono text-sm font-semibold">Pro Tips</h3>
                </div>
                <ul className="space-y-2 text-xs font-mono text-muted-foreground">
                  <li>• Filter by role to see targeted openings</li>
                  <li>• Sort by salary to find high-paying roles</li>
                  <li>• Check remote options for flexibility</li>
                  <li>• Browse top companies hiring now</li>
                </ul>
              </HackerCard>

              {/* Featured Hiring Companies */}
              {analytics?.topHiringCompanies && analytics.topHiringCompanies.length > 0 && (
                <HackerCard glowColor="orange" className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="h-4 w-4 text-[#FB651E]" />
                    <h3 className="font-mono text-sm font-semibold">Top Hiring</h3>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mb-3">Companies with most openings</p>
                  <div className="space-y-2">
                    {analytics.topHiringCompanies.slice(0, 3).map((company: any) => (
                      <Link key={company.id} to={`/company/${company.slug}`} className="text-xs border-b border-muted/20 pb-2 last:border-0 block hover:opacity-80 transition">
                        <p className="font-semibold text-[#FB651E] truncate hover:underline">{company.name}</p>
                        <p className="text-muted-foreground">{company.jobCount} positions</p>
                      </Link>
                    ))}
                  </div>
                </HackerCard>
              )}
            </motion.div>

            {/* Main Content */}
            <div className="px-4 sm:px-6">
              {/* Hero Section */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8 text-center"
              >
                <h1 className="mb-4 bg-gradient-to-r from-[#FB651E] via-orange-400 to-red-400 bg-clip-text text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-transparent leading-relaxed py-1">
                  YC Hiring Board
                </h1>
                <p className="text-sm sm:text-base md:text-lg text-muted-foreground mb-4">
                  Discover latest job opportunities at Y Combinator funded companies
                </p>
                <Link
                  to="/hiring/analytics"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#FB651E]/50 text-[#FB651E] hover:bg-[#FB651E]/10 transition-colors"
                >
                  <BarChart3 className="h-4 w-4" />
                  View Market Analytics →
                </Link>
              </motion.div>

          {/* Stats Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4"
          >
            {[
              {
                icon: Briefcase,
                label: 'Total Jobs',
                value: paginatedData.total,
              },
              {
                icon: Building2,
                label: 'Companies Hiring',
                value: stats.hiringCompanies || 0,
              },
              {
                icon: TrendingUp,
                label: 'Avg Salary',
                value: stats.avgSalary ? `$${(stats.avgSalary / 1000).toFixed(0)}K` : 'N/A',
              },
              {
                icon: Zap,
                label: 'New This Week',
                value: stats.newJobsThisWeek || 0,
              },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div key={i} whileHover={{ y: -4 }} transition={{ duration: 0.3 }}>
                  <HackerCard glowColor="orange" className="p-3 sm:p-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-[#FB651E] flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                        <p className="text-lg sm:text-xl font-bold truncate">{stat.value}</p>
                      </div>
                    </div>
                  </HackerCard>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Filters + Sort - CompaniesBrowser-style Card layout */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <Card>
              <CardContent className="pt-6">
                <JobFilters
                  filters={filters}
                  onFiltersChange={handleFilterChange}
                  stats={{
                    roles: stats.topRoles || [],
                    batches: stats.topBatches || [],
                    locations: stats.topLocations || [],
                  }}
                />

                {/* Sort - inline like CompaniesBrowser search row */}
                <div className="mt-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 border-t border-border pt-4">
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 'recent' as const, label: 'Most Recent' },
                      { value: 'salary_high' as const, label: 'Highest Salary' },
                      { value: 'salary_low' as const, label: 'Lowest Salary' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleSortChange(option.value)}
                        className={`px-3 py-1.5 rounded-lg border transition-colors text-xs sm:text-sm whitespace-nowrap ${
                          sortBy === option.value
                            ? 'bg-[#FB651E]/20 border-[#FB651E] text-[#FB651E]'
                            : 'border-border text-muted-foreground hover:border-[#FB651E]/50'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    {paginatedData.total.toLocaleString()} jobs found
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Jobs Grid */}
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin">
                <Zap className="h-6 w-6 text-[#FB651E]" />
              </div>
              <p className="mt-2 text-muted-foreground">Loading jobs...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-500">
              <p>Failed to load jobs. Please try again.</p>
            </div>
          ) : paginatedData.jobs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No jobs match your filters. Try adjusting them!</p>
            </div>
          ) : (
            <>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {paginatedData.jobs.map((job: JobWithCompany, index: number) => (
                  <JobCard key={job.id} job={job} index={index} />
                ))}
              </motion.div>

              {/* Pagination - CompaniesBrowser style: centered Prev | Page X of Y | Next */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-8 flex justify-center gap-2 flex-wrap"
              >
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={!paginatedData.has_prev}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border disabled:opacity-50 disabled:cursor-not-allowed hover:border-[#FB651E]/50 transition-colors text-sm"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>

                <span className="flex items-center px-4 py-2 text-sm text-muted-foreground">
                  Page {paginatedData.page} of {paginatedData.total_pages}
                </span>

                <button
                  onClick={() => setCurrentPage(p => Math.min(paginatedData.total_pages, p + 1))}
                  disabled={!paginatedData.has_next}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border disabled:opacity-50 disabled:cursor-not-allowed hover:border-[#FB651E]/50 transition-colors text-sm"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </motion.div>
            </>
          )}
            </div>

            {/* Right Sidebar */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="hidden lg:flex flex-col gap-4"
            >
              {/* Live Stats Card */}
              <HackerCard glowColor="purple" className="p-4 sticky top-20">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-violet-500" />
                  <h3 className="font-mono text-sm font-semibold">Live Stats</h3>
                </div>
                <div className="space-y-3 text-xs font-mono">
                  <div>
                    <p className="text-muted-foreground mb-1">Total Jobs</p>
                    <p className="font-bold text-[#FB651E]">{paginatedData.total.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Companies</p>
                    <p className="font-bold text-violet-500">{stats.hiringCompanies || 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Avg Salary</p>
                    <p className="font-bold text-orange-500">{stats.avgSalary ? `$${(stats.avgSalary / 1000).toFixed(0)}K` : 'N/A'}</p>
                  </div>
                </div>
              </HackerCard>

              {/* View Analytics CTA */}
              <HackerCard glowColor="orange" className="p-4">
                <h3 className="font-mono text-sm font-semibold mb-3">Market Insights</h3>
                <Link to="/hiring/analytics" className="inline-flex items-center gap-2 w-full justify-center px-3 py-2 bg-[#FB651E]/20 text-[#FB651E] rounded text-xs font-mono hover:bg-[#FB651E]/30 transition mb-3">
                  View Analytics
                  <ArrowRight className="h-3 w-3" />
                </Link>
                <p className="text-xs text-muted-foreground font-mono text-center">
                  Explore salary trends and market data
                </p>
              </HackerCard>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
}
