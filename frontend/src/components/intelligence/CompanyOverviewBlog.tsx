import { motion } from 'framer-motion';
import { Clock, MapPin } from 'lucide-react';

interface CompanyOverviewBlogProps {
  companyName: string;
  description: string;
  lastUpdated: string;
  industry?: string;
  founded?: string;
  locations?: string[];
  ycBatch?: string;
  badges?: string[];
}

/**
 * Transform raw Perplexity response into concise, readable summary
 */
function transformDescription(rawText: string): string {
  // Remove markdown formatting
  let cleaned = rawText
    .replace(/\*\*(.+?)\*\*/g, '$1') // Bold
    .replace(/\*(.+?)\*/g, '$1') // Italic
    .trim();

  // Split into sentences and take the first 2-3 most meaningful ones
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 20);

  // Take first 2-3 sentences or until we have ~150-200 chars
  let result = '';
  for (const sentence of sentences) {
    if ((result + sentence).length > 220) break;
    result += (result ? ' ' : '') + sentence;
  }

  return result || cleaned.substring(0, 220);
}

export function CompanyOverviewBlog({
  companyName,
  description,
  lastUpdated,
  industry,
  founded,
  locations,
  ycBatch,
  badges = [],
}: CompanyOverviewBlogProps) {
  const formattedDate = new Date(lastUpdated).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const transformedDescription = transformDescription(description);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="mb-12"
    >
      {/* Hero Background */}
      <div className="bg-white dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden mb-8">
        <div className="px-6 py-8 md:px-10 md:py-12">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="w-full"
          >
            {/* Company Name */}
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 leading-tight">
              {companyName}
            </h1>

            {/* Description */}
            <p className="text-base md:text-lg text-foreground mb-6 leading-relaxed max-w-4xl font-light">
              {transformedDescription}
            </p>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-5">
              {badges.map((badge) => (
                <span
                  key={badge}
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30"
                >
                  {badge}
                </span>
              ))}
            </div>

            {/* Updated timestamp */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span>Research updated {formattedDate}</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Company Details Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        {industry && (
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-4 hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
              Industry
            </p>
            <p className="text-base font-bold text-foreground">{industry}</p>
          </div>
        )}

        {founded && (
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-4 hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
              Founded
            </p>
            <p className="text-base font-bold text-foreground">{founded}</p>
          </div>
        )}

        {locations && locations.length > 0 && (
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-4 hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              Locations
            </p>
            <p className="text-sm font-bold text-foreground">{locations.slice(0, 2).join(', ')}</p>
          </div>
        )}

        {ycBatch && (
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-4 hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
              YC Batch
            </p>
            <p className="text-base font-bold text-foreground">{ycBatch}</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
