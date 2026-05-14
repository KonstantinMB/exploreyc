import { motion } from 'framer-motion';
import { ExternalLink, MapPin, Briefcase, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import type { JobWithCompany } from '../../types/hiring';
import { ROLE_COLORS } from '../../types/hiring';
import { HackerCard } from '../ui/hacker-card';
import { formatSalary, isHighSalary } from '../../utils/currency';

interface JobCardProps {
  job: JobWithCompany;
  index?: number;
}

function getLogoUrl(company: any): string {
  // First, try to use logo from Supabase storage if available
  if (company.logo_path) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (supabaseUrl) {
      return `${supabaseUrl}/storage/v1/object/public/assets/${company.logo_path}`;
    }
  }

  // Fall back to original URL with proxy
  const rawUrl = company.small_logo_url || company.logo_url;
  if (!rawUrl?.startsWith('http')) return rawUrl;
  const raw = import.meta.env.VITE_API_URL || '';
  const base = raw.startsWith('http') ? raw.replace(/\/$/, '') : (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/api/logo-proxy?url=${encodeURIComponent(rawUrl)}`;
}

function getJobUrl(showPath: string): string {
  // If show_path is a full URL, extract just the path portion
  if (showPath?.startsWith('http')) {
    try {
      const url = new URL(showPath);
      return url.pathname;
    } catch {
      return showPath;
    }
  }
  // If it's already a path, use as-is
  return showPath || '';
}


export function JobCard({ job, index = 0 }: JobCardProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const roleColor = ROLE_COLORS[job.pretty_role] || ROLE_COLORS['Operations'];
  const currency = job.salary_currency || 'USD';
  const isHighSalaryFlag = isHighSalary(job.salary_min, job.salary_max, currency);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -4 }}
      className="h-full"
    >
      <a
        href={`https://www.workatastartup.com${getJobUrl(job.show_path)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="block h-full"
      >
        <HackerCard
          glowColor={isHighSalaryFlag ? 'green' : 'orange'}
          className="h-full p-4 sm:p-5 bg-gradient-to-br from-background to-muted/20 hover:border-[#FB651E]/50 transition-all duration-300 group"
        >
          <div className="flex flex-col h-full gap-3">
            {/* Header: CompaniesBrowser-style - title/role left, logo right */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm sm:text-base font-bold leading-snug group-hover:text-[#FB651E] transition-colors line-clamp-2">
                  {job.title}
                </h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs font-medium truncate">{job.company.name}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border flex-shrink-0 ${roleColor}`}>
                    {job.pretty_role}
                  </span>
                </div>
              </div>
              {/* Logo on right like CompaniesBrowser */}
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-[#FB651E]/10 to-[#FB651E]/5 border border-[#FB651E]/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {(job.company.logo_path || job.company.small_logo_url) && !logoFailed ? (
                  <img
                    src={getLogoUrl(job.company)}
                    alt={job.company.name}
                    className="w-8 h-8 sm:w-10 sm:h-10 object-contain"
                    referrerPolicy="no-referrer"
                    onError={() => setLogoFailed(true)}
                  />
                ) : (
                  <span className="text-sm font-bold text-[#FB651E]">
                    {job.company.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            {/* Metadata - CompaniesBrowser-style simple rows */}
            <div className="space-y-2 text-xs text-muted-foreground flex-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" />
                <span className={`font-mono ${isHighSalaryFlag ? 'text-emerald-600 font-medium' : ''}`}>
                  {formatSalary(job.salary_min, job.salary_max, currency)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Briefcase className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{job.pretty_job_type}</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span className="line-clamp-2">
                  {job.pretty_location_or_remote} {job.remote === 'yes' && '(Remote)'}
                </span>
              </div>
              <div className="text-[10px] font-mono">{job.company.batch} • {job.pretty_min_experience}</div>
            </div>

            {/* CTA - like CompaniesBrowser Visit Website */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-[10px] text-muted-foreground font-mono">Apply</span>
              <ExternalLink className="w-3.5 h-3.5 text-[#FB651E]" />
            </div>
          </div>
        </HackerCard>
      </a>
    </motion.div>
  );
}
