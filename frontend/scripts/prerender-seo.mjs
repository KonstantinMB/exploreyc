/**
 * Build-time per-route SEO prerender.
 *
 * The app is a client-rendered SPA, so non-JS crawlers and AI bots (GPTBot,
 * PerplexityBot, ClaudeBot, Bing) only ever see the static index.html. This
 * script runs after `vite build` and writes a static `dist/<route>/index.html`
 * for each SEO-important page with that page's real <title>, description,
 * canonical, Open Graph/Twitter tags and JSON-LD baked into the <head>.
 *
 * Vercel serves these static files for their paths; the catch-all rewrite in
 * vercel.json only falls back to the SPA index.html for routes without a file.
 * The React app still hydrates and takes over normally on all of them.
 *
 * NOTE: keep the /api-docs and /database entries in sync with the in-page
 * <Helmet> tags in ApiDocsPage.tsx / DatabasePage.tsx, and the FAQ in sync with
 * src/components/HomeFaq.tsx.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const ORIGIN = 'https://exploreyc.com';

function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Replace a whole <meta ...> / <link ...> tag matched by an attribute, with a clean version.
function setMetaByName(html, name, content) {
  const re = new RegExp(`<meta\\b[^>]*\\bname="${name}"[^>]*>`, 'i');
  return html.replace(re, `<meta name="${name}" content="${escAttr(content)}">`);
}
function setMetaByProp(html, prop, content) {
  const re = new RegExp(`<meta\\b[^>]*\\bproperty="${prop}"[^>]*>`, 'i');
  return html.replace(re, `<meta property="${prop}" content="${escAttr(content)}">`);
}
function setTitle(html, title) {
  return html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escAttr(title)}</title>`);
}
function setCanonical(html, url) {
  const re = /<link\b[^>]*\brel="canonical"[^>]*>/i;
  const tag = `<link rel="canonical" href="${escAttr(url)}">`;
  return re.test(html) ? html.replace(re, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
}
function appendJsonLd(html, obj) {
  const tag = `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
  return html.replace('</head>', `    ${tag}\n  </head>`);
}

function applyMeta(html, m) {
  const url = `${ORIGIN}${m.path}`;
  html = setTitle(html, m.title);
  html = setMetaByName(html, 'description', m.description);
  html = setCanonical(html, url);
  html = setMetaByProp(html, 'og:title', m.ogTitle || m.title);
  html = setMetaByProp(html, 'og:description', m.ogDescription || m.description);
  html = setMetaByProp(html, 'og:url', url);
  html = setMetaByName(html, 'twitter:title', m.ogTitle || m.title);
  html = setMetaByName(html, 'twitter:description', m.ogDescription || m.description);
  html = setMetaByName(html, 'twitter:url', url);
  if (m.jsonLd) html = appendJsonLd(html, m.jsonLd);
  return html;
}

const ROUTES = [
  {
    path: '/api-docs',
    title: 'Y Combinator, a16z & Product Hunt data API — Free REST API | ExploreYC',
    description:
      'Free, open-source REST API for Y Combinator, a16z and Product Hunt company data. Endpoints for companies, search, stats, batches and maps — JSON over HTTPS with API-key auth.',
    ogTitle: 'Free API for Y Combinator, a16z & Product Hunt data — ExploreYC',
    ogDescription:
      'Public REST API over YC, a16z, Product Hunt & Hacker News company data. JSON, API-key auth, free tier.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'ExploreYC API',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Any',
      url: `${ORIGIN}/api-docs`,
      description:
        'Free, open-source REST API for startup data across Y Combinator, a16z, Product Hunt and Hacker News. Companies, search, stats, batches, industries, countries and maps — JSON over HTTPS with API-key authentication.',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    },
  },
  {
    path: '/database',
    title: 'Startup database — Y Combinator, a16z & Product Hunt companies | ExploreYC',
    description:
      'Searchable database of 8,600+ startups from Y Combinator, a16z, Product Hunt & Hacker News — filter by batch, industry, country, funding & hiring. Free API available.',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: 'ExploreYC startup company database',
      description:
        'A database of 8,600+ startups from Y Combinator, a16z (Andreessen Horowitz), Product Hunt and Hacker News, with company name, batch, industry, country, team size, hiring status, founders and funding. Available via a free, open-source REST API.',
      url: `${ORIGIN}/database`,
      keywords: ['Y Combinator', 'a16z', 'Product Hunt', 'Hacker News', 'startups', 'company data', 'API'],
      creator: { '@type': 'Organization', name: 'ExploreYC', url: `${ORIGIN}/` },
      isAccessibleForFree: true,
      distribution: {
        '@type': 'DataDownload',
        encodingFormat: 'application/json',
        contentUrl: 'https://api.exploreyc.com/api/v1/companies',
      },
    },
  },
  {
    path: '/map',
    title: 'Interactive map of Y Combinator, a16z & Product Hunt startups | ExploreYC',
    description:
      'Explore 8,600+ startups from YC, a16z, Product Hunt & Hacker News on an interactive 2D map and 3D globe — density hotspots, batch timeline and hub tours.',
  },
  {
    path: '/analytics',
    title: 'Y Combinator analytics — batches, industries & hiring trends | ExploreYC',
    description:
      'Charts and analytics on Y Combinator and a16z: batches over time, top industries, geography and hiring trends across 8,600+ startups.',
  },
  {
    path: '/hiring',
    title: "YC startup jobs — who's hiring across Y Combinator | ExploreYC",
    description:
      'Open roles across Y Combinator companies that are actively hiring, refreshed daily. Browse YC startup jobs by role and company.',
  },
  {
    path: '/founders',
    title: 'For founders — PG essays & daily YC updates | ExploreYC',
    description:
      'Paul Graham essays, daily Y Combinator updates and founder resources — everything a startup founder actually reads, in one place.',
  },
  {
    path: '/tools',
    title: 'Founder tools — startup idea validator & success predictor | ExploreYC',
    description:
      'Free founder tools built on YC + a16z data: startup idea validator, success predictor, batch wrapped and a fundraising tracker.',
  },
  {
    path: '/funding',
    title: 'Startup funding data — Y Combinator & a16z rounds | ExploreYC',
    description:
      'Funding data across Y Combinator and a16z portfolio companies — total raised, last round and top-funded startups. Free API available.',
  },
];

// FAQ — keep in sync with src/components/HomeFaq.tsx. Injected into the homepage
// <head> as FAQPage JSON-LD so non-JS AI bots get the answers too.
const FAQS = [
  ['Is there an API for Y Combinator company data?', 'Yes. ExploreYC provides a free, open-source REST API for Y Combinator company data at api.exploreyc.com/api/v1. Authenticate with an API key and query companies, full-text search, stats and more — returned as structured JSON, no scraping required.'],
  ['Does ExploreYC include a16z and Product Hunt data too?', 'Yes. Alongside Y Combinator, ExploreYC aggregates Andreessen Horowitz (a16z) portfolio companies, Product Hunt launches and Hacker News startups. You can search across all sources at once or filter to a single source.'],
  ['Is the ExploreYC API free?', 'Yes, there is a free tier. Create a developer account, generate an API key, and start with 5 requests per day. Higher rate limits are available for heavier usage.'],
  ['Is ExploreYC open source?', 'Yes — ExploreYC is an open-source project. Instead of scraping Y Combinator, a16z or Product Hunt yourself, you can pull clean, structured company data straight from the public API.'],
  ['What startup data can I get?', 'For 8,600+ companies: name, one-liner, description, batch, industry, country, team size, hiring status, founders, funding, stage, exits and geo-coordinates — via the API or the filterable web database.'],
  ['How do I get started with the API?', 'Grab an API key at exploreyc.com/signup, then send a request to the /companies endpoint with your bearer token. The full endpoint reference is at exploreyc.com/api-docs.'],
];

function main() {
  const base = readFileSync(join(DIST, 'index.html'), 'utf8');

  // Homepage: add FAQPage JSON-LD to the static head.
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };
  writeFileSync(join(DIST, 'index.html'), appendJsonLd(base, faqSchema));

  // Per-route static HTML with baked-in head.
  let count = 0;
  for (const m of ROUTES) {
    const html = applyMeta(base, m);
    const dir = join(DIST, m.path.replace(/^\//, ''));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), html);
    count++;
  }
  console.log(`prerender-seo: wrote ${count} route HTML files + homepage FAQ schema`);
}

main();
