import { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';

interface CompanyHeroCardProps {
  companyName: string;
  summary: string;
  lastUpdated: string;
  badges?: string[];
}

export function CompanyHeroCard({
  companyName,
  summary,
  lastUpdated,
  badges = ['Y Combinator'],
}: CompanyHeroCardProps) {
  const [logoError, setLogoError] = useState(false);

  // Extract domain from company name for Clearbit logo API
  const domain = companyName.toLowerCase().replace(/\s+/g, '');
  const logoUrl = !logoError
    ? `https://logo.clearbit.com/${domain}.com`
    : null;

  const formattedDate = new Date(lastUpdated).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-8">
          <div className="flex items-start gap-6">
            {/* Logo */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex-shrink-0"
            >
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center overflow-hidden">
                {logoUrl && !logoError ? (
                  <img
                    src={logoUrl}
                    alt={companyName}
                    className="w-14 h-14 object-contain"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <div className="text-2xl font-bold text-slate-600 dark:text-slate-300">
                    {companyName.substring(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
            </motion.div>

            {/* Content */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="flex-1"
            >
              {/* Company Name */}
              <h1 className="text-3xl font-bold text-foreground mb-2">
                {companyName}
              </h1>

              {/* Summary - Short description */}
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed max-w-3xl">
                {summary.length > 150 ? summary.substring(0, 150) + '...' : summary}
              </p>

              {/* Metadata Row */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Badges */}
                <div className="flex flex-wrap gap-2">
                  {badges.map((badge) => (
                    <span
                      key={badge}
                      className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30"
                    >
                      {badge}
                    </span>
                  ))}
                </div>

                {/* Last Updated */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-3 border-l border-slate-200 dark:border-slate-700">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formattedDate}</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
