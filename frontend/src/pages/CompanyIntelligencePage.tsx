import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, Zap, AlertCircle, Search, Loader2 } from 'lucide-react';
import axios from 'axios';
import { parseIntelligence } from '../lib/intelligenceParser';
import type { ParsedIntelligence } from '../lib/intelligenceParser';
import { EnhancedLoadingState } from '../components/intelligence/EnhancedLoadingState';
import { SourcesAccordion } from '../components/intelligence/SourcesAccordion';
import { HeroSection } from '../components/intelligence/HeroSection';
import { MetricsGrid } from '../components/intelligence/MetricsGrid';
import { CompanyOverviewGrid } from '../components/intelligence/CompanyOverviewGrid';
import { FundingRoundsSection } from '../components/intelligence/FundingRoundsSection';
import { StatisticsSection } from '../components/intelligence/StatisticsSection';
import { LeadershipSection } from '../components/intelligence/LeadershipSection';
import { ProductMarketSection } from '../components/intelligence/ProductMarketSection';
import { TimelineSection } from '../components/intelligence/TimelineSection';

interface ResearchResult {
  company_name?: string;
  research?: string;
  citations?: string[];
  timestamp?: string;
  model?: string;
  success: boolean;
  error?: string;
}

export function CompanyIntelligencePage() {
  const [searchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(() => {
    const qParam = searchParams.get('q');
    return qParam ? decodeURIComponent(qParam) : '';
  });
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [parsedIntelligence, setParsedIntelligence] = useState<ParsedIntelligence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Auto-search if q parameter is provided
  useEffect(() => {
    const qParam = searchParams.get('q');
    if (qParam && !hasSearched) {
      setSearchInput(decodeURIComponent(qParam));
      // Trigger search programmatically
      performSearch(decodeURIComponent(qParam));
    }
  }, [searchParams]);

  const performSearch = async (companyName: string) => {
    if (!companyName.trim()) {
      setError('Please enter a company name');
      return;
    }

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const baseURL = apiUrl || window.location.origin;

      const response = await axios.post(`${baseURL}/api/research/company`, {
        company_name: companyName,
      });

      if (response.data.success) {
        setResult(response.data);
        // Parse the research into structured intelligence
        const parsed = parseIntelligence(
          response.data.company_name || companyName,
          response.data.research || '',
          response.data.timestamp || new Date().toISOString()
        );
        setParsedIntelligence(parsed);
      } else {
        setError(response.data.error || 'Failed to research company');
        setResult(null);
        setParsedIntelligence(null);
      }
    } catch (err: any) {
      const message = err.response?.data?.detail || err.message || 'Failed to research company';
      setError(message);
      setResult(null);
      console.error('Research error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchInput);
  };

  return (
    <div className="min-h-screen bg-background pt-12 md:pt-0">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Navigation buttons */}
        <div className="flex items-center gap-4 mb-8">
          <a
            href="/tools"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-[#FB651E] font-mono transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Tools
          </a>
          <a
            href="/research-hub"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-purple-600 font-mono transition-colors"
          >
            Explore Hub →
          </a>
        </div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Zap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Company Intelligence</h1>
          </div>
          <p className="text-sm text-muted-foreground font-mono">
            Get real-time research, news, and market intelligence for any YC company
          </p>
        </motion.div>

        {/* Search Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search for a company (e.g. OpenAI, Stripe, Figma)"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-3 rounded-lg border-2 border-border bg-background text-lg placeholder:text-muted-foreground focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-blue-600 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Search className="h-5 w-5" />
                )}
              </button>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Researching...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Get Intelligence
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>

        {/* Error Message */}
        {error && hasSearched && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-6 p-6 rounded-lg border flex items-start gap-3 ${
              error.includes('Rate limit')
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400'
            }`}
          >
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold mb-2">
                {error.includes('Rate limit') ? 'Rate Limit Reached' : 'Research Unavailable'}
              </p>
              <p className="text-sm mb-4">{error}</p>
              {error.includes('Rate limit') && (
                <a
                  href="/research-hub"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-sm transition-colors"
                >
                  Explore Other Research →
                </a>
              )}
            </div>
          </motion.div>
        )}

        {/* Results - Professional Dashboard Style */}
        {hasSearched && !error && result && parsedIntelligence && (
          <motion.div className="space-y-8 pb-12">
            {/* Hero Section */}
            <HeroSection
              companyName={parsedIntelligence.companyName}
              description={parsedIntelligence.summary}
              lastUpdated={parsedIntelligence.lastUpdated}
            />

            {/* Key Metrics Grid */}
            {parsedIntelligence.metrics.length > 0 && (
              <MetricsGrid metrics={parsedIntelligence.metrics.slice(0, 4)} />
            )}

            {/* Company Overview Grid */}
            <CompanyOverviewGrid
              description={parsedIntelligence.summary}
            />

            {/* Funding Rounds */}
            <FundingRoundsSection />

            {/* Statistics */}
            {parsedIntelligence.metrics.length > 0 && (
              <StatisticsSection
                statistics={parsedIntelligence.metrics.map((m) => ({
                  label: m.label,
                  value: String(m.value),
                  isPublic: !String(m.value).toLowerCase().includes('not') && !!m.value,
                }))}
              />
            )}

            {/* Leadership */}
            {parsedIntelligence.sections.some((s) => s.type === 'leadership') && (
              <LeadershipSection />
            )}

            {/* Product & Market */}
            {parsedIntelligence.sections.length > 0 && (
              <ProductMarketSection
                sections={parsedIntelligence.sections
                  .filter((s) => s.type !== 'leadership')
                  .map((s) => ({
                    title: s.title,
                    content: s.content,
                  }))}
              />
            )}

            {/* Timeline */}
            {parsedIntelligence.timeline.length > 0 && (
              <TimelineSection
                events={parsedIntelligence.timeline.map((t) => ({
                  date: t.date,
                  title: t.title,
                  description: t.description,
                }))}
              />
            )}

            {/* Sources */}
            {result.citations && result.citations.length > 0 && (
              <SourcesAccordion citations={result.citations} />
            )}

            {/* CTA: Search Another */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="text-center py-8"
            >
              <button
                onClick={() => {
                  setSearchInput('');
                  setResult(null);
                  setParsedIntelligence(null);
                  setError(null);
                  setHasSearched(false);
                }}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-blue-200 dark:border-blue-500/30 hover:bg-blue-50 dark:hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold transition-colors"
              >
                ← Search Another Company
              </button>
            </motion.div>
          </motion.div>
        )}

        {/* Empty State */}
        {!hasSearched && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-500/10 dark:to-indigo-500/10 border-2 border-blue-200 dark:border-blue-500/30 rounded-xl p-8">
              <h3 className="text-lg font-bold text-foreground mb-4">How It Works</h3>
              <ul className="space-y-3">
                {[
                  {
                    title: 'Real-Time Research',
                    description:
                      'Get the latest news, funding updates, and market intelligence powered by Perplexity AI',
                  },
                  {
                    title: 'Web Search Integration',
                    description:
                      'Access current information from across the web with cited sources',
                  },
                  {
                    title: 'Company Profiles',
                    description:
                      'Understand key developments, leadership changes, and strategic positioning',
                  },
                  {
                    title: 'Competitive Intelligence',
                    description: 'Compare companies and understand market dynamics in real-time',
                  },
                ].map((item, idx) => (
                  <li key={idx} className="flex gap-3">
                    <div className="flex-shrink-0 mt-1">
                      <div className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-600 text-white text-sm font-bold">
                        {idx + 1}
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {['OpenAI', 'Stripe', 'Figma', 'Anthropic'].map((company) => (
                <button
                  key={company}
                  onClick={() => setSearchInput(company)}
                  className="p-3 border border-border rounded-lg hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors text-left"
                >
                  <p className="font-mono text-sm text-muted-foreground">Try searching:</p>
                  <p className="font-semibold text-foreground">{company}</p>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Loading State */}
        {loading && <EnhancedLoadingState companyName={searchInput} />}
      </div>
    </div>
  );
}
