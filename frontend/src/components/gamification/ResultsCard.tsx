import { motion } from 'framer-motion';
import { Share2, Download, Trophy } from 'lucide-react';
import { Button } from '../ui/button';
import { HackerCard } from '../ui/hacker-card';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  xp_reward?: number;
}

interface ResultsCardProps {
  combined_score: number;
  tier: string;
  percentile: number;
  idea_score: number;
  team_score?: number;
  market_score: number;
  achievements: Achievement[];
  leaderboard_position: number;
  onShare?: () => void;
}

const TIER_COLORS = {
  bronze: 'from-amber-500/10 to-amber-500/5 border-amber-500/30',
  silver: 'from-slate-500/10 to-slate-500/5 border-slate-500/30',
  gold: 'from-yellow-500/10 to-yellow-500/5 border-yellow-500/30',
  platinum: 'from-purple-500/10 to-purple-500/5 border-purple-500/30',
};

const TIER_LABELS = {
  bronze: '🥉 Bronze - Needs Work!',
  silver: '🥈 Silver - Promising Idea',
  gold: '🥇 Gold - Strong Potential',
  platinum: '🦄 Platinum - Unicorn Material',
};

export function ResultsCard({
  combined_score,
  tier,
  percentile,
  idea_score,
  team_score,
  market_score,
  achievements,
  leaderboard_position,
  onShare,
}: ResultsCardProps) {
  const tierColor = TIER_COLORS[tier as keyof typeof TIER_COLORS] || TIER_COLORS.bronze;

  const scores = [
    { label: 'Idea Quality', value: idea_score, color: 'from-blue-500/30 to-blue-500/10' },
    ...(team_score !== undefined ? [{ label: 'Team Profile', value: team_score, color: 'from-green-500/30 to-green-500/10' }] : []),
    { label: 'Market Potential', value: market_score, color: 'from-orange-500/30 to-orange-500/10' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6 max-w-3xl mx-auto"
    >
      {/* Main Score Card */}
      <HackerCard
        glowColor="green"
        className={`bg-gradient-to-br ${tierColor} border-2 p-8`}
      >
        <div className="text-center space-y-6">
          {/* Main Score Circle */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="relative w-40 h-40">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  className="text-muted/20"
                />
                <motion.circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  className="text-[#FB651E]"
                  strokeDasharray={440}
                  initial={{ strokeDashoffset: 440 }}
                  animate={{ strokeDashoffset: 440 - (combined_score / 100) * 440 }}
                  transition={{ duration: 1.5, ease: 'easeOut' }}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-bold text-foreground">{combined_score}</span>
                <span className="text-sm text-muted-foreground">/100</span>
              </div>
            </div>

            <div className="text-center">
              <h2 className="text-3xl font-bold text-foreground mb-2">
                {TIER_LABELS[tier as keyof typeof TIER_LABELS]}
              </h2>
              <p className="text-lg text-muted-foreground">
                Your startup is in the <span className="font-semibold text-foreground">top {percentile + 1}%</span> of YC companies
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {leaderboard_position > 0 ? `Position: #${leaderboard_position} on the leaderboard` : 'Be the first to share your prediction!'}
              </p>
            </div>
          </motion.div>
        </div>
      </HackerCard>

      {/* Score Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {scores.map((score, idx) => (
          <motion.div
            key={score.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + idx * 0.1 }}
            className={`p-4 rounded-lg border border-border bg-gradient-to-br ${score.color}`}
          >
            <p className="text-sm font-medium text-muted-foreground mb-2">{score.label}</p>
            <div className="flex items-end gap-3">
              <span className="text-3xl font-bold text-foreground">{score.value}</span>
              <span className="text-sm text-muted-foreground mb-1">/100</span>
            </div>
            {/* Progress Bar */}
            <div className="mt-3 w-full bg-muted/30 rounded-full h-2 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${score.value}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-[#FB651E] to-[#FB651E]/60"
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Achievements */}
      {achievements.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-4"
        >
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#FB651E]" />
            Achievements Unlocked ({achievements.length})
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {achievements.map((achievement) => (
              <motion.div
                key={achievement.id}
                whileHover={{ scale: 1.02 }}
                className="p-4 rounded-lg border border-border bg-gradient-to-br from-background to-muted/10 hover:border-[#FB651E]/50 transition-all"
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{achievement.icon}</span>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-foreground">{achievement.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{achievement.description}</p>
                    {achievement.xp_reward && (
                      <p className="text-xs font-mono text-[#FB651E] mt-2">+{achievement.xp_reward} XP</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={onShare}
          className="flex-1 bg-[#FB651E] hover:bg-[#FB651E]/90 text-white flex items-center justify-center gap-2"
        >
          <Share2 className="w-4 h-4" />
          Share Results
        </Button>
        <Button
          variant="outline"
          className="flex-1 flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" />
          Download Report
        </Button>
      </div>
    </motion.div>
  );
}
