import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ExternalLink,
  Briefcase,
  Users,
  MapPin,
  TrendingUp,
  Globe,
  Building2,
  DollarSign,
  Calendar,
  UserCheck,
  Loader2,
  Share2,
  ArrowRight
} from 'lucide-react';
import { apiClient, type Company } from '../lib/api';
import { Button } from '../components/ui/button';
import { AnnouncementBanner } from '../components/AnnouncementBanner';
import { CompanyResearch } from '../components/CompanyResearch';
import { SourceBadge, sourceLabel } from '../components/ui/SourceBadge';

function formatLocations(allLocations: string, maxShow = 2): string {
  if (!allLocations?.trim()) return '';
  const locations = allLocations.split(/[;\n]+/).map((s) => s.trim()).filter(Boolean);
  if (locations.length <= maxShow) return locations.join(', ');
  const shown = locations.slice(0, maxShow).join(', ');
  return `${shown} +${locations.length - maxShow} more`;
}

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `$${(amount / 1_000_000_000).toFixed(2)}B`;
  }
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  return `$${(amount / 1_000).toFixed(0)}K`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function CompanyPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setError('No company slug provided');
      setLoading(false);
      return;
    }

    const fetchCompany = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.getCompanyBySlug(slug);
        setCompany(response.data);
      } catch (err: any) {
        console.error('Error fetching company:', err);
        setError(err.response?.data?.detail || 'Failed to load company');
      } finally {
        setLoading(false);
      }
    };

    fetchCompany();
  }, [slug]);

  // Fetch hiring jobs for this company
  const { data: jobsData } = useQuery({
    queryKey: ['company-jobs', company?.id],
    queryFn: async () => {
      if (!company?.id) return { jobs: [] };
      const response = await fetch(`/api/hiring/jobs/paginated?company_id=${company.id}&per_page=100`);
      if (!response.ok) throw new Error('Failed to fetch jobs');
      return response.json();
    },
    enabled: !!company?.id,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#FB651E] mx-auto mb-4" />
          <p className="text-muted-foreground font-mono">Loading company...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !company) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto bg-red-600/10 rounded-2xl flex items-center justify-center mb-6">
            <span className="text-4xl">??</span>
          </div>
          <h2 className="text-2xl font-bold mb-2">Company Not Found</h2>
          <p className="text-muted-foreground font-mono mb-6">{error || 'This company does not exist'}</p>
          <Button
            onClick={() => navigate('/')}
            className="bg-[#FB651E] hover:bg-[#E65C00]"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Explorer
          </Button>
        </div>
      </div>
    );
  }

  const tags = company.tags ? JSON.parse(company.tags) : [];
  const industries = company.industries ? JSON.parse(company.industries) : [];

  return (
    <>
      <AnnouncementBanner />
      <div className="min-h-screen bg-background pt-12 md:pt-0">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back button */}
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-[#FB651E] font-mono mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Explorer
        </button>

        {/* Company Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-start gap-6 mb-6">
            {company.small_logo_thumb_url && (
              <img
                src={company.small_logo_thumb_url}
                alt={company.name}
                className="w-24 h-24 rounded-xl border border-border shadow-lg flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-4xl font-bold text-[#FB651E] mb-2 break-words">
                {company.name}
              </h1>
              <p className="text-lg text-foreground mb-4 leading-relaxed">
                {company.one_liner}
              </p>

              {/* Status Badges */}
              <div className="flex flex-wrap gap-2 items-center">
                {/* Source (incubator / VC) brand */}
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-muted/40">
                  <SourceBadge source={company.source} />
                  <span className="text-sm font-medium text-foreground">{sourceLabel(company.source)}</span>
                </span>
                {company.is_hiring && (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-200">
                    <Briefcase className="h-4 w-4 mr-1.5" />
                    Hiring
                  </span>
                )}
                {company.top_company && (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                    <TrendingUp className="h-4 w-4 mr-1.5" />
                    Top Company
                  </span>
                )}
                {company.batch && (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-orange-100 text-orange-800 border border-orange-200">
                    {company.batch}
                  </span>
                )}
                {company.exit_type && (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200">
                    {company.exit_type}
                    {company.ticker_symbol ? `: ${company.ticker_symbol}` : company.acquirer ? ` → ${company.acquirer}` : ''}
                  </span>
                )}
                {company.status && company.status.trim() && (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200">
                    {company.status}
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-6"
        >
          {/* Key Metrics */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#FB651E]" />
              Company Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {company.all_locations && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-muted-foreground mb-1">Location</div>
                    <div className="text-foreground break-words">{formatLocations(company.all_locations, 3)}</div>
                  </div>
                </div>
              )}
              {company.team_size > 0 && (
                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">Team Size</div>
                    <div className="text-foreground">{company.team_size} people</div>
                  </div>
                </div>
              )}
              {company.industry && (
                <div className="flex items-start gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">Industry</div>
                    <div className="text-foreground">{company.industry}</div>
                  </div>
                </div>
              )}
              {company.stage && (
                <div className="flex items-start gap-3">
                  <TrendingUp className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">Stage</div>
                    <div className="text-foreground">{company.stage}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Funding Information - Prominent Display */}
          {(company.funding_total_usd || company.funding_last_round_name) && (
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/10 border-2 border-emerald-200 dark:border-emerald-500/30 rounded-xl p-6 shadow-md">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <DollarSign className="h-6 w-6" />
                Funding Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {company.funding_total_usd && (
                  <div className="bg-white dark:bg-gray-800/50 rounded-lg p-4 border border-emerald-100 dark:border-emerald-500/20">
                    <div className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Total Raised</div>
                    <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(company.funding_total_usd)}
                    </div>
                  </div>
                )}
                {company.funding_last_round_usd && (
                  <div className="bg-white dark:bg-gray-800/50 rounded-lg p-4 border border-emerald-100 dark:border-emerald-500/20">
                    <div className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Last Round</div>
                    <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(company.funding_last_round_usd)}
                    </div>
                  </div>
                )}
                {company.valuation_usd && (
                  <div className="bg-white dark:bg-gray-800/50 rounded-lg p-4 border border-emerald-100 dark:border-emerald-500/20">
                    <div className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Valuation</div>
                    <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(company.valuation_usd)}
                    </div>
                  </div>
                )}
                {company.funding_last_round_name && (
                  <div className="bg-white dark:bg-gray-800/50 rounded-lg p-4 border border-emerald-100 dark:border-emerald-500/20">
                    <div className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Round Type</div>
                    <div className="text-lg font-semibold text-foreground">{company.funding_last_round_name}</div>
                  </div>
                )}
                {company.funding_last_round_date && (
                  <div className="bg-white dark:bg-gray-800/50 rounded-lg p-4 border border-emerald-100 dark:border-emerald-500/20">
                    <div className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Last Funding Date
                    </div>
                    <div className="text-lg font-semibold text-foreground">{formatDate(company.funding_last_round_date)}</div>
                  </div>
                )}
                {company.investors_count && company.investors_count > 0 && (
                  <div className="bg-white dark:bg-gray-800/50 rounded-lg p-4 border border-emerald-100 dark:border-emerald-500/20">
                    <div className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide flex items-center gap-1">
                      <UserCheck className="h-3 w-3" />
                      Investors
                    </div>
                    <div className="text-lg font-semibold text-foreground">{company.investors_count} investors</div>
                  </div>
                )}
                {company.employee_count && company.employee_count > 0 && (
                  <div className="bg-white dark:bg-gray-800/50 rounded-lg p-4 border border-emerald-100 dark:border-emerald-500/20">
                    <div className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Employee Count
                    </div>
                    <div className="text-lg font-semibold text-foreground">{company.employee_count.toLocaleString()} employees</div>
                  </div>
                )}
                {company.employee_growth_6m && (
                  <div className="bg-white dark:bg-gray-800/50 rounded-lg p-4 border border-emerald-100 dark:border-emerald-500/20">
                    <div className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">6-Month Growth</div>
                    <div className="text-lg font-semibold text-foreground">
                      {company.employee_growth_6m > 0 ? '+' : ''}{(company.employee_growth_6m * 100).toFixed(1)}%
                    </div>
                  </div>
                )}
              </div>
              {company.coresignal_last_updated && (
                <p className="text-xs text-muted-foreground font-mono mt-4 pt-4 border-t border-emerald-200/50">
                  Funding data last updated: {formatDate(company.coresignal_last_updated)}
                </p>
              )}
            </div>
          )}

          {/* Description */}
          {company.long_description && (
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <h2 className="text-xl font-semibold mb-4">About {company.name}</h2>
              <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                {company.long_description}
              </p>
            </div>
          )}

          {/* Industries & Tags */}
          {(industries.length > 0 || tags.length > 0) && (
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              {industries.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3">Industries</h3>
                  <div className="flex flex-wrap gap-2">
                    {industries.map((industry: string, index: number) => (
                      <span
                        key={index}
                        className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
                      >
                        {industry}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {tags.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag: string, index: number) => (
                      <span
                        key={index}
                        className="px-3 py-1.5 text-sm rounded-lg bg-[#FB651E]/10 text-[#FB651E] border border-[#FB651E]/30 font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sub-industry */}
          {company.subindustry && (
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
              <p className="text-sm">
                <span className="font-medium text-foreground">Sub-industry:</span>{' '}
                <span className="text-muted-foreground">{company.subindustry}</span>
              </p>
            </div>
          )}

          {/* Company Intelligence Section */}
          <CompanyResearch companyName={company.name} />

          {/* Hiring Jobs Section */}
          {jobsData?.jobs && jobsData.jobs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-card border border-border rounded-xl p-6 shadow-sm"
            >
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-[#FB651E]" />
                Open Positions ({jobsData.total})
              </h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {jobsData.jobs.slice(0, 10).map((job: any, index: number) => (
                  <a
                    key={index}
                    href={job.job_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 + index * 0.02 }}
                      className="flex items-start justify-between p-3 border border-border rounded-lg hover:bg-muted/50 hover:border-[#FB651E]/50 transition cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate hover:text-[#FB651E]">{job.pretty_job_title || job.title}</p>
                        <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                          {job.pretty_job_type && (
                            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded">
                              {job.pretty_job_type}
                            </span>
                          )}
                          {job.pretty_location_or_remote && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {job.pretty_location_or_remote}
                            </span>
                          )}
                          {job.pretty_experience_level && (
                            <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded">
                              {job.pretty_experience_level}
                            </span>
                          )}
                        </div>
                        {job.salary_min && job.salary_max && (
                          <p className="text-sm font-mono text-[#FB651E] mt-2">
                            ${(job.salary_min / 1000).toFixed(0)}K - ${(job.salary_max / 1000).toFixed(0)}K
                          </p>
                        )}
                      </div>
                      <ArrowRight className="h-5 w-5 text-[#FB651E] flex-shrink-0 ml-4" />
                    </motion.div>
                  </a>
                ))}
              </div>
              {jobsData.total > 10 && (
                <p className="text-xs text-muted-foreground font-mono text-center mt-3 pt-3 border-t border-border">
                  Showing 10 of {jobsData.total} open positions
                </p>
              )}
            </motion.div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4 pt-4">
            {company.website && (
              <Button
                asChild
                className="flex-1 min-w-[200px] bg-[#FB651E] hover:bg-[#E65C00] text-white"
                size="lg"
              >
                <a href={company.website} target="_blank" rel="noopener noreferrer">
                  <Globe className="h-5 w-5 mr-2" />
                  Visit Website
                  <ExternalLink className="h-4 w-4 ml-2" />
                </a>
              </Button>
            )}
            <Button
              onClick={() => navigate(`/share/company/${company.slug}`)}
              variant="outline"
              className="flex-1 min-w-[200px] border-[#FB651E]/50 hover:border-[#FB651E] hover:bg-[#FB651E]/10"
              size="lg"
            >
              <Share2 className="h-5 w-5 mr-2" />
              Share Card
            </Button>
            <Button
              asChild
              variant="outline"
              className="flex-1 min-w-[200px]"
              size="lg"
            >
              <a
                href={
                  company.source === 'a16z' && company.source_url
                    ? company.source_url
                    : `https://www.ycombinator.com/companies/${company.slug}`
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                View on {company.source === 'a16z' ? 'a16z' : 'YC'}
                <ExternalLink className="h-4 w-4 ml-2" />
              </a>
            </Button>
          </div>

          {/* Similar companies hint */}
          {company.industry && (
            <p className="text-xs text-muted-foreground font-mono text-center py-4">
              Find similar companies: Filter by <span className="text-[#FB651E] font-semibold">{company.industry}</span> on the Explorer
            </p>
          )}
        </motion.div>
        </div>
      </div>
    </>
  );
}
