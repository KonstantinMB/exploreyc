import { motion } from 'framer-motion';
import { DotPattern } from '../ui/dot-pattern';
import { GridPattern } from '../ui/grid-pattern';

interface Industry {
  name: string;
  count: number;
  percentage: number;
}

interface IndustrySlideProps {
  industries: Industry[];
}

export function IndustrySlide({ industries }: IndustrySlideProps) {
  const topIndustry = industries[0];
  const maxCount = Math.max(...industries.map(i => i.count));

  return (
    <div className="relative h-full flex flex-col p-6 md:p-12 bg-background overflow-hidden">
      <DotPattern color="hsl(var(--primary) / 0.15)" size={24} radius={0.5} />
      <GridPattern size={32} className="opacity-50" />

      <div className="relative z-10">
        {/* Terminal Header */}
        <div className="mb-8">
          <div className="font-mono text-sm text-muted-foreground mb-2">
            $ analyze --industries --limit=5
          </div>
          <h2 className="text-3xl md:text-4xl font-bold font-mono">
            <span className="text-[#FB651E]">&gt;</span> Top Industries
          </h2>
        </div>

        {/* Top Industry Spotlight with custom SVG icon */}
        {topIndustry && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="relative border border-[#FB651E]/30 p-6 mb-8 bg-card/30 backdrop-blur-sm hover:border-[#FB651E]/60 transition-colors"
          >
            {/* Corner brackets */}
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#FB651E]" />
            <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#FB651E]" />
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#FB651E]" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#FB651E]" />

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-xs text-muted-foreground font-mono mb-2">
                  RANK_1:
                </div>
                <div className="text-2xl font-bold font-mono mb-1 truncate pr-4">{topIndustry.name}</div>
                <div className="text-sm text-muted-foreground font-mono">
                  {topIndustry.count} companies • {topIndustry.percentage.toFixed(1)}%
                </div>
              </div>

              {/* Custom SVG trophy icon */}
              <div className="flex-shrink-0">
                <svg width="60" height="60" viewBox="0 0 60 60" className="text-[#FB651E]">
                  {/* Trophy geometric design */}
                  <rect x="20" y="35" width="20" height="15" fill="currentColor" opacity="0.3" />
                  <rect x="15" y="50" width="30" height="5" fill="currentColor" />
                  <path d="M 15 10 L 15 30 L 20 35 L 40 35 L 45 30 L 45 10 Z" fill="currentColor" opacity="0.6" />
                  <rect x="12" y="8" width="36" height="4" fill="currentColor" />
                  <text x="30" y="27" textAnchor="middle" fontSize="14" fontWeight="bold" fill="white" fontFamily="monospace">1</text>
                </svg>
              </div>
            </div>
          </motion.div>
        )}

        {/* Custom SVG Bar Chart */}
        <div className="space-y-4 flex-1">
          {industries.map((industry, index) => {
            const barWidth = (industry.count / maxCount) * 100;

            return (
              <motion.div
                key={industry.name}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between text-sm font-mono">
                  <span className="font-medium truncate flex-1 mr-4">
                    <span className="text-muted-foreground">{index + 1}.</span> {industry.name}
                  </span>
                  <span className="text-muted-foreground whitespace-nowrap tabular-nums">
                    {industry.count} • {industry.percentage.toFixed(1)}%
                  </span>
                </div>

                {/* Custom SVG horizontal bar */}
                <div className="relative h-8 border border-border/30 bg-muted/10 overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0"
                    initial={{ width: 0 }}
                    animate={{ width: `${barWidth}%` }}
                    transition={{ duration: 0.8, delay: index * 0.1, ease: 'easeOut' }}
                  >
                    {/* Custom SVG pattern fill */}
                    <svg width="100%" height="100%" className="absolute inset-0">
                      <defs>
                        <pattern id={`diagonalPattern${index}`} x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
                          <rect width="8" height="8" fill="#FB651E" opacity="0.15" />
                          <line x1="0" y1="0" x2="8" y2="8" stroke="#FB651E" strokeWidth="1" opacity="0.3" />
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill={`url(#diagonalPattern${index})`} />
                      <rect width="100%" height="100%" fill="#FB651E" opacity="0.5" />
                    </svg>
                    <div className="absolute inset-0 flex items-center px-3">
                      <span className="text-xs font-bold font-mono text-white drop-shadow">
                        {industry.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
