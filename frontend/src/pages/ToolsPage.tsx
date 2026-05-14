import { Link } from 'react-router-dom';
import { ArrowRight, Check, Sparkles, TrendingUp, Zap, Flame } from 'lucide-react';
import { motion } from 'framer-motion';
import { IdeaValidatorIcon, BatchWrappedIcon, FundraisingTrackerIcon } from '../components/ToolsIcons';
import { useApp } from '../contexts/AppContext';
import { getSecondMostRecentBatch, batchToShortFormat } from '../lib/batchUtils';
import { HackerCard } from '../components/ui/hacker-card';

export function ToolsPage() {
  const { stats } = useApp();

  // Get second-most recent batch (latest may not have started yet, e.g. Summer 2026 vs Spring 2026)
  const wrappedBatch = getSecondMostRecentBatch(stats?.by_batch);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 md:py-16">
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#FB651E]/10 border border-[#FB651E]/30 rounded-full mb-6">
            <Zap className="h-4 w-4 text-[#FB651E]" />
            <span className="text-sm font-mono text-[#FB651E]">Free Tools for Founders</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="font-mono text-[#FB651E]">&gt;</span> Build Smarter with YC Data
          </h1>
          <p className="text-lg text-muted-foreground font-mono">
            Powerful, free tools built on Y Combinator's portfolio data to help you validate ideas, track funding, and grow your startup.
          </p>
        </motion.div>

        {/* Tools Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid lg:grid-cols-3 gap-6 md:gap-8 max-w-7xl mx-auto mb-12"
        >
          {/* Idea Validator */}
          <motion.div variants={itemVariants}>
            <Link to="/validator" className="block group h-full">
              <HackerCard
                glowColor="blue"
                className="h-full p-8 bg-gradient-to-br from-blue-600/5 via-background to-blue-600/10 hover:border-blue-500/50 transition-all duration-300"
              >
                <div className="flex flex-col h-full">
                  {/* Icon & Badge */}
                  <div className="flex items-start justify-between mb-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
                      <div className="relative w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                        <IdeaValidatorIcon className="w-8 h-8 text-white" />
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-500 text-xs rounded-full font-mono font-medium border border-emerald-500/30">
                      LIVE
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-2xl font-bold mb-3 group-hover:text-blue-500 transition-colors">
                    Idea Validator
                  </h3>
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    Check if your startup idea already exists in the YC portfolio. Get instant feedback on market crowding.
                  </p>

                  {/* Features */}
                  <div className="space-y-3 mb-6 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-emerald-500" />
                      </div>
                      <span className="text-sm">Search 5,000+ YC companies</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-emerald-500" />
                      </div>
                      <span className="text-sm">Industry breakdown & analysis</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-emerald-500" />
                      </div>
                      <span className="text-sm">Green light / Crowded indicator</span>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <span className="font-mono text-sm text-blue-500 font-medium">
                      Try it free →
                    </span>
                    <ArrowRight className="w-5 h-5 text-blue-500 group-hover:translate-x-2 transition-transform" />
                  </div>
                </div>
              </HackerCard>
            </Link>
          </motion.div>

          {/* Batch Wrapped */}
          {wrappedBatch && (
            <motion.div variants={itemVariants}>
              <Link to={`/batch/${batchToShortFormat(wrappedBatch.name)}/wrapped`} className="block group h-full">
                <HackerCard
                  glowColor="orange"
                  className="h-full p-8 bg-gradient-to-br from-[#FB651E]/5 via-background to-[#FF8C42]/10 hover:border-[#FB651E]/50 transition-all duration-300"
                >
                  <div className="flex flex-col h-full">
                    {/* Icon & Badge */}
                    <div className="flex items-start justify-between mb-6">
                      <div className="relative">
                        <div className="absolute inset-0 bg-[#FB651E] blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
                        <div className="relative w-16 h-16 bg-gradient-to-br from-[#FB651E] to-[#FF8C42] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                          <BatchWrappedIcon className="w-8 h-8 text-white" />
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <span className="px-3 py-1 bg-yellow-500/20 text-yellow-500 text-xs rounded-full font-mono font-medium border border-yellow-500/30 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          NEW
                        </span>
                      </div>
                    </div>

                    {/* Title & Description */}
                    <h3 className="text-2xl font-bold mb-3 group-hover:text-[#FB651E] transition-colors">
                      Batch Wrapped
                    </h3>
                    <p className="text-muted-foreground mb-6 leading-relaxed">
                      Spotify-style shareable stats for YC batches. Beautiful infographics showcasing {wrappedBatch.name}'s highlights.
                    </p>

                    {/* Features */}
                    <div className="space-y-3 mb-6 flex-1">
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                          <Check className="w-3 h-3 text-emerald-500" />
                        </div>
                        <span className="text-sm">Stunning visual infographics</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                          <Check className="w-3 h-3 text-emerald-500" />
                        </div>
                        <span className="text-sm">Top industries & locations</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                          <Check className="w-3 h-3 text-emerald-500" />
                        </div>
                        <span className="text-sm">Share on Twitter instantly</span>
                      </div>
                    </div>

                    {/* CTA */}
                    <div className="flex items-center justify-between pt-4 border-t border-border">
                      <span className="font-mono text-sm text-[#FB651E] font-medium">
                        View Wrapped →
                      </span>
                      <ArrowRight className="w-5 h-5 text-[#FB651E] group-hover:translate-x-2 transition-transform" />
                    </div>
                  </div>
                </HackerCard>
              </Link>
            </motion.div>
          )}

          {/* Success Predictor */}
          <motion.div variants={itemVariants}>
            <Link to="/success-predictor" className="block group h-full">
              <HackerCard
                glowColor="orange"
                className="h-full p-8 bg-gradient-to-br from-rose-600/5 via-background to-rose-600/10 hover:border-rose-500/50 transition-all duration-300"
              >
                <div className="flex flex-col h-full">
                  {/* Icon & Badge */}
                  <div className="flex items-start justify-between mb-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-rose-500 blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
                      <div className="relative w-16 h-16 bg-gradient-to-br from-rose-500 to-rose-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                        <Sparkles className="w-8 h-8 text-white" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <span className="px-3 py-1 bg-red-500/20 text-red-500 text-xs rounded-full font-mono font-medium border border-red-500/30 flex items-center gap-1">
                        <Flame className="w-3 h-3" />
                        BETA
                      </span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-2xl font-bold mb-3 group-hover:text-rose-500 transition-colors">
                    Success Predictor
                  </h3>
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    AI-powered startup success predictions. Get scored against 5,772 YC companies and unlock achievements.
                  </p>

                  {/* Features */}
                  <div className="space-y-3 mb-6 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-emerald-500" />
                      </div>
                      <span className="text-sm">Multi-dimensional scoring</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-emerald-500" />
                      </div>
                      <span className="text-sm">Find similar YC companies</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-emerald-500" />
                      </div>
                      <span className="text-sm">Share & compare predictions</span>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <span className="font-mono text-sm text-rose-500 font-medium">
                      Try it out →
                    </span>
                    <ArrowRight className="w-5 h-5 text-rose-500 group-hover:translate-x-2 transition-transform" />
                  </div>
                </div>
              </HackerCard>
            </Link>
          </motion.div>

          {/* Fundraising Tracker */}
          <motion.div variants={itemVariants}>
            <Link to="/funding" className="block group h-full">
              <HackerCard
                glowColor="green"
                className="h-full p-8 bg-gradient-to-br from-emerald-600/5 via-background to-emerald-600/10 hover:border-emerald-500/50 transition-all duration-300"
              >
                <div className="flex flex-col h-full">
                  {/* Icon & Badge */}
                  <div className="flex items-start justify-between mb-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-emerald-500 blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
                      <div className="relative w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                        <FundraisingTrackerIcon className="w-8 h-8 text-white" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <span className="px-3 py-1 bg-emerald-500/20 text-emerald-500 text-xs rounded-full font-mono font-medium border border-emerald-500/30 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        HOT
                      </span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-2xl font-bold mb-3 group-hover:text-emerald-500 transition-colors">
                    Funding Tracker
                  </h3>
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    Interactive funding leaderboard with timeline charts. Track $140B+ raised across YC companies.
                  </p>

                  {/* Features */}
                  <div className="space-y-3 mb-6 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-emerald-500" />
                      </div>
                      <span className="text-sm">Real funding amounts & stages</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-emerald-500" />
                      </div>
                      <span className="text-sm">Dynamic timeline visualization</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-emerald-500" />
                      </div>
                      <span className="text-sm">Top funded companies ranked</span>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <span className="font-mono text-sm text-emerald-500 font-medium">
                      Explore data →
                    </span>
                    <ArrowRight className="w-5 h-5 text-emerald-500 group-hover:translate-x-2 transition-transform" />
                  </div>
                </div>
              </HackerCard>
            </Link>
          </motion.div>

        </motion.div>

        {/* Stats Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="max-w-5xl mx-auto mt-16"
        >
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center p-6 border border-border rounded-xl bg-gradient-to-br from-background to-muted/20">
              <div className="text-4xl font-bold font-mono text-[#FB651E] mb-2">
                5,000+
              </div>
              <div className="text-sm text-muted-foreground">
                YC Companies Analyzed
              </div>
            </div>
            <div className="text-center p-6 border border-border rounded-xl bg-gradient-to-br from-background to-muted/20">
              <div className="text-4xl font-bold font-mono text-blue-500 mb-2">
                $140B+
              </div>
              <div className="text-sm text-muted-foreground">
                Total Funding Tracked
              </div>
            </div>
            <div className="text-center p-6 border border-border rounded-xl bg-gradient-to-br from-background to-muted/20">
              <div className="text-4xl font-bold font-mono text-emerald-500 mb-2">
                100%
              </div>
              <div className="text-sm text-muted-foreground">
                Free Forever
              </div>
            </div>
          </div>
        </motion.div>

        {/* CTA Footer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="max-w-3xl mx-auto mt-16 text-center"
        >
          <HackerCard glowColor="orange" className="p-8 md:p-10">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Start Building Today
            </h2>
            <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
              All tools are completely free and built on real YC portfolio data. No signup required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/validator"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#FB651E] hover:bg-[#E65C00] text-white font-mono rounded-lg transition-colors"
              >
                Validate Your Idea
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/funding"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-border hover:border-[#FB651E]/50 font-mono rounded-lg transition-colors"
              >
                Explore Funding Data
              </Link>
            </div>
          </HackerCard>
        </motion.div>
      </div>
    </div>
  );
}
