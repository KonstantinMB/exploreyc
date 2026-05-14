import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ContactFormModal } from './ContactFormModal';
import { api } from '../lib/api';
import {
  ArrowUp,
  Check,
  Clock,
  Lightbulb,
  Rocket,
  TrendingUp,
  Users,
  Brain,
  Briefcase,
  BookOpen,
  Star,
  Trophy,
  MessageSquare,
  Network,
  Sparkles,
  BarChart3,
} from 'lucide-react';

export interface RoadmapFeature {
  id: string;
  title: string;
  description: string;
  category: 'viral' | 'engagement' | 'data' | 'tools';
  status: 'shipped' | 'in-progress' | 'planned' | 'under-consideration';
  priority: 'high' | 'medium' | 'low';
  eta?: string;
  impact: string;
  icon: any;
}

const ROADMAP_FEATURES: RoadmapFeature[] = [
  {
    id: 'batch-wrapped',
    title: 'YC Batch Wrapped',
    description: 'Spotify Wrapped-style shareable batch stats. Beautiful infographics showing your batch size, top industries, hiring %, and how you compare to other batches.',
    category: 'viral',
    status: 'shipped',
    priority: 'high',
    eta: 'March 2026',
    impact: 'Viral social sharing, founders love to share batch stats on Twitter',
    icon: Sparkles,
  },
  {
    id: 'cofounder-match',
    title: 'Find Your Co-Founder Match',
    description: 'Dating app for YC founders. Match with co-founders by skills, industry, location. YC accepts 2x more teams than solo founders.',
    category: 'tools',
    status: 'planned',
    priority: 'high',
    eta: '1 month',
    impact: 'Solves real pain point, creates network effects, YC would promote it',
    icon: Users,
  },
  {
    id: 'success-predictor',
    title: 'YC Success Predictor',
    description: 'AI model predicting your startup success based on 5,772 YC company patterns. Upload idea + team, get similarity score and suggestions.',
    category: 'tools',
    status: 'under-consideration',
    priority: 'high',
    eta: '6 weeks',
    impact: '20,000+ YC applicants per batch would use this, media coverage potential',
    icon: Brain,
  },
  {
    id: 'hiring-board',
    title: 'Live YC Hiring Board',
    description: 'All 1,425 hiring YC companies in one place. Filter by role, batch, location, stage. One-click apply.',
    category: 'engagement',
    status: 'planned',
    priority: 'medium',
    eta: '3 weeks',
    impact: 'Daily engagement, monetization potential, serves job seekers',
    icon: Briefcase,
  },
  {
    id: 'founder-journeys',
    title: 'YC Founder Journey Stories',
    description: 'Interactive timelines: Airbnb cereal boxes → $100B. Visual stories of famous YC companies with key milestones, pivots, and lessons.',
    category: 'engagement',
    status: 'planned',
    priority: 'medium',
    eta: '4 weeks',
    impact: 'SEO gold, inspirational content, shows YC impact',
    icon: BookOpen,
  },
  {
    id: 'fundraising-tracker',
    title: 'Fundraising Tracker',
    description: 'Interactive funding network: YC companies, investors, rounds by sector. Timeline by batch, funding stages, network graph.',
    category: 'data',
    status: 'shipped',
    priority: 'high',
    eta: 'March 2026',
    impact: 'Shows YC success rate, enables funding filters, critical for investors',
    icon: TrendingUp,
  },
  {
    id: 'product-hunt',
    title: 'Product Hunt Data',
    description: 'Add launch dates, upvotes, #1 Product badges. Show which YC companies crushed their PH launch.',
    category: 'data',
    status: 'planned',
    priority: 'low',
    eta: '1 week',
    impact: 'Launch correlation with success, free API',
    icon: Rocket,
  },
  {
    id: 'watchlist',
    title: 'My YC Watchlist',
    description: 'Save favorite companies, get alerts when they are hiring, weekly digest email, compare saved companies.',
    category: 'engagement',
    status: 'planned',
    priority: 'medium',
    eta: '2 weeks',
    impact: 'User retention, daily active users, personalization',
    icon: Star,
  },
  {
    id: 'leaderboards',
    title: 'Batch Leaderboards',
    description: 'Most funded this month, fastest growing, most hiring, media mentions. Real-time competition between batches.',
    category: 'engagement',
    status: 'under-consideration',
    priority: 'medium',
    eta: '3 weeks',
    impact: 'Gamification, batch pride, daily checks',
    icon: Trophy,
  },
  {
    id: 'ama-archive',
    title: 'YC Founder AMA Archive',
    description: 'Searchable index of AMAs from Reddit, Twitter, YC Blog. "What Brian Chesky said about pricing" with video timestamps.',
    category: 'engagement',
    status: 'under-consideration',
    priority: 'low',
    eta: '8 weeks',
    impact: 'Learning resource, SEO, unique content',
    icon: MessageSquare,
  },
  {
    id: 'idea-validator',
    title: 'Startup Idea Validator',
    description: 'Check if your idea already exists in YC portfolio, see similar companies, market size analysis, "Green light" or "Crowded" indicator.',
    category: 'tools',
    status: 'shipped',
    priority: 'medium',
    eta: 'March 2026',
    impact: 'Helps founders validate ideas, saves time',
    icon: Lightbulb,
  },
  {
    id: 'network-graph',
    title: 'YC Network Graph',
    description: 'Visual connections between companies: same investors, same batch, employee flow. "6 degrees of YC separation".',
    category: 'engagement',
    status: 'under-consideration',
    priority: 'low',
    eta: '10 weeks',
    impact: 'Beautiful visualization, network insights, shareable',
    icon: Network,
  },
];

