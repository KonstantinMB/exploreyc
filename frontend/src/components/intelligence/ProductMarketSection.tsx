import { motion } from 'framer-motion';

interface ProductMarketSectionProps {
  sections: Array<{
    title: string;
    content: string;
  }>;
}

// Helper to parse bullet points from content
function extractBulletPoints(content: string): string[] {
  const lines = content.split('\n');
  const points: string[] = [];

  for (const line of lines) {
    const match = line.match(/^[-•*]\s+(.+)$/);
    if (match) {
      points.push(match[1].trim());
    }
  }

  return points;
}

// Helper to clean content from bullet points
function cleanContent(content: string): string {
  return content
    .replace(/^[-•*]\s+.+$/gm, '')
    .replace(/\n\n+/g, '\n')
    .trim();
}

export function ProductMarketSection({
  sections,
}: ProductMarketSectionProps) {
  if (!sections || sections.length === 0) {
    return null;
  }

  // Filter out empty sections
  const validSections = sections.filter((s) => s.content && s.content.length > 20);

  if (validSections.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.55, duration: 0.5 }}
      className="mb-12"
    >
      {/* Section Header */}
      <div className="flex items-center gap-4 mb-8">
        <h2 className="text-xl font-semibold tracking-wider uppercase text-slate-900 dark:text-white whitespace-nowrap">
          Product & Market Position
        </h2>
        <div className="flex-1 h-px bg-gradient-to-r from-slate-300 to-transparent dark:from-slate-700"></div>
      </div>

      <div className="space-y-7">
        {validSections.map((section, sectionIndex) => {
          const bulletPoints = extractBulletPoints(section.content);
          const cleanedContent = cleanContent(section.content);

          return (
            <motion.div
              key={sectionIndex}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + sectionIndex * 0.12, duration: 0.5, ease: 'easeInOut' as const }}
              className="bg-white dark:bg-slate-950 rounded-xl p-8 border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow"
            >
              {/* Section Title */}
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-5 uppercase tracking-wider">
                {section.title}
              </h3>

              {/* Main Content */}
              {cleanedContent && (
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                  {cleanedContent}
                </p>
              )}

              {/* Bullet Points */}
              {bulletPoints.length > 0 && (
                <ul className="space-y-3 mb-4">
                  {bulletPoints.map((point, pointIndex) => (
                    <motion.li
                      key={pointIndex}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.65 + sectionIndex * 0.12 + pointIndex * 0.05, duration: 0.4 }}
                      className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed"
                    >
                      <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
                      <span>{point}</span>
                    </motion.li>
                  ))}
                </ul>
              )}

              {/* Advantage Pills (for competitor/advantage sections) */}
              {section.title.toLowerCase().includes('advantage') ||
              section.title.toLowerCase().includes('compete') ? (
                <div className="mt-6 flex flex-wrap gap-3">
                  {bulletPoints.map((point, pointIndex) => (
                    <motion.span
                      key={pointIndex}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.7 + sectionIndex * 0.12 + pointIndex * 0.08, duration: 0.4 }}
                      className="px-4 py-2 text-xs font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 rounded-full hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
                    >
                      {point}
                    </motion.span>
                  ))}
                </div>
              ) : null}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
