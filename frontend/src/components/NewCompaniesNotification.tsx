import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, TrendingUp } from 'lucide-react';
import { Button } from './ui/button';
import type { Company } from '../lib/api';

interface NewCompaniesNotificationProps {
  newCompanies: Company[];
  onDismiss: () => void;
}

export function NewCompaniesNotification({ newCompanies, onDismiss }: NewCompaniesNotificationProps) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible || newCompanies.length === 0) return null;

  // Group by batch
  const byBatch = newCompanies.reduce((acc, company) => {
    const batch = company.batch || 'Unspecified';
    if (!acc[batch]) acc[batch] = [];
    acc[batch].push(company);
    return acc;
  }, {} as Record<string, Company[]>);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4"
      >
        <div className="bg-gradient-to-r from-[#FF6600] to-[#ff8533] text-white rounded-lg shadow-2xl p-6 border-2 border-white/20">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg font-mono">
                  New YC Companies Added!
                </h3>
                <p className="text-white/90 text-sm font-mono">
                  {newCompanies.length} companies just joined Y Combinator
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="text-white hover:bg-white/20"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-3">
            {Object.entries(byBatch).slice(0, 3).map(([batch, companies]) => (
              <div key={batch} className="bg-white/10 rounded-lg p-3 backdrop-blur">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold font-mono flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    {batch}
                  </span>
                  <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs font-mono">
                    {companies.length} companies
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {companies.slice(0, 5).map((company) => (
                    <span
                      key={company.id}
                      className="bg-white/10 px-2 py-1 rounded text-xs font-mono hover:bg-white/20 transition-colors"
                    >
                      {company.name}
                    </span>
                  ))}
                  {companies.length > 5 && (
                    <span className="text-xs font-mono text-white/70">
                      +{companies.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-white/20">
            <p className="text-xs text-white/80 font-mono">
              💡 Tip: Check the Analytics tab to see trends and insights about these new batches
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
