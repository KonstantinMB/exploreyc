import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
  type ColumnDef,
} from '@tanstack/react-table';
import {
  Database,
  Download,
  ExternalLink,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Star,
  Search,
  X,
  Building2,
  TrendingUp,
  Layers,
  CheckCircle2,
  Filter,
  SlidersHorizontal,
  Loader2,
  Send,
  Mail,
} from 'lucide-react';
import { apiClient, type Company, type CompanyFilter } from '../lib/api';
import { SourceBadge, sourceLabel } from '../components/ui/SourceBadge';
import { PageHeader } from '../components/ui/PageHeader';
import { useApp } from '../contexts/AppContext';
import { HackerCard } from '../components/ui/hacker-card';
import { DotPattern } from '../components/ui/dot-pattern';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';

const PAGE_SIZE = 50;

const mobileHiddenColumns = new Set([
  'subindustry', 'all_locations', 'team_size', 'stage',
  'nonprofit', 'funding_last_round_name', 'employee_count',
  'employee_growth_6m', 'website', 'founders', 'exit', 'year_founded',
]);

function formatFunding(v?: number | null): string {
  if (!v) return '—';
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

function formatEmployeeGrowth(v?: number | null): string {
  if (v == null) return '—';
  const sign = v >= 0 ? '+' : '';
  return `${sign}${(v * 100).toFixed(0)}%`;
}

function BoolCell({ value }: { value: boolean }) {
  return value ? (
    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto" />
  ) : (
    <span className="text-muted-foreground/40 text-xs mx-auto block text-center">—</span>
  );
}

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (!sorted) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40 inline-block" />;
  if (sorted === 'asc') return <ArrowUp className="w-3 h-3 ml-1 text-[#FB651E] inline-block" />;
  return <ArrowDown className="w-3 h-3 ml-1 text-[#FB651E] inline-block" />;
}

