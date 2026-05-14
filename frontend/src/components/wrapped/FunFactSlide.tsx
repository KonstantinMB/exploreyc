import { motion } from 'framer-motion';
import { DotPattern } from '../ui/dot-pattern';
import { GridPattern } from '../ui/grid-pattern';

interface FunFactSlideProps {
  funFact: string;
}

export function FunFactSlide({ funFact }: FunFactSlideProps) {
  return (
    <div className="relative h-full flex flex-col items-center justify-center p-6 md:p-12 bg-background overflow-hidden">
      <DotPattern color="hsl(var(--primary) / 0.15)" size={24} radius={0.5} />
      <GridPattern size={32} className="opacity-50" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative text-center max-w-3xl z-10"
      >
        {/* Terminal Command */}
        <div className="font-mono text-sm text-muted-foreground mb-8">
          $ generate --fun-fact --random
        </div>

        {/* Custom SVG lightbulb icon */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0, rotate: -10 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ duration: 0.4, delay: 0.1, type: 'spring' }}
          className="w-24 h-24 mx-auto mb-8"
        >
          <svg viewBox="0 0 100 100" className="w-full h-full text-amber-500">
            {/* Lightbulb geometric design */}
            <defs>
              <linearGradient id="bulbGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
              {/* Glow effect */}
              <radialGradient id="glowGradient" cx="50%" cy="40%">
                <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
              </radialGradient>
            </defs>
            {/* Glow */}
            <circle cx="50" cy="40" r="35" fill="url(#glowGradient)" />
            {/* Bulb body */}
            <circle cx="50" cy="40" r="20" fill="url(#bulbGradient)" />
            {/* Filament */}
            <path d="M 45 35 Q 50 30 55 35 Q 50 40 45 35" stroke="#fef3c7" strokeWidth="2" fill="none" />
            {/* Base */}
            <rect x="42" y="58" width="16" height="4" fill="currentColor" opacity="0.6" />
            <rect x="40" y="62" width="20" height="3" fill="currentColor" opacity="0.6" />
            <rect x="40" y="65" width="20" height="3" fill="currentColor" opacity="0.6" />
            {/* Light rays */}
            <line x1="30" y1="25" x2="22" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="square" opacity="0.5" />
            <line x1="70" y1="25" x2="78" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="square" opacity="0.5" />
            <line x1="25" y1="40" x2="15" y2="40" stroke="currentColor" strokeWidth="2" strokeLinecap="square" opacity="0.5" />
            <line x1="75" y1="40" x2="85" y2="40" stroke="currentColor" strokeWidth="2" strokeLinecap="square" opacity="0.5" />
          </svg>
        </motion.div>

        {/* Header */}
        <h2 className="text-3xl md:text-4xl font-bold font-mono mb-12">
          <span className="text-[#FB651E]">&gt;</span> Fun Fact
        </h2>

        {/* Fun Fact Box with terminal styling */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="relative border border-amber-500/30 p-8 md:p-12 bg-amber-500/5 backdrop-blur-sm"
        >
          {/* Corner brackets */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-amber-500" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-amber-500" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-amber-500" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-amber-500" />

          <div className="text-xs font-mono text-muted-foreground mb-4">OUTPUT:</div>
          <p className="text-xl md:text-2xl font-mono leading-relaxed">
            {funFact}
          </p>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="mt-8 font-mono text-sm text-muted-foreground"
        >
          <span className="text-amber-500">&gt;</span> Innovation happens in unexpected ways
        </motion.div>
      </motion.div>
    </div>
  );
}
