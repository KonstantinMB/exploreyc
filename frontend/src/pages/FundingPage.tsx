import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { TrendingUp, DollarSign, Building2, Users, Database, Share2, Twitter } from 'lucide-react';
import { apiClient } from '../lib/api';
import { TopInvestorsView } from '../components/funding/TopInvestorsView';
import { TopFundedCompaniesView } from '../components/funding/TopFundedCompaniesView';
import { FundingTimelineChart } from '../components/funding/FundingTimelineChart';
import { HackerCard } from '../components/ui/hacker-card';
import { DotPattern } from '../components/ui/dot-pattern';
import { GridPattern } from '../components/ui/grid-pattern';
import { CompanyDetailModal } from '../components/CompanyDetailModal';
import { Button } from '../components/ui/button';

export function FundingPage() {
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [minYear, setMinYear] = useState<number>(2020); // Filter: show companies from this year onwards (default 2020 for better performance)

  // Fetch funding stats
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['funding-stats'],
    queryFn: async () => {
      const response = await apiClient.getFundingStats();
      return response.data;
    },
    retry: false, // Don't retry if tables don't exist
  });

  // Fetch funding network
  const { data: network, isLoading: networkLoading } = useQuery({
    queryKey: ['funding-network'],
    queryFn: async () => {
      const response = await apiClient.getFundingNetwork();
      return response.data;
    },
  });

  // Fetch full company data when selected
  const { data: selectedCompany } = useQuery({
    queryKey: ['company', selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return null;
      const response = await apiClient.getCompany(selectedCompanyId);
      return response.data;
    },
    enabled: !!selectedCompanyId,
    retry: false,
  });

  // Filter network data by minimum year
  const filteredNetwork = useMemo(() => {
    if (!network) return null;

    const extractYear = (batch: string): number => {
      const match = batch.match(/\d{4}/);
      return match ? parseInt(match[0]) : 0;
    };

    const filteredCompanies = network.companies.filter((company) => {
      const year = extractYear(company.batch);
      return year >= minYear;
    });

    // Filter investors and connections based on filtered companies
    const companyIds = new Set(filteredCompanies.map(c => c.id));
    const filteredConnections = network.connections.filter(
      conn => companyIds.has(conn.company_id)
    );
    const investorIds = new Set(filteredConnections.map(c => c.investor_id));
    const filteredInvestors = network.investors.filter(
      inv => investorIds.has(inv.id)
    );

    return {
      companies: filteredCompanies,
      investors: filteredInvestors,
      connections: filteredConnections,
    };
  }, [network, minYear]);

  // Get available years for the filter
  const availableYears = useMemo(() => {
    if (!network?.companies?.length) return [];
    const years = network.companies.map(c => {
      const match = c.batch.match(/\d{4}/);
      return match ? parseInt(match[0]) : 0;
    }).filter(y => y > 0);
    const uniqueYears = Array.from(new Set(years)).sort();
    return uniqueYears;
  }, [network?.companies]);

  const handleCompanyClick = useCallback((companyId: number) => {
    setSelectedCompanyId(companyId);
  }, []);

  // Format large numbers
  const formatCurrency = (amount: number) => {
    if (amount >= 1_000_000_000) {
      return `$${(amount / 1_000_000_000).toFixed(2)}B`;
    }
    if (amount >= 1_000_000) {
      return `$${(amount / 1_000_000).toFixed(1)}M`;
    }
    return `$${(amount / 1_000).toFixed(0)}K`;
  };

  // Generate structured data for SEO
  const structuredData = useMemo(() => {
    if (!filteredNetwork?.companies.length || !stats) return null;

    const topCompanies = filteredNetwork.companies.slice(0, 10);

    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          'itemListElement': [
            {
              '@type': 'ListItem',
              'position': 1,
              'name': 'Home',
              'item': 'https://yc-explorer.com'
            },
            {
              '@type': 'ListItem',
              'position': 2,
              'name': 'Funding',
              'item': 'https://yc-explorer.com/funding'
            }
          ]
        },
        {
          '@type': 'ItemList',
          'name': 'Top YC Companies by Funding',
          'description': `Ranking of ${filteredNetwork.companies.length} Y Combinator startups by total funding raised`,
          'numberOfItems': filteredNetwork.companies.length,
          'itemListOrder': 'https://schema.org/ItemListOrderDescending',
          'itemListElement': topCompanies.map((company, index) => ({
            '@type': 'ListItem',
            'position': index + 1,
            'item': {
              '@type': 'Organization',
              'name': company.name,
              'url': `https://yc-explorer.com/company/${company.slug}`,
              'description': `${company.industry} company from ${company.batch}`,
              'foundingDate': company.batch,
              'slogan': company.industry
            }
          }))
        },
        {
          '@type': 'Dataset',
          'name': 'YC Company Funding Data',
          'description': 'Comprehensive funding data for Y Combinator portfolio companies',
          'url': 'https://yc-explorer.com/funding',
          'dateModified': new Date().toISOString(),
          'datePublished': '2024-01-01',
          'creator': {
            '@type': 'Organization',
            'name': 'YC Explorer'
          },
          'distribution': {
            '@type': 'DataDownload',
            'encodingFormat': 'application/json',
            'contentUrl': 'https://yc-explorer.com/api/funding/network'
          }
        }
      ]
    };
  }, [filteredNetwork, stats]);

  // Social share functions
  const shareToTwitter = useCallback(() => {
    if (!stats) return;
    const text = `Check out the top YC companies by funding! $${(stats.total_funding_usd / 1_000_000_000).toFixed(1)}B raised across ${stats.total_funded_companies} startups 🚀`;
    const url = 'https://yc-explorer.com/funding';
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
  }, [stats]);

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText('https://yc-explorer.com/funding');
    // Could add a toast notification here
  }, []);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.06,
        delayChildren: 0.1,
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
        {/* Primary Meta Tags */}
        <title>
          {filteredNetwork?.companies.length
            ? `Top ${filteredNetwork.companies.length} YC Companies by Funding (2025) | YC Explorer`
            : 'YC Startup Funding Leaderboard 2025 | Y Combinator Companies Ranked'
          }
        </title>
        <meta
          name="description"
          content={
            filteredNetwork?.companies.length && stats
              ? `Explore ${filteredNetwork.companies.length} YC-backed startups ranked by funding. Total: $${(stats.total_funding_usd / 1_000_000_000).toFixed(1)}B raised. Updated ${new Date().toLocaleDateString()}. See which Y Combinator companies raised the most.`
              : 'Complete ranking of Y Combinator startups by total funding raised. Explore 5000+ YC companies, investment data, and unicorns. Updated daily with latest funding rounds.'
          }
        />
        <meta name="keywords" content="YC funding, Y Combinator startups, startup funding leaderboard, YC companies ranked, venture capital, startup investment data, YC unicorns, tech startup funding" />
        <link rel="canonical" href="https://yc-explorer.com/funding" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://yc-explorer.com/funding" />
        <meta
          property="og:title"
          content={
            filteredNetwork?.companies.length
              ? `Top ${filteredNetwork.companies.length} YC Companies by Funding 💰`
              : 'YC Startup Funding Leaderboard - Y Combinator Rankings'
          }
        />
        <meta
          property="og:description"
          content={
            stats
              ? `$${(stats.total_funding_usd / 1_000_000_000).toFixed(1)}B raised across ${stats.total_funded_companies} YC startups. See the complete ranking!`
              : 'Discover which Y Combinator startups raised the most funding. Complete leaderboard updated daily.'
          }
        />
        <meta property="og:image" content="https://yc-explorer.com/og-funding.png" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://yc-explorer.com/funding" />
        <meta
          name="twitter:title"
          content={
            filteredNetwork?.companies.length
              ? `Top ${filteredNetwork.companies.length} YC Companies by Funding 💰`
              : 'YC Startup Funding Leaderboard'
          }
        />
        <meta
          name="twitter:description"
          content={
            stats
              ? `$${(stats.total_funding_usd / 1_000_000_000).toFixed(1)}B raised. See the full ranking →`
              : 'Complete ranking of Y Combinator startups by funding.'
          }
        />
        <meta name="twitter:image" content="https://yc-explorer.com/og-funding.png" />

        {/* Additional SEO */}
        <meta name="author" content="YC Explorer" />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <meta name="googlebot" content="index, follow" />

        {/* Structured Data for Rich Snippets */}
        {structuredData && (
          <script type="application/ld+json">
            {JSON.stringify(structuredData)}
          </script>
        )}
      </Helmet>

      <div className="relative min-h-screen bg-background pb-24">
        {/* Background patterns */}
        <DotPattern color="hsl(var(--primary) / 0.15)" size={24} radius={0.5} />
        <GridPattern size={32} className="opacity-50" />

        {/* Content */}
        <div className="relative z-10 container mx-auto px-4 py-8">
          {/* Terminal Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-2 mb-4 font-mono text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span>$ analyze --funding --network --interactive</span>
            </div>
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
              <div className="flex-1">
                <h1 className="text-3xl md:text-4xl font-bold mb-2 font-mono">
                  <span className="text-emerald-500">&gt;</span>{' '}
                  <span className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                    YC Funding Leaderboard
                  </span>
                </h1>
                <p className="text-muted-foreground font-mono text-sm">
                  {filteredNetwork?.companies.length
                    ? `${filteredNetwork.companies.length} Y Combinator startups ranked by total funding`
                    : 'Interactive visualization of YC portfolio funding and investor connections'
                  }
                </p>
              </div>

              {/* Social Share Buttons */}
              {stats && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={shareToTwitter}
                    className="gap-2 font-mono"
                  >
                    <Twitter className="h-4 w-4" />
                    Share
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyLink}
                    className="gap-2 font-mono"
                  >
                    <Share2 className="h-4 w-4" />
                    Copy Link
                  </Button>
                </div>
              )}
            </div>

            {/* Freshness Indicator */}
            {filteredNetwork?.companies.length && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-xs font-mono text-emerald-500">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Updated {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            )}
          </motion.div>

          {/* Setup Required Message */}
          {!statsLoading && (!stats || statsError) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <HackerCard glowColor="orange" className="p-8">
                <div className="text-center max-w-2xl mx-auto">
                  <div className="text-6xl mb-6">🚀</div>
                  <h2 className="text-2xl font-bold font-mono mb-4 text-[#FB651E]">
                    Setup Required
                  </h2>
                  <p className="text-muted-foreground font-mono mb-6">
                    The funding feature requires database migrations to be run.
                  </p>
                  <div className="bg-card/50 border border-border rounded-lg p-6 text-left">
                    <div className="font-mono text-sm space-y-3">
                      <div className="flex items-start gap-3">
                        <span className="text-emerald-500">1.</span>
                        <div>
                          <strong className="text-foreground">Run Migration</strong>
                          <div className="text-muted-foreground mt-1">
                            Go to Supabase Dashboard → SQL Editor and run the funding data migration
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="text-emerald-500">2.</span>
                        <div>
                          <strong className="text-foreground">Add Mock Data (Optional)</strong>
                          <div className="text-muted-foreground mt-1">
                            Test the UI immediately with sample data
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="text-emerald-500">3.</span>
                        <div>
                          <strong className="text-foreground">Connect Coresignal (Later)</strong>
                          <div className="text-muted-foreground mt-1">
                            Add your Coresignal API key to fetch real funding data
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-6 pt-6 border-t border-border">
                      <div className="text-xs text-muted-foreground font-mono">
                        📄 See{' '}
                        <code className="bg-muted px-2 py-1 rounded text-emerald-500">
                          SETUP_FUNDING.md
                        </code>{' '}
                        in the repository for detailed instructions
                      </div>
                    </div>
                  </div>
                </div>
              </HackerCard>
            </motion.div>
          )}

          {/* Quick Stats Grid */}
          {!statsLoading && stats && (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
            >
              <motion.div variants={itemVariants}>
                <HackerCard glowColor="green" className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-emerald-500/10 rounded">
                      <DollarSign className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-mono text-muted-foreground mb-1">
                        TOTAL_RAISED:
                      </div>
                      <div className="text-2xl font-bold font-mono text-emerald-500 tabular-nums">
                        {formatCurrency(stats.total_funding_usd)}
                      </div>
                    </div>
                  </div>
                </HackerCard>
              </motion.div>

              <motion.div variants={itemVariants}>
                <HackerCard glowColor="orange" className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-[#FB651E]/10 rounded">
                      <Building2 className="h-5 w-5 text-[#FB651E]" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-mono text-muted-foreground mb-1">
                        FUNDED_COMPANIES:
                      </div>
                      <div className="text-2xl font-bold font-mono text-[#FB651E] tabular-nums">
                        {stats.total_funded_companies.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </HackerCard>
              </motion.div>

              <motion.div variants={itemVariants}>
                <HackerCard glowColor="blue" className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-500/10 rounded">
                      <TrendingUp className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-mono text-muted-foreground mb-1">
                        AVG_FUNDING:
                      </div>
                      <div className="text-2xl font-bold font-mono text-blue-500 tabular-nums">
                        {formatCurrency(stats.avg_funding_per_company)}
                      </div>
                    </div>
                  </div>
                </HackerCard>
              </motion.div>

              <motion.div variants={itemVariants}>
                <HackerCard glowColor="purple" className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-violet-500/10 rounded">
                      <Users className="h-5 w-5 text-violet-500" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-mono text-muted-foreground mb-1">
                        UNICORNS:
                      </div>
                      <div className="text-2xl font-bold font-mono text-violet-500 tabular-nums">
                        {stats.top_funded_companies.filter(c => c.valuation_usd && c.valuation_usd >= 1_000_000_000).length}
                      </div>
                    </div>
                  </div>
                </HackerCard>
              </motion.div>
            </motion.div>
          )}

          {/* Year Filter */}
          {!networkLoading && network && availableYears.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="mb-6"
            >
              <HackerCard glowColor="blue" className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5 text-blue-500" />
                    <div>
                      <div className="text-sm font-mono font-medium">Filter by Year</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        Showing companies from {minYear} onwards • {filteredNetwork?.companies.length || 0} companies
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min={availableYears[0]}
                      max={availableYears[availableYears.length - 1]}
                      value={minYear}
                      onChange={(e) => setMinYear(parseInt(e.target.value))}
                      className="w-48 accent-blue-500"
                    />
                    <select
                      value={minYear}
                      onChange={(e) => setMinYear(parseInt(e.target.value))}
                      className="px-3 py-1.5 bg-background border border-border rounded font-mono text-sm"
                    >
                      {availableYears.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </HackerCard>
            </motion.div>
          )}

          {/* Funding Timeline Chart */}
          {!networkLoading && filteredNetwork && filteredNetwork.companies.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mb-8"
            >
              <HackerCard glowColor="orange" className="p-6">
                <FundingTimelineChart companies={filteredNetwork.companies} />
              </HackerCard>
            </motion.div>
          )}

          {/* Funding Visualization */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="relative"
          >
            {networkLoading ? (
              <div className="flex items-center justify-center py-24">
                <div className="text-center font-mono">
                  <div className="text-lg text-muted-foreground mb-2">
                    $ loading funding data...
                  </div>
                  <div className="animate-pulse text-emerald-500">
                    ████████████
                  </div>
                </div>
              </div>
            ) : filteredNetwork ? (
              <>
                {/* Show Top Investors if we have investor data */}
                {filteredNetwork.investors.length > 0 ? (
                  <TopInvestorsView
                    investors={filteredNetwork.investors}
                    companies={filteredNetwork.companies}
                    connections={filteredNetwork.connections}
                    onCompanyClick={handleCompanyClick}
                  />
                ) : filteredNetwork.companies.length > 0 ? (
                  /* Fallback: Show Top Funded Companies if no investors but have companies */
                  <>
                    <TopFundedCompaniesView
                      companies={filteredNetwork.companies}
                      onCompanyClick={handleCompanyClick}
                    />
                    <div className="mt-6 p-2.5 bg-blue-500/10 border border-blue-500/30 rounded text-center">
                      <p className="text-[11px] text-muted-foreground font-mono leading-relaxed">
                        💡 Data for {filteredNetwork.companies.length} YC startups only - analytics don't factor in all YC companies yet. Data acquisition for remaining companies is in progress.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center py-24">
                    <div className="text-center font-mono text-muted-foreground">
                      <div className="text-lg mb-2">No funding data available</div>
                      <div className="text-sm">
                        Run enrichment to populate funding data
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center py-24">
                <div className="text-center font-mono text-muted-foreground">
                  <div className="text-lg mb-2">No funding data available</div>
                  <div className="text-sm">
                    Run enrichment to populate funding data
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Company Detail Modal */}
        {selectedCompanyId && selectedCompany && (
          <CompanyDetailModal
            company={selectedCompany}
            open={true}
            onClose={() => setSelectedCompanyId(null)}
            showViewFullPage
          />
        )}
      </div>
    </>
  );
}