const STATUS_CONFIG = {
  shipped: {
    label: 'Shipped',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    icon: Check,
  },
  'in-progress': {
    label: 'In Progress',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    icon: Clock,
  },
  planned: {
    label: 'Planned',
    color: 'bg-[#FB651E]/10 text-[#FB651E] dark:bg-[#FB651E]/20',
    icon: Rocket,
  },
  'under-consideration': {
    label: 'Under Consideration',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
    icon: Lightbulb,
  },
};

const CATEGORY_CONFIG = {
  viral: { label: 'Viral Growth', color: 'text-pink-600', icon: TrendingUp },
  engagement: { label: 'Engagement', color: 'text-purple-600', icon: Users },
  data: { label: 'Data & Insights', color: 'text-blue-600', icon: BarChart3 },
  tools: { label: 'Founder Tools', color: 'text-green-600', icon: Briefcase },
};

export function ProductRoadmap() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | RoadmapFeature['status']>('all');
  const [sortBy, setSortBy] = useState<'votes' | 'priority'>('votes');
  const [contactModalOpen, setContactModalOpen] = useState(false);

  // Get user identifier (IP hash or session ID)
  const getUserIdentifier = () => {
    let userId = localStorage.getItem('roadmap-user-id');
    if (!userId) {
      // Generate a random user ID (in production, use IP hash from server)
      userId = `user-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('roadmap-user-id', userId);
    }
    return userId;
  };

  const userIdentifier = getUserIdentifier();

  // Fetch vote counts from API
  const { data: votesData } = useQuery({
    queryKey: ['roadmap-votes'],
    queryFn: async () => {
      const response = await api.get('/api/roadmap/votes');
      return response.data.votes as Record<string, number>;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // Fetch user's votes from API
  const { data: userVotesData } = useQuery({
    queryKey: ['roadmap-user-votes', userIdentifier],
    queryFn: async () => {
      const response = await api.get(`/api/roadmap/user-votes/${userIdentifier}`);
      return new Set(response.data.feature_ids as string[]);
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const votes = votesData || {};
  const userVotes = userVotesData || new Set<string>();

  // Track which feature is being mutated (prevents double-clicks and wrong-feature perception)
  const [pendingFeatureId, setPendingFeatureId] = useState<string | null>(null);

  // Vote mutation with optimistic update
  const voteMutation = useMutation({
    mutationFn: async (featureId: string) => {
      const response = await api.post<{ success: boolean }>(`/api/roadmap/vote/${featureId}`, {
        user_identifier: userIdentifier
      });
      return response.data;
    },
    onMutate: async (featureId: string) => {
      setPendingFeatureId(featureId);
      await queryClient.cancelQueries({ queryKey: ['roadmap-votes'] });
      await queryClient.cancelQueries({ queryKey: ['roadmap-user-votes', userIdentifier] });
      const prevVotes = queryClient.getQueryData<Record<string, number>>(['roadmap-votes']);
      const prevUserVotes = queryClient.getQueryData<Set<string>>(['roadmap-user-votes', userIdentifier]);
      queryClient.setQueryData(['roadmap-votes'], (old: Record<string, number> | undefined) => ({
        ...old,
        [featureId]: (old?.[featureId] ?? 0) + 1,
      }));
      queryClient.setQueryData(['roadmap-user-votes', userIdentifier], (old: Set<string> | undefined) => {
        const next = new Set(old ?? []);
        next.add(featureId);
        return next;
      });
      return { prevVotes, prevUserVotes };
    },
    onError: (_err, _featureId, context) => {
      if (context?.prevVotes) queryClient.setQueryData(['roadmap-votes'], context.prevVotes);
      if (context?.prevUserVotes) queryClient.setQueryData(['roadmap-user-votes', userIdentifier], context.prevUserVotes);
    },
    onSuccess: (data, _featureId, context) => {
      if (data && 'success' in data && !data.success) {
        if (context?.prevVotes) queryClient.setQueryData(['roadmap-votes'], context.prevVotes);
        if (context?.prevUserVotes) queryClient.setQueryData(['roadmap-user-votes', userIdentifier], context.prevUserVotes);
      }
    },
    onSettled: () => {
      setPendingFeatureId(null);
      queryClient.invalidateQueries({ queryKey: ['roadmap-votes'] });
      queryClient.invalidateQueries({ queryKey: ['roadmap-user-votes', userIdentifier] });
    },
  });

  // Unvote mutation with optimistic update
  const unvoteMutation = useMutation({
    mutationFn: async (featureId: string) => {
      const response = await api.delete<{ success: boolean }>(`/api/roadmap/vote/${featureId}`, {
        data: { user_identifier: userIdentifier }
      });
      return response.data;
    },
    onMutate: async (featureId: string) => {
      setPendingFeatureId(featureId);
      await queryClient.cancelQueries({ queryKey: ['roadmap-votes'] });
      await queryClient.cancelQueries({ queryKey: ['roadmap-user-votes', userIdentifier] });
      const prevVotes = queryClient.getQueryData<Record<string, number>>(['roadmap-votes']);
      const prevUserVotes = queryClient.getQueryData<Set<string>>(['roadmap-user-votes', userIdentifier]);
      queryClient.setQueryData(['roadmap-votes'], (old: Record<string, number> | undefined) => ({
        ...old,
        [featureId]: Math.max(0, (old?.[featureId] ?? 0) - 1),
      }));
      queryClient.setQueryData(['roadmap-user-votes', userIdentifier], (old: Set<string> | undefined) => {
        const next = new Set(old ?? []);
        next.delete(featureId);
        return next;
      });
      return { prevVotes, prevUserVotes };
    },
    onError: (_err, _featureId, context) => {
      if (context?.prevVotes) queryClient.setQueryData(['roadmap-votes'], context.prevVotes);
      if (context?.prevUserVotes) queryClient.setQueryData(['roadmap-user-votes', userIdentifier], context.prevUserVotes);
    },
    onSuccess: (data, _featureId, context) => {
      if (data && 'success' in data && !data.success) {
        if (context?.prevVotes) queryClient.setQueryData(['roadmap-votes'], context.prevVotes);
        if (context?.prevUserVotes) queryClient.setQueryData(['roadmap-user-votes', userIdentifier], context.prevUserVotes);
      }
    },
    onSettled: () => {
      setPendingFeatureId(null);
      queryClient.invalidateQueries({ queryKey: ['roadmap-votes'] });
      queryClient.invalidateQueries({ queryKey: ['roadmap-user-votes', userIdentifier] });
    },
  });

  const handleVote = useCallback((e: React.MouseEvent, featureId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (pendingFeatureId) return; // Prevent double-clicks
    if (userVotes.has(featureId)) {
      unvoteMutation.mutate(featureId);
    } else {
      voteMutation.mutate(featureId);
    }
  }, [userVotes, pendingFeatureId, voteMutation, unvoteMutation]);

  const filteredFeatures = ROADMAP_FEATURES.filter(
    (f) => filter === 'all' || f.status === filter
  );

  const sortedFeatures = [...filteredFeatures].sort((a, b) => {
    if (sortBy === 'votes') {
      return (votes[b.id] || 0) - (votes[a.id] || 0);
    }
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });

  return (
    <motion.section
      id="roadmap"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="mt-12"
    >
      <Card className="border-[#FB651E]/20">
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-xl sm:text-2xl flex items-center gap-2">
                <Rocket className="h-5 w-5 sm:h-6 sm:w-6 text-[#FB651E] flex-shrink-0" />
                Product Roadmap
              </CardTitle>
              <CardDescription className="mt-2 font-mono">
                Vote on features you want most. Help us prioritize what to build next!
              </CardDescription>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 mt-4 sm:mt-6">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                All Features
              </Button>
              <Button
                variant={filter === 'planned' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('planned')}
              >
                Planned
              </Button>
              <Button
                variant={filter === 'in-progress' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('in-progress')}
              >
                In Progress
              </Button>
              <Button
                variant={filter === 'under-consideration' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('under-consideration')}
              >
                Under Consideration
              </Button>
            </div>

            <div className="flex gap-2 sm:ml-auto">
              <Button
                variant={sortBy === 'votes' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('votes')}
              >
                Most Voted
              </Button>
              <Button
                variant={sortBy === 'priority' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('priority')}
              >
                Priority
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {sortedFeatures.map((feature, index) => {
              const StatusIcon = STATUS_CONFIG[feature.status].icon;
              const CategoryIcon = CATEGORY_CONFIG[feature.category].icon;
              const FeatureIcon = feature.icon;
              const hasVoted = userVotes.has(feature.id);
              const voteCount = votes[feature.id] || 0;

              return (
                <motion.div
                  key={feature.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card
                    className={`hover:border-[#FB651E]/50 transition-all ${
                      hasVoted ? 'border-[#FB651E]/30 bg-[#FB651E]/5' : ''
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        {/* Vote Button */}
                        <button
                          type="button"
                          disabled={!!pendingFeatureId}
                          onClick={(e) => handleVote(e, feature.id)}
                          aria-label={hasVoted ? `Remove vote from ${feature.title}` : `Vote for ${feature.title}`}
                          className={`flex flex-col items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-lg border-2 transition-all shrink-0 min-h-[44px] min-w-[44px] ${
                            pendingFeatureId === feature.id
                              ? 'opacity-70 cursor-wait'
                              : hasVoted
                                ? 'bg-[#FB651E] border-[#FB651E] text-white'
                                : 'border-gray-300 dark:border-gray-700 hover:border-[#FB651E] hover:bg-[#FB651E]/10'
                          } disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none`}
                        >
                          <ArrowUp className={`h-4 w-4 ${hasVoted ? 'fill-current' : ''}`} />
                          <span className="text-xs font-bold mt-0.5">{voteCount}</span>
                        </button>

                        {/* Feature Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2 mb-2">
                            <div className="p-1.5 rounded bg-[#FB651E]/10">
                              <FeatureIcon className="h-4 w-4 text-[#FB651E]" />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-sm leading-tight">
                                {feature.title}
                              </h4>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge
                                  variant="secondary"
                                  className={`text-xs ${STATUS_CONFIG[feature.status].color}`}
                                >
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {STATUS_CONFIG[feature.status].label}
                                </Badge>
                                {feature.eta && (
                                  <span className="text-xs text-muted-foreground">
                                    ETA: {feature.eta}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                            {feature.description}
                          </p>

                          <div className="flex items-center gap-2 text-xs">
                            <CategoryIcon
                              className={`h-3 w-3 ${CATEGORY_CONFIG[feature.category].color}`}
                            />
                            <span className={CATEGORY_CONFIG[feature.category].color}>
                              {CATEGORY_CONFIG[feature.category].label}
                            </span>
                          </div>

                          <details className="mt-2">
                            <summary className="text-xs text-[#FB651E] cursor-pointer hover:underline">
                              Why this matters
                            </summary>
                            <p className="text-xs text-muted-foreground mt-1 pl-4 border-l-2 border-[#FB651E]/30">
                              {feature.impact}
                            </p>
                          </details>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Stats */}
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-center">
              <div>
                <div className="text-xl sm:text-2xl font-bold text-[#FB651E]">
                  {ROADMAP_FEATURES.filter((f) => f.status === 'shipped').length}
                </div>
                <div className="text-xs text-muted-foreground font-mono">Shipped</div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-blue-600">
                  {ROADMAP_FEATURES.filter((f) => f.status === 'in-progress').length}
                </div>
                <div className="text-xs text-muted-foreground font-mono">In Progress</div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-purple-600">
                  {ROADMAP_FEATURES.filter((f) => f.status === 'planned').length}
                </div>
                <div className="text-xs text-muted-foreground font-mono">Planned</div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold">
                  {Object.values(votes).reduce((a, b) => a + b, 0)}
                </div>
                <div className="text-xs text-muted-foreground font-mono">Total Votes</div>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-[#FB651E]/10 border border-[#FB651E]/30 rounded-lg">
            <p className="text-sm text-center font-mono">
              💡 <span className="font-semibold">Got a feature idea?</span>{' '}
              <button
                type="button"
                onClick={() => setContactModalOpen(true)}
                className="text-[#FB651E] hover:underline font-semibold"
              >
                Share your feedback
              </button>
            </p>
          </div>

          <ContactFormModal
            open={contactModalOpen}
            onClose={() => setContactModalOpen(false)}
          />
        </CardContent>
      </Card>
    </motion.section>
  );
}
