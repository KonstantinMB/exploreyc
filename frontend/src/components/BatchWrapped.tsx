import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { WelcomeSlide } from './wrapped/WelcomeSlide';
import { IndustrySlide } from './wrapped/IndustrySlide';
import { GeographySlide } from './wrapped/GeographySlide';
import { HiringSlide } from './wrapped/HiringSlide';
import { TeamSizeSlide } from './wrapped/TeamSizeSlide';
import { FunFactSlide } from './wrapped/FunFactSlide';
import { HighlightsSlide } from './wrapped/HighlightsSlide';
import { ShareSlide } from './wrapped/ShareSlide';

interface BatchWrappedStats {
  batch: string;
  total_companies: number;
  hiring_count: number;
  hiring_percentage: number;
  top_industries: Array<{ name: string; count: number; percentage: number }>;
  top_countries: Array<{ name: string; count: number; percentage: number }>;
  avg_team_size: number | null;
  notable_companies: Array<{
    name: string;
    team_size: number | null;
    is_hiring: boolean;
    industry: string | null;
  }>;
  fun_fact: string;
}

interface BatchWrappedProps {
  stats: BatchWrappedStats;
  onClose: () => void;
  onExportImage: () => void;
  onShareTwitter: () => void;
}

const TOTAL_SLIDES = 8;

export function BatchWrapped({ stats, onClose, onExportImage, onShareTwitter }: BatchWrappedProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Navigation handlers
  const goToNextSlide = useCallback(() => {
    setCurrentSlide((prev) => Math.min(prev + 1, TOTAL_SLIDES - 1));
  }, []);

  const goToPrevSlide = useCallback(() => {
    setCurrentSlide((prev) => Math.max(prev - 1, 0));
  }, []);

  const goToSlide = useCallback((index: number) => {
    setCurrentSlide(index);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        goToNextSlide();
      } else if (e.key === 'ArrowLeft') {
        goToPrevSlide();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNextSlide, goToPrevSlide, onClose]);

  // Touch/swipe navigation
  const touchStartX = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;

    if (Math.abs(diff) > 50) {
      // Swipe threshold
      if (diff > 0) {
        goToNextSlide();
      } else {
        goToPrevSlide();
      }
    }
  };

  // Render current slide
  const renderSlide = () => {
    const slideProps = {
      key: currentSlide,
      initial: { opacity: 0, x: 50 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: -50 },
      transition: { duration: 0.3 },
    };

    switch (currentSlide) {
      case 0:
        return (
          <motion.div {...slideProps} className="h-full">
            <WelcomeSlide batch={stats.batch} totalCompanies={stats.total_companies} />
          </motion.div>
        );
      case 1:
        return (
          <motion.div {...slideProps} className="h-full">
            <IndustrySlide industries={stats.top_industries} />
          </motion.div>
        );
      case 2:
        return (
          <motion.div {...slideProps} className="h-full">
            <GeographySlide countries={stats.top_countries} />
          </motion.div>
        );
      case 3:
        return (
          <motion.div {...slideProps} className="h-full">
            <HiringSlide
              hiringCount={stats.hiring_count}
              hiringPercentage={stats.hiring_percentage}
              totalCompanies={stats.total_companies}
            />
          </motion.div>
        );
      case 4:
        return (
          <motion.div {...slideProps} className="h-full">
            <TeamSizeSlide avgTeamSize={stats.avg_team_size} batch={stats.batch} />
          </motion.div>
        );
      case 5:
        return (
          <motion.div {...slideProps} className="h-full">
            <FunFactSlide funFact={stats.fun_fact} />
          </motion.div>
        );
      case 6:
        return (
          <motion.div {...slideProps} className="h-full">
            <HighlightsSlide
              batch={stats.batch}
              totalCompanies={stats.total_companies}
              hiringPercentage={stats.hiring_percentage}
              topIndustry={stats.top_industries[0]?.name || 'N/A'}
              topCountry={stats.top_countries[0]?.name || 'N/A'}
              notableCompanies={stats.notable_companies}
            />
          </motion.div>
        );
      case 7:
        return (
          <motion.div {...slideProps} className="h-full">
            <ShareSlide
              batch={stats.batch}
              totalCompanies={stats.total_companies}
              onExportImage={onExportImage}
              onShareTwitter={onShareTwitter}
            />
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-background"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 bg-muted/80 hover:bg-muted rounded-full transition-colors"
        aria-label="Close wrapped"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Slide Content - Add padding at bottom for controls */}
      <div className="h-full w-full overflow-hidden pb-32">
        <AnimatePresence mode="wait">{renderSlide()}</AnimatePresence>
      </div>

      {/* Navigation Controls */}
      <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-8 px-4 bg-gradient-to-t from-background via-background to-transparent pt-8 pb-4">
        {/* Previous Button */}
        <button
          onClick={goToPrevSlide}
          disabled={currentSlide === 0}
          className="p-3 bg-muted hover:bg-muted/80 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-110"
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Slide Indicators */}
        <div className="flex gap-2">
          {Array.from({ length: TOTAL_SLIDES }).map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`h-2 rounded-full transition-all ${
                index === currentSlide
                  ? 'w-8 bg-[#FB651E]'
                  : 'w-2 bg-muted hover:bg-muted-foreground/50'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        {/* Next Button */}
        <button
          onClick={goToNextSlide}
          disabled={currentSlide === TOTAL_SLIDES - 1}
          className="p-3 bg-muted hover:bg-muted/80 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-110"
          aria-label="Next slide"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Keyboard hints - positioned above navigation */}
      <div className="absolute bottom-20 left-0 right-0 flex justify-center pointer-events-none">
        <div className="bg-muted/90 backdrop-blur-sm px-4 py-2 rounded-full text-xs text-muted-foreground font-mono shadow-lg">
          Use ← → arrow keys or swipe to navigate
        </div>
      </div>
    </div>
  );
}
