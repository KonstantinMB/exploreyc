import { motion } from 'framer-motion';

interface CompanyOverviewGridProps {
  description: string;
  industry?: string;
  locations?: string[];
  ycBatch?: string;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.3,
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

export function CompanyOverviewGrid({
  description,
  industry,
  locations,
  ycBatch,
}: CompanyOverviewGridProps) {
  // Extract key information from description
  const sentences = description.split(/[.!?]/).filter((s) => s.trim());

  // Try to extract what the company does (usually in first 1-2 sentences)
  const whatWeDo = sentences.slice(0, 2).join('. ').trim() + '.';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.5 }}
      className="mb-12"
    >
      {/* Section Header */}
      <div className="flex items-center gap-4 mb-8">
        <h2 className="text-xl font-semibold tracking-wider uppercase text-slate-900 dark:text-white whitespace-nowrap">
          Company Overview
        </h2>
        <div className="flex-1 h-px bg-gradient-to-r from-slate-300 to-transparent dark:from-slate-700"></div>
      </div>

      {/* 2x2 Grid */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        {/* What We Do */}
        <motion.div
          variants={item}
          className="bg-white dark:bg-slate-950 rounded-xl p-7 border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 letter-spacing">
            What We Do
          </p>
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {whatWeDo}
          </p>
        </motion.div>

        {/* Industry */}
        {industry && (
          <motion.div
            variants={item}
            className="bg-white dark:bg-slate-950 rounded-xl p-7 border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Industry
            </p>
            <p className="text-base font-semibold text-slate-900 dark:text-white">
              {industry}
            </p>
          </motion.div>
        )}

        {/* Headquarters */}
        {locations && locations.length > 0 && (
          <motion.div
            variants={item}
            className="bg-white dark:bg-slate-950 rounded-xl p-7 border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Headquarters
            </p>
            <p className="text-base font-semibold text-slate-900 dark:text-white">
              {locations[0]}
            </p>
            {locations.length > 1 && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                + {locations.length - 1} other location{locations.length > 2 ? 's' : ''}
              </p>
            )}
          </motion.div>
        )}

        {/* YC Batch */}
        <motion.div
          variants={item}
          className="bg-white dark:bg-slate-950 rounded-xl p-7 border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            Y Combinator
          </p>
          <p className="text-base font-semibold text-slate-900 dark:text-white">
            {ycBatch || 'Not applicable'}
          </p>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
