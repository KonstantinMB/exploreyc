import { motion } from 'framer-motion';
import { DollarSign, Users, TrendingUp, Calendar } from 'lucide-react';
import type { MetricData } from '../../lib/intelligenceParser';

interface MetricsDashboardProps {
  metrics: MetricData[];
}

const METRIC_ICONS: Record<MetricData['type'], React.ComponentType<{ className: string }>> = {
  funding: DollarSign,
  team: Users,
  valuation: TrendingUp,
  date: Calendar,
  other: TrendingUp,
};

export function MetricsDashboard({ metrics }: MetricsDashboardProps) {
  if (metrics.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {metrics.map((metric, index) => {
          const Icon = METRIC_ICONS[metric.type];

          return (
            <motion.div
              key={`${metric.label}-${index}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + index * 0.05 }}
              className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-4 relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            >
              {/* Accent bar */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 group-hover:w-1.5 transition-all" />

              <div className="space-y-2 pl-1">
                {/* Label */}
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {metric.label}
                  </p>
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>

                {/* Value */}
                <div className="text-2xl font-bold text-foreground">
                  {metric.value}
                </div>

                {/* Optional sublabel from icon field */}
                {metric.icon && typeof metric.icon === 'string' && (
                  <p className="text-xs text-muted-foreground pt-1">
                    {metric.icon}
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
