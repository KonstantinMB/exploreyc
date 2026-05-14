import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

interface EnhancedLoadingStateProps {
  companyName: string;
}

export function EnhancedLoadingState({ companyName }: EnhancedLoadingStateProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  const pulseVariants = {
    pulse: {
      opacity: [0.4, 1, 0.4],
      transition: {
        duration: 2,
        repeat: Infinity,
      },
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center py-16 space-y-8"
    >
      {/* Animated scanner */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 100 }}
        className="relative w-32 h-32"
      >
        <motion.div
          className="absolute inset-0 border-4 border-blue-600 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute inset-0 border-4 border-transparent border-t-blue-400 border-r-blue-400 rounded-full"
          animate={{ rotate: -360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div variants={pulseVariants} animate="pulse">
            <Zap className="w-12 h-12 text-blue-600" />
          </motion.div>
        </div>
      </motion.div>

      {/* Text content */}
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="text-center space-y-4">
        <motion.div variants={itemVariants}>
          <h3 className="text-2xl font-bold text-foreground">Researching {companyName}</h3>
        </motion.div>

        <motion.div variants={itemVariants}>
          <p className="text-muted-foreground font-mono">
            Analyzing latest news, funding, and market insights...
          </p>
        </motion.div>

        {/* Progress indicators */}
        <motion.div variants={itemVariants} className="flex justify-center gap-2 pt-4">
          {['📰', '💰', '👥', '🎯'].map((icon, i) => (
            <motion.div
              key={i}
              className="text-3xl"
              animate={{
                y: [0, -10, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            >
              {icon}
            </motion.div>
          ))}
        </motion.div>

        {/* Subtitle */}
        <motion.div variants={itemVariants}>
          <p className="text-xs text-muted-foreground font-mono">
            This may take 10-30 seconds • Powered by Perplexity AI
          </p>
        </motion.div>
      </motion.div>

      {/* Loading bars */}
      <motion.div variants={itemVariants} className="w-full max-w-md space-y-3">
        {['News & Announcements', 'Funding Data', 'Market Position'].map((label, i) => (
          <div key={i} className="space-y-1">
            <p className="text-xs font-mono text-muted-foreground">{label}</p>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{
                  duration: 1.5 + i * 0.3,
                  repeat: Infinity,
                  repeatDelay: 1,
                }}
              />
            </div>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}
