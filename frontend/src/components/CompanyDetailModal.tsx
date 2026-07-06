import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ExternalLink, Briefcase, Users, MapPin, TrendingUp, Globe, Building2, DollarSign, Calendar, UserCheck, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { SourceBadge, sourceLabel } from './ui/SourceBadge';
import type { Company } from '../lib/api';

interface CompanyDetailModalProps {
  company: Company | null;
  open: boolean;
  onClose: () => void;
  showViewFullPage?: boolean;
}

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
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
}

export function CompanyDetailModal({ company, open, onClose, showViewFullPage }: CompanyDetailModalProps) {
  if (!company) return null;

  const tags = company.tags ? JSON.parse(company.tags) : [];
  const industries = company.industries ? JSON.parse(company.industries) : [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <div className="flex items-start gap-4">
            {company.small_logo_thumb_url && (
              <img
                src={company.small_logo_thumb_url}
                alt={company.name}
                className="w-16 h-16 rounded-lg border"
              />
            )}
            <div className="flex-1">
              <DialogTitle className="text-2xl font-bold text-[#FB651E]">
                {company.name}
              </DialogTitle>
              <DialogDescription className="text-base mt-1">
                {company.one_liner}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Status Badges */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-muted/40">
              <SourceBadge source={company.source} />
              <span className="text-sm font-medium text-foreground">{sourceLabel(company.source)}</span>
            </span>
            {company.is_hiring && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-200">
                <Briefcase className="h-4 w-4 mr-1" />
                Hiring
              </span>
            )}
            {company.top_company && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                <TrendingUp className="h-4 w-4 mr-1" />
                Top Company
              </span>
            )}
            {company.batch && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800 border border-orange-200">
                {company.batch}
              </span>
            )}
            {company.exit_type && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200">
                {company.exit_type}
                {company.ticker_symbol ? `: ${company.ticker_symbol}` : company.acquirer ? ` → ${company.acquirer}` : ''}
              </span>
            )}
            {company.status && company.status.trim() && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200">
                {company.status}
              </span>
            )}
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-4">
            {company.all_locations && (
              <div className="flex items-start gap-2 text-sm col-span-2 sm:col-span-1">
                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="font-medium">Location: </span>
                  <span className="text-muted-foreground break-words">{formatLocations(company.all_locations)}</span>
                </div>
              </div>
            )}
            {company.team_size > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Team Size:</span>
                <span>{company.team_size} people</span>
              </div>
            )}
            {company.industry && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Industry:</span>
                <span>{company.industry}</span>
              </div>
            )}
            {company.stage && (
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Stage:</span>
                <span>{company.stage}</span>
              </div>
            )}
          </div>

          {/* Funding Information */}
          {(company.funding_total_usd || company.funding_last_round_name) && (
            <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-lg p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <DollarSign className="h-5 w-5" />
                Funding Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {company.funding_total_usd && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Total Raised</div>
                    <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(company.funding_total_usd)}
                    </div>
                  </div>
                )}
                {company.funding_last_round_usd && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Last Round</div>
                    <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(company.funding_last_round_usd)}
                    </div>
                  </div>
                )}
                {company.funding_last_round_name && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Round Type</div>
                    <div className="text-sm font-medium">{company.funding_last_round_name}</div>
                  </div>
                )}
                {company.funding_last_round_date && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Last Funding Date
                    </div>
                    <div className="text-sm font-medium">{formatDate(company.funding_last_round_date)}</div>
                  </div>
                )}
                {company.investors_count && company.investors_count > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <UserCheck className="h-3 w-3" />
                      Investors
                    </div>
                    <div className="text-sm font-medium">{company.investors_count} investors</div>
                  </div>
                )}
                {company.valuation_usd && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Valuation</div>
                    <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(company.valuation_usd)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          {company.long_description && (
            <div>
              <h3 className="font-semibold mb-2">About</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {company.long_description}
              </p>
            </div>
          )}

          {/* Industries */}
          {industries.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Industries</h3>
              <div className="flex flex-wrap gap-2">
                {industries.map((industry: string, index: number) => (
                  <span
                    key={index}
                    className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700"
                  >
                    {industry}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag: string, index: number) => (
                  <span
                    key={index}
                    className="px-2 py-1 text-xs rounded bg-[#FB651E]/10 text-[#FB651E] border border-[#FB651E]/20"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Sub-industry */}
          {company.subindustry && (
            <div className="text-sm">
              <span className="font-medium">Sub-industry:</span>{' '}
              <span className="text-muted-foreground">{company.subindustry}</span>
            </div>
          )}

          {/* Similar companies hint */}
          {company.industry && (
            <p className="text-xs text-muted-foreground font-mono">
              Similar: Filter by <span className="text-[#FB651E]">{company.industry}</span> in Map or Companies tab
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-4 border-t">
            {showViewFullPage && company.slug && (
              <Button asChild variant="outline" className="flex-1">
                <Link to={`/company/${company.slug}`} onClick={onClose}>
                  <FileText className="h-4 w-4 mr-2" />
                  View full page
                </Link>
              </Button>
            )}
            {company.website && (
              <Button
                asChild
                className="flex-1 bg-[#FB651E] hover:bg-[#E65C00]"
              >
                <a href={company.website} target="_blank" rel="noopener noreferrer">
                  <Globe className="h-4 w-4 mr-2" />
                  Visit Website
                  <ExternalLink className="h-4 w-4 ml-2" />
                </a>
              </Button>
            )}
            <Button
              asChild
              variant="outline"
              className="flex-1"
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
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
