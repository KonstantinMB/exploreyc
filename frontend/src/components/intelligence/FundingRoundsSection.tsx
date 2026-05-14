import { motion } from 'framer-motion';
import { DollarSign, LockIcon } from 'lucide-react';

interface FundingRound {
  stage: string;
  amount: string;
  date: string;
  leadInvestor?: string;
  investors?: string[];
}

interface FundingRoundsSectionProps {
  rounds?: FundingRound[];
  totalRaised?: string;
}

export function FundingRoundsSection({
  rounds = [],
  totalRaised,
}: FundingRoundsSectionProps) {
  const hasFundingData = rounds && rounds.length > 0 && rounds[0].amount !== 'Not public';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.5 }}
      className="mb-12"
    >
      {/* Section Header */}
      <div className="flex items-center gap-4 mb-8">
        <h2 className="text-xl font-semibold tracking-wider uppercase text-slate-900 dark:text-white whitespace-nowrap">
          Funding Rounds
        </h2>
        <div className="flex-1 h-px bg-gradient-to-r from-slate-300 to-transparent dark:from-slate-700"></div>
      </div>

      {!hasFundingData ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-12 border border-slate-200 dark:border-slate-800 text-center"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-800 mb-6">
            <LockIcon className="w-8 h-8 text-slate-500 dark:text-slate-400" strokeWidth={1.5} />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
            Funding Details Not Publicly Disclosed
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
            Based on available sources, specific funding rounds, amounts, and investors remain undisclosed for this company.
          </p>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {totalRaised && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-500/10 dark:to-emerald-500/10 rounded-xl p-6 border border-green-200 dark:border-green-500/30"
            >
              <div className="flex items-center gap-3">
                <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-green-600 dark:text-green-400">
                    Total Raised
                  </p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                    {totalRaised}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          <div className="relative pl-8">
            {rounds.map((round, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + index * 0.1 }}
                className="relative mb-6"
              >
                {/* Timeline dot */}
                <div className="absolute -left-8 top-1 w-4 h-4 rounded-full bg-blue-500 border-4 border-white dark:border-slate-950 shadow-sm" />

                {/* Timeline line */}
                {index < rounds.length - 1 && (
                  <div className="absolute -left-6.5 top-5 w-0.5 h-20 bg-slate-200 dark:bg-slate-700" />
                )}

                {/* Card */}
                <div className="bg-white dark:bg-slate-950 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        {round.stage}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {round.date}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">
                        {round.amount}
                      </p>
                    </div>
                  </div>

                  {round.leadInvestor && (
                    <div className="mb-2">
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Lead Investor
                      </p>
                      <p className="text-sm text-slate-900 dark:text-white">
                        {round.leadInvestor}
                      </p>
                    </div>
                  )}

                  {round.investors && round.investors.length > 0 && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                        Other Investors ({round.investors.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {round.investors.map((investor, idx) => (
                          <span
                            key={idx}
                            className="inline-block px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded"
                          >
                            {investor}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
