import { motion } from 'framer-motion';

interface TeamMember {
  name: string;
  title: string;
  background?: string;
}

interface LeadershipSectionProps {
  founders?: string[];
  teamInfo?: string;
}

export function LeadershipSection({
  founders = [],
  teamInfo,
}: LeadershipSectionProps) {
  // Parse founders from raw text
  const teamMembers: TeamMember[] = [];

  if (founders && founders.length > 0) {
    founders.forEach((founder) => {
      const match = founder.match(/(.+?)(?:\s*[-–]\s*(.+))?$/);
      if (match) {
        teamMembers.push({
          name: match[1].trim(),
          title: match[2]?.trim() || 'Co-founder',
          background: 'Founder & Leadership',
        });
      }
    });
  }

  if (teamMembers.length === 0) {
    return null;
  }

  if (teamMembers.length === 0) {
    return null;
  }

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.45,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: 'easeInOut' as const },
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45, duration: 0.5 }}
      className="mb-12"
    >
      {/* Section Header */}
      <div className="flex items-center gap-4 mb-8">
        <h2 className="text-xl font-semibold tracking-wider uppercase text-slate-900 dark:text-white whitespace-nowrap">
          Leadership & Team
        </h2>
        <div className="flex-1 h-px bg-gradient-to-r from-slate-300 to-transparent dark:from-slate-700"></div>
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8"
      >
        {teamMembers.map((member, index) => {
          const initials = member.name
            .split(' ')
            .map((n) => n.charAt(0))
            .join('')
            .toUpperCase();

          return (
            <motion.div
              key={index}
              variants={item}
              className="bg-white dark:bg-slate-950 rounded-xl p-7 border border-slate-200 dark:border-slate-800 text-center hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-500 transition-all duration-300"
            >
              {/* Avatar */}
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 flex items-center justify-center shadow-md">
                <span className="text-3xl font-bold text-white">{initials}</span>
              </div>

              {/* Name */}
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2 text-base">
                {member.name}
              </h3>

              {/* Title */}
              <p className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider mb-3">
                {member.title}
              </p>

              {/* Background */}
              {member.background && (
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {member.background}
                </p>
              )}
            </motion.div>
          );
        })}
      </motion.div>

      {/* Team Info / Research Teams */}
      {teamInfo && teamInfo.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="p-6 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-200 dark:border-blue-500/30"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 mb-3">
            Research & Focus Areas
          </p>
          <div className="flex flex-wrap gap-2.5">
            {teamInfo.split(',').map((team, index) => (
              <span
                key={index}
                className="px-3.5 py-2 text-xs font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-full border border-blue-100 dark:border-blue-500/20"
              >
                {team.trim()}
              </span>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
