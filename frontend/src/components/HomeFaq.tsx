import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { HelpCircle, Plus, Minus } from 'lucide-react';

// Answer-style content targeting the queries we want to win on Google + AI search
// (YC/a16z/Product Hunt data API, open-source startup data). Rendered visibly AND
// emitted as FAQPage structured data from the same source, so the schema always
// matches what's on the page.
const FAQS: { q: string; a: string }[] = [
  {
    q: 'Is there an API for Y Combinator company data?',
    a: 'Yes. ExploreYC provides a free, open-source REST API for Y Combinator company data at api.exploreyc.com/api/v1. Authenticate with an API key and query companies, full-text search, stats and more — returned as structured JSON, no scraping required.',
  },
  {
    q: 'Does ExploreYC include a16z and Product Hunt data too?',
    a: 'Yes. Alongside Y Combinator, ExploreYC aggregates Andreessen Horowitz (a16z) portfolio companies, Product Hunt launches and Hacker News startups. You can search across all sources at once or filter to a single source with source=yc, source=a16z, and so on.',
  },
  {
    q: 'Is the ExploreYC API free?',
    a: 'Yes, there is a free tier. Create a developer account, generate an API key, and start with 5 requests per day. Higher rate limits are available for heavier usage.',
  },
  {
    q: 'Is ExploreYC open source?',
    a: 'Yes — ExploreYC is an open-source project. Instead of scraping Y Combinator, a16z or Product Hunt yourself, you can pull clean, structured company data straight from the public API.',
  },
  {
    q: 'What startup data can I get?',
    a: 'For 8,600+ companies: name, one-liner, description, batch, industry, country, team size, hiring status, founders, funding, stage, exits and geo-coordinates — via the API or the filterable web database.',
  },
  {
    q: 'How do I get started with the API?',
    a: 'Grab an API key at exploreyc.com/signup, then send a request to the /companies endpoint with your bearer token. The full endpoint reference, authentication and rate limits are at exploreyc.com/api-docs.',
  },
];

export function HomeFaq() {
  const [open, setOpen] = useState<number | null>(0);

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

      <div className="flex items-center gap-2 mb-6 font-mono">
        <HelpCircle className="h-5 w-5 text-[#FB651E]" />
        <span className="text-muted-foreground">$</span>
        <h2 className="text-xl font-bold">FAQ — the API &amp; the data</h2>
      </div>

      <div className="max-w-3xl space-y-2">
        {FAQS.map((f, i) => {
          const isOpen = open === i;
          return (
            <div
              key={f.q}
              className="border border-border/80 rounded-lg bg-card/40 dark:bg-white/[0.02] overflow-hidden"
            >
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left font-mono font-semibold text-sm hover:text-[#FB651E] transition-colors"
                aria-expanded={isOpen}
              >
                <span>{f.q}</span>
                {isOpen ? (
                  <Minus className="h-4 w-4 text-[#FB651E] flex-shrink-0" />
                ) : (
                  <Plus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
              </button>
              <motion.div
                initial={false}
                animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <p className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed font-mono">
                  {f.a}
                </p>
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
