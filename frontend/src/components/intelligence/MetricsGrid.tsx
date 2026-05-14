import { motion } from 'framer-motion';
import { TrendingUp, DollarSign, Users, FileText, Target } from 'lucide-react';
import type { MetricData } from '../../lib/intelligenceParser';

interface MetricsGridProps {
  metrics: MetricData[];
}

type IconType = 'trending' | 'dollar' | 'users' | 'file' | 'target';

function getIconComponent(type: IconType) {
  switch (type) {
    case 'trending':
      return TrendingUp;
    case 'dollar':
      return DollarSign;
    case 'users':
      return Users;
    case 'file':
      return FileText;
    case 'target':
      return Target;
    default:
      return TrendingUp;
  }
}

function getIconColor(type: IconType): string {
  switch (type) {
    case 'trending':
      return 'text-green-600 dark:text-green-400';
    case 'dollar':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'users':
      return 'text-blue-600 dark:text-blue-400';
    case 'file':
      return 'text-purple-600 dark:text-purple-400';
    case 'target':
      return 'text-orange-600 dark:text-orange-400';
    default:
      return 'text-blue-600 dark:text-blue-400';
  }
}

function getIconBgColor(type: IconType): string {
  switch (type) {
    case 'trending':
      return 'bg-green-50 dark:bg-green-500/10';
    case 'dollar':
      return 'bg-emerald-50 dark:bg-emerald-500/10';
    case 'users':
      return 'bg-blue-50 dark:bg-blue-500/10';
    case 'file':
      return 'bg-purple-50 dark:bg-purple-500/10';
    case 'target':
      return 'bg-orange-50 dark:bg-orange-500/10';
    default:
      return 'bg-blue-50 dark:bg-blue-500/10';
  }
}

function formatMetricValue(value: string | number): string {
  const str = String(value);
  // Add "B" for billion if it's in that format but missing
  if (/^\$?\d+0{9}/.test(str)) {
    return str.replace(/(\d+)0{9}/, '$1B');
  }
  return str;
}

export function MetricsGrid({ metrics }: MetricsGridProps) {
  if (!metrics || metrics.length === 0) {
    return null;
  }

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: 'easeInOut' as const },
    },
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12"
    >
      {metrics.map((metric, index) => {
        const IconComponent = getIconComponent((metric.icon as IconType) || 'target');
        const iconColor = getIconColor((metric.icon as IconType) || 'target');
        const bgColor = getIconBgColor((metric.icon as IconType) || 'target');
        const formattedValue = formatMetricValue(metric.value);

        return (
          <motion.div
            key={index}
            variants={item}
            className="bg-white dark:bg-slate-950 rounded-xl p-6 border border-slate-200 dark:border-slate-800 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-500 transition-all duration-300"
          >
            {/* Icon Circle */}
            <div className={`w-12 h-12 ${bgColor} rounded-lg flex items-center justify-center mb-4`}>
              <IconComponent className={`w-6 h-6 ${iconColor}`} strokeWidth={1.5} />
            </div>

            {/* Label */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              {metric.label}
            </p>

            {/* Value */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 + index * 0.1, duration: 0.6 }}
            >
              <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
                {formattedValue}
              </p>
            </motion.div>

            {/* Sublabel based on metric type */}
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {metric.type === 'funding' ? 'Latest' : 'Current'}
            </p>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
