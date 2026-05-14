import { motion } from 'framer-motion';
import { TrendingUp, Users, DollarSign, Target } from 'lucide-react';

export interface MetricItem {
  label: string;
  value: string;
  description?: string;
  icon?: 'trending' | 'users' | 'dollar' | 'target';
}

interface KeyMetricsShowcaseProps {
  title?: string;
  metrics: MetricItem[];
}

const ICON_MAP = {
  trending: TrendingUp,
  users: Users,
  dollar: DollarSign,
  target: Target,
};

export function KeyMetricsShowcase({
  title = 'Key Metrics',
  metrics,
}: KeyMetricsShowcaseProps) {
  if (!metrics || metrics.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mb-12"
    >
      {/* Title */}
      <h2 className="text-3xl font-bold text-foreground mb-8">
        {title}
      </h2>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, index) => {
          const Icon = metric.icon ? ICON_MAP[metric.icon] : null;

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + index * 0.05 }}
              className="bg-white dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 rounded-xl p-6 hover:border-blue-400 dark:hover:border-blue-500 transition-all group"
            >
              {/* Icon */}
              {Icon && (
                <div className="mb-4">
                  <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-500/20 transition-colors">
                    <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              )}

              {/* Label */}
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {metric.label}
              </p>

              {/* Value */}
              <p className="text-3xl md:text-4xl font-bold text-foreground mb-2 break-words">
                {metric.value}
              </p>

              {/* Description */}
              {metric.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {metric.description}
                </p>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
