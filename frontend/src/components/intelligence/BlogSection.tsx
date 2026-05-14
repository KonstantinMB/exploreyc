import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

interface BlogSectionProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  content: string;
  items?: string[];
  highlighted?: boolean;
  index?: number;
}

export function BlogSection({
  title,
  subtitle,
  icon: Icon,
  content,
  items,
  highlighted = false,
  index = 0,
}: BlogSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.05 }}
      className={`${
        highlighted
          ? 'bg-blue-50 dark:bg-blue-500/5 border-2 border-blue-200 dark:border-blue-500/30'
          : 'bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800'
      } rounded-xl p-6 md:p-8`}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        {Icon && <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" />}
        <div className="flex-1">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-1">
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="prose prose-sm dark:prose-invert max-w-none mb-4">
        <p className="text-base leading-relaxed text-foreground whitespace-pre-wrap">
          {content}
        </p>
      </div>

      {/* Items List (bullet points) */}
      {items && items.length > 0 && (
        <div className="space-y-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
              <p className="text-sm text-foreground leading-relaxed">{item}</p>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
