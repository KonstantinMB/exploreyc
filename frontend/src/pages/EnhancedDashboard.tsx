import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '../components/Header';
import { StatsCards } from '../components/StatsCards';
import { AdvancedAnalytics } from '../components/AdvancedAnalytics';
import { CompaniesBrowser } from '../components/CompaniesBrowser';
import { OptimizedMap } from '../components/OptimizedMap';
import { CompanyDetailModal } from '../components/CompanyDetailModal';
import { LoadingScreen } from '../components/LoadingScreen';
import { CommandPalette } from '../components/CommandPalette';
import { PaulGrahamEssays } from '../components/PaulGrahamEssays';
import { ProductRoadmap } from '../components/ProductRoadmap';
import { EmailSubscription } from '../components/EmailSubscription';
import {
  AnalyticsChartSVG,
  DataInsightsSVG,
  MapLocationSVG,
  CompanyGridSVG,
  YCHeroBanner
} from '../components/illustrations/CustomSVGs';
import { useApp } from '../contexts/AppContext';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { getSecondMostRecentBatch, batchToShortFormat } from '../lib/batchUtils';

export function EnhancedDashboard() {
  const { stats, loading, error, refreshData, selectedCompany, setSelectedCompany, loadingProgress, loadingTotal } = useApp();
  const [isDark, setIsDark] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useKeyboardShortcuts(() => setCommandPaletteOpen(true));

  // Second-most recent batch (latest may not have started yet)
  const wrappedBatch = getSecondMostRecentBatch(stats?.by_batch);

  const topCountry = stats?.by_country
    ? Object.entries(stats.by_country).sort(([, a], [, b]) => b - a)[0]
    : undefined;

  const handleThemeToggle = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          className="text-center max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mb-6">
            <img src="/yc-logo.png" alt="YC" className="h-16 w-16 mx-auto opacity-80" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Having trouble connecting</h2>
          <p className="text-muted-foreground text-sm mb-6">{error}</p>
          <button
            onClick={() => refreshData()}
            className="px-6 py-3 bg-[#FB651E] text-white rounded-lg hover:bg-[#E65C00] font-medium transition-colors"
          >
            Try again
          </button>
          <p className="mt-6 text-xs text-muted-foreground">
            If this keeps happening, check your connection or try again later.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Loading Screen - YC branded */}
      <AnimatePresence>
        {loading && !stats && (
          <LoadingScreen
            progress={loadingProgress}
            total={loadingTotal}
          />
        )}
      </AnimatePresence>

      {/* Command Palette */}
      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />

      {/* Header */}
      <Header
        onThemeToggle={handleThemeToggle}
        isDark={isDark}
        onCommandPalette={() => setCommandPaletteOpen(true)}
      />

      {/* Main Content - pt compensates for fixed header (~7rem) */}
      <main className="container mx-auto px-3 sm:px-4 pt-28 pb-4 sm:pb-8 max-w-7xl">
        {/* Loading State */}
        {loading && !stats ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-muted animate-pulse rounded-lg"></div>
              ))}
            </div>
            <div className="h-96 bg-muted animate-pulse rounded-lg"></div>
          </div>
        ) : (
          <>
            {/* Scraper Panel */}
            {/* Stats Cards */}

            {/* Interactive World Map - at top */}
            <motion.section
              id="map"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-8 sm:mb-12"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                <MapLocationSVG className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0" />
                <div className="min-w-0">
                  <h2 className="text-xl sm:text-2xl font-bold">Interactive World Map</h2>
                  <p className="text-sm text-muted-foreground font-mono">
                    Discover YC companies around the globe with company logos
                  </p>
                </div>
              </div>

              {/* Info banner: Check startup against YC - moved above map */}
              <a
                href="/validator"
                className="mb-4 block rounded-lg border border-[#FB651E]/30 bg-[#FB651E]/5 hover:bg-[#FB651E]/10 hover:border-[#FB651E]/50 transition-all p-4 sm:p-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="p-2 bg-[#FB651E]/20 rounded-lg">
                      <svg className="w-6 h-6 text-[#FB651E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">
                      Check your startup against {(stats?.total_companies ?? 5773).toLocaleString()} YC companies
                    </h3>
                      <p className="text-sm text-muted-foreground font-mono mt-0.5">
                        See if similar ideas exist, get a market signal, and find your space — free.
                      </p>
                    </div>
                  </div>
                  <span className="text-sm text-[#FB651E] font-mono font-medium sm:ml-auto">
                    Validate your idea →
                  </span>
                </div>
              </a>

              <OptimizedMap />
            </motion.section>

            {stats && (
              <StatsCards
                totalCompanies={stats.total_companies}
                hiring={stats.hiring}
                topBatch={wrappedBatch ? { batch: wrappedBatch.name, count: wrappedBatch.count } : undefined}
                topCountry={topCountry ? { country: topCountry[0], count: topCountry[1] } : undefined}
              />
            )}

            {/* Hero Banner */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
              className="my-8 rounded-lg overflow-hidden shadow-lg"
            >
              <YCHeroBanner className="w-full h-40 md:h-48" />
            </motion.div>

            {/* Batch Wrapped Banner */}
            {wrappedBatch && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.4 }}
                className="mb-8"
              >
                <a
                  href={`/batch/${batchToShortFormat(wrappedBatch.name)}/wrapped`}
                  className="block rounded-xl border border-[#FB651E]/20 bg-[#FB651E]/5 hover:bg-[#FB651E]/10 hover:border-[#FB651E]/40 transition-all p-6 sm:p-8 group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="w-14 h-14 bg-[#FB651E] rounded-xl flex items-center justify-center">
                        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                          {wrappedBatch.name} Wrapped
                          <span className="px-2 py-0.5 bg-green-600/20 text-green-600 dark:text-green-400 rounded text-xs font-mono">
                            NEW
                          </span>
                        </h3>
                        <p className="text-sm text-muted-foreground font-mono mt-1">
                          Spotify-style stats for {wrappedBatch.count.toLocaleString()} companies • Share on Twitter
                        </p>
                      </div>
                    </div>
                    <span className="text-sm text-[#FB651E] font-mono font-semibold sm:ml-auto whitespace-nowrap flex items-center gap-1 group-hover:gap-2 transition-all">
                      View Wrapped
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </span>
                  </div>
                </a>
              </motion.section>
            )}

            {/* All Sections on Single Page */}
            <div className="space-y-12 mt-8">
              {/* Analytics Section */}
              <motion.section
                id="analytics"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                  <AnalyticsChartSVG className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0" />
                  <div className="min-w-0">
                    <h2 className="text-xl sm:text-2xl font-bold">Analytics Dashboard</h2>
                    <p className="text-sm text-muted-foreground font-mono">
                      Explore YC batch trends, industries, and geographic distribution
                    </p>
                  </div>
                </div>
                {stats && <AdvancedAnalytics stats={stats} />}
              </motion.section>

              {/* Insights Section */}
              <motion.section
                id="insights"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                  <DataInsightsSVG className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0" />
                  <div className="min-w-0">
                    <h2 className="text-xl sm:text-2xl font-bold">For Founders</h2>
                    <p className="text-sm text-muted-foreground font-mono">
                      Paul Graham essays and daily YC updates
                    </p>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <PaulGrahamEssays />
                    <EmailSubscription />
                  </div>

                  {stats && (
                    <div className="bg-muted/50 rounded-lg p-6 font-mono text-sm">
                      <h3 className="font-bold mb-4 text-[#FB651E]">YC Database Insights</h3>
                      <p className="text-muted-foreground mb-4">
                        Comprehensive data on {(stats.total_companies ?? 0).toLocaleString()} Y Combinator companies across {Object.keys(stats.by_batch || {}).length} batches
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                        <div>
                          <div className="text-muted-foreground">Total Companies</div>
                          <div className="text-2xl font-bold">{(stats.total_companies ?? 0).toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Currently Hiring</div>
                          <div className="text-2xl font-bold text-green-600">{(stats.hiring ?? 0).toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Total Batches</div>
                          <div className="text-2xl font-bold">{Object.keys(stats.by_batch).length}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Countries</div>
                          <div className="text-2xl font-bold">{Object.keys(stats.by_country).length}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.section>

              {/* Companies Section */}
              <motion.section
                id="companies"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                  <CompanyGridSVG className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0" />
                  <div className="min-w-0">
                    <h2 className="text-xl sm:text-2xl font-bold">Browse All Companies</h2>
                    <p className="text-sm text-muted-foreground font-mono">
                      Search, filter, and explore {(stats?.total_companies ?? 5772).toLocaleString()} YC startups
                    </p>
                  </div>
                </div>
                <CompaniesBrowser refreshTrigger={stats?.total_companies || 0} />
              </motion.section>

              {/* Product Roadmap Section */}
              <ProductRoadmap />
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-12 sm:mt-16 py-6 sm:py-8 bg-muted/30">
        <div className="container mx-auto px-3 sm:px-4 max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <img src="/yc-logo.png" alt="YC" className="h-6 w-6 object-contain" />
                YC Company Explorer
              </h3>
              <p className="text-sm text-muted-foreground">
                Explore and analyze Y Combinator startups with interactive maps, advanced analytics, and real-time data.
              </p>
            </div>

            <div>
              <h3 className="font-bold mb-3">Quick Stats</h3>
              <div className="text-sm text-muted-foreground space-y-1 font-mono">
                <div>{(stats?.total_companies ?? 0).toLocaleString()} companies indexed</div>
                <div>{(stats?.hiring ?? 0).toLocaleString()} currently hiring</div>
                <div>{Object.keys(stats?.by_country || {}).length} countries represented</div>
              </div>
            </div>

          </div>

          <div className="mt-8 pt-6 border-t text-center text-sm text-muted-foreground">
            <p>
              Data from{' '}
              <a
                href="https://www.ycombinator.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#FB651E] hover:underline"
              >
                Y Combinator
              </a>
              {' '} • Made for developers and founders
            </p>
          </div>
        </div>
      </footer>

      {/* Company Detail Modal */}
      <CompanyDetailModal
        company={selectedCompany}
        open={!!selectedCompany}
        onClose={() => setSelectedCompany(null)}
      />
    </div>
  );
}
