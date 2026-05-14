import { motion } from 'framer-motion';
import { Calendar, Dot } from 'lucide-react';

interface HeroSectionProps {
  companyName: string;
  description: string;
  lastUpdated: string;
  industry?: string;
  founded?: string;
  locations?: string[];
  ycBatch?: string;
}

export function HeroSection({
  companyName,
  description,
  lastUpdated,
  industry,
  founded,
  locations,
  ycBatch,
}: HeroSectionProps) {
  const formattedDate = new Date(lastUpdated).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Extract first sentence as tagline
  const tagline = description.split(/[.!?]/)[0] + '.';

  // Get company initial for avatar
  const initial = companyName.charAt(0).toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="mb-12"
    >
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] dark:from-[#1e3a8a] dark:to-[#1e1b4b] px-8 py-16 md:px-12 md:py-20">
        {/* Subtle background pattern overlay */}
        <div className="absolute inset-0 opacity-5">
          <svg
            className="w-full h-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative z-10">
          {/* Main content container */}
          <div className="max-w-5xl">
            {/* Avatar + Company Info */}
            <div className="flex items-start gap-6 mb-8">
              {/* Avatar */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="flex-shrink-0"
              >
                <div className="w-24 h-24 md:w-28 md:h-28 rounded-2xl bg-white dark:bg-slate-100 flex items-center justify-center shadow-2xl">
                  <span className="text-5xl md:text-6xl font-black text-blue-600">
                    {initial}
                  </span>
                </div>
              </motion.div>

              {/* Company Name & Tagline */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15, duration: 0.5 }}
                className="flex-1 pt-2"
              >
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 tracking-tight leading-tight">
                  {companyName}
                </h1>
                <p className="text-blue-50 text-base md:text-lg leading-relaxed max-w-3xl font-light">
                  {tagline}
                </p>
              </motion.div>
            </div>

            {/* Badges */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.4 }}
              className="flex flex-wrap items-center gap-3 mb-8"
            >
              {ycBatch && (
                <span className="px-4 py-2 rounded-full bg-white/20 text-white text-xs font-semibold uppercase tracking-wider backdrop-blur-md border border-white/30 hover:bg-white/25 transition-colors">
                  Y Combinator
                </span>
              )}
              {industry && (
                <span className="px-4 py-2 rounded-full bg-white/20 text-white text-xs font-semibold uppercase tracking-wider backdrop-blur-md border border-white/30 hover:bg-white/25 transition-colors">
                  {industry}
                </span>
              )}
              {locations && locations.length > 0 && (
                <span className="px-4 py-2 rounded-full bg-white/20 text-white text-xs font-semibold uppercase tracking-wider backdrop-blur-md border border-white/30 hover:bg-white/25 transition-colors">
                  📍 {locations[0]}
                </span>
              )}
            </motion.div>

            {/* Footer Info */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="flex items-center gap-4 text-blue-50 text-sm"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>Founded {founded}</span>
              </div>
              <Dot className="w-2 h-2 text-blue-200 opacity-50" />
              <span>Research updated {formattedDate}</span>
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
