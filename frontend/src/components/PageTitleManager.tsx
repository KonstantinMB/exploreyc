import React from 'react';
import { useLocation } from 'react-router-dom';

const BRAND = 'ExploreYC';
const DEFAULT_TITLE = `${BRAND} — startup data from YC, a16z & more`;

const EXACT: Record<string, string> = {
  '/': DEFAULT_TITLE,
  '/analytics': 'Analytics',
  '/analytics/batches': 'Batch Analytics',
  '/funding': 'Funding',
  '/tools': 'Tools',
  '/hiring': 'YC Hiring Board',
  '/hiring/analytics': 'Hiring Analytics',
  '/founders': 'For Founders',
  '/roadmap': 'Roadmap',
  '/share': 'Share',
  '/validator': 'Idea Validator',
  '/success-predictor': 'Startup Success Predictor',
  '/research': 'Company Research',
  '/research-hub': 'Research Hub',
  '/admin': 'Admin',
  '/verify-email': 'Verify your email',
  '/explore': DEFAULT_TITLE,
  '/api-docs': 'API Reference',
  '/dashboard': 'Developer Dashboard',
  '/login': 'Developer Login',
  '/signup': 'Get API Access',
};

function titleForPath(pathname: string): string {
  const exact = EXACT[pathname];
  if (exact) return exact === DEFAULT_TITLE ? exact : `${exact} — ${BRAND}`;

  // Dynamic routes — match by prefix / pattern.
  if (pathname.startsWith('/company/')) return `Company — ${BRAND}`;
  if (pathname.startsWith('/share/company')) return `Share company — ${BRAND}`;
  if (pathname.match(/^\/batch\/.+\/wrapped$/)) return `Batch Wrapped — ${BRAND}`;

  // Unknown route — NotFoundPage sets its own title via Helmet, but provide
  // a sensible default in case the title manager fires first.
  return `Page not found — ${BRAND}`;
}

export function PageTitleManager() {
  const location = useLocation();
  React.useEffect(() => {
    document.title = titleForPath(location.pathname);
  }, [location.pathname]);
  return null;
}
