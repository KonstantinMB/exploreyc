export interface SalaryByRole {
  role: string;
  avg: number;
  min: number;
  max: number;
  median: number;
  count: number;
  jobsWithSalary: number;
}

export interface RoleDistribution {
  role: string;
  count: number;
  percentage: number;
}

export interface LocationBreakdown {
  location: string;
  count: number;
  percentage: number;
  remoteCount?: number;
}

export interface BatchHiring {
  batch: string;
  count: number;
  companies: number;
}

export interface TopHiringCompany {
  id: number;
  name: string;
  logo_url?: string;
  small_logo_url?: string;
  logo_path?: string;
  jobCount: number;
  batch: string;
  slug?: string;
}

export interface TopPayingCompany {
  id: number;
  name: string;
  avgSalary: number;
  jobCount: number;
  batch?: string;
  slug?: string;
}

export interface HighestPayingRole {
  role: string;
  avgSalary: number;
  minSalary: number;
  maxSalary: number;
  jobCount: number;
}

export interface JobTypeBreakdown {
  type: string;
  count: number;
  percentage: number;
}

export interface ExperienceLevelBreakdown {
  level: string;
  count: number;
  percentage: number;
}

export interface RemoteStats {
  remote: number;
  remotePercentage: number;
  onsite: number;
  onsitePercentage: number;
  mixed: number;
  mixedPercentage: number;
}

export interface EarlyStageStats {
  earlyStageCompanies: number;
  earlyStagePercentage: number;
  earlyStageJobs: number;
  growthStageCompanies: number;
  growthStageJobs: number;
}

export interface HiringAnalytics {
  totalJobs: number;
  totalCompanies: number;
  avgSalary: number;
  salaryMedian: number;
  jobsWithSalary: number;
  jobsWithSalaryPercentage: number;
  salaryByRole: SalaryByRole[];
  roleDistribution: RoleDistribution[];
  topBatches: BatchHiring[];
  topHiringCompanies: TopHiringCompany[];
  topPayingCompanies: TopPayingCompany[];
  highestPayingRoles: HighestPayingRole[];
  locationBreakdown: LocationBreakdown[];
  jobTypeBreakdown: JobTypeBreakdown[];
  experienceLevels: ExperienceLevelBreakdown[];
  remoteStats: RemoteStats;
  earlyStageStats: EarlyStageStats;
  industryVerticals: Array<{
    vertical: string;
    count: number;
    percentage: number;
  }>;
  lastUpdated: string;
}
