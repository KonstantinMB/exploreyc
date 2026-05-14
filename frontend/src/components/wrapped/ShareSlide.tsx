import { motion } from 'framer-motion';
import { DotPattern } from '../ui/dot-pattern';
import { GridPattern } from '../ui/grid-pattern';

interface ShareSlideProps {
  batch: string;
  totalCompanies: number;
  onExportImage: () => void;
  onShareTwitter: () => void;
}

export function ShareSlide({ batch, totalCompanies, onExportImage, onShareTwitter }: ShareSlideProps) {
  return (
    <div className="relative h-full flex flex-col items-center justify-center p-6 md:p-12 bg-background overflow-hidden">
      <DotPattern color="hsl(var(--primary) / 0.15)" size={24} radius={0.5} />
      <GridPattern size={32} className="opacity-50" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative text-center max-w-2xl w-full z-10"
      >
        {/* Terminal Command */}
        <div className="font-mono text-sm text-muted-foreground mb-8">
          $ share --platform=all --format=image
        </div>

        {/* Custom YC Logo matching WelcomeSlide */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0, rotate: -5 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ duration: 0.4, delay: 0.1, type: 'spring' }}
          className="w-20 h-20 mx-auto mb-8"
        >
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <defs>
              <linearGradient id="ycGradientShare" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FB651E" />
                <stop offset="100%" stopColor="#E65C00" />
              </linearGradient>
            </defs>
            {/* Square background */}
            <rect x="2" y="2" width="96" height="96" fill="url(#ycGradientShare)" rx="8" />
            {/* Y shape */}
            <path
              d="M 30 25 L 50 50 M 70 25 L 50 50 M 50 50 L 50 75"
              stroke="white"
              strokeWidth="8"
              strokeLinecap="square"
              fill="none"
            />
          </svg>
        </motion.div>

        {/* Header */}
        <h2 className="text-3xl md:text-4xl font-bold font-mono mb-2">
          <span className="text-[#FB651E]">&gt;</span> That's {batch}!
        </h2>
        <p className="text-lg text-muted-foreground font-mono mb-12">
          {totalCompanies.toLocaleString()} companies building the future
        </p>

        {/* Share Message with corner brackets */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="relative bg-card/30 border border-border/50 backdrop-blur-sm p-6 mb-8"
        >
          {/* Corner brackets */}
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#FB651E]" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#FB651E]" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#FB651E]" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#FB651E]" />

          <p className="text-xl font-semibold font-mono mb-2">
            Share your batch story
          </p>
          <p className="text-sm text-muted-foreground font-mono">
            BATCH={batch} • STATUS=special
          </p>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 w-full max-w-md mx-auto"
        >
          {/* Twitter Share Button with custom SVG */}
          <button
            onClick={onShareTwitter}
            className="flex-1 bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white font-semibold font-mono py-4 px-6 transition-colors flex items-center justify-center gap-3"
          >
            {/* Custom Twitter/X bird icon */}
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span>Share on X</span>
          </button>

          {/* Download Button with custom SVG */}
          <button
            onClick={onExportImage}
            className="flex-1 bg-[#FB651E] hover:bg-[#E65C00] text-white font-semibold font-mono py-4 px-6 transition-colors flex items-center justify-center gap-3"
          >
            {/* Custom download arrow icon */}
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
              <path d="M12 3 L12 16 M12 16 L7 11 M12 16 L17 11" />
              <rect x="4" y="18" width="16" height="3" fill="currentColor" />
            </svg>
            <span>Download Image</span>
          </button>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="mt-12 text-center"
        >
          <p className="text-sm text-muted-foreground font-mono">
            <span className="text-[#FB651E]">&gt;</span> Made with data from{' '}
            <a
              href="https://www.ycombinator.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#FB651E] hover:underline"
            >
              Y Combinator
            </a>
          </p>
          <p className="text-xs text-muted-foreground font-mono mt-2">
            $ exploreyc.com
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
