import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { StatsCards } from '../components/StatsCards';
import { StatsCharts } from '../components/StatsCharts';
import { ScraperPanel } from '../components/ScraperPanel';
import { CompaniesBrowser } from '../components/CompaniesBrowser';
import { CompanyMap } from '../components/CompanyMap';
import { apiClient } from '../lib/api';
import type { Stats } from '../lib/api';

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    loadStats();
  }, [refreshTrigger]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const response = await apiClient.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScrapeComplete = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const topBatch = stats?.by_batch
    ? Object.entries(stats.by_batch)
        .sort(([, a], [, b]) => b - a)[0]
    : undefined;

  const topCountry = stats?.by_country
    ? Object.entries(stats.by_country)
        .sort(([, a], [, b]) => b - a)[0]
    : undefined;

  return (
    <div className="min-h-screen bg-[#F6F6EF]">
      {/* Header */}
      <motion.header
        className="bg-[#FF6600] text-white shadow-md"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 100 }}
      >
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">YC Company Scraper</h1>
              <p className="text-sm opacity-90 mt-1">
                Explore and analyze Y Combinator startups
              </p>
            </div>

            <div className="flex gap-2" />
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Scraper Panel */}
        <div className="mb-8">
          <ScraperPanel onScrapeComplete={handleScrapeComplete} />
        </div>

        {/* Stats Cards */}
        {loading ? (
          <div className="text-center py-12">Loading statistics...</div>
        ) : stats ? (
          <>
            <StatsCards
              totalCompanies={stats.total_companies}
              hiring={stats.hiring}
              topBatch={topBatch ? { batch: topBatch[0], count: topBatch[1] } : undefined}
              topCountry={topCountry ? { country: topCountry[0], count: topCountry[1] } : undefined}
            />

            {/* Charts */}
            {stats.total_companies > 0 && (
              <StatsCharts
                byBatch={stats.by_batch}
                byIndustry={stats.by_industry}
                byCountry={stats.by_country}
              />
            )}
          </>
        ) : null}

        {/* Tabs for different views */}
        <Tabs defaultValue="companies" className="mt-8">
          <TabsList className="mb-4">
            <TabsTrigger value="companies">Companies</TabsTrigger>
            <TabsTrigger value="map">Map View</TabsTrigger>
          </TabsList>

          <TabsContent value="companies">
            <CompaniesBrowser refreshTrigger={refreshTrigger} />
          </TabsContent>

          <TabsContent value="map">
            <CompanyMap refreshTrigger={refreshTrigger} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12 py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>
            Built with React, TypeScript, Tailwind CSS, and FastAPI •{' '}
            <a
              href="https://www.ycombinator.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#FF6600] hover:underline"
            >
              Data from Y Combinator
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