const columnHelper = createColumnHelper<Company>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const columns: ColumnDef<Company, any>[] = [
  columnHelper.display({
    id: 'index',
    header: '#',
    cell: (info) => (
      <span className="text-muted-foreground/50 text-xs tabular-nums">
        {info.row.index + 1}
      </span>
    ),
    enableSorting: false,
    size: 44,
  }),
  columnHelper.accessor('name', {
    header: 'Company',
    cell: (info) => {
      const company = info.row.original;
      return (
        <Link
          to={`/company/${company.slug}`}
          className="flex items-center gap-2 min-w-0 group"
        >
          {company.small_logo_thumb_url ? (
            <img
              src={company.small_logo_thumb_url}
              alt=""
              className="w-5 h-5 rounded-sm object-contain flex-shrink-0 bg-muted"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-5 h-5 rounded-sm bg-[#FB651E]/20 flex items-center justify-center flex-shrink-0">
              <span className="text-[8px] font-bold text-[#FB651E]">
                {company.name.charAt(0)}
              </span>
            </div>
          )}
          <span className="font-medium text-xs truncate group-hover:text-[#FB651E] transition-colors max-w-[160px]">
            {info.getValue() as string}
          </span>
        </Link>
      );
    },
    size: 220,
  }),
  columnHelper.accessor('batch', {
    header: 'Batch',
    cell: (info) => (
      <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
        {(info.getValue() as string) || '—'}
      </span>
    ),
    size: 96,
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: (info) => {
      const status = info.getValue() as string;
      if (!status) return <span className="text-muted-foreground/40 text-xs">—</span>;
      const isActive = status === 'Active';
      return (
        <span
          className={`text-[10px] font-mono px-1.5 py-0.5 rounded-sm whitespace-nowrap ${
            isActive
              ? 'bg-emerald-500/10 text-emerald-500'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {status}
        </span>
      );
    },
    size: 88,
  }),
  columnHelper.accessor('industry', {
    header: 'Industry',
    cell: (info) => (
      <span className="text-xs text-muted-foreground truncate block max-w-[130px]">
        {(info.getValue() as string) || '—'}
      </span>
    ),
    size: 150,
  }),
  columnHelper.accessor('subindustry', {
    header: 'Subindustry',
    cell: (info) => (
      <span className="text-xs text-muted-foreground truncate block max-w-[130px]">
        {(info.getValue() as string) || '—'}
      </span>
    ),
    size: 150,
  }),
  columnHelper.accessor('country', {
    header: 'Country',
    cell: (info) => (
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {(info.getValue() as string) || '—'}
      </span>
    ),
    size: 100,
  }),
  columnHelper.accessor('all_locations', {
    header: 'Location',
    cell: (info) => {
      const loc = info.getValue() as string;
      if (!loc) return <span className="text-muted-foreground/40 text-xs">—</span>;
      const first = loc.split(';')[0].trim();
      return (
        <span className="text-xs text-muted-foreground truncate block max-w-[120px]" title={loc}>
          {first}
        </span>
      );
    },
    enableSorting: false,
    size: 140,
  }),
  columnHelper.accessor('team_size', {
    header: 'Team',
    cell: (info) => {
      const v = info.getValue() as number;
      return (
        <span className="text-xs font-mono tabular-nums text-right block">
          {v ? v.toLocaleString() : '—'}
        </span>
      );
    },
    size: 72,
  }),
  columnHelper.accessor('stage', {
    header: 'Stage',
    cell: (info) => (
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {(info.getValue() as string) || '—'}
      </span>
    ),
    size: 80,
  }),
  columnHelper.accessor('is_hiring', {
    header: 'Hiring',
    cell: (info) => <BoolCell value={info.getValue() as boolean} />,
    size: 64,
  }),
  columnHelper.accessor('top_company', {
    header: 'Top Co.',
    cell: (info) => <BoolCell value={info.getValue() as boolean} />,
    size: 68,
  }),
  columnHelper.accessor('nonprofit', {
    header: 'Nonprofit',
    cell: (info) => <BoolCell value={info.getValue() as boolean} />,
    size: 76,
  }),
  columnHelper.accessor('funding_total_usd', {
    header: 'Total Funding',
    cell: (info) => (
      <span className="text-xs font-mono tabular-nums text-right block text-emerald-600 dark:text-emerald-400">
        {formatFunding(info.getValue() as number)}
      </span>
    ),
    size: 112,
  }),
  columnHelper.accessor('funding_last_round_name', {
    header: 'Last Round',
    cell: (info) => (
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {(info.getValue() as string) || '—'}
      </span>
    ),
    size: 100,
  }),
  columnHelper.accessor('employee_count', {
    header: 'Employees',
    cell: (info) => {
      const v = info.getValue() as number;
      return (
        <span className="text-xs font-mono tabular-nums text-right block">
          {v ? v.toLocaleString() : '—'}
        </span>
      );
    },
    size: 88,
  }),
  columnHelper.accessor('employee_growth_6m', {
    header: '6m Growth',
    cell: (info) => {
      const v = info.getValue() as number | null;
      if (v == null) return <span className="text-muted-foreground/40 text-xs text-right block">—</span>;
      const isPositive = v >= 0;
      return (
        <span
          className={`text-xs font-mono tabular-nums text-right block ${
            isPositive ? 'text-emerald-500' : 'text-red-500'
          }`}
        >
          {formatEmployeeGrowth(v)}
        </span>
      );
    },
    size: 88,
  }),
  columnHelper.accessor('website', {
    header: 'Website',
    cell: (info) => {
      const url = info.getValue() as string;
      if (!url) return <span className="text-muted-foreground/40 text-xs text-center block">—</span>;
      return (
        <a
          href={url.startsWith('http') ? url : `https://${url}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center text-muted-foreground hover:text-[#FB651E] transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      );
    },
    enableSorting: false,
    size: 68,
  }),
];

// ---- Source-agnostic columns (a16z and future VC/incubator sources) ----------
const sourceBadgeColumn = columnHelper.accessor('source', {
  header: 'Source',
  cell: (info) => (
    <span title={sourceLabel(info.getValue() as string)}>
      <SourceBadge source={info.getValue() as string} />
    </span>
  ),
  size: 72,
});

const foundersColumn = columnHelper.accessor('founders', {
  header: 'Founders',
  cell: (info) => {
    const v = info.getValue() as string;
    if (!v) return <span className="text-muted-foreground/40 text-xs">—</span>;
    return (
      <span className="text-xs text-muted-foreground truncate block max-w-[170px]" title={v}>
        {v}
      </span>
    );
  },
  enableSorting: false,
  size: 180,
});

const exitColumn = columnHelper.display({
  id: 'exit',
  header: 'Exit',
  cell: (info) => {
    const c = info.row.original;
    if (!c.exit_type) return <span className="text-muted-foreground/40 text-xs">—</span>;
    const detail = c.ticker_symbol ? `: ${c.ticker_symbol}` : c.acquirer ? ` → ${c.acquirer}` : '';
    return (
      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-blue-500/10 text-blue-400 whitespace-nowrap">
        {c.exit_type}{detail}
      </span>
    );
  },
  size: 150,
});

const yearFoundedColumn = columnHelper.accessor('year_founded', {
  header: 'Founded',
  cell: (info) => (
    <span className="text-xs font-mono tabular-nums">
      {(info.getValue() as number) || '—'}
    </span>
  ),
  size: 80,
});

// Resolve a column's key whether it's an accessor ('batch') or display ('exit') column
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const colKey = (c: ColumnDef<Company, any>): string => (c as any).id ?? (c as any).accessorKey ?? '';

// YC-only columns that are always empty for a16z — dropped in the focused a16z view
const A16Z_HIDDEN_COLUMNS = new Set([
  'batch', 'subindustry', 'country', 'all_locations', 'team_size', 'top_company',
  'nonprofit', 'funding_total_usd', 'funding_last_round_name', 'employee_count', 'employee_growth_6m',
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getColumns(source: string): ColumnDef<Company, any>[] {
  // Focused a16z view: drop empty YC columns, surface founders / exit / founded
  if (source === 'a16z') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out: ColumnDef<Company, any>[] = [];
    for (const c of columns.filter((col) => !A16Z_HIDDEN_COLUMNS.has(colKey(col)))) {
      out.push(c);
      if (colKey(c) === 'name') out.push(foundersColumn);
      if (colKey(c) === 'stage') { out.push(exitColumn); out.push(yearFoundedColumn); }
    }
    return out;
  }
  // Mixed view: full YC columns + Source badge + a16z fields
  if (source === 'all') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out: ColumnDef<Company, any>[] = [];
    for (const c of columns) {
      out.push(c);
      if (colKey(c) === 'name') out.push(sourceBadgeColumn);
      if (colKey(c) === 'stage') { out.push(foundersColumn); out.push(exitColumn); }
    }
    return out;
  }
  // Default: Y Combinator — unchanged
  return columns;
}

const FEATURE_KEY = 'db-export';
const FEATURE_INTEREST_LS_KEY = 'yc_feature_interest_db-export';

// Stable per-browser id so one browser's interest counts once (shared with roadmap votes).
function getClientId(): string {
  let id = localStorage.getItem('roadmap-user-id');
  if (!id) {
    id = `user-${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem('roadmap-user-id', id);
  }
  return id;
}

// Data export is currently paused. Instead of downloading, users register interest
// ("I want this feature") which is persisted server-side so we can measure demand.
function FeatureInterestModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [count, setCount] = useState<number | null>(null);

  // If this browser already registered interest, show the thank-you state on open.
  useEffect(() => {
    if (!open) return;
    if (localStorage.getItem(FEATURE_INTEREST_LS_KEY) === 'true') {
      setStatus('done');
    }
  }, [open]);

  const handleSubmit = async () => {
    setStatus('submitting');
    try {
      const { data } = await apiClient.submitFeatureInterest({
        feature: FEATURE_KEY,
        email: email.trim() || undefined,
        user_identifier: getClientId(),
      });
      setCount(data.count ?? null);
      localStorage.setItem(FEATURE_INTEREST_LS_KEY, 'true');
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  const done = status === 'done';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md font-mono">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Download className="w-4 h-4 text-[#FB651E]" />
            Data export
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Export is paused while we rebuild it. Want it back? Let us know and we'll
            prioritise it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {done ? (
            <HackerCard glowColor="green" className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className="text-sm text-emerald-500 font-semibold">
                  Thanks — we've noted your interest!
                </span>
              </div>
              {count !== null && (
                <p className="text-xs text-muted-foreground mt-2">
                  You're one of{' '}
                  <span className="text-foreground font-semibold tabular-nums">
                    {count.toLocaleString()}
                  </span>{' '}
                  {count === 1 ? 'person' : 'people'} who want this feature back.
                </p>
              )}
            </HackerCard>
          ) : (
            <HackerCard glowColor="orange" className="p-4">
              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                Click below to tell us you want CSV / JSON export. Leave an email if you'd
                like us to notify you when it's back — totally optional.
              </p>

              <div className="flex items-center gap-2 mb-3 px-3 py-2 border border-border rounded-sm bg-background/50 focus-within:border-[#FB651E]/50 transition-colors">
                <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com (optional)"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={status === 'submitting'}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FB651E] hover:bg-[#E65C00] disabled:opacity-70 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors rounded-sm"
              >
                {status === 'submitting' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    I want this feature
                  </>
                )}
              </button>

              {status === 'error' && (
                <p className="text-xs text-red-500 mt-2">
                  Something went wrong — please try again.
                </p>
              )}
            </HackerCard>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export function DatabasePage() {
  const { stats } = useApp();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [batch, setBatch] = useState('');
  const [industry, setIndustry] = useState('');
  const [country, setCountry] = useState('');
  const [isHiring, setIsHiring] = useState(false);
  const [topOnly, setTopOnly] = useState(false);
  const [source, setSource] = useState('all'); // 'all' (default) | 'yc' | 'a16z' | 'hackernews' | ...
  const [currentPage, setCurrentPage] = useState(1);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [exportOpen, setExportOpen] = useState(false);

  // Auto-open export modal when navigated here with ?export=open (e.g. from command palette)
  useEffect(() => {
    if (searchParams.get('export') === 'open') {
      setExportOpen(true);
      navigate('/database', { replace: true });
    }
  }, [searchParams, navigate]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page on filter change
  const resetPage = useCallback(() => setCurrentPage(1), []);

  // Build filter object
  const activeFilters: CompanyFilter = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: (currentPage - 1) * PAGE_SIZE,
      ...(debouncedSearch && { search: debouncedSearch }),
      ...(batch && { batch }),
      ...(industry && { industry }),
      ...(country && { country }),
      ...(isHiring && { is_hiring: true }),
      ...(topOnly && { top_company: true }),
      ...(source !== 'yc' && { source }),
    }),
    [currentPage, debouncedSearch, batch, industry, country, isHiring, topOnly, source],
  );

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['companies-table', activeFilters],
    queryFn: () => apiClient.getCompanies(activeFilters).then((r) => r.data),
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
  });

  // Available sources (incubators/VCs) for the Source filter
  const { data: sources } = useQuery({
    queryKey: ['sources'],
    queryFn: () => apiClient.getSources().then((r) => r.data.sources),
    staleTime: 1000 * 60 * 30,
  });
  const hasMultipleSources = (sources?.length ?? 0) > 1;

  // Filter select options from stats
  const batches = useMemo(
    () => Object.keys(stats?.by_batch || {}).sort((a, b) => b.localeCompare(a)),
    [stats],
  );
  const industries = useMemo(
    () => Object.keys(stats?.by_industry || {}).sort(),
    [stats],
  );
  const countries = useMemo(
    () => Object.keys(stats?.by_country || {}).sort(),
    [stats],
  );

  const companies = data?.companies ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Columns adapt to the selected source (a16z surfaces founders/exit/founded)
  const tableColumns = useMemo(() => getColumns(source), [source]);

  const table = useReactTable({
    data: companies,
    columns: tableColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
  });

  const hasFilters = !!(debouncedSearch || batch || industry || country || isHiring || topOnly || source !== 'yc');

  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setBatch('');
    setIndustry('');
    setCountry('');
    setIsHiring(false);
    setTopOnly(false);
    setSource('yc');
    setCurrentPage(1);
  };

  const totalBatches = stats?.by_batch ? Object.keys(stats.by_batch).length : 0;

  const sourceHeading =
    source === 'a16z' ? 'a16z Portfolio Database'
    : source === 'all' ? 'Companies Database'
    : 'YC Companies Database';
  const sourceSubtitle =
    source === 'a16z' ? 'Andreessen Horowitz portfolio companies, searchable and exportable'
    : source === 'all' ? 'Every company across all tracked incubators & VCs, searchable and exportable'
    : 'Every Y Combinator company, searchable and exportable';

  return (
    <div className="relative min-h-screen bg-background overflow-x-hidden">
      <Helmet>
        <title>{sourceHeading} | ExploreYC</title>
        <meta name="description" content="Browse and export startup companies from Y Combinator, a16z, and more in a sortable, filterable table." />
      </Helmet>

      <DotPattern color="hsl(var(--primary) / 0.12)" size={24} radius={0.5} />

      <div className="container relative mx-auto px-4 py-8 max-w-[1600px]">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <PageHeader
            command="$ db --companies --export"
            title={sourceHeading}
            subtitle={sourceSubtitle}
            actions={
              <button
                onClick={() => setExportOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#FB651E] hover:bg-[#E65C00] text-white text-sm font-semibold font-mono transition-colors rounded-sm flex-shrink-0"
              >
                <Download className="w-4 h-4" />
                I want export
              </button>
            }
          />
        </motion.div>

        {/* Stats row */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6"
        >
          {[
            {
              label: 'Total Companies',
              value: (stats?.total_all_companies ?? stats?.total_companies)?.toLocaleString() ?? '—',
              icon: Building2,
              color: 'text-[#FB651E]',
            },
            {
              label: 'Currently Hiring',
              value: stats?.hiring?.toLocaleString() ?? '—',
              icon: TrendingUp,
              color: 'text-emerald-500',
            },
            {
              label: 'YC Batches',
              value: totalBatches || '—',
              icon: Layers,
              color: 'text-blue-500',
            },
            {
              label: 'Filtered Results',
              value: isLoading ? '…' : total.toLocaleString(),
              icon: Database,
              color: 'text-violet-500',
            },
          ].map((stat) => (
            <motion.div key={stat.label} variants={item}>
              <HackerCard className="p-3" glowColor={
                stat.color.includes('orange') ? 'orange' :
                stat.color.includes('emerald') ? 'green' :
                stat.color.includes('blue') ? 'blue' : 'purple'
              }>
                <div className="flex items-center gap-2 mb-1">
                  <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
                  <span className="text-xs text-muted-foreground font-mono">{stat.label}</span>
                </div>
                <div className={`text-xl font-bold font-mono tabular-nums ${stat.color}`}>
                  {stat.value}
                </div>
              </HackerCard>
            </motion.div>
          ))}
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-4"
        >
          <HackerCard className="p-3" glowColor="orange">
            <div className="flex flex-wrap gap-2 items-center">
              {/* Search group: full-width on mobile, constrained on sm+ */}
              <div className="flex items-center gap-2 w-full sm:w-auto sm:flex-1 sm:max-w-xs min-w-0">
                <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search companies..."
                    className="pl-8 h-8 text-xs font-mono bg-background/50 w-full"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>{/* end search group */}

              {/* Source (incubator / VC) */}
              {hasMultipleSources && (
                <select
                  value={source}
                  onChange={(e) => { setSource(e.target.value); resetPage(); }}
                  className="h-8 px-2 text-xs font-mono bg-background/50 border border-border rounded-sm text-foreground focus:outline-none focus:border-[#FB651E]/50 min-w-[140px]"
                  title="Source (incubator / VC)"
                >
                  {sources!.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.display_name}{s.count ? ` (${s.count.toLocaleString()})` : ''}
                    </option>
                  ))}
                  <option value="all">All sources</option>
                </select>
              )}

              {/* Batch */}
              <select
                value={batch}
                onChange={(e) => { setBatch(e.target.value); resetPage(); }}
                className="h-8 px-2 text-xs font-mono bg-background/50 border border-border rounded-sm text-foreground focus:outline-none focus:border-[#FB651E]/50 min-w-[120px] disabled:opacity-40"
                disabled={source === 'a16z'}
                title={source === 'a16z' ? 'Batches are a Y Combinator concept' : undefined}
              >
                <option value="">All Batches</option>
                {batches.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>

              {/* Industry */}
              <select
                value={industry}
                onChange={(e) => { setIndustry(e.target.value); resetPage(); }}
                className="h-8 px-2 text-xs font-mono bg-background/50 border border-border rounded-sm text-foreground focus:outline-none focus:border-[#FB651E]/50 min-w-[130px]"
              >
                <option value="">All Industries</option>
                {industries.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>

              {/* Country */}
              <select
                value={country}
                onChange={(e) => { setCountry(e.target.value); resetPage(); }}
                className="h-8 px-2 text-xs font-mono bg-background/50 border border-border rounded-sm text-foreground focus:outline-none focus:border-[#FB651E]/50 min-w-[120px]"
              >
                <option value="">All Countries</option>
                {countries.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              {/* Toggle: Hiring */}
              <button
                onClick={() => { setIsHiring(!isHiring); resetPage(); }}
                className={`h-8 px-3 text-xs font-mono border rounded-sm transition-colors whitespace-nowrap ${
                  isHiring
                    ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80'
                }`}
              >
                Hiring
              </button>

              {/* Toggle: Top Company */}
              <button
                onClick={() => { setTopOnly(!topOnly); resetPage(); }}
                className={`h-8 px-3 text-xs font-mono border rounded-sm transition-colors whitespace-nowrap ${
                  topOnly
                    ? 'bg-[#FB651E]/10 border-[#FB651E]/50 text-[#FB651E]'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80'
                }`}
              >
                <Star className="w-3 h-3 inline-block mr-1 mb-0.5" />
                Top Co.
              </button>

              {/* Clear filters */}
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="h-8 px-2 text-xs font-mono text-muted-foreground hover:text-red-500 border border-border hover:border-red-500/30 rounded-sm transition-colors flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Clear
                </button>
              )}

              {/* Filter indicator */}
              {hasFilters && (
                <span className="text-xs text-muted-foreground font-mono ml-auto">
                  <Filter className="w-3 h-3 inline-block mr-1" />
                  {total.toLocaleString()} results
                </span>
              )}
            </div>
          </HackerCard>
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
        >
          <HackerCard className="overflow-hidden" glowColor="orange">
            <div
              className="overflow-x-auto"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <table className="w-full text-xs font-mono border-collapse" style={{ minWidth: 'max-content' }}>
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id} className="border-b border-border bg-muted/30">
                      {headerGroup.headers.map((header, i) => {
                        const canSort = header.column.getCanSort();
                        const sorted = header.column.getIsSorted();
                        return (
                          <th
                            key={header.id}
                            className={`px-3 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap select-none ${
                              canSort ? 'cursor-pointer hover:text-foreground transition-colors' : ''
                            } ${i === 0 ? 'sticky left-0 z-10 bg-background border-r border-border/40' : ''} ${mobileHiddenColumns.has(header.id) ? 'hidden md:table-cell' : ''}`}
                            style={{ width: header.getSize(), minWidth: header.getSize() }}
                            onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {canSort && <SortIcon sorted={sorted} />}
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {isLoading && companies.length === 0 ? (
                    <tr>
                      <td colSpan={tableColumns.length} className="px-4 py-16 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-6 h-6 border-2 border-[#FB651E] border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs">Loading companies…</span>
                        </div>
                      </td>
                    </tr>
                  ) : companies.length === 0 ? (
                    <tr>
                      <td colSpan={tableColumns.length} className="px-4 py-16 text-center text-muted-foreground">
                        <Database className="w-8 h-8 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No companies match your filters</p>
                        <button
                          onClick={clearFilters}
                          className="mt-3 text-xs text-[#FB651E] hover:underline"
                        >
                          Clear filters
                        </button>
                      </td>
                    </tr>
                  ) : (
                    table.getRowModel().rows.map((row, rowIdx) => (
                      <tr
                        key={row.id}
                        className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${
                          isFetching ? 'opacity-70' : ''
                        } ${rowIdx % 2 === 0 ? '' : 'bg-muted/5'}`}
                      >
                        {row.getVisibleCells().map((cell, cellIdx) => (
                          <td
                            key={cell.id}
                            className={`px-3 py-2 ${
                              mobileHiddenColumns.has(cell.column.id) ? 'hidden md:table-cell' : ''
                            } ${cellIdx === 0 ? 'sticky left-0 z-10 bg-background border-r border-border/40' : ''}`}
                            style={{ width: cell.column.getSize(), minWidth: cell.column.getSize() }}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 border-t border-border bg-muted/10">
              <div className="hidden sm:block text-xs text-muted-foreground font-mono">
                {total > 0 && (
                  <>
                    Showing{' '}
                    <span className="text-foreground">
                      {((currentPage - 1) * PAGE_SIZE + 1).toLocaleString()}–
                      {Math.min(currentPage * PAGE_SIZE, total).toLocaleString()}
                    </span>{' '}
                    of{' '}
                    <span className="text-foreground">{total.toLocaleString()}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs border border-border rounded-sm disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#FB651E]/40 hover:text-[#FB651E] transition-colors font-mono"
                >
                  <ChevronLeft className="w-3 h-3" />
                  Prev
                </button>
                <span className="text-xs font-mono text-muted-foreground px-1">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs border border-border rounded-sm disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#FB651E]/40 hover:text-[#FB651E] transition-colors font-mono"
                >
                  Next
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </HackerCard>
        </motion.div>

        {/* Export CTA footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 text-center"
        >
          <p className="text-xs text-muted-foreground font-mono">
            Data export (CSV / JSON) is paused while we rebuild it.{' '}
            <button
              onClick={() => setExportOpen(true)}
              className="text-[#FB651E] hover:underline"
            >
              I want this feature
            </button>
          </p>
        </motion.div>
      </div>

      <FeatureInterestModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
      />
    </div>
  );
}
