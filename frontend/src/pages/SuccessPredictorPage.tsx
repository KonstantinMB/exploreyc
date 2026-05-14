import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { AppProvider } from '../contexts/AppContext';
import { AnnouncementBanner } from '../components/AnnouncementBanner';
import { PredictionForm } from '../components/gamification/PredictionForm';
import { ResultsCard } from '../components/gamification/ResultsCard';
import { MatchedCompanies } from '../components/gamification/MatchedCompanies';
import axios from 'axios';

interface PredictionResult {
  prediction_id: string;
  idea_score: number;
  team_score?: number;
  market_score: number;
  combined_score: number;
  percentile: number;
  tier: string;
  similar_companies: any[];
  achievements: any[];
  challenges: any[];
  leaderboard_position: number;
}

function SuccessPredictorContent() {
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePredictionSubmit = async (data: any) => {
    setIsLoading(true);
    setError(null);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const baseURL = apiUrl || window.location.origin;

      const response = await axios.post(`${baseURL}/api/gamified-predict`, {
        idea_description: data.idea_description,
        industry: data.industry,
        market_type: data.market_type,
        location: data.location,
        founder_info: data.founder_info,
        max_matches: 10,
      });

      setResult(response.data);
      // Scroll to results
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    } catch (err: any) {
      const message = err.response?.data?.detail || err.message || 'Failed to get prediction';
      setError(message);
      console.error('Prediction error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = async () => {
    if (!result?.prediction_id) return;

    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const baseURL = apiUrl || window.location.origin;

      const response = await axios.post(`${baseURL}/api/predictions/${result.prediction_id}/share`, {
        is_public: true,
      });

      const shareUrl = response.data.share_url;
      const text = `I scored ${result.combined_score}/100 on the YC Success Predictor! Can you beat my score? 🚀`;

      if (navigator.share) {
        navigator.share({
          title: 'YC Success Predictor',
          text: text,
          url: shareUrl,
        });
      } else {
        // Copy to clipboard as fallback
        const fullText = `${text}\n${shareUrl}`;
        navigator.clipboard.writeText(fullText);
        alert('Share link copied to clipboard!');
      }
    } catch (err) {
      console.error('Share error:', err);
      alert('Failed to share prediction');
    }
  };

  return (
    <>
      <AnnouncementBanner />
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          {/* Back link */}
          <a
            href="/tools"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-[#FB651E] font-mono mb-8 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Tools
          </a>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-[#FB651E]/10 rounded-lg">
                <Sparkles className="h-6 w-6 text-[#FB651E]" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">
                Startup Success Predictor
              </h1>
            </div>
            <p className="text-sm text-muted-foreground font-mono">
              Get a data-driven prediction based on 5,772 YC companies
            </p>
          </motion.div>

          {!result ? (
            <>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-600 text-sm"
                >
                  {error}
                </motion.div>
              )}

              {/* Form */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <PredictionForm onSubmit={handlePredictionSubmit} isLoading={isLoading} />
              </motion.div>

              {/* Info Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-12 space-y-4"
              >
                <h2 className="text-lg font-semibold text-foreground">How it works</h2>
                <div className="space-y-3">
                  {[
                    {
                      title: 'Data-Driven Matching',
                      description:
                        'Your idea is compared against 5,772 YC companies using AI semantic similarity.',
                    },
                    {
                      title: 'Multi-Dimensional Scoring',
                      description:
                        'We evaluate idea quality, team profile, and market potential based on success patterns.',
                    },
                    {
                      title: 'Unlock Achievements',
                      description:
                        'Earn badges for strong markets, founder experience, and other success indicators.',
                    },
                    {
                      title: 'Compare Against Matches',
                      description:
                        'See the top 5 similar YC companies and their success metrics.',
                    },
                  ].map((box, idx) => (
                    <motion.div
                      key={box.title}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + idx * 0.05 }}
                      className="p-4 rounded-lg border border-border bg-muted/50"
                    >
                      <h3 className="font-semibold text-foreground text-sm">{box.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{box.description}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </>
          ) : (
            <>
              {/* Results */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <ResultsCard
                  combined_score={result.combined_score}
                  tier={result.tier}
                  percentile={result.percentile}
                  idea_score={result.idea_score}
                  team_score={result.team_score}
                  market_score={result.market_score}
                  achievements={result.achievements}
                  leaderboard_position={result.leaderboard_position}
                  onShare={handleShare}
                />
              </motion.div>

              {/* Matched Companies */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mt-12"
              >
                <MatchedCompanies companies={result.similar_companies} />
              </motion.div>

              {/* Try Again */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-12 text-center"
              >
                <button
                  onClick={() => {
                    setResult(null);
                    setError(null);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="text-[#FB651E] hover:text-[#FB651E]/80 font-semibold transition-colors"
                >
                  ← Try Another Idea
                </button>
              </motion.div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export function SuccessPredictorPage() {
  return (
    <AppProvider>
      <SuccessPredictorContent />
    </AppProvider>
  );
}
