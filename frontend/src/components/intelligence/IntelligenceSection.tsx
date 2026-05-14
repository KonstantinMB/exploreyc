import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Newspaper, DollarSign, Users, Target, Handshake, BarChart3 } from 'lucide-react';
import type { IntelligenceSection } from '../../lib/intelligenceParser';
import { formatIntelligenceText } from '../../lib/intelligenceParser';

interface IntelligenceSectionProps {
  section: IntelligenceSection;
  index: number;
}

const SECTION_ICONS: Record<IntelligenceSection['type'], React.ComponentType<{ className: string }>> = {
  news: Newspaper,
  funding: DollarSign,
  leadership: Users,
  product: Target,
  partnerships: Handshake,
  summary: BarChart3,
};

const SECTION_COLORS: Record<IntelligenceSection['type'], string> = {
  news: 'border-l-amber-500',
  funding: 'border-l-emerald-500',
  leadership: 'border-l-blue-500',
  product: 'border-l-purple-500',
  partnerships: 'border-l-rose-500',
  summary: 'border-l-slate-500',
};

export function IntelligenceSectionComponent({ section, index }: IntelligenceSectionProps) {
  const [isExpanded, setIsExpanded] = useState(index < 2); // First two sections expanded by default

  const Icon = SECTION_ICONS[section.type];
  const borderColor = SECTION_COLORS[section.type];
  const formattedContent = formatIntelligenceText(section.content);
  const isLong = formattedContent.split('\n').length > 5;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 * (index + 1) }}
    >
      <div
        className={`bg-white dark:bg-slate-950 border-l-4 ${borderColor} border border-l-0 border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden`}
      >
        {/* Header - clickable if content is long */}
        <button
          onClick={() => isLong && setIsExpanded(!isExpanded)}
          className={`w-full px-6 py-4 flex items-center justify-between text-left transition-colors ${
            isLong ? 'hover:bg-slate-50 dark:hover:bg-slate-900' : ''
          }`}
          disabled={!isLong}
        >
          <div className="flex items-center gap-3">
            <Icon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <h3 className="text-base font-semibold text-foreground">{section.title}</h3>
          </div>
          {isLong && (
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </motion.div>
          )}
        </button>

        {/* Content */}
        <AnimatePresence>
          {!isLong || isExpanded ? (
            <motion.div
              initial={isLong ? { opacity: 0, height: 0 } : undefined}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="px-6 pb-4 pt-0 border-t border-slate-200 dark:border-slate-800">
                <div className="space-y-3">
                  {formattedContent.split('\n\n').map((paragraph, i) => (
                    <div key={i} className="text-sm leading-relaxed text-foreground">
                      {paragraph.split('\n').map((line, j) => (
                        <div key={j} className="break-words">
                          {line}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Expand indicator */}
                {isLong && !isExpanded && (
                  <div className="mt-4 text-center">
                    <span className="text-xs text-muted-foreground">
                      Click to read more...
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
