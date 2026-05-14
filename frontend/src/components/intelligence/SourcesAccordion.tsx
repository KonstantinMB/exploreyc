import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ExternalLink } from 'lucide-react';

interface SourcesAccordionProps {
  citations: string[];
}

export function SourcesAccordion({ citations }: SourcesAccordionProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!citations || citations.length === 0) {
    return null;
  }

  const getDomain = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return domain.replace('www.', '');
    } catch {
      return url.replace(/^https?:\/\//, '').split('/')[0];
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="mb-8"
    >
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-xl font-semibold tracking-wide uppercase text-slate-900 dark:text-white">
          Sources
        </h2>
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase px-3 py-1 bg-slate-100 dark:bg-slate-900 rounded-full">
          {citations.length} sources
        </span>
      </div>

      {/* Accordion Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
      >
        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
          {isOpen ? 'Hide sources' : 'Show sources'}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-slate-600 dark:text-slate-400 flex-shrink-0" />
        </motion.div>
      </button>

      {/* Accordion Content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              {citations.map((citation, idx) => {
                const domain = getDomain(citation);

                return (
                  <motion.a
                    key={idx}
                    href={citation}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + idx * 0.05 }}
                    className="flex items-center gap-3 p-4 bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors group"
                  >
                    <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex-shrink-0 transition-colors" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                        {domain}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {citation}
                      </p>
                    </div>
                  </motion.a>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
