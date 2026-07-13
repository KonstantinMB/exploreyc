import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Database, Globe2, BarChart3, Briefcase, BookOpen, Wrench, ArrowRight, Sparkles,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';

interface Capability {
  cmd: string;
  title: string;
  desc: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string; // text/border accent
  glow: string; // hover shadow
}

const CAPABILITIES: Capability[] = [
  {
    cmd: '$ db --companies',
    title: 'Companies Database',
    desc: 'Every YC & a16z company in one sortable, filterable table — batch, industry, funding, team.',
    to: '/database',
    icon: Database,
    accent: 'text-[#FB651E] group-hover:border-[#FB651E]/50',
    glow: 'group-hover:shadow-[0_0_24px_rgba(251,101,30,0.15)]',
  },
  {
    cmd: '$ map --world',
    title: 'Interactive World Map',
    desc: 'Watch YC spread across the globe — 2D map, 3D globe, density hotspots, batch timeline.',
    to: '/map',
    icon: Globe2,
    accent: 'text-sky-400 group-hover:border-sky-400/50',
    glow: 'group-hover:shadow-[0_0_24px_rgba(56,189,248,0.15)]',
  },
  {
    cmd: '$ analytics',
    title: 'Analytics & Charts',
    desc: 'Batches, industries, geography and hiring trends — the shape of Y Combinator over time.',
    to: '/analytics',
    icon: BarChart3,
    accent: 'text-blue-400 group-hover:border-blue-400/50',
    glow: 'group-hover:shadow-[0_0_24px_rgba(96,165,250,0.15)]',
  },
  {
    cmd: '$ jobs --hiring',
    title: 'Hiring Board',
    desc: 'Open roles across every company that is actively hiring, refreshed daily.',
    to: '/hiring',
    icon: Briefcase,
    accent: 'text-emerald-400 group-hover:border-emerald-400/50',
    glow: 'group-hover:shadow-[0_0_24px_rgba(52,211,153,0.15)]',
  },
  {
    cmd: '$ founders',
    title: 'For Founders',
    desc: 'PG essays, daily YC updates, and the playbook — everything a founder actually reads.',
    to: '/founders',
    icon: BookOpen,
    accent: 'text-violet-400 group-hover:border-violet-400/50',
    glow: 'group-hover:shadow-[0_0_24px_rgba(167,139,250,0.15)]',
  },
  {
    cmd: '$ tools --launch',
    title: 'Founder Tools',
    desc: 'Idea validator, success predictor, batch wrapped and a fundraising tracker.',
    to: '/tools',
    icon: Wrench,
    accent: 'text-amber-400 group-hover:border-amber-400/50',
    glow: 'group-hover:shadow-[0_0_24px_rgba(251,191,36,0.15)]',
  },
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
      <div className="mb-6">
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
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px mb-6 rounded-lg overflow-hidden border border-border/70 bg-border/40"
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

      {/* Capability grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CAPABILITIES.map((c, i) => {
          const Icon = c.icon;
          return (
            <motion.div
              key={c.to}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: (i % 3) * 0.06 }}
            >
              <Link to={c.to} className="group block h-full">
                <div
                  className={`relative h-full overflow-hidden rounded-lg border border-border/80 bg-card/50 dark:border-white/5 dark:bg-white/[0.02] p-5 transition-all duration-300 ${c.glow}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-2 rounded-md bg-current/10 ${c.accent.split(' ')[0]}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="font-mono text-[11px] text-muted-foreground/70">{c.cmd}</span>
                  </div>
                  <h3 className="font-mono font-bold text-base mb-1.5">{c.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{c.desc}</p>
                  <span
                    className={`inline-flex items-center gap-1 mt-4 text-xs font-mono ${c.accent.split(' ')[0]} opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300`}
                  >
                    open <ArrowRight className="h-3 w-3" />
                  </span>
                  {/* corner sweep on hover */}
                  <div
                    className={`absolute -right-8 -top-8 w-16 h-16 rounded-full blur-2xl opacity-0 group-hover:opacity-30 transition-opacity duration-500 ${c.accent.split(' ')[0]} bg-current`}
                  />
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
