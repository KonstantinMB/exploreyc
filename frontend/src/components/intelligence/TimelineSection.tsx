import { motion } from 'framer-motion';

interface TimelineEvent {
  date: string;
  title: string;
  description: string;
}

interface TimelineSectionProps {
  events: TimelineEvent[];
}

export function TimelineSection({ events }: TimelineSectionProps) {
  if (!events || events.length === 0) {
    return null;
  }

  // Sort events by date (most recent first) and take top 8
  const sortedEvents = [...events]
    .sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    })
    .slice(0, 8);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className="mb-12"
    >
      {/* Section Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold tracking-wider uppercase text-slate-900 dark:text-white whitespace-nowrap">
            Recent Developments
          </h2>
          <div className="flex-1 h-px bg-gradient-to-r from-slate-300 to-transparent dark:from-slate-700"></div>
        </div>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase ml-4 flex-shrink-0">
          Last 12 months
        </span>
      </div>

      <div className="relative">
        {/* Timeline gradient line */}
        <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 via-blue-400 via-50% to-slate-300 dark:from-blue-500 dark:via-blue-600 dark:to-slate-700 md:-translate-x-1/2" />

        {/* Timeline Events */}
        <div className="space-y-8">
          {sortedEvents.map((event, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + index * 0.1, duration: 0.5, ease: 'easeInOut' as const }}
              className={`relative flex ${index % 2 === 0 ? 'md:justify-start' : 'md:justify-end'}`}
            >
              {/* Timeline Dot */}
              <div className="absolute left-0 md:left-1/2 top-7 w-7 h-7 -translate-x-2 md:-translate-x-3.5 bg-white dark:bg-slate-950 border-4 border-blue-500 rounded-full shadow-md" />

              {/* Content Card */}
              <div
                className={`ml-16 md:ml-0 ${
                  index % 2 === 0 ? 'md:mr-1/2 md:pr-10' : 'md:ml-1/2 md:pl-10'
                } md:w-1/2`}
              >
                <div className="bg-white dark:bg-slate-950 rounded-lg p-6 border border-slate-200 dark:border-slate-800 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-500 transition-all duration-300">
                  {/* Date Badge */}
                  <div className="inline-block mb-3 px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 rounded-full border border-blue-100 dark:border-blue-500/20">
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
                      {event.date}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
                    {event.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {event.description.substring(0, 200)}
                    {event.description.length > 200 ? '...' : ''}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
