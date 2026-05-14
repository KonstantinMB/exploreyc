import { motion } from 'framer-motion';
import { DotPattern } from '../ui/dot-pattern';
import { GridPattern } from '../ui/grid-pattern';

interface TeamSizeSlideProps {
  avgTeamSize: number | null;
  batch: string;
}

export function TeamSizeSlide({ avgTeamSize, batch }: TeamSizeSlideProps) {
  const hasData = avgTeamSize !== null && avgTeamSize > 0;

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
          $ avg --team-size --batch={batch.toLowerCase().replace(' ', '-')}
        </div>

        {/* Custom SVG team icon */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="w-24 h-24 mx-auto mb-8"
        >
          <svg viewBox="0 0 100 100" className="w-full h-full text-blue-500">
            {/* Group of people represented geometrically */}
            <defs>
              <linearGradient id="teamGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#2563eb" />
              </linearGradient>
            </defs>
            {/* Person 1 */}
            <circle cx="30" cy="35" r="8" fill="url(#teamGradient)" opacity="0.8" />
            <rect x="22" y="45" width="16" height="20" fill="url(#teamGradient)" opacity="0.8" rx="2" />
            {/* Person 2 (larger - center) */}
            <circle cx="50" cy="32" r="10" fill="url(#teamGradient)" />
            <rect x="40" y="44" width="20" height="24" fill="url(#teamGradient)" rx="2" />
            {/* Person 3 */}
            <circle cx="70" cy="35" r="8" fill="url(#teamGradient)" opacity="0.8" />
            <rect x="62" y="45" width="16" height="20" fill="url(#teamGradient)" opacity="0.8" rx="2" />
            {/* Connection lines */}
            <line x1="38" y1="55" x2="46" y2="55" stroke="#3b82f6" strokeWidth="2" opacity="0.5" />
            <line x1="54" y1="55" x2="62" y2="55" stroke="#3b82f6" strokeWidth="2" opacity="0.5" />
          </svg>
        </motion.div>

        {/* Header */}
        <h2 className="text-3xl md:text-4xl font-bold font-mono mb-2">
          <span className="text-[#FB651E]">&gt;</span> Team Size
        </h2>
        <p className="text-muted-foreground font-mono text-sm mb-12">
          {hasData ? 'AVERAGE_TEAM_COMPOSITION' : 'DATA_NOT_AVAILABLE'}
        </p>

        {hasData ? (
          <>
            {/* Main Stat with corner brackets */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="relative border border-blue-500/30 p-12 mb-8 bg-blue-500/5 backdrop-blur-sm"
            >
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-blue-500" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-blue-500" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-blue-500" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-blue-500" />

              <div className="text-xs font-mono text-muted-foreground mb-3">AVG_TEAM_SIZE:</div>
              <div className="text-8xl md:text-9xl font-bold font-mono text-blue-500 tabular-nums">
                {Math.round(avgTeamSize)}
              </div>
              <div className="text-sm font-mono text-muted-foreground mt-4">
                people per company
              </div>
            </motion.div>

            {/* Additional context */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="border border-border/30 bg-card/30 backdrop-blur-sm p-4 font-mono text-sm text-muted-foreground"
            >
              <span className="text-[#FB651E]">&gt;</span> Building lean and focused teams
            </motion.div>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="border border-border/30 bg-card/30 backdrop-blur-sm p-8 font-mono"
          >
            <div className="text-xl text-muted-foreground mb-2">
              Team size data not available for this batch
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="text-[#FB651E]">&gt;</span> Focus on building great products
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
