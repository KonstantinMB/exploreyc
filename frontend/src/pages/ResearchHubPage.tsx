import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft, Search, TrendingUp, Clock, Eye, Zap, Loader2, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { HackerCard } from '../components/ui/hacker-card';

interface ResearchItem {
  id: number;
  query: string;
  query_type: string;
  response_data: any;
  view_count: number;
  search_count: number;
  created_at: string;
  updated_at: string;
}

export function ResearchHubPage() {
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch research history
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['research-history', sortBy],
    queryFn: async () => {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const baseURL = apiUrl || window.location.origin;

      const response = await axios.get(`${baseURL}/api/research/history`, {
        params: { sort_by: sortBy, limit: 50 },
      });
      return response.data;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // Fetch search results if searching
  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ['research-search', debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch.trim()) return null;

      const apiUrl = import.meta.env.VITE_API_URL || '';
      const baseURL = apiUrl || window.location.origin;

      const response = await axios.post(`${baseURL}/api/research/search`, {
        query: debouncedSearch,
      });
      return response.data;
    },
    enabled: !!debouncedSearch.trim(),
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // Fetch popular research
  const { data: popularData } = useQuery({
    queryKey: ['research-popular'],
    queryFn: async () => {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const baseURL = apiUrl || window.location.origin;

      const response = await axios.get(`${baseURL}/api/research/popular`, {
        params: { limit: 8 },
      });
      return response.data;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const displayData = debouncedSearch.trim() ? searchData : historyData;
  const isLoading = debouncedSearch.trim() ? searchLoading : historyLoading;

  return (
    <>
      <Helmet>
        <title>Research Hub - Explore Company Intelligence</title>
        <meta name="description" content="Explore research on YC companies. Discover what others are researching." />
      </Helmet>

      <div className="min-h-screen bg-background pt-12 md:pt-0">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          {/* Back button */}
          <a
            href="/research"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-[#FB651E] font-mono mb-8 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Research
          </a>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Zap className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Research Hub</h1>
            </div>
            <p className="text-sm text-muted-foreground font-mono">
              Explore research from all users. Discover trending companies and insights.
            </p>
          </motion.div>

          {/* Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <div className="relative">
              <input
                type="text"
                placeholder="Search research by company name..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border-2 border-border bg-background text-lg placeholder:text-muted-foreground focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 transition-colors"
              />
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
            </div>
          </motion.div>

          {/* Popular Searches Sidebar */}
          {!searchInput && popularData?.results && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mb-8"
            >
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-600" />
                Trending Companies
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {popularData.results.slice(0, 8).map((item: ResearchItem) => (
                  <button
                    key={item.id}
                    onClick={() => setSearchInput(item.query)}
                    className="p-3 rounded-lg border border-border hover:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors text-left"
                  >
                    <p className="font-mono text-xs text-muted-foreground truncate">
                      {item.query}
                    </p>
                    <p className="text-xs font-mono text-purple-600 dark:text-purple-400 mt-1">
                      {item.view_count} views
                    </p>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Sort Options */}
          {!searchInput && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-6 flex gap-2"
            >
              <button
                onClick={() => setSortBy('recent')}
                className={`px-4 py-2 rounded-lg text-sm font-mono transition-colors ${
                  sortBy === 'recent'
                    ? 'bg-purple-600 text-white'
                    : 'border border-border hover:border-purple-600/50'
                }`}
              >
                <Clock className="inline h-3 w-3 mr-2" />
                Recent
              </button>
              <button
                onClick={() => setSortBy('popular')}
                className={`px-4 py-2 rounded-lg text-sm font-mono transition-colors ${
                  sortBy === 'popular'
                    ? 'bg-purple-600 text-white'
                    : 'border border-border hover:border-purple-600/50'
                }`}
              >
                <TrendingUp className="inline h-3 w-3 mr-2" />
                Popular
              </button>
            </motion.div>
          )}

          {/* Results */}
          {isLoading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12"
            >
              <Loader2 className="h-8 w-8 animate-spin text-purple-600 mb-4" />
              <p className="text-muted-foreground font-mono">
                {debouncedSearch.trim() ? 'Searching...' : 'Loading research...'}
              </p>
            </motion.div>
          ) : !displayData?.results || displayData.results.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-12"
            >
              <AlertCircle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">
                {debouncedSearch.trim()
                  ? 'No research found matching your search'
                  : 'No research data available yet'}
              </p>
            </motion.div>
          ) : (
            <motion.div
              variants={{
                hidden: { opacity: 0 },
                show: { opacity: 1, transition: { staggerChildren: 0.05 } },
              }}
              initial="hidden"
              animate="show"
              className="space-y-4"
            >
              {displayData.results.map((item: ResearchItem) => (
                <motion.div
                  key={item.id}
                  variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                  className="group"
                >
                  <HackerCard glowColor="purple" className="p-4 hover:border-purple-500/50 transition-all cursor-pointer">
                    <Link to={`/research?q=${encodeURIComponent(item.query)}`} className="block">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-bold text-foreground group-hover:text-purple-600 transition-colors mb-2">
                            {item.query}
                          </h3>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground font-mono">
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {item.view_count} views
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(item.updated_at).toLocaleDateString()}
                            </span>
                            <span className="inline-block px-2 py-1 rounded bg-purple-500/20 text-purple-600 dark:text-purple-400">
                              {item.query_type}
                            </span>
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <div className="text-2xl font-bold text-purple-600">
                            {item.view_count}
                          </div>
                          <div className="text-xs text-muted-foreground">views</div>
                        </div>
                      </div>
                    </Link>
                  </HackerCard>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* CTA */}
          {!debouncedSearch.trim() && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-12 text-center"
            >
              <Link
                to="/research"
                className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-mono transition-colors"
              >
                <Zap className="h-4 w-4" />
                Contribute Your Own Research
              </Link>
            </motion.div>
          )}
        </div>
      </div>
    </>
  );
}
