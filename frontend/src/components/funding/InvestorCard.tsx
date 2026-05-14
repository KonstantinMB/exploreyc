import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Building2, ChevronDown, ChevronUp, DollarSign } from 'lucide-react';
import { HackerCard } from '../ui/hacker-card';

interface InvestorCardProps {
  investor: {
    id: number;
    name: string;
    investor_type?: string;
    portfolio_count: number;
  };
  portfolioCompanies: Array<{
    id: number;
    name: string;
    slug: string;
    funding_total_usd: number;
    batch: string;
    industry: string;
    last_funding_date?: string;
  }>;
  totalInvested: number;
  onCompanyClick: (companyId: number) => void;
}

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(2)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  return `$${(amount / 1_000).toFixed(0)}K`;
}

export function InvestorCard({ investor, portfolioCompanies, totalInvested, onCompanyClick }: InvestorCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const avgInvestment = portfolioCompanies.length > 0 ? totalInvested / portfolioCompanies.length : 0;

  const getInvestorTypeColor = (type?: string) => {
    if (!type) return 'text-gray-500';
    const typeLower = type.toLowerCase();
    if (typeLower.includes('venture')) return 'text-blue-500';
    if (typeLower.includes('angel')) return 'text-violet-500';
    if (typeLower.includes('corporate')) return 'text-emerald-500';
    return 'text-gray-500';
  };

  const sortedCompanies = [...portfolioCompanies].sort((a, b) => b.funding_total_usd - a.funding_total_usd);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <HackerCard
        glowColor="blue"
        className={`p-5 transition-all cursor-pointer ${
          isExpanded ? 'border-[#FB651E]/60' : 'hover:border-[#FB651E]/30'
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold font-mono text-foreground truncate">
              {investor.name}
            </h3>
            {investor.investor_type && (
              <p className={`text-xs font-mono ${getInvestorTypeColor(investor.investor_type)} mt-1`}>
                {investor.investor_type}
              </p>
            )}
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.3 }}
            className="flex-shrink-0"
          >
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-[#FB651E]" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </motion.div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="bg-muted/30 p-3 rounded-lg">
            <div className="flex items-center gap-1 mb-1">
              <Building2 className="h-3 w-3 text-blue-500" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Companies</span>
            </div>
            <div className="text-xl font-bold font-mono text-blue-500">
              {investor.portfolio_count}
            </div>
          </div>

          <div className="bg-muted/30 p-3 rounded-lg">
            <div className="flex items-center gap-1 mb-1">
              <DollarSign className="h-3 w-3 text-emerald-500" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</span>
            </div>
            <div className="text-xl font-bold font-mono text-emerald-500">
              {formatCurrency(totalInvested)}
            </div>
          </div>

          <div className="bg-muted/30 p-3 rounded-lg">
            <div className="flex items-center gap-1 mb-1">
              <TrendingUp className="h-3 w-3 text-[#FB651E]" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Avg</span>
            </div>
            <div className="text-xl font-bold font-mono text-[#FB651E]">
              {formatCurrency(avgInvestment)}
            </div>
          </div>
        </div>

        {/* Expand hint */}
        {!isExpanded && (
          <div className="text-xs text-muted-foreground font-mono text-center pt-2 border-t border-border/50">
            Click to view portfolio →
          </div>
        )}

        {/* Expanded Portfolio */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="pt-4 border-t border-border mt-4">
                <div className="text-xs font-mono text-muted-foreground mb-3 flex items-center gap-2">
                  <span className="text-[#FB651E]">$</span>
                  <span>Portfolio Companies ({portfolioCompanies.length})</span>
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {sortedCompanies.map((company, index) => (
                    <motion.div
                      key={company.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCompanyClick(company.id);
                      }}
                      className="flex items-center justify-between gap-3 p-3 bg-background/50 hover:bg-[#FB651E]/10 rounded-lg border border-border/50 hover:border-[#FB651E]/50 transition-all cursor-pointer group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-foreground truncate group-hover:text-[#FB651E] transition-colors">
                          {company.name}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-mono text-muted-foreground">
                            {company.batch}
                          </span>
                          {company.industry && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-xs text-muted-foreground truncate">
                                {company.industry}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-bold font-mono text-emerald-500">
                          {formatCurrency(company.funding_total_usd)}
                        </div>
                        {company.last_funding_date && (
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {new Date(company.last_funding_date).getFullYear()}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </HackerCard>
    </motion.div>
  );
}
