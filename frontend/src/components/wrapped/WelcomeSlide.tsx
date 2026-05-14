import { motion } from 'framer-motion';
import { DotPattern } from '../ui/dot-pattern';
import { GridPattern } from '../ui/grid-pattern';

interface WelcomeSlideProps {
  batch: string;
  totalCompanies: number;
}

export function WelcomeSlide({ batch, totalCompanies }: WelcomeSlideProps) {
  return (
    <div className="relative h-full flex flex-col items-center justify-center text-center p-8 bg-background overflow-hidden">
      <DotPattern color="hsl(var(--primary) / 0.15)" size={24} radius={0.5} />
      <GridPattern size={32} className="opacity-50" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative space-y-8 max-w-2xl z-10"
      >
        {/* Custom YC Logo SVG - Geometric */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="relative w-24 h-24 mx-auto"
        >
          {/* Custom SVG geometric Y */}
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <defs>
              <linearGradient id="ycGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FB651E" />
                <stop offset="100%" stopColor="#E65C00" />
              </linearGradient>
            </defs>
            {/* Square border */}
            <rect x="2" y="2" width="96" height="96" fill="url(#ycGradient)" rx="8" />
            {/* Y shape made of lines */}
            <path
              d="M 30 25 L 50 50 M 70 25 L 50 50 M 50 50 L 50 75"
              stroke="white"
              strokeWidth="8"
              strokeLinecap="square"
              fill="none"
            />
          </svg>
        </motion.div>

        {/* Terminal prompt */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="font-mono text-sm text-muted-foreground"
        >
          $ batch-wrapped --name={batch.toLowerCase().replace(' ', '-')}
        </motion.div>

        {/* Batch Name with terminal style */}
        <div className="space-y-4">
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="text-6xl md:text-7xl font-bold font-mono"
          >
            <span className="text-[#FB651E]">&gt;</span> {batch}
          </motion.h1>

          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="text-3xl md:text-4xl font-bold text-muted-foreground font-mono"
          >
            .wrapped<span className="animate-pulse">_</span>
          </motion.h2>
        </div>

        {/* Total Companies - Terminal Box */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="relative border border-[#FB651E]/30 p-8 bg-card/30 backdrop-blur-sm group hover:border-[#FB651E]/60 transition-colors"
        >
          {/* Corner brackets */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#FB651E]" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#FB651E]" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#FB651E]" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#FB651E]" />

          <div className="space-y-2">
            <div className="text-xs font-mono text-muted-foreground">TOTAL_COMPANIES:</div>
            <div className="text-6xl font-bold font-mono text-[#FB651E] tabular-nums">
              {totalCompanies.toLocaleString()}
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.6 }}
          className="font-mono text-sm text-muted-foreground"
        >
          <span className="text-[#FB651E]">&gt;</span> press → to continue
        </motion.div>
      </motion.div>
    </div>
  );
}
