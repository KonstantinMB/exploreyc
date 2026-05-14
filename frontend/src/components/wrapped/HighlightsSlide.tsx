import { motion } from 'framer-motion';
import { DotPattern } from '../ui/dot-pattern';
import { GridPattern } from '../ui/grid-pattern';

interface NotableCompany {
  name: string;
  team_size: number | null;
  is_hiring: boolean;
  industry: string | null;
}

interface HighlightsSlideProps {
  batch: string;
  totalCompanies: number;
  hiringPercentage: number;
  topIndustry: string;
  topCountry: string;
  notableCompanies: NotableCompany[];
}

export function HighlightsSlide({
  batch,
  totalCompanies,
  hiringPercentage,
  topIndustry,
  topCountry,
  notableCompanies,
}: HighlightsSlideProps) {
  const stats = [
    {
      label: 'Total Companies',
      value: totalCompanies.toLocaleString(),
      svg: (
        <svg viewBox="0 0 40 40" className="w-full h-full">
          {/* Trophy geometric design */}
          <rect x="13" y="23" width="14" height="10" fill="currentColor" opacity="0.3" />
          <rect x="10" y="33" width="20" height="4" fill="currentColor" />
          <path d="M 10 7 L 10 20 L 13 23 L 27 23 L 30 20 L 30 7 Z" fill="currentColor" opacity="0.6" />
          <rect x="8" y="5" width="24" height="3" fill="currentColor" />
          <text x="20" y="18" textAnchor="middle" fontSize="10" fontWeight="bold" fill="white" fontFamily="monospace">1</text>
        </svg>
      ),
      color: 'text-[#FB651E]',
      borderColor: 'border-[#FB651E]/30',
      bgColor: 'bg-[#FB651E]/5',
    },
    {
      label: 'Currently Hiring',
      value: `${hiringPercentage}%`,
      svg: (
        <svg viewBox="0 0 40 40" className="w-full h-full">
          {/* Upward trend arrow */}
          <rect x="2" y="2" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
          <polyline
            points="6,30 14,22 20,24 28,14 34,10"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="square"
          />
          <circle cx="6" cy="30" r="2" fill="currentColor" />
          <circle cx="14" cy="22" r="2" fill="currentColor" />
          <circle cx="20" cy="24" r="2" fill="currentColor" />
          <circle cx="28" cy="14" r="2" fill="currentColor" />
          <circle cx="34" cy="10" r="2" fill="currentColor" />
          <path d="M 34 10 L 29 12 M 34 10 L 32 15" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
        </svg>
      ),
      color: 'text-emerald-500',
      borderColor: 'border-emerald-500/30',
      bgColor: 'bg-emerald-500/5',
    },
    {
      label: 'Top Industry',
      value: topIndustry,
      svg: (
        <svg viewBox="0 0 40 40" className="w-full h-full">
          {/* Briefcase geometric design */}
          <rect x="8" y="16" width="24" height="18" fill="currentColor" opacity="0.4" rx="1" />
          <rect x="8" y="16" width="24" height="4" fill="currentColor" opacity="0.6" />
          <rect x="15" y="12" width="10" height="5" fill="currentColor" opacity="0.5" />
          <rect x="18" y="20" width="4" height="8" fill="currentColor" opacity="0.3" />
          <line x1="8" y1="24" x2="32" y2="24" stroke="currentColor" strokeWidth="1" opacity="0.4" />
        </svg>
      ),
      color: 'text-blue-500',
      borderColor: 'border-blue-500/30',
      bgColor: 'bg-blue-500/5',
    },
    {
      label: 'Top Country',
      value: topCountry,
      svg: (
        <svg viewBox="0 0 40 40" className="w-full h-full">
          {/* Globe with latitude/longitude */}
          <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
          <ellipse cx="20" cy="20" rx="16" ry="5" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4" />
          <ellipse cx="20" cy="20" rx="16" ry="11" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4" />
          <ellipse cx="20" cy="20" rx="5" ry="16" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4" />
          <ellipse cx="20" cy="20" rx="11" ry="16" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4" />
          <line x1="20" y1="4" x2="20" y2="36" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="20" cy="13" r="1.5" fill="currentColor" />
          <circle cx="27" cy="20" r="1.5" fill="currentColor" />
          <circle cx="13" cy="23" r="1.5" fill="currentColor" />
        </svg>
      ),
      color: 'text-violet-500',
      borderColor: 'border-violet-500/30',
      bgColor: 'bg-violet-500/5',
    },
  ];

  return (
    <div className="relative h-full flex flex-col p-6 md:p-12 bg-background overflow-hidden">
      <DotPattern color="hsl(var(--primary) / 0.15)" size={24} radius={0.5} />
      <GridPattern size={32} className="opacity-50" />

      <div className="relative z-10">
        {/* Terminal Header */}
        <div className="mb-8">
          <div className="font-mono text-sm text-muted-foreground mb-2">
            $ summary --batch={batch.toLowerCase().replace(' ', '-')} --highlights
          </div>
          <h2 className="text-3xl md:text-4xl font-bold font-mono">
            <span className="text-[#FB651E]">&gt;</span> Batch Highlights
          </h2>
          <p className="text-muted-foreground font-mono text-sm mt-2">
            KEY_METRICS=compiled
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className={`relative ${stat.bgColor} border ${stat.borderColor} backdrop-blur-sm p-6`}
            >
              {/* Corner brackets */}
              <div className={`absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 ${stat.borderColor.replace('/30', '')}`} />
              <div className={`absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 ${stat.borderColor.replace('/30', '')}`} />
              <div className={`absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 ${stat.borderColor.replace('/30', '')}`} />
              <div className={`absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 ${stat.borderColor.replace('/30', '')}`} />

              <div className="flex items-center gap-4">
                <div className={`${stat.color} w-10 h-10 flex-shrink-0`}>
                  {stat.svg}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground font-mono mb-1 uppercase">
                    {stat.label.replace(' ', '_')}:
                  </div>
                  <div className={`text-2xl md:text-3xl font-bold font-mono ${stat.color} truncate tabular-nums`}>
                    {stat.value}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Notable Companies */}
        {notableCompanies && notableCompanies.length > 0 && (
          <div className="space-y-4">
            <div className="font-mono text-sm text-muted-foreground mb-4">
              <span className="text-[#FB651E]">&gt;</span> NOTABLE_COMPANIES:
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {notableCompanies.slice(0, 3).map((company, index) => (
                <motion.div
                  key={company.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.3 + index * 0.05 }}
                  className="relative bg-card/30 border border-border/50 backdrop-blur-sm p-4"
                >
                  {/* Small corner brackets */}
                  <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#FB651E]" />
                  <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#FB651E]" />
                  <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#FB651E]" />
                  <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#FB651E]" />

                  <div className="font-semibold font-mono text-sm mb-2 truncate">
                    {company.name}
                  </div>
                  <div className="space-y-1 text-xs font-mono text-muted-foreground">
                    {company.industry && (
                      <div className="truncate">industry: {company.industry}</div>
                    )}
                    {company.team_size && (
                      <div>team_size: {company.team_size}</div>
                    )}
                    {company.is_hiring && (
                      <div className="text-emerald-500">status: HIRING</div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
