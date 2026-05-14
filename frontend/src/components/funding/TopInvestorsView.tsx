import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, TrendingDown, TrendingUp, Building2 } from 'lucide-react';
import { InvestorCard } from './InvestorCard';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

interface Company {
  id: number;
  name: string;
  slug: string;
  funding_total_usd: number;
  batch: string;
  industry: string;
  last_funding_date?: string;
}

interface Investor {
  id: number;
  name: string;
  investor_type?: string;
  portfolio_count: number;
}

interface Connection {
  company_id: number;
  investor_id: number;
  amount_usd?: number;
}

interface TopInvestorsViewProps {
  investors: Investor[];
  companies: Company[];
  connections: Connection[];
  onCompanyClick: (companyId: number) => void;
}

type SortOption = 'portfolio' | 'total' | 'avg';

export function TopInvestorsView({ investors, companies, connections, onCompanyClick }: TopInvestorsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('portfolio');

  // Build investor data with portfolio info
  const investorData = useMemo(() => {
    return investors.map((investor) => {
      // Get all connections for this investor
      const investorConnections = connections.filter((c) => c.investor_id === investor.id);

      // Get portfolio companies
      const portfolioCompanyIds = new Set(investorConnections.map((c) => c.company_id));
      const portfolioCompanies = companies.filter((c) => portfolioCompanyIds.has(c.id));

      // Calculate total invested (sum of company funding totals)
      const totalInvested = portfolioCompanies.reduce((sum, company) => sum + company.funding_total_usd, 0);

      return {
        investor,
        portfolioCompanies,
        totalInvested,
        avgInvestment: portfolioCompanies.length > 0 ? totalInvested / portfolioCompanies.length : 0,
      };
    });
  }, [investors, companies, connections]);

  // Filter by search
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return investorData;

    const query = searchQuery.toLowerCase();
    return investorData.filter((data) =>
      data.investor.name.toLowerCase().includes(query) ||
      data.portfolioCompanies.some((c) => c.name.toLowerCase().includes(query))
    );
  }, [investorData, searchQuery]);

  // Sort
  const sortedData = useMemo(() => {
    const sorted = [...filteredData];

    switch (sortBy) {
      case 'portfolio':
        return sorted.sort((a, b) => b.investor.portfolio_count - a.investor.portfolio_count);
      case 'total':
        return sorted.sort((a, b) => b.totalInvested - a.totalInvested);
      case 'avg':
        return sorted.sort((a, b) => b.avgInvestment - a.avgInvestment);
      default:
        return sorted;
    }
  }, [filteredData, sortBy]);

  // Calculate summary stats
  const totalCompaniesInvested = useMemo(() => {
    const uniqueCompanies = new Set(connections.map((c) => c.company_id));
    return uniqueCompanies.size;
  }, [connections]);

  const totalFundingAmount = useMemo(() => {
    return companies.reduce((sum, c) => sum + c.funding_total_usd, 0);
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
            <Building2 className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-muted-foreground uppercase tracking-wide font-mono">Active Investors</span>
          </div>
          <div className="text-3xl font-bold font-mono text-blue-500">
            {investors.length}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <span className="text-xs text-muted-foreground uppercase tracking-wide font-mono">Companies Funded</span>
          </div>
          <div className="text-3xl font-bold font-mono text-emerald-500">
            {totalCompaniesInvested}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-[#FB651E]" />
            <span className="text-xs text-muted-foreground uppercase tracking-wide font-mono">Total Funding</span>
          </div>
          <div className="text-2xl font-bold font-mono text-[#FB651E]">
            ${(totalFundingAmount / 1_000_000_000).toFixed(2)}B
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
            placeholder="Search investors or companies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 font-mono"
          />
        </div>

        <div className="flex gap-2">
          <Button
            variant={sortBy === 'portfolio' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('portfolio')}
            className={sortBy === 'portfolio' ? 'bg-[#FB651E] hover:bg-[#E65C00]' : ''}
          >
            <Building2 className="h-4 w-4 mr-1" />
            Portfolio
          </Button>
          <Button
            variant={sortBy === 'total' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('total')}
            className={sortBy === 'total' ? 'bg-[#FB651E] hover:bg-[#E65C00]' : ''}
          >
            <TrendingUp className="h-4 w-4 mr-1" />
            Total
          </Button>
          <Button
            variant={sortBy === 'avg' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('avg')}
            className={sortBy === 'avg' ? 'bg-[#FB651E] hover:bg-[#E65C00]' : ''}
          >
            <TrendingDown className="h-4 w-4 mr-1" />
            Avg
          </Button>
        </div>
      </motion.div>

      {/* Investors Grid */}
      {sortedData.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <div className="text-muted-foreground font-mono mb-2">
            No investors found matching "{searchQuery}"
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
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {sortedData.map((data) => (
            <InvestorCard
              key={data.investor.id}
              investor={data.investor}
              portfolioCompanies={data.portfolioCompanies}
              totalInvested={data.totalInvested}
              onCompanyClick={onCompanyClick}
            />
          ))}
        </motion.div>
      )}

      {/* Results count */}
      {searchQuery && sortedData.length > 0 && (
        <div className="text-center text-sm text-muted-foreground font-mono">
          Showing {sortedData.length} of {investorData.length} investors
        </div>
      )}
    </div>
  );
}
