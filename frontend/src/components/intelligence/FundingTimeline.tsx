import { motion } from 'framer-motion';
import { DollarSign } from 'lucide-react';

export interface FundingRound {
  stage: string;
  amount: string;
  valuation?: string;
  date: string;
  investors: string[];
  leadInvestor?: string;
}

interface FundingTimelineProps {
  rounds: FundingRound[];
  totalRaised?: string;
}

export function FundingTimeline({ rounds, totalRaised }: FundingTimelineProps) {
  if (!rounds || rounds.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="space-y-6"
    >
      {/* Summary Header */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Funding Rounds
          </p>
          <p className="text-2xl font-bold text-foreground">{rounds.length}</p>
        </div>
        {totalRaised && (
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Total Raised
            </p>
            <p className="text-2xl font-bold text-green-600">{totalRaised}</p>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        {rounds.map((round, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + index * 0.1 }}
            className="relative pl-8"
          >
            {/* Timeline dot */}
            <div className="absolute left-0 top-1.5">
              <div className="w-4 h-4 rounded-full bg-blue-500 border-4 border-white dark:border-slate-950 shadow-md" />
            </div>

            {/* Timeline connector */}
            {index < rounds.length - 1 && (
              <div className="absolute left-1.5 top-6 w-0.5 h-12 bg-slate-200 dark:bg-slate-700" />
            )}

            {/* Card */}
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-4 hover:border-blue-400 transition-colors">
              {/* Header: Stage and Amount */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    {round.stage}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">{round.date}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-green-600 font-bold">
                    <DollarSign className="w-4 h-4" />
                    <span>{round.amount}</span>
                  </div>
                </div>
              </div>

              {/* Valuation */}
              {round.valuation && (
                <p className="text-xs text-muted-foreground mb-3">
                  Valuation: <span className="font-semibold text-foreground">{round.valuation}</span>
                </p>
              )}

              {/* Investors */}
              <div className="space-y-2">
                {round.leadInvestor && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      Lead Investor
                    </p>
                    <p className="text-sm text-foreground font-medium">{round.leadInvestor}</p>
                  </div>
                )}

                {round.investors && round.investors.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      Other Investors ({round.investors.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {round.investors.map((investor, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        >
                          {investor}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
