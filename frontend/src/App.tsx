import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Outlet, useLocation, useOutlet, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Analytics } from '@vercel/analytics/react';
import { AnimatePresence, motion } from 'framer-motion';
import { AppProvider, useApp } from './contexts/AppContext';
import { Navbar } from './components/Navbar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { CommandPalette } from './components/CommandPalette';
import { ContactFormModal } from './components/ContactFormModal';
import { Footer } from './components/Footer';
import { LoadingScreen } from './components/LoadingScreen';
import { AnnouncementBanner } from './components/AnnouncementBanner';
import { HomePage } from './pages/HomePage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ToolsPage } from './pages/ToolsPage';
import { RoadmapPage } from './pages/RoadmapPage';
import { FoundersPage } from './pages/FoundersPage';
import { VerifyEmail } from './pages/VerifyEmail';
import { ValidatorPage } from './pages/ValidatorPage';
import { IdeaBreakdownPage } from './pages/IdeaBreakdownPage';
import { SuccessPredictorPage } from './pages/SuccessPredictorPage';
import { CompanyIntelligencePage } from './pages/CompanyIntelligencePage';
import { ResearchHubPage } from './pages/ResearchHubPage';
import { BatchWrappedPage } from './pages/BatchWrappedPage';
import { AllBatchesPage } from './pages/AllBatchesPage';
import { FundingPage } from './pages/FundingPage';
import { AdminPage } from './pages/AdminPage';
import { CompanyPage } from './pages/CompanyPage';
import { ShareHub } from './pages/ShareHub';
import { CompanyCardPage } from './pages/CompanyCardPage';
import { HiringBoardPagePaginated } from './pages/HiringBoardPagePaginated';
import { HiringAnalyticsPage } from './pages/HiringAnalyticsPage';
import { DatabasePage } from './pages/DatabasePage';
import { FounderLeaderboardPage } from './pages/FounderLeaderboardPage';
import { FounderProfilePage } from './pages/FounderProfilePage';
import { PageTitleManager } from './components/PageTitleManager';
import { DevAuthProvider } from './contexts/DevAuthContext';
import { SignupPage } from './pages/SignupPage';
import { DevLoginPage } from './pages/DevLoginPage';
import { DeveloperDashboard } from './pages/DeveloperDashboard';
import { ApiDocsPage } from './pages/ApiDocsPage';
import { CompanyDetailModal } from './components/CompanyDetailModal';
import './index.css';

// ExploreYC World — the one globe. Lazy-loaded so the three.js bundle never
// taxes the rest of the app, but rendered INSIDE <Layout>: the platform navbar
// sits above the globe on every World surface, because a shopfront that does
// not say whose shop it is has stopped being a shopfront.
const WorldPage = React.lazy(() => import('./pages/world/WorldPage'));
const WorldCountryPage = React.lazy(() => import('./pages/world/WorldCountryPage'));
const WorldPlotPage = React.lazy(() => import('./pages/world/WorldPlotPage'));
const WorldClaimPage = React.lazy(() => import('./pages/world/WorldClaimPage'));
const WorldClaimedPage = React.lazy(() => import('./pages/world/WorldClaimedPage'));

/**
 * Routes whose page IS one full-screen WebGL canvas: the content area is the
 * globe, everything else floats over it as `position: fixed` layers, and there
 * is nothing below to scroll to. They get a measured, viewport-filling stage
 * and no footer instead of the normal document flow.
 *
 * Only the claim wizard qualifies. /world itself is a scrolling shopfront —
 * a globe window sized by the page (see STAGE_HEIGHT in WorldPage.tsx), then
 * the paid plots, the boards and the price underneath — so it flows normally
 * and keeps its footer like every other page.
 *
 * Exact strings, not a prefix: `/world/claim` and `/world/claimed` differ by
 * one letter and only the first is a globe.
 */
const WORLD_STAGE_ROUTES = new Set(['/world/claim']);

