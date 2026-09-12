import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Database, Earth, BarChart3, Briefcase, BookOpen, Wrench, ArrowRight, Sparkles,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';

/**
 * Six doors, six words each.
 *
 * TWO THINGS CHANGED HERE and both were the owner's call. The cards used to
 * carry a sentence of prose apiece — six paragraphs describing surfaces whose
 * own titles already describe them — so the descriptions are now a three-word
 * label, and the card is a row rather than a panel. And each card used to pick
 * its own hue (sky, blue, emerald, violet, amber) which made this the one
 * section on the site running a five-colour palette; everything is YC orange
 * now, the platform's single accent.
 */
interface Capability {
  title: string;
  note: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CAPABILITIES: Capability[] = [
  { title: 'Companies Database', note: 'Sortable · filterable', to: '/database', icon: Database },
  // The only card here selling something rather than showing something.
  { title: 'ExploreYC World', note: 'Claim a plot — $5', to: '/world', icon: Earth },
  { title: 'Analytics & Charts', note: 'Batches · industries · geo', to: '/analytics', icon: BarChart3 },
  { title: 'Hiring Board', note: 'Open roles, daily', to: '/hiring', icon: Briefcase },
  { title: 'For Founders', note: 'PG essays · playbook', to: '/founders', icon: BookOpen },
  { title: 'Founder Tools', note: 'Validator · predictor', to: '/tools', icon: Wrench },
];

export function PlatformCapabilities() {
  const { stats } = useApp();

  const total = (stats?.total_all_companies ?? stats?.total_companies)?.toLocaleString() ?? '—';
  const active = stats?.by_status?.['Active']?.toLocaleString() ?? '—';
  const hiring = stats?.hiring?.toLocaleString() ?? '—';
  const topIndustry =
    stats?.by_industry
      ? Object.entries(stats.by_industry).sort(([, a], [, b]) => b - a)[0]?.[0]
      : undefined;
  const topCountry =
    stats?.by_country
      ? Object.entries(stats.by_country).sort(([, a], [, b]) => b - a)[0]?.[0]
      : undefined;

  const statStrip = [
    { label: 'companies tracked', value: total },
    { label: 'active', value: active },
    { label: 'hiring now', value: hiring },
    { label: 'top industry', value: topIndustry ?? '—' },
    { label: 'top country', value: topCountry ?? '—' },
  ];

  return (
    <div>
      {/* Heading */}
      <div className="mb-5">
        <div className="flex items-center gap-2 font-mono text-sm text-muted-foreground mb-2">
          <Sparkles className="h-4 w-4 text-[#FB651E]" />
          <span>$ explore --all</span>
        </div>
        <h2 className="text-2xl md:text-3xl font-bold font-mono">
          <span className="text-[#FB651E]">&gt;</span> Everything you can explore
        </h2>
      </div>

      {/* Live stat strip */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.4 }}
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px mb-4 rounded-sm overflow-hidden border border-border/70 bg-border/40"
      >
        {statStrip.map((s) => (
          <div key={s.label} className="bg-card/60 dark:bg-white/[0.02] px-4 py-3">
            <div className="text-lg font-bold font-mono text-[#FB651E] truncate">{s.value}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
              {s.label}
            </div>
          </div>
        ))}
      </motion.div>

      {/* Capability rows */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {CAPABILITIES.map((c, i) => {
          const Icon = c.icon;
          return (
            <motion.div
              key={c.to}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.4, delay: (i % 3) * 0.06 }}
            >
              <Link
                to={c.to}
                className="group flex h-full items-center gap-3 rounded-sm border border-border/80 bg-card/50 p-3.5 transition-all duration-300 hover:border-[#FB651E]/50 hover:shadow-[0_0_24px_rgba(251,101,30,0.12)] motion-reduce:transition-none dark:border-white/5 dark:bg-white/[0.02]"
              >
                <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-sm border border-[#FB651E]/25 bg-[#FB651E]/[0.08] text-[#FB651E]">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-sm font-bold">{c.title}</span>
                  <span className="block truncate font-mono text-xs text-muted-foreground">
                    {c.note}
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-[#FB651E] motion-reduce:transition-none" />
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
