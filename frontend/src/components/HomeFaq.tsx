import { useEffect, useId, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { HelpCircle, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import faqs from '../data/faqs.json';

// Answer-style content targeting the queries we want to win on Google + AI search
// (YC/a16z/Product Hunt data API, open-source startup data). Rendered visibly AND
// emitted as FAQPage structured data from the same source, so the schema always
// matches what's on the page.
//
// The questions live in src/data/faqs.json because scripts/prerender-seo.mjs reads
// the same file to bake the JSON-LD into the static homepage head — one source, no drift.
const FAQS: { q: string; a: string }[] = faqs;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export function HomeFaq() {
  // Everything starts collapsed — answers appear only on click.
  const [open, setOpen] = useState<number | null>(null);
  const reduced = usePrefersReducedMotion();
  const baseId = useId();

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <div>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>

      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-center gap-2 font-mono">
          <HelpCircle className="h-5 w-5 text-[#FB651E]" />
          <span className="text-muted-foreground">$</span>
          <h2 className="text-xl font-bold">FAQ — the API &amp; the data</h2>
        </div>

        <div className="space-y-2">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            const panelId = `${baseId}-faq-${i}`;
            return (
              <div
                key={f.q}
                className={`overflow-hidden rounded-lg border bg-card/40 transition-colors dark:bg-white/[0.02] ${
                  isOpen ? 'border-[#FB651E]/40' : 'border-border/80 hover:border-[#FB651E]/25'
                }`}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left font-mono text-sm font-semibold transition-colors hover:text-[#FB651E]"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                >
                  <span className="[text-wrap:pretty]">{f.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 motion-reduce:transition-none ${
                      isOpen ? 'rotate-180 text-[#FB651E]' : 'text-muted-foreground'
                    }`}
                  />
                </button>
                <motion.div
                  id={panelId}
                  initial={false}
                  animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
                  transition={reduced ? { duration: 0 } : { duration: 0.25, ease: 'easeInOut' }}
                  className="overflow-hidden"
                  aria-hidden={!isOpen}
                >
                  <p className="px-4 pb-4 font-mono text-sm leading-relaxed text-muted-foreground">
                    {f.a}
                  </p>
                </motion.div>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-center font-mono text-sm text-muted-foreground">
          Still have a question?{' '}
          <Link to="/api-docs" className="text-[#FB651E] hover:underline">
            Read the API docs
          </Link>
        </p>
      </div>
    </div>
  );
}