/**
 * Height of the platform chrome above the content area, in CSS px.
 *
 * Only a first-paint fallback — the stage measures its own real offset in a
 * layout effect, before the browser paints. It matches the two places the
 * number is already hardcoded: <main>'s `pt-[84px]` below, and the 28px
 * banner + 56px bar that MobileBottomNav pins itself to.
 */
const APP_CHROME_FALLBACK_PX = 84;

// Minimal fallback shown while a /world chunk loads. It carries `world-root`
// so the first paint is already on the World's own tokens (bright ground,
// rounded sans) rather than flashing the app's shell — and so this is a
// sentence, not a fake shell prompt.
function WorldFallback() {
  return (
    <div className="world-root flex h-full min-h-[16rem] items-center justify-center">
      <p className="text-sm font-semibold text-muted-foreground" role="status">
        Loading the World…
      </p>
    </div>
  );
}

function lazyWorld(element: React.ReactNode) {
  return <React.Suspense fallback={<WorldFallback />}>{element}</React.Suspense>;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 60 * 60, // 1 hour default
    },
  },
});

// AnimatedOutlet: use useOutlet() so AnimatePresence can properly track exit/enter.
// Using <Outlet /> directly inside AnimatePresence causes blank screens on nav (Outlet unmounts before exit).
function AnimatedOutlet() {
  const location = useLocation();
  const outlet = useOutlet();

  return (
    <AnimatePresence mode="wait" initial={false}>
      {outlet && (
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="min-h-[50vh]"
        >
          {outlet}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Scroll to top when route changes (so user sees full page on mobile)
function ScrollToTop() {
  const location = useLocation();
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return null;
}

/**
 * Sizes the full-bleed stage to "everything under the chrome".
 *
 * Two deliberate choices:
 *
 * 1. It MEASURES the stage's offset rather than trusting a constant. The
 *    chrome is 28px of banner + 56px of bar, but which of those are in the
 *    document flow changes at `md` and again at `lg`, and <main> only drops
 *    its 84px of padding at `lg`. Measuring is right at every width, including
 *    the tablet band where the two disagree; a constant is right at two.
 *
 * 2. It uses `window.innerHeight`, not `100dvh`. `dvh` needs Safari 15.4 and
 *    this build targets further back than that, and innerHeight already tracks
 *    the dynamic viewport — iOS fires `resize` as the toolbar collapses, which
 *    is exactly when a hardcoded `100vh` would push the globe off-screen.
 *
 * Returns null when the route is not a stage route, which is the signal to
 * render the ordinary animated outlet instead.
 *
 * The ref is passed IN rather than created and handed back. Same behaviour,
 * but it keeps `ref={...}` at the call site pointing at a plain useRef, which
 * is what the react-hooks lint rule can actually verify; a ref smuggled out
 * inside a returned object reads to it as a ref touched during render.
 */
function useStageHeight(
  ref: React.RefObject<HTMLDivElement | null>,
  active: boolean,
  pathname: string
) {
  const [height, setHeight] = React.useState<number | null>(null);

  React.useLayoutEffect(() => {
    if (!active) {
      setHeight(null);
      return;
    }
    let cancelled = false;
    const measure = () => {
      const el = ref.current;
      if (cancelled || !el) return;
      // Document offset of the stage's top edge: <main>'s padding on phones
      // (where the chrome is `fixed`), the real banner + navbar height on
      // desktop (where both are in flow).
      const offset = el.getBoundingClientRect().top + window.scrollY;
      // A floor, so a mid-transition measurement can never collapse the globe
      // to nothing.
      setHeight(Math.max(320, Math.round(window.innerHeight - offset)));
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    // Web fonts can nudge the banner's line box by a pixel or two after first
    // paint. Cheap to re-measure once they land; harmless if unsupported. The
    // `cancelled` flag matters here and nowhere else: this promise can resolve
    // after the visitor has already navigated off the stage route.
    document.fonts?.ready.then(measure).catch(() => {});
    return () => {
      cancelled = true;
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, [ref, active, pathname]);

  return height;
}

// Layout component for pages with navigation (AppProvider wraps entire app so context persists on nav)
function LayoutContent() {
  const { commandPaletteOpen, setCommandPaletteOpen, contactFormOpen, setContactFormOpen, loading, stats, companies, error, refreshData, loadingProgress, loadingTotal, selectedCompany, setSelectedCompany } = useApp();
  const location = useLocation();

  // Pages that get the platform chrome (navbar, burger, ⌘K) but don't read the
  // company dataset, so they skip the initial loading/error gate and render
  // immediately. The World is on this list on purpose: it fetches its own
  // /api/world/globe payload, and before the merge it lived outside <Layout>
  // entirely — making the globe wait on 8,600 unrelated company rows would be
  // a straight regression paid for by every visitor arriving from a plot link.
  const chromeOnly = ['/api-docs', '/dashboard', '/signup', '/login', '/world'].some((p) => location.pathname.startsWith(p));

  const fullBleed = WORLD_STAGE_ROUTES.has(location.pathname);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const stageHeight = useStageHeight(stageRef, fullBleed, location.pathname);

  // Global keyboard shortcut for command palette (⌘K / Ctrl+K)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setCommandPaletteOpen]);

  // Show loading screen while initial data is loading
  // Keep loading screen visible until BOTH stats AND companies are loaded
  if (!chromeOnly && ((loading && !stats) || (loading && companies.length === 0))) {
    return (
      <AnimatePresence>
        <LoadingScreen
          progress={loadingProgress}
          total={loadingTotal}
        />
      </AnimatePresence>
    );
  }

  // Show error screen if data failed to load
  if (!chromeOnly && error && !stats) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto bg-red-600/10 rounded-sm flex items-center justify-center mb-6">
            <span className="text-4xl">⚠️</span>
          </div>
          <h2 className="text-2xl font-bold mb-2">Error Loading Data</h2>
          <p className="text-muted-foreground font-mono mb-6">{error}</p>
          <button
            onClick={() => refreshData()}
            className="px-6 py-3 bg-[#FB651E] hover:bg-[#E65C00] text-white font-semibold rounded-xl transition-colors"
          >
            Try Again
          </button>
          <p className="mt-6 text-xs text-muted-foreground">
            If this keeps happening, check your connection or try again later.
          </p>
        </div>
      </div>
    );
  }

  // Once data is loaded, show the app with instant navigation
  return (
    <div className="min-h-screen bg-background">
      <AnnouncementBanner />
      <ScrollToTop />
      <Navbar />
      <MobileBottomNav />
      <main className="pt-[84px] lg:pt-0">
        {fullBleed ? (
          /*
            The globe stage.

            `translateZ(0)` is doing real work, not cargo-culting a GPU hint:
            a transformed element is the containing block for its `position:
            fixed` descendants, so the World's own full-screen layers resolve
            against THIS box — the area under the navbar — instead of against
            the viewport, where they would sit on top of the navbar and undo
            the whole point of the merge. Radix dialogs are unaffected: they
            portal to document.body, outside this subtree, and stay
            viewport-centred as a modal should.

            Height is measured px once the layout effect has run; the calc()
            below is only what the very first paint uses, and useLayoutEffect
            replaces it before the browser ever shows that value.

            No <AnimatePresence> wrapper here. The cross-fade is a 15% opacity
            tween on a `min-h-[50vh]` box — fine for a document, wrong for a
            canvas that must be exactly one viewport tall from frame one.
          */
          <div
            ref={stageRef}
            className="relative isolate overflow-hidden"
            style={{
              height: stageHeight ?? `calc(100vh - ${APP_CHROME_FALLBACK_PX}px)`,
              transform: 'translateZ(0)',
            }}
          >
            <Outlet />
          </div>
        ) : (
          <AnimatedOutlet />
        )}
      </main>
      {/* A footer under a viewport-filling globe is a scrollbar and nothing
          else. Every other route, including the World's own content pages,
          keeps it. */}
      {!fullBleed && <Footer />}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
      <ContactFormModal
        open={contactFormOpen}
        onClose={() => setContactFormOpen(false)}
      />
      {/* Hosted here, not per-page. ⌘K → a company sets `selectedCompany` from
          anywhere in the app, but only HomePage and the retired MapPage ever
          rendered the modal, so the same keystroke opened a company on two
          routes and did nothing on the other fifteen. One host in the shell
          fixes that and survives MapPage's deletion. */}
      {selectedCompany && (
        <CompanyDetailModal
          company={selectedCompany}
          open={true}
          onClose={() => setSelectedCompany(null)}
        />
      )}
    </div>
  );
}

function Layout() {
  return <LayoutContent />;
}

// Routes: Layout wraps all main pages so AppProvider stays mounted (data loads once, no loading on nav)
function AnimatedRoutes() {
  const location = useLocation();

  return (
    <Routes location={location}>
      {/* Full-screen pages without navigation */}
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/validator" element={<ValidatorPage />} />
      <Route path="/idea" element={<IdeaBreakdownPage />} />
      <Route path="/success-predictor" element={<SuccessPredictorPage />} />
      <Route path="/research" element={<CompanyIntelligencePage />} />
      <Route path="/research-hub" element={<ResearchHubPage />} />
      <Route path="/batch/:batch/wrapped" element={<BatchWrappedPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/company/:slug" element={<CompanyPage />} />
      <Route path="/share/company/:slug" element={<CompanyCardPage />} />
      <Route path="/share/company" element={<CompanyCardPage />} />

      {/* Main app: Layout wraps all pages - data loads once on first visit, instant nav */}
      <Route path="/explore" element={<Navigate to="/" replace />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="analytics/batches" element={<AllBatchesPage />} />
        <Route path="funding" element={<FundingPage />} />
        <Route path="tools" element={<ToolsPage />} />
        <Route path="hiring" element={<HiringBoardPagePaginated />} />
        <Route path="hiring/analytics" element={<HiringAnalyticsPage />} />
        <Route path="database" element={<DatabasePage />} />

        {/* ExploreYC World — one globe, inside the platform. Every surface
            gets the real navbar above it. /world/claim is the only one that
            fills the stage (see WORLD_STAGE_ROUTES); the rest scroll. */}
        <Route path="world" element={lazyWorld(<WorldPage />)} />
        <Route path="world/c/:iso" element={lazyWorld(<WorldCountryPage />)} />
        <Route path="world/p/:id" element={lazyWorld(<WorldPlotPage />)} />
        <Route path="world/claim" element={lazyWorld(<WorldClaimPage />)} />
        <Route path="world/claimed" element={lazyWorld(<WorldClaimedPage />)} />

        {/* The deck.gl company explorer retired into the globe above. This is
            a live, indexed URL — the redirect is the only thing keeping those
            links pointed at a real page, so it stays indefinitely. It sits
            inside <Layout>, so the destination arrives with the navbar
            already up.

            This one is for in-app navigation and for `vite dev`, which never
            reads vercel.json. Crawlers and cold traffic get the real thing:
            vercel.json now serves a 308 for /map, because a redirect a bot
            only discovers by executing JavaScript passes the ranking signal
            slowly if at all. Both are wanted; neither replaces the other. */}
        <Route path="map" element={<Navigate to="/world" replace />} />

        <Route path="founders" element={<FoundersPage />} />
        <Route path="founders/leaderboard" element={<FounderLeaderboardPage />} />
        <Route path="founder/:slug" element={<FounderProfilePage />} />
        <Route path="roadmap" element={<RoadmapPage />} />
        <Route path="share" element={<ShareHub />} />
        {/* Public API developer portal — in-platform (navbar, burger, ⌘K) */}
        <Route path="api-docs" element={<ApiDocsPage />} />
        <Route path="signup" element={<SignupPage />} />
        <Route path="login" element={<DevLoginPage />} />
        <Route path="dashboard" element={<DeveloperDashboard />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <BrowserRouter>
          <PageTitleManager />
          <DevAuthProvider>
            <AppProvider>
              <AnimatedRoutes />
            </AppProvider>
          </DevAuthProvider>
        </BrowserRouter>
        <Analytics />
      </HelmetProvider>
    </QueryClientProvider>
  );
}

export default App;
