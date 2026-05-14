import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const LOADING_TIPS = [
  'Discovering startups from every YC batch...',
  'Mapping companies across the globe...',
  'Indexing industries and hiring status...',
  'Building your explorer view...',
  'Almost there...',
];

interface LoadingScreenProps {
  message?: string;
  progress?: number;
  total?: number;
}

export function LoadingScreen({ message, progress = 0, total = 0 }: LoadingScreenProps) {
  const [tipIndex, setTipIndex] = useState(0);
  const showProgress = total > 0 && progress > 0;

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % LOADING_TIPS.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const displayMessage = message || LOADING_TIPS[tipIndex];
  const progressPct = showProgress ? Math.min(100, (progress / total) * 100) : 0;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F6F6EF] dark:bg-[#0a0a0a] overflow-hidden"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#FB651E]/5 via-transparent to-[#FF8833]/5" />

      <div className="relative z-10 flex flex-col items-center">
        {/* YC Logo with bounce */}
        <motion.div
          className="mb-10 flex flex-col items-center"
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.6, type: 'spring', stiffness: 120 }}
        >
          <motion.img
            src="/yc-logo.png"
            alt="YC"
            className="h-20 w-20 object-contain drop-shadow-lg"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.p
            className="mt-4 font-mono text-sm text-muted-foreground tracking-wider"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            YC Company Explorer
          </motion.p>
        </motion.div>

        {/* Spinner with glow */}
        <motion.div
          className="relative h-14 w-14 mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, rotate: 360 }}
          transition={{ opacity: { duration: 0.5 }, rotate: { duration: 1.5, repeat: Infinity, ease: 'linear' } }}
        >
          <div className="absolute inset-0 rounded-full border-4 border-[#FB651E]/20" />
          <motion.div
            className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#FB651E]"
            animate={{ boxShadow: ['0 0 0 0 rgba(251,101,30,0.3)', '0 0 20px 4px rgba(251,101,30,0.2)'] }}
            transition={{ duration: 1, repeat: Infinity, repeatType: 'reverse' }}
          />
        </motion.div>

        {/* Rotating tip message */}
        <AnimatePresence mode="wait">
          <motion.p
            key={tipIndex}
            className="font-mono text-sm text-muted-foreground text-center max-w-xs min-h-[2.5rem] flex items-center justify-center"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
          >
            {displayMessage}
          </motion.p>
        </AnimatePresence>

        {/* Progress bar - only show when we have real progress */}
        {showProgress && (
          <motion.div
            className="mt-6 w-72"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="h-1.5 overflow-hidden rounded-full bg-[#FB651E]/20">
              <motion.div
                className="h-full bg-gradient-to-r from-[#FB651E] to-[#FF8833] rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
