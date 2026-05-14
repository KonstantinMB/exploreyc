import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, TrendingUp, DollarSign, Building2, Calendar } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { HackerCard } from '../ui/hacker-card';

interface Company {
  id: number;
  name: string;
  slug: string;
  funding_total_usd: number;
  batch: string;
  industry: string;
  last_funding_date?: string;
  logo?: string;
}

interface TopFundedCompaniesViewProps {
  companies: Company[];
  onCompanyClick: (companyId: number) => void;
}

type SortOption = 'funding' | 'name' | 'batch';

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(2)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  return `$${(amount / 1_000).toFixed(0)}K`;
}

function getLogoUrl(rawUrl: string): string {
  if (!rawUrl?.startsWith('http')) return rawUrl;
  const raw = import.meta.env.VITE_API_URL || '';
  const base = raw.startsWith('http') ? raw.replace(/\/$/, '') : (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/api/logo-proxy?url=${encodeURIComponent(rawUrl)}`;
}

function CompanyLogo({ company }: { company: Company }) {
  const [logoError, setLogoError] = useState(false);

  return (
    <div className="w-12 h-12 rounded-lg bg-white border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
      {company.logo && !logoError ? (
        <img
          src={getLogoUrl(company.logo)}
          alt={company.name}
          className="w-full h-full object-contain p-1"
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setLogoError(true)}
        />
      ) : (
        <span className="text-lg font-bold text-[#FB651E]">
          {company.name.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}

export function TopFundedCompaniesView({ companies, onCompanyClick }: TopFundedCompaniesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('funding');

  // Filter by search
  const filteredCompanies = useMemo(() => {
    if (!searchQuery.trim()) return companies;

    const query = searchQuery.toLowerCase();
    return companies.filter((company) =>
      company.name.toLowerCase().includes(query) ||
      company.industry?.toLowerCase().includes(query) ||
      company.batch?.toLowerCase().includes(query)
    );
  }, [companies, searchQuery]);

  // Sort
  const sortedCompanies = useMemo(() => {
    const sorted = [...filteredCompanies];

    switch (sortBy) {
      case 'funding':
        return sorted.sort((a, b) => b.funding_total_usd - a.funding_total_usd);
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'batch':
        return sorted.sort((a, b) => b.batch.localeCompare(a.batch));
      default:
        return sorted;
    }
  }, [filteredCompanies, sortBy]);

  // Calculate summary stats
  const totalFunding = useMemo(() => {
    return companies.reduce((sum, c) => sum + c.funding_total_usd, 0);
  }, [companies]);

  const avgFunding = useMemo(() => {
    return companies.length > 0 ? totalFunding / companies.length : 0;
  }, [companies.length, totalFunding]);

  const topCompany = useMemo(() => {
    return companies.length > 0
      ? companies.reduce((max, c) => (c.funding_total_usd > max.funding_total_usd ? c : max))
      : null;
  }, [companies]);

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-4 w-4 text-emerald-500" />
            <span className="text-xs text-muted-foreground uppercase tracking-wide font-mono">Total Funding</span>
          </div>
          <div className="text-3xl font-bold font-mono text-emerald-500">
            {formatCurrency(totalFunding)}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-muted-foreground uppercase tracking-wide font-mono">Average Funding</span>
          </div>
          <div className="text-3xl font-bold font-mono text-blue-500">
            {formatCurrency(avgFunding)}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-[#FB651E]" />
            <span className="text-xs text-muted-foreground uppercase tracking-wide font-mono">Top Company</span>
          </div>
          <div className="text-xl font-bold font-mono text-[#FB651E] truncate">
            {topCompany?.name || 'N/A'}
          </div>
        </div>
      </motion.div>

      {/* Search & Sort Controls */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-3"
      >
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search companies, industries, or batches..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 font-mono"
          />
        </div>

        <div className="flex gap-2">
          <Button
            variant={sortBy === 'funding' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('funding')}
            className={sortBy === 'funding' ? 'bg-[#FB651E] hover:bg-[#E65C00]' : ''}
          >
            <DollarSign className="h-4 w-4 mr-1" />
            Funding
          </Button>
          <Button
            variant={sortBy === 'batch' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('batch')}
            className={sortBy === 'batch' ? 'bg-[#FB651E] hover:bg-[#E65C00]' : ''}
          >
            <Calendar className="h-4 w-4 mr-1" />
            Batch
          </Button>
          <Button
            variant={sortBy === 'name' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('name')}
            className={sortBy === 'name' ? 'bg-[#FB651E] hover:bg-[#E65C00]' : ''}
          >
            <Building2 className="h-4 w-4 mr-1" />
            Name
          </Button>
        </div>
      </motion.div>

      {/* Companies List */}
      {sortedCompanies.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <div className="text-muted-foreground font-mono mb-2">
            No companies found matching "{searchQuery}"
          </div>
          <Button
            variant="outline"
            onClick={() => setSearchQuery('')}
            className="mt-4"
          >
            Clear Search
          </Button>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          {sortedCompanies.map((company, index) => (
            <motion.div
              key={company.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
            >
              <HackerCard
                glowColor="orange"
                className="p-4 cursor-pointer hover:border-[#FB651E]/60 transition-all"
                onClick={() => onCompanyClick(company.id)}
              >
                <div className="flex items-center justify-between gap-4">
                  {/* Rank & Logo */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`
                        w-12 h-12 flex items-center justify-center font-bold font-mono rounded-lg flex-shrink-0
                        ${index === 0 ? 'bg-yellow-500/20 text-yellow-500 text-xl' : ''}
                        ${index === 1 ? 'bg-gray-400/20 text-gray-400 text-lg' : ''}
                        ${index === 2 ? 'bg-orange-600/20 text-orange-600 text-lg' : ''}
                        ${index > 2 ? 'bg-muted text-muted-foreground' : ''}
                      `}
                    >
                      #{index + 1}
                    </div>

                    {/* Logo */}
                    <CompanyLogo company={company} />

                    {/* Company Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold font-mono text-foreground truncate">
                        {company.name}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
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
                        {company.last_funding_date && (
                          <>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground">
                              Last funded: {new Date(company.last_funding_date).getFullYear()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Funding Amount */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-2xl font-bold font-mono text-emerald-500">
                      {formatCurrency(company.funding_total_usd)}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono mt-1">
                      Total Raised
                    </div>
                  </div>
                </div>
              </HackerCard>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Results count */}
      {searchQuery && sortedCompanies.length > 0 && (
        <div className="text-center text-sm text-muted-foreground font-mono">
          Showing {sortedCompanies.length} of {companies.length} companies
        </div>
      )}
    </div>
  );
}
