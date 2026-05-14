import { motion } from 'framer-motion';
import { CheckCircle2, Circle } from 'lucide-react';

interface StatisticItem {
  label: string;
  value: string | null;
  isPublic: boolean;
}

interface StatisticsSectionProps {
  statistics: StatisticItem[];
}

export function StatisticsSection({ statistics }: StatisticsSectionProps) {
  if (!statistics || statistics.length === 0) {
    return null;
  }

  const publicStats = statistics.filter((s) => s.isPublic && s.value);
  const privateStats = statistics.filter((s) => !s.isPublic);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
      className="mb-12"
    >
      {/* Section Header */}
      <div className="flex items-center gap-4 mb-8">
        <h2 className="text-xl font-semibold tracking-wider uppercase text-slate-900 dark:text-white whitespace-nowrap">
          Key Metrics & Statistics
        </h2>
        <div className="flex-1 h-px bg-gradient-to-r from-slate-300 to-transparent dark:from-slate-700"></div>
      </div>

      {publicStats.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.5 }}
          className="bg-white dark:bg-slate-950 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 mb-6"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                  <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Metric
                  </th>
                  <th className="text-right px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Value
                  </th>
                  <th className="text-center px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {publicStats.map((stat, index) => (
                  <motion.tr
                    key={index}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.45 + index * 0.05, duration: 0.4 }}
                    className={index % 2 === 0 ? '' : 'bg-slate-50 dark:bg-slate-900/30'}
                  >
                    <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                      {stat.label}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-semibold text-slate-900 dark:text-white">
                      {stat.value}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" strokeWidth={2} />
                        <span className="text-xs text-green-600 dark:text-green-400 font-semibold">
                          Verified
                        </span>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {privateStats.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="bg-slate-50 dark:bg-slate-900/50 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <tbody>
                {privateStats.slice(0, 5).map((stat, index) => (
                  <motion.tr
                    key={index}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35 + index * 0.05 }}
                    className={index % 2 === 0 ? '' : 'bg-slate-100 dark:bg-slate-900/70'}
                  >
                    <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                      {stat.label}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-semibold text-slate-400 dark:text-slate-500">
                      –
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Circle className="w-3 h-3 text-slate-400 dark:text-slate-600" />
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                          Not public
                        </span>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
