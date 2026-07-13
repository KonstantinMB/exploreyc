import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Terminal, KeyRound, ArrowRight, Copy, Check, Zap } from 'lucide-react';

// Real ExploreYC public API surface (mirrors /api-docs).
const API_BASE = 'https://api.exploreyc.com/api/v1';

interface ApiExample {
  method: string;
  path: string;
  cmd: string;
  response: string[];
}

const EXAMPLES: ApiExample[] = [
  {
    method: 'GET',
    path: '/companies',
    cmd: `curl -H "Authorization: Bearer eyc_live_…" \\\n  "${API_BASE}/companies?source=yc&limit=2"`,
    response: [
      '{',
      '  "companies": [',
      '    { "id": 15231, "name": "Stripe",',
      '      "one_liner": "Payments infrastructure for the internet.",',
      '      "batch": "Summer 2009", "industry": "Fintech",',
      '      "status": "Active", "is_hiring": true },',
      '    { "id": 18442, "name": "Airbnb",',
      '      "batch": "Winter 2009", "industry": "Consumer" }',
      '  ],',
      '  "total": 6049,',
      '  "has_more": true',
      '}',
    ],
  },
  {
    method: 'GET',
    path: '/search',
    cmd: `curl -H "Authorization: Bearer eyc_live_…" \\\n  "${API_BASE}/search?q=fintech&limit=2"`,
    response: [
      '{',
      '  "companies": [',
      '    { "id": 15231, "name": "Stripe",',
      '      "industry": "Fintech", "batch": "Summer 2009" },',
      '    { "id": 20817, "name": "Brex",',
      '      "industry": "Fintech", "batch": "Winter 2017" }',
      '  ],',
      '  "total": 214,',
      '  "has_more": true',
      '}',
    ],
  },
  {
    method: 'GET',
    path: '/stats',
    cmd: `curl -H "Authorization: Bearer eyc_live_…" \\\n  "${API_BASE}/stats"`,
    response: [
      '{',
      '  "total_companies": 6049,',
      '  "hiring": 1530,',
      '  "top_industry": "B2B",',
      '  "top_country": "United States",',
      '  "batches": 50',
      '}',
    ],
  },
];

const ENDPOINT_CHIPS = [
  '/companies',
  '/search',
  '/stats',
  '/map',
  '/batches',
  '/industries',
  '/countries',
];

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

// Minimal JSON syntax highlighter → colored spans matching the platform palette.
function highlight(line: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+\.?\d*)|(true|false|null)|([{}[\],:])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(line))) {
    if (m.index > last) nodes.push(line.slice(last, m.index));
    if (m[1]) {
      const isKey = !!m[2];
      nodes.push(
        <span key={key++} className={isKey ? 'text-[#FB651E]' : 'text-emerald-400'}>
          {m[1]}
        </span>
      );
      if (m[2]) nodes.push(<span key={key++} className="text-white/30">{m[2]}</span>);
    } else if (m[3]) {
      nodes.push(<span key={key++} className="text-sky-400">{m[3]}</span>);
    } else if (m[4]) {
      nodes.push(<span key={key++} className="text-violet-400">{m[4]}</span>);
    } else if (m[5]) {
      nodes.push(<span key={key++} className="text-white/30">{m[5]}</span>);
    }
    last = re.lastIndex;
  }
  if (last < line.length) nodes.push(line.slice(last));
  return nodes;
}

type Phase = 'typing' | 'fetching' | 'responding' | 'hold';

