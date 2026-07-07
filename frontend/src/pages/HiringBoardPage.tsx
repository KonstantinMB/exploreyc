import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import { Search, TrendingUp, Building2, Briefcase, Users, Zap } from 'lucide-react';
import { apiClient } from '../lib/api';
import { JobCard } from '../components/hiring/JobCard';
import { JobFilters } from '../components/hiring/JobFilters';
import { HackerCard } from '../components/ui/hacker-card';
import { DotPattern } from '../components/ui/dot-pattern';
import { GridPattern } from '../components/ui/grid-pattern';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import type { HiringFilters, JobWithCompany } from '../types/hiring';

export function HiringBoardPage() {
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

  const [sortBy, setSortBy] = useState<'recent' | 'salary' | 'relevant'>('recent');

  // Fetch hiring board data
  const { data: hiringData, isLoading: isLoadingHiring, error: hiringError } = useQuery({
    queryKey: ['hiring-board'],
    queryFn: async () => {
      const response = await apiClient.getHiringBoard();
      return response.data;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // Fetch hiring stats
  const { data: hiringStats } = useQuery({
    queryKey: ['hiring-stats'],
    queryFn: async () => {
      const response = await apiClient.getHiringStats();
      return response.data;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // Process and filter jobs
  const filteredAndSortedJobs = useMemo(() => {
    if (!hiringData?.jobs || !hiringData?.companies) return [];

    const jobsWithCompany = hiringData.jobs
      .map((job: any) => {
        const company = hiringData.companies.find((c: any) => c.id === job.company_id);
        return company ? { ...job, company } : null;
      })
      .filter((j: any) => j !== null) as JobWithCompany[];

    // Apply filters
    let filtered = jobsWithCompany.filter((job) => {
      // Role filter
      if (filters.roles.length > 0 && !filters.roles.includes(job.pretty_role)) {
        return false;
      }

      // Batch filter
      if (filters.batches.length > 0 && !filters.batches.includes(job.company.batch)) {
        return false;
      }

      // Location filter
      if (filters.locations.length > 0) {
        const jobLocations = job.locations.map(l => l.toLowerCase());
        const hasLocation = filters.locations.some(loc =>
          jobLocations.some(jl => jl.includes(loc.toLowerCase()))
        );
        if (!hasLocation && !(filters.remote === 'yes' && job.remote === 'yes')) {
          return false;
        }
      }

      // Job type filter
      if (filters.jobTypes.length > 0 && !filters.jobTypes.includes(job.job_type)) {
        return false;
      }

      // Remote filter
      if (filters.remote !== 'all' && job.remote !== filters.remote) {
        return false;
      }

      // Salary filter
      if (filters.salaryMin && job.salary_max && job.salary_max < filters.salaryMin) {
        return false;
      }
      if (filters.salaryMax && job.salary_min && job.salary_min > filters.salaryMax) {
        return false;
      }

      // Search query
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        return (
          job.title.toLowerCase().includes(query) ||
          job.company.name.toLowerCase().includes(query) ||
          job.pretty_role.toLowerCase().includes(query)
        );
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'salary':
          const avgA = ((a.salary_min || 0) + (a.salary_max || 0)) / 2;
          const avgB = ((b.salary_min || 0) + (b.salary_max || 0)) / 2;
          return avgB - avgA;
        case 'recent':
          return new Date(b.pretty_updated_at).getTime() - new Date(a.pretty_updated_at).getTime();
        case 'relevant':
        default:
          return 0;
      }
    });

    return filtered;
  }, [hiringData, filters, sortBy]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <>
      <Helmet>
        <title>Live YC Hiring Board - 1,425+ Jobs | ExploreYC</title>
        <meta
          name="description"
          content={`Browse ${filteredAndSortedJobs.length || '1,425+'} live job openings from Y Combinator companies. Filter by role, batch, location, salary. One-click apply.`}
        />
        <meta
          name="keywords"
          content="YC jobs, startup jobs, tech jobs, Y Combinator hiring, job board, hiring companies"
        />
      </Helmet>

      <div className="relative min-h-screen bg-background pb-24">
        {/* Background patterns */}
        <DotPattern color="hsl(var(--primary) / 0.15)" size={24} radius={0.5} />
        <GridPattern size={32} className="opacity-50" />

        {/* Content */}
        <div className="relative z-10 container mx-auto px-4 py-8 md:py-12">
          {/* Hero Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#FB651E]/10 border border-[#FB651E]/30 rounded-full mb-6">
              <Zap className="h-4 w-4 text-[#FB651E]" />
              <span className="text-sm font-mono text-[#FB651E]">Live Hiring Board</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="font-mono text-[#FB651E]">&gt;</span> YC Hiring Board
            </h1>
            <p className="text-lg text-muted-foreground font-mono max-w-2xl">
              {filteredAndSortedJobs.length || '1,425+'} live job openings from Y Combinator companies.
              Filter by role, batch, location. One-click apply.
            </p>
          </motion.div>

          {/* Stats Grid */}
          {hiringStats && !isLoadingHiring && (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12"
            >
              <motion.div variants={itemVariants} whileHover={{ y: -4 }}>
                <HackerCard glowColor="orange" className="p-4 cursor-default transition-all duration-300">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#FB651E]/10 rounded-lg">
                      <Briefcase className="h-5 w-5 text-[#FB651E]" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-mono text-muted-foreground mb-1">
                        JOBS_OPEN:
                      </div>
                      <div className="text-2xl font-bold font-mono text-[#FB651E] tabular-nums">
                        {hiringStats.totalJobs || '1.4K+'}
                      </div>
                    </div>
                  </div>
                </HackerCard>
              </motion.div>

              <motion.div variants={itemVariants} whileHover={{ y: -4 }}>
                <HackerCard glowColor="green" className="p-4 cursor-default transition-all duration-300">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-lg">
                      <Building2 className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-mono text-muted-foreground mb-1">
                        HIRING_COMPANIES:
                      </div>
                      <div className="text-2xl font-bold font-mono text-emerald-500 tabular-nums">
                        {hiringStats.hiringCompanies || '1.4K'}
                      </div>
                    </div>
                  </div>
                </HackerCard>
              </motion.div>

              <motion.div variants={itemVariants} whileHover={{ y: -4 }}>
                <HackerCard glowColor="blue" className="p-4 cursor-default transition-all duration-300">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-mono text-muted-foreground mb-1">
                        NEW_THIS_WEEK:
                      </div>
                      <div className="text-2xl font-bold font-mono text-blue-500 tabular-nums">
                        {hiringStats.newJobsThisWeek || '50+'}
                      </div>
                    </div>
                  </div>
                </HackerCard>
              </motion.div>

              <motion.div variants={itemVariants} whileHover={{ y: -4 }}>
                <HackerCard glowColor="purple" className="p-4 cursor-default transition-all duration-300">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-violet-500/10 rounded-lg">
                      <Users className="h-5 w-5 text-violet-500" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-mono text-muted-foreground mb-1">
                        AVG_SALARY:
                      </div>
                      <div className="text-2xl font-bold font-mono text-violet-500 tabular-nums">
                        ${hiringStats.avgSalary ? (hiringStats.avgSalary / 1000).toFixed(0) : '150'}K
                      </div>
                    </div>
                  </div>
                </HackerCard>
              </motion.div>
            </motion.div>
          )}

          {/* Search & Sort Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8 flex flex-col sm:flex-row gap-4"
          >
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search jobs, companies, roles..."
                value={filters.searchQuery}
                onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                className="pl-10 font-mono"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant={sortBy === 'recent' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('recent')}
                className={sortBy === 'recent' ? 'bg-[#FB651E] hover:bg-[#E65C00]' : ''}
              >
                Recent
              </Button>
              <Button
                variant={sortBy === 'salary' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('salary')}
                className={sortBy === 'salary' ? 'bg-[#FB651E] hover:bg-[#E65C00]' : ''}
              >
                Salary
              </Button>
            </div>
          </motion.div>

          {/* Main Content - Filters + Jobs Grid */}
          <div className="grid lg:grid-cols-4 gap-8">
            {/* Sidebar Filters - Desktop */}
            {hiringStats && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="hidden lg:block"
              >
                <HackerCard glowColor="blue" className="p-6 sticky top-24">
                  <JobFilters
                    filters={filters}
                    onFiltersChange={setFilters}
                    stats={{
                      roles: hiringStats.topRoles || [],
                      batches: hiringStats.topBatches || [],
                      locations: hiringStats.topLocations || [],
                    }}
                  />
                </HackerCard>
              </motion.div>
            )}

            {/* Jobs Grid */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="lg:col-span-3"
            >
              {isLoadingHiring ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
                  {[...Array(6)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <div className="h-64 bg-muted/40 rounded-lg border border-border animate-pulse" />
                    </motion.div>
                  ))}
                </div>
              ) : hiringError ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-center py-24"
                >
                  <div className="text-center font-mono text-muted-foreground max-w-md">
                    <div className="w-16 h-16 mx-auto bg-red-500/10 rounded-lg flex items-center justify-center mb-4">
                      <span className="text-3xl">⚠️</span>
                    </div>
                    <div className="text-lg font-medium mb-2">Error loading jobs</div>
                    <div className="text-sm">
                      Failed to fetch hiring board data. Please check your connection and try again.
                    </div>
                  </div>
                </motion.div>
              ) : filteredAndSortedJobs.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-center py-24"
                >
                  <div className="text-center font-mono text-muted-foreground max-w-md">
                    <div className="w-16 h-16 mx-auto bg-[#FB651E]/10 rounded-lg flex items-center justify-center mb-4">
                      <span className="text-3xl">🔍</span>
                    </div>
                    <div className="text-lg font-medium mb-2">No jobs found</div>
                    <div className="text-sm mb-6">
                      Try adjusting your filters or clearing your search
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setFilters({
                        roles: [],
                        batches: [],
                        locations: [],
                        jobTypes: [],
                        experienceLevels: [],
                        remote: 'all',
                        salaryMin: null,
                        salaryMax: null,
                        searchQuery: '',
                      })}
                      className="border-[#FB651E]/30 hover:border-[#FB651E]/50 text-[#FB651E]"
                    >
                      Clear all filters
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
                  {filteredAndSortedJobs.map((job, index) => (
                    <JobCard key={job.id} job={job} index={index} />
                  ))}
                </div>
              )}

              {/* Results count */}
              {filteredAndSortedJobs.length > 0 && (
                <div className="mt-8 text-center text-sm text-muted-foreground font-mono">
                  Showing {filteredAndSortedJobs.length} of {hiringData?.jobs.length || 0} jobs
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
}
