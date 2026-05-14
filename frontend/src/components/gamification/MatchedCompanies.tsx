import { motion } from 'framer-motion';
import { ExternalLink, TrendingUp } from 'lucide-react';
import { HackerCard } from '../ui/hacker-card';

interface Company {
  id: string;
  name: string;
  slug?: string;
  batch?: string;
  team_size?: number;
  logo_url?: string;
  small_logo_url?: string;
  website?: string;
  similarity?: number;
  funding_total_usd?: number;
  valuation_usd?: number;
}

interface MatchedCompaniesProps {
  companies: Company[];
  title?: string;
}

function getLogoUrl(company: Company): string {
  // Use small logo if available
  const rawUrl = company.small_logo_url || company.logo_url;
  if (!rawUrl?.startsWith('http')) return rawUrl || '';

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (supabaseUrl && rawUrl) {
    return `${supabaseUrl}/storage/v1/object/public/assets/${rawUrl}`;
  }

  // Proxy through backend
  const apiUrl = import.meta.env.VITE_API_URL || '';
  const base = apiUrl.startsWith('http') ? apiUrl.replace(/\/$/, '') : window.location.origin;
  return `${base}/api/logo-proxy?url=${encodeURIComponent(rawUrl)}`;
}

function formatFunding(amount?: number): string {
  if (!amount) return 'N/A';
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(0)}M`;
  return `$${(amount / 1000).toFixed(0)}K`;
}

function CompanyCard({ company, idx }: { company: Company; idx: number }) {
  const cardContent = (
    <HackerCard
      glowColor={company.similarity && company.similarity >= 0.7 ? 'green' : 'orange'}
      className="h-full p-4 hover:border-[#FB651E]/50 transition-all group"
    >
      <div className="space-y-3 flex flex-col h-full">
        {/* Company Header */}
        <div className="flex items-start gap-3">
          {company.logo_url || company.small_logo_url ? (
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FB651E]/10 to-[#FB651E]/5 border border-[#FB651E]/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
              <img
                src={getLogoUrl(company)}
                alt={company.name}
                className="w-8 h-8 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FB651E]/10 to-[#FB651E]/5 border border-[#FB651E]/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-[#FB651E]">
                {company.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm text-foreground truncate group-hover:text-[#FB651E] transition-colors">
              {company.name}
            </h4>
            {company.batch && (
              <p className="text-xs text-muted-foreground">{company.batch}</p>
            )}
          </div>
        </div>

        {/* Similarity Score */}
        {company.similarity !== undefined && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Match Score</span>
              <span className="font-semibold text-[#FB651E]">
                {Math.round(company.similarity * 100)}%
              </span>
            </div>
            <div className="w-full bg-muted/30 rounded-full h-1.5 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.round(company.similarity * 100)}%` }}
                transition={{ duration: 1, ease: 'easeOut', delay: 0.8 }}
                className="h-full bg-gradient-to-r from-[#FB651E] to-[#FB651E]/60"
              />
            </div>
          </div>
        )}

        {/* Metrics */}
        <div className="space-y-2 flex-1">
          {company.team_size && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Team Size</span>
              <span className="font-mono text-foreground">{company.team_size}+</span>
            </div>
          )}

          {company.funding_total_usd && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Funding</span>
              <span className="font-mono text-foreground">{formatFunding(company.funding_total_usd)}</span>
            </div>
          )}

          {company.valuation_usd && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Valuation</span>
              <span className="font-mono text-foreground text-[#FB651E] font-semibold">
                {formatFunding(company.valuation_usd)}
              </span>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="pt-2 border-t border-border">
          <div className="flex items-center gap-1 text-[#FB651E] text-xs font-medium group-hover:gap-2 transition-all">
            {company.slug ? 'View Profile' : 'Visit Website'}
            <ExternalLink className="w-3 h-3" />
          </div>
        </div>
      </div>
    </HackerCard>
  );

  // Prefer internal slug link, fallback to external website link
  const href = company.slug
    ? `/company/${company.slug}`
    : (company.website ? `https://${company.website}` : '#');

  const isExternal = !!company.website && !company.slug;

  return (
    <motion.div
      key={company.id || idx}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7 + idx * 0.05 }}
    >
      <a
        href={href}
        target={isExternal ? '_blank' : undefined}
        rel={isExternal ? 'noopener noreferrer' : undefined}
        className="block h-full"
      >
        {cardContent}
      </a>
    </motion.div>
  );
}

export function MatchedCompanies({ companies, title = 'Similar YC Companies' }: MatchedCompaniesProps) {
  if (!companies || companies.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="space-y-4"
    >
      <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-[#FB651E]" />
        {title} ({companies.length})
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {companies.map((company, idx) => (
          <CompanyCard key={company.id || idx} company={company} idx={idx} />
        ))}
      </div>

      {/* Pro Tip */}
      <div className="mt-6 p-4 rounded-lg border border-border bg-muted/50 text-sm text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">💡 Pro tip:</span> Study the companies above with the highest match score.
          They share similar characteristics with your idea and have already achieved success in the YC ecosystem.
        </p>
      </div>
    </motion.div>
  );
}
