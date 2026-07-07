import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Share2, Trophy, Map, CreditCard, Sparkles, ArrowRight } from 'lucide-react';
import { HackerCard } from '../components/ui/hacker-card';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export function ShareHub() {
  const features = [
    {
      icon: Sparkles,
      title: 'YC Portfolio Wrapped',
      description: 'Annual and quarterly insights. Total funding, unicorns, biggest rounds, industry trends.',
      href: '/share/wrapped/2024',
      color: 'orange',
      badge: 'Coming Soon',
      available: false,
    },
    {
      icon: Trophy,
      title: 'Funding Leaderboards',
      description: 'Top 10 most funded companies, unicorn tracker, industry leaders, biggest rounds.',
      href: '/share/leaderboard',
      color: 'yellow',
      badge: 'Coming Soon',
      available: false,
    },
    {
      icon: Map,
      title: 'Map Snapshots',
      description: 'Geographic distribution by batch, hiring hotspots, industry heatmaps.',
      href: '/share/map',
      color: 'blue',
      badge: 'Coming Soon',
      available: false,
    },
    {
      icon: CreditCard,
      title: 'Company Trading Cards',
      description: 'Beautiful shareable cards for every YC company. Share your startup or discover others.',
      href: '/share/company',
      color: 'green',
      badge: 'New',
      available: true,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-16 text-center"
        >
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="p-3 bg-[#FB651E]/10 rounded-lg">
              <Share2 className="h-8 w-8 text-[#FB651E]" />
            </div>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
            <span className="text-[#FB651E]">&gt;</span>{' '}
            <span className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
              Share Center
            </span>
          </h1>
          <p className="text-lg text-muted-foreground font-mono max-w-2xl mx-auto">
            Create viral content for social media. Beautiful, branded images optimized for Twitter, LinkedIn, and Reddit.
          </p>
        </motion.div>

        {/* Feature Grid */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto mb-16"
        >
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const colorClasses = {
              orange: 'text-[#FB651E] bg-[#FB651E]/10',
              yellow: 'text-yellow-500 bg-yellow-500/10',
              blue: 'text-blue-500 bg-blue-500/10',
              green: 'text-emerald-500 bg-emerald-500/10',
            };
            const isAvailable = feature.available;

            return (
              <motion.div key={index} variants={item}>
                {isAvailable ? (
                  <Link to={feature.href} className="group block h-full">
                    <HackerCard
                    glowColor={feature.color as 'orange' | 'blue' | 'green' | 'purple'}
                    className="p-6 h-full hover:border-[#FB651E]/60 transition-all"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg ${colorClasses[feature.color as keyof typeof colorClasses]}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-bold font-mono text-lg">{feature.title}</h3>
                          {feature.badge && (
                            <span
                              className={`px-2 py-0.5 text-xs font-mono border ${
                                feature.badge === 'New'
                                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                  : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                              }`}
                            >
                              {feature.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">{feature.description}</p>
                        <div className="flex items-center gap-1 text-xs text-[#FB651E] font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                          Create →
                        </div>
                      </div>
                    </div>
                  </HackerCard>
                </Link>
                ) : (
                  <div
                    className="group block h-full cursor-not-allowed select-none pointer-events-none"
                    title="Coming soon"
                  >
                    <HackerCard
                      glowColor={feature.color as 'orange' | 'blue' | 'green' | 'purple'}
                      className="p-6 h-full opacity-50 grayscale"
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-lg ${colorClasses[feature.color as keyof typeof colorClasses]}`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-bold font-mono text-lg text-muted-foreground">{feature.title}</h3>
                            <span className="px-2 py-0.5 text-xs font-mono border bg-gray-500/20 text-gray-400 border-gray-500/30">
                              {feature.badge}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-4">{feature.description}</p>
                        </div>
                      </div>
                    </HackerCard>
                  </div>
                )}
              </motion.div>
            );
          })}
        </motion.div>

        {/* How it Works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto"
        >
          <h2 className="text-2xl font-bold mb-6 font-mono">
            <span className="text-[#FB651E]">$</span> How it works
          </h2>
          <div className="space-y-4">
            {[
              { step: '1', text: 'Choose your content type (wrapped, leaderboard, map, or company card)' },
              { step: '2', text: 'Customize filters and options to create your perfect share' },
              { step: '3', text: 'Download high-quality PNG or share directly to Twitter/LinkedIn' },
              { step: '4', text: 'Drive traffic back to ExploreYC and grow your audience' },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex items-start gap-4 p-4 border border-border rounded-lg bg-card/30"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#FB651E] text-white flex items-center justify-center font-mono font-bold">
                  {item.step}
                </div>
                <p className="text-sm text-foreground pt-1">{item.text}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <HackerCard glowColor="orange" className="p-8 max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold mb-4">Ready to go viral?</h3>
            <p className="text-muted-foreground mb-6 font-mono">
              Start creating shareable content that showcases YC's incredible portfolio.
            </p>
            <Link
              to="/share/company"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#FB651E] hover:bg-[#E65C00] text-white font-mono transition-colors"
            >
              Create Company Card
              <ArrowRight className="h-4 w-4" />
            </Link>
          </HackerCard>
        </motion.div>
      </div>
    </div>
  );
}
