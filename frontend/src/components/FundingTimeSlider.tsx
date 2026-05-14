import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';

interface FundingTimeSliderProps {
  startYear?: number;
  endYear?: number;
  currentDate: string; // ISO date string or batch name
  onDateChange: (date: string) => void;
  batches?: string[]; // Optional list of YC batches
  autoPlaySpeed?: number; // milliseconds per step
}

export function FundingTimeSlider({
  startYear = 2005,
  endYear = new Date().getFullYear(),
  currentDate,
  onDateChange,
  batches,
  autoPlaySpeed = 1000,
}: FundingTimeSliderProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Generate timeline items (batches or years)
  const timelineItems = batches || generateYearBatches(startYear, endYear);

  // Find current index based on currentDate
  useEffect(() => {
    const index = timelineItems.findIndex(item => item === currentDate);
    if (index !== -1) {
      setCurrentIndex(index);
    }
  }, [currentDate, timelineItems]);

  // Auto-play functionality
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => {
        const next = prev + 1;
        if (next >= timelineItems.length) {
          setIsPlaying(false);
          return prev;
        }
        onDateChange(timelineItems[next]);
        return next;
      });
    }, autoPlaySpeed);

    return () => clearInterval(interval);
  }, [isPlaying, timelineItems, onDateChange, autoPlaySpeed]);

  const handleSliderChange = useCallback(
    (value: number[]) => {
      const index = value[0];
      setCurrentIndex(index);
      onDateChange(timelineItems[index]);
    },
    [timelineItems, onDateChange]
  );

  const handlePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  const handleSkipBack = useCallback(() => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      onDateChange(timelineItems[newIndex]);
    }
  }, [currentIndex, timelineItems, onDateChange]);

  const handleSkipForward = useCallback(() => {
    if (currentIndex < timelineItems.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      onDateChange(timelineItems[newIndex]);
    }
  }, [currentIndex, timelineItems, onDateChange]);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex(timelineItems.length - 1);
    onDateChange(timelineItems[timelineItems.length - 1]);
  }, [timelineItems, onDateChange]);

  // Calculate progress percentage
  const progress = (currentIndex / (timelineItems.length - 1)) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border/50 p-4 z-30"
    >
      <div className="max-w-7xl mx-auto">
        {/* Timeline explanation */}
        <div className="text-xs text-muted-foreground mb-2">
          <span className="font-semibold text-foreground">Timeline:</span>{' '}
          Each step is a YC batch. Move the slider to see which companies had joined YC by that batch.
          {currentDate === 'Present' ? ' Showing all companies.' : ' Amounts are current totals.'}
        </div>

        {/* Terminal command */}
        <div className="font-mono text-xs text-muted-foreground mb-3">
          $ timeline --date=<span className="text-emerald-500">{currentDate}</span>{' '}
          {isPlaying && <span className="text-blue-500 animate-pulse">--playing</span>}
        </div>

        {/* Main controls */}
        <div className="flex items-center gap-4">
          {/* Play/Pause and Skip buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="icon"
              onClick={handleSkipBack}
              disabled={currentIndex === 0}
              className="h-8 w-8"
            >
              <SkipBack className="h-4 w-4" />
            </Button>

            <Button
              variant="default"
              size="icon"
              onClick={handlePlayPause}
              className="h-10 w-10 bg-emerald-500 hover:bg-emerald-600"
            >
              <AnimatePresence mode="wait">
                {isPlaying ? (
                  <motion.div
                    key="pause"
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 90 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Pause className="h-5 w-5" fill="currentColor" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="play"
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 90 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Play className="h-5 w-5" fill="currentColor" />
                  </motion.div>
                )}
              </AnimatePresence>
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={handleSkipForward}
              disabled={currentIndex === timelineItems.length - 1}
              className="h-8 w-8"
            >
              <SkipForward className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="font-mono text-xs"
            >
              Reset
            </Button>
          </div>

          {/* Slider */}
          <div className="flex-1 relative">
            <Slider
              value={[currentIndex]}
              onValueChange={handleSliderChange}
              max={timelineItems.length - 1}
              step={1}
              className="relative"
            />

            {/* Progress bar with corner brackets */}
            <div className="mt-2 relative">
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#FB651E] via-emerald-500 to-blue-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Date markers */}
              <div className="flex justify-between mt-2 font-mono text-xs text-muted-foreground">
                <span>{timelineItems[0]}</span>
                <motion.span
                  key={currentDate}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="font-bold text-foreground"
                >
                  {currentDate}
                </motion.span>
                <span>{timelineItems[timelineItems.length - 1]}</span>
              </div>
            </div>
          </div>

          {/* Stats display */}
          <div className="shrink-0 font-mono text-xs">
            <div className="bg-card border border-border/50 rounded px-3 py-2 min-w-[120px]">
              <div className="text-muted-foreground mb-1">POSITION:</div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-emerald-500 tabular-nums">
                  {currentIndex + 1}
                </span>
                <span className="text-muted-foreground">
                  / {timelineItems.length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Batch milestone markers (optional) */}
        {batches && batches.length < 50 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {batches.map((batch, idx) => (
              <button
                key={batch}
                onClick={() => {
                  setCurrentIndex(idx);
                  onDateChange(batch);
                }}
                className={`px-2 py-1 text-xs font-mono rounded transition-colors ${
                  idx === currentIndex
                    ? 'bg-emerald-500 text-white'
                    : idx < currentIndex
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                {batch}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Helper function to generate batch names from year range
function generateYearBatches(startYear: number, endYear: number): string[] {
  const batches: string[] = [];
  const seasons = ['Winter', 'Summer'];

  for (let year = startYear; year <= endYear; year++) {
    for (const season of seasons) {
      batches.push(`${season} ${year}`);
    }
  }

  return batches;
}