export function ApiShowcase() {
  const reduced = usePrefersReducedMotion();
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState(0);
  const [lines, setLines] = useState(0);
  const [phase, setPhase] = useState<Phase>('typing');
  const [copied, setCopied] = useState(false);
  const timers = useRef<number[]>([]);

  const ex = EXAMPLES[idx];

  // Drive the typewriter → fetch → stream-response → hold state machine.
  useEffect(() => {
    if (reduced) {
      // Skip animation: show the full request + response, cycle slowly.
      setTyped(ex.cmd.length);
      setLines(ex.response.length);
      const t = window.setTimeout(() => setIdx((i) => (i + 1) % EXAMPLES.length), 6000);
      return () => window.clearTimeout(t);
    }

    let cancelled = false;
    const clearAll = () => timers.current.forEach((t) => window.clearTimeout(t));

    if (phase === 'typing') {
      if (typed < ex.cmd.length) {
        const t = window.setTimeout(() => !cancelled && setTyped((n) => n + 1), 16);
        timers.current.push(t);
      } else {
        const t = window.setTimeout(() => !cancelled && setPhase('fetching'), 450);
        timers.current.push(t);
      }
    } else if (phase === 'fetching') {
      const t = window.setTimeout(() => !cancelled && setPhase('responding'), 650);
      timers.current.push(t);
    } else if (phase === 'responding') {
      if (lines < ex.response.length) {
        const t = window.setTimeout(() => !cancelled && setLines((n) => n + 1), 80);
        timers.current.push(t);
      } else {
        const t = window.setTimeout(() => !cancelled && setPhase('hold'), 2800);
        timers.current.push(t);
      }
    } else if (phase === 'hold') {
      const t = window.setTimeout(() => {
        if (cancelled) return;
        setTyped(0);
        setLines(0);
        setPhase('typing');
        setIdx((i) => (i + 1) % EXAMPLES.length);
      }, 200);
      timers.current.push(t);
    }

    return () => {
      cancelled = true;
      clearAll();
    };
  }, [phase, typed, lines, idx, reduced, ex.cmd.length, ex.response.length]);

  const typedCmd = ex.cmd.slice(0, typed);
  const showResponse = phase === 'responding' || phase === 'hold' || reduced;
  const fetching = phase === 'fetching';

  const copyCmd = async () => {
    try {
      await navigator.clipboard.writeText(ex.cmd.replace('eyc_live_…', 'eyc_live_your_key'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked — no-op */
    }
  };

  const steps = useMemo(
    () => [
      {
        n: '01',
        title: 'Grab a key',
        body: 'Create a free developer account and generate an API key from the dashboard.',
        code: 'eyc_live_••••••••',
        to: '/signup',
        cta: 'Get a key',
      },
      {
        n: '02',
        title: 'Send a request',
        body: 'Pass your key as a bearer token. Filter by batch, industry, country, hiring & more.',
        code: 'Authorization: Bearer eyc_live_…',
        to: '/api-docs',
        cta: 'See params',
      },
      {
        n: '03',
        title: 'Get YC data',
        body: 'Clean JSON across YC + a16z — companies, search, stats, maps, batch wrapped.',
        code: '200 OK · application/json',
        to: '/database',
        cta: 'Browse data',
      },
    ],
    []
  );

  return (
    <div className="relative">
      {/* Section heading */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 font-mono text-sm text-muted-foreground mb-2">
            <Terminal className="h-4 w-4 text-[#FB651E]" />
            <span>$ curl api.exploreyc.com/api/v1</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold font-mono">
            <span className="text-[#FB651E]">&gt;</span> YC data, one request away
          </h2>
          <p className="text-muted-foreground font-mono text-sm mt-2 max-w-xl">
            A public REST API over every company we track — YC &amp; a16z. Authenticate, query,
            and get structured JSON back. No scraping.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 flex-shrink-0">
          <Link
            to="/signup"
            className="group inline-flex items-center gap-2 px-4 py-2.5 bg-[#FB651E] hover:bg-[#E65C00] text-white text-sm font-semibold font-mono transition-colors rounded-sm"
          >
            <KeyRound className="h-4 w-4" />
            Get your API key
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            to="/api-docs"
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-border hover:border-[#FB651E]/50 text-sm font-mono bg-background/50 transition-colors rounded-sm"
          >
            Read the docs
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
        {/* Terminal window — always dark so it reads as a real console in both themes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5 }}
          className="lg:col-span-3 relative flex flex-col overflow-hidden rounded-lg border border-[#FB651E]/25 bg-[#0a0c11] shadow-[0_0_40px_rgba(251,101,30,0.08)]"
        >
          {/* window chrome */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
            <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
            <span className="ml-2 font-mono text-[11px] text-white/40 truncate">
              exploreyc — api — curl
            </span>
            <div className="ml-auto flex items-center gap-2">
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {ex.method} {ex.path}
              </span>
              <button
                onClick={copyCmd}
                className="text-white/40 hover:text-white transition-colors"
                title="Copy request"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* terminal body */}
          <div className="flex-1 p-4 font-mono text-[12px] sm:text-[13px] leading-relaxed min-h-[340px]">
            {/* request */}
            <div className="text-white/85 whitespace-pre-wrap break-all">
              <span className="text-[#FB651E]">$ </span>
              {typedCmd}
              {phase === 'typing' && !reduced && (
                <span className="inline-block w-[7px] h-[15px] -mb-0.5 bg-[#FB651E] animate-pulse" />
              )}
            </div>

            {/* fetching spinner */}
            {fetching && (
              <div className="mt-3 text-white/50 flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full border-2 border-[#FB651E]/40 border-t-[#FB651E] animate-spin" />
                fetching…
              </div>
            )}

            {/* response */}
            {showResponse && (
              <div className="mt-3">
                <div className="text-white/30 mb-1">↳ 200 OK · application/json</div>
                <pre className="whitespace-pre-wrap break-all text-white/80">
                  {ex.response.slice(0, reduced ? ex.response.length : lines).map((ln, i) => (
                    <motion.div
                      key={`${idx}-${i}`}
                      initial={reduced ? false : { opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.18 }}
                    >
                      {highlight(ln)}
                    </motion.div>
                  ))}
                </pre>
              </div>
            )}
          </div>

          {/* endpoint chips */}
          <div className="px-4 py-3 border-t border-white/[0.06] bg-white/[0.02] flex flex-wrap gap-1.5">
            {ENDPOINT_CHIPS.map((chip) => (
              <Link
                key={chip}
                to="/api-docs"
                className="font-mono text-[11px] px-2 py-1 rounded-sm border border-white/10 text-white/50 hover:text-[#FB651E] hover:border-[#FB651E]/40 transition-colors"
              >
                {chip}
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Connect steps */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: 0.1 + i * 0.08 }}
              className="group relative flex-1 rounded-lg border border-border/80 bg-card/50 dark:border-white/5 dark:bg-white/[0.02] p-4 hover:border-[#FB651E]/40 transition-colors"
            >
              <div className="flex items-start gap-3">
                <span className="font-mono text-lg font-bold text-[#FB651E]/40 group-hover:text-[#FB651E] transition-colors tabular-nums">
                  {s.n}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-mono font-bold text-sm mb-1">{s.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-2">{s.body}</p>
                  <code className="block text-[11px] font-mono text-[#FB651E]/90 bg-[#FB651E]/[0.06] border border-[#FB651E]/15 rounded-sm px-2 py-1 mb-2 truncate">
                    {s.code}
                  </code>
                  <Link
                    to={s.to}
                    className="inline-flex items-center gap-1 text-xs font-mono text-[#FB651E] hover:underline"
                  >
                    {s.cta} <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
          <div className="rounded-lg border border-[#FB651E]/20 bg-[#FB651E]/[0.04] p-3 flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <Zap className="h-3.5 w-3.5 text-[#FB651E] flex-shrink-0" />
            Free tier available · rate-limited · no credit card
          </div>
        </div>
      </div>
    </div>
  );
}
