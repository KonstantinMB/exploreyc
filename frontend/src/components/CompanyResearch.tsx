import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Loader2, AlertCircle, ExternalLink, ChevronDown } from 'lucide-react';
import axios from 'axios';

interface CompanyResearchProps {
  companyName: string;
}

export function CompanyResearch({ companyName }: CompanyResearchProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [research, setResearch] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoadResearch = async () => {
    if (research) {
      setIsExpanded(!isExpanded);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const baseURL = apiUrl || window.location.origin;

      const response = await axios.post(`${baseURL}/api/research/company`, {
        company_name: companyName,
      });

      setResearch(response.data);
      setIsExpanded(true);
    } catch (err: any) {
      const message = err.response?.data?.detail || err.message || 'Failed to load research';
      setError(message);
      console.error('Research error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-500/10 dark:to-indigo-500/10 border-2 border-blue-200 dark:border-blue-500/30 rounded-xl p-6 shadow-md"
    >
      {/* Header */}
      <button
        onClick={handleLoadResearch}
        disabled={loading}
        className="w-full flex items-center justify-between hover:opacity-80 transition-opacity disabled:opacity-60"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
              Company Intelligence
              <span className="text-xs bg-blue-500/20 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-full font-mono">
                BETA
              </span>
            </h3>
            <p className="text-sm text-muted-foreground font-mono">
              {research ? 'Real-time research loaded' : 'Powered by Perplexity AI'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
          <ChevronDown
            className={`h-5 w-5 text-muted-foreground transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-4 border-t border-blue-200/50 dark:border-blue-500/20 pt-4"
          >
            {error ? (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-600 dark:text-red-400">Research Unavailable</p>
                  <p className="text-sm text-red-600/80 dark:text-red-400/80">{error}</p>
                </div>
              </div>
            ) : research ? (
              <div className="space-y-4">
                {/* Research Content */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-foreground">Latest Updates</h4>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
                      {research.research}
                    </div>
                  </div>
                </div>

                {/* Citations */}
                {research.citations && research.citations.length > 0 && (
                  <div className="border-t border-blue-200/50 dark:border-blue-500/20 pt-3">
                    <h4 className="font-semibold text-sm text-muted-foreground mb-2">Sources</h4>
                    <div className="space-y-1">
                      {research.citations.slice(0, 5).map((citation: string, idx: number) => (
                        <a
                          key={idx}
                          href={citation}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 hover:underline group"
                        >
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{citation}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="border-t border-blue-200/50 dark:border-blue-500/20 pt-3">
                  <p className="text-xs text-muted-foreground font-mono">
                    Updated: {new Date(research.timestamp).toLocaleDateString()} via {research.model}
                  </p>
                </div>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action State */}
      {!research && !isExpanded && (
        <div className="mt-4 pt-4 border-t border-blue-200/50 dark:border-blue-500/20">
          <p className="text-sm text-muted-foreground mb-3">
            Get real-time news, funding updates, and market intelligence for this company.
          </p>
          <button
            onClick={handleLoadResearch}
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading Research...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Load Company Intelligence
              </>
            )}
          </button>
        </div>
      )}
    </motion.div>
  );
}
