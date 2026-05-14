import { motion } from 'framer-motion';
import { DotPattern } from '../ui/dot-pattern';
import { GridPattern } from '../ui/grid-pattern';

interface Country {
  name: string;
  count: number;
  percentage: number;
}

interface GeographySlideProps {
  countries: Country[];
}

export function GeographySlide({ countries }: GeographySlideProps) {
  const topCountry = countries[0];
  const maxCount = Math.max(...countries.map(c => c.count));

  return (
    <div className="relative h-full flex flex-col p-6 md:p-12 bg-background overflow-hidden">
      <DotPattern color="hsl(var(--primary) / 0.15)" size={24} radius={0.5} />
      <GridPattern size={32} className="opacity-50" />

      <div className="relative z-10">
        {/* Terminal Header */}
        <div className="mb-8">
          <div className="font-mono text-sm text-muted-foreground mb-2">
            $ map --countries --sort-desc
          </div>
          <h2 className="text-3xl md:text-4xl font-bold font-mono">
            <span className="text-[#FB651E]">&gt;</span> Global Reach
          </h2>
        </div>

        {/* Top Country with custom SVG globe */}
        {topCountry && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="relative border border-violet-500/30 p-6 mb-8 bg-violet-500/5 backdrop-blur-sm hover:border-violet-500/60 transition-colors"
          >
            {/* Corner brackets */}
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-violet-500" />
            <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-violet-500" />
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-violet-500" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-violet-500" />

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-xs text-muted-foreground font-mono mb-2">
                  TOP_LOCATION:
                </div>
                <div className="text-2xl font-bold font-mono mb-1 truncate pr-4">{topCountry.name}</div>
                <div className="text-sm text-muted-foreground font-mono">
                  {topCountry.count} companies • {topCountry.percentage.toFixed(1)}%
                </div>
              </div>

              {/* Custom SVG globe icon */}
              <div className="flex-shrink-0">
                <svg width="60" height="60" viewBox="0 0 60 60" className="text-violet-500">
                  {/* Globe design */}
                  <circle cx="30" cy="30" r="24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                  {/* Latitude lines */}
                  <ellipse cx="30" cy="30" rx="24" ry="8" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
                  <ellipse cx="30" cy="30" rx="24" ry="16" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
                  {/* Longitude lines */}
                  <ellipse cx="30" cy="30" rx="8" ry="24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
                  <ellipse cx="30" cy="30" rx="16" ry="24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
                  {/* Center meridian */}
                  <line x1="30" y1="6" x2="30" y2="54" stroke="currentColor" strokeWidth="2" />
                  {/* Location pins */}
                  <circle cx="30" cy="20" r="2" fill="currentColor" />
                  <circle cx="40" cy="30" r="2" fill="currentColor" />
                  <circle cx="20" cy="35" r="2" fill="currentColor" />
                </svg>
              </div>
            </div>
          </motion.div>
        )}

        {/* Country list with custom bars */}
        <div className="space-y-4 flex-1">
          {countries.map((country, index) => {
            const barWidth = (country.count / maxCount) * 100;

            return (
              <motion.div
                key={country.name}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between text-sm font-mono">
                  <span className="font-medium truncate flex-1 mr-4">
                    <span className="text-muted-foreground">{index + 1}.</span> {country.name}
                  </span>
                  <span className="text-muted-foreground whitespace-nowrap tabular-nums">
                    {country.count} • {country.percentage.toFixed(1)}%
                  </span>
                </div>

                {/* Custom SVG horizontal bar with grid pattern */}
                <div className="relative h-8 border border-border/30 bg-muted/10 overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0"
                    initial={{ width: 0 }}
                    animate={{ width: `${barWidth}%` }}
                    transition={{ duration: 0.8, delay: index * 0.1, ease: 'easeOut' }}
                  >
                    {/* Custom SVG grid pattern fill */}
                    <svg width="100%" height="100%" className="absolute inset-0">
                      <defs>
                        <pattern id={`gridPattern${index}`} x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
                          <rect width="10" height="10" fill="#8b5cf6" opacity="0.1" />
                          <path d="M 0 0 L 10 0 M 0 0 L 0 10" stroke="#8b5cf6" strokeWidth="0.5" opacity="0.3" />
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill={`url(#gridPattern${index})`} />
                      <rect width="100%" height="100%" fill="#8b5cf6" opacity="0.4" />
                    </svg>
                    <div className="absolute inset-0 flex items-center px-3">
                      <span className="text-xs font-bold font-mono text-white drop-shadow">
                        {country.percentage.toFixed(1)}%
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
