/**
 * Types for Live YC Hiring Board
 * Data from WorkAtAStartup API
 */

export interface Company {
  id: number;
  name: string;
  slug: string;
  batch: string;
  location: string | null;
  is_hiring: boolean;
  logo_url: string;
  small_logo_url: string;
  logo_path?: string;
  team_size: number;
  primary_vertical: string;
  parent_sector: string;
  child_sector: string | null;
  description: string;
  hiring_description: string;
  website: string;
  one_liner: string;
  country: string | null;
}

export interface Job {
  id: number;
  company_id: number;
  state: string;
  title: string;
  description: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency?: string; // ISO 4217 currency code (USD, INR, GBP, etc.)
  equity_min: number | null;
  equity_max: number | null;
  show_path: string; // Apply URL on WorkAtAStartup
  pretty_job_type: string; // "Full-time", "Contract", etc.
  pretty_min_experience: string;
  pretty_location_or_remote: string;
  pretty_salary_range: string;
  pretty_role: string; // "Engineering", "Sales", etc.
  pretty_updated_at: string;
  job_type: 'fulltime' | 'contract' | 'internship' | 'parttime';
  remote: 'yes' | 'no';
  locations: string[];
  min_experience: number;
  time_to_hire: number | null;
}

export interface JobWithCompany extends Job {
  company: Company;
}

export interface HiringBoardData {
  companies: Company[];
  jobs: Job[];
  recommendedJobIds: number[];
  totalJobs: number;
  hiringCompanies: number;
  lastUpdated: string;
}

export interface HiringStats {
  totalJobs: number;
  hiringCompanies: number;
  newJobsThisWeek: number;
  avgSalary: number | null;
  topRoles: Array<{ role: string; count: number }>;
  topBatches: Array<{ batch: string; count: number }>;
  topLocations: Array<{ location: string; count: number }>;
}

// Filter types
export interface HiringFilters {
  roles: string[];
  batches: string[];
  locations: string[];
  jobTypes: string[];
  experienceLevels: string[];
  remote: 'all' | 'yes' | 'no';
  salaryMin: number | null;
  salaryMax: number | null;
  searchQuery: string;
}

export const ROLE_COLORS: Record<string, string> = {
  'Engineering': 'bg-blue-500/20 text-blue-500 border-blue-500/30',
  'Sales': 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30',
  'Design': 'bg-purple-500/20 text-purple-500 border-purple-500/30',
  'Marketing': 'bg-[#FB651E]/20 text-[#FB651E] border-[#FB651E]/30',
  'Product': 'bg-cyan-500/20 text-cyan-500 border-cyan-500/30',
  'Operations': 'bg-slate-500/20 text-slate-500 border-slate-500/30',
  'HR': 'bg-pink-500/20 text-pink-500 border-pink-500/30',
  'Recruiting': 'bg-pink-500/20 text-pink-500 border-pink-500/30',
};

export const ROLE_ICONS: Record<string, string> = {
  'Engineering': '⚙️',
  'Sales': '🎯',
  'Design': '🎨',
  'Marketing': '📢',
  'Product': '📦',
  'Operations': '⚡',
  'HR': '👥',
  'Recruiting': '👥',
};
