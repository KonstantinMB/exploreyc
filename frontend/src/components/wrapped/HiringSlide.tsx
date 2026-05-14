import { motion } from 'framer-motion';
import { DotPattern } from '../ui/dot-pattern';
import { GridPattern } from '../ui/grid-pattern';

interface HiringSlideProps {
  hiringCount: number;
  hiringPercentage: number;
  totalCompanies: number;
}

export function HiringSlide({ hiringCount, hiringPercentage, totalCompanies }: HiringSlideProps) {
  const isHiring = hiringPercentage >= 40;

  return (
    <div className="relative h-full flex flex-col items-center justify-center p-6 md:p-12 bg-background overflow-hidden">
      <DotPattern color="hsl(var(--primary) / 0.15)" size={24} radius={0.5} />
      <GridPattern size={32} className="opacity-50" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative text-center max-w-2xl z-10"
      >
        {/* Terminal Command */}
        <div className="font-mono text-sm text-muted-foreground mb-8">
          $ count --hiring --percentage
        </div>

        {/* Custom SVG hiring icon */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="w-24 h-24 mx-auto mb-8"
        >
          <svg viewBox="0 0 100 100" className="w-full h-full">
            {/* Geometric chart going up */}
            <defs>
              <linearGradient id="hiringGradient" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#10b981" opacity="0.3" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>
            {/* Base rectangle */}
            <rect x="10" y="10" width="80" height="80" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-500" opacity="0.3" />
            {/* Upward trend line */}
            <polyline
              points="15,75 35,55 50,60 70,35 85,25"
              fill="none"
              stroke="#10b981"
              strokeWidth="4"
              strokeLinecap="square"
            />
            {/* Data points */}
            <circle cx="15" cy="75" r="4" fill="#10b981" />
            <circle cx="35" cy="55" r="4" fill="#10b981" />
            <circle cx="50" cy="60" r="4" fill="#10b981" />
            <circle cx="70" cy="35" r="4" fill="#10b981" />
            <circle cx="85" cy="25" r="4" fill="#10b981" />
            {/* Upward arrow */}
            <path d="M 85 25 L 78 28 M 85 25 L 82 32" stroke="#10b981" strokeWidth="3" strokeLinecap="square" />
          </svg>
        </motion.div>

        {/* Header */}
        <h2 className="text-3xl md:text-4xl font-bold font-mono mb-2">
          <span className="text-[#FB651E]">&gt;</span> Hiring Status
        </h2>
        <p className="text-muted-foreground font-mono text-sm mb-12">
          {isHiring ? 'ACCELERATED_GROWTH=true' : 'BUILDING_FOUNDATIONS=true'}
        </p>

        {/* Main Stat with corner brackets */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="relative border border-emerald-500/30 p-8 mb-8 bg-emerald-500/5 backdrop-blur-sm"
        >
          {/* Corner brackets */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-500" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-500" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-500" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-500" />

          <div className="text-xs font-mono text-muted-foreground mb-2">HIRING_RATE:</div>
          <div className="text-8xl md:text-9xl font-bold font-mono text-emerald-500 tabular-nums">
            {hiringPercentage.toFixed(0)}
            <span className="text-5xl">%</span>
          </div>
        </motion.div>

        {/* Detail Grid */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="border border-border/30 bg-card/30 backdrop-blur-sm p-6"
        >
          <div className="grid grid-cols-2 gap-6 text-center font-mono">
            <div>
              <div className="text-xs text-muted-foreground mb-2">
                HIRING_COUNT:
              </div>
              <div className="text-3xl font-bold text-emerald-500 tabular-nums">
                {hiringCount.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-2">
                TOTAL_COUNT:
              </div>
              <div className="text-3xl font-bold tabular-nums">
                {totalCompanies.toLocaleString()}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
