import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, useLocation, useOutlet, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Analytics } from '@vercel/analytics/react';
import { AnimatePresence, motion } from 'framer-motion';
import { AppProvider, useApp } from './contexts/AppContext';
import { Navbar } from './components/Navbar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { CommandPalette } from './components/CommandPalette';
import { ContactFormModal } from './components/ContactFormModal';
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
import { PageTitleManager } from './components/PageTitleManager';
import { DevAuthProvider } from './contexts/DevAuthContext';
import { SignupPage } from './pages/SignupPage';
import { DevLoginPage } from './pages/DevLoginPage';
import { DeveloperDashboard } from './pages/DeveloperDashboard';
import { ApiDocsPage } from './pages/ApiDocsPage';
import './index.css';

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

// Layout component for pages with navigation (AppProvider wraps entire app so context persists on nav)
function LayoutContent() {
  const { commandPaletteOpen, setCommandPaletteOpen, contactFormOpen, setContactFormOpen, loading, stats, companies, error, refreshData, loadingProgress, loadingTotal } = useApp();
  const location = useLocation();

  // Developer-portal pages get the platform chrome (navbar) but don't need the company
  // dataset, so they skip the initial loading/error gate and render immediately.
  const chromeOnly = ['/api-docs', '/dashboard', '/signup', '/login'].some((p) => location.pathname.startsWith(p));

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
          <div className="w-20 h-20 mx-auto bg-red-600/10 rounded-2xl flex items-center justify-center mb-6">
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
        <AnimatedOutlet />
      </main>
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
      <ContactFormModal
        open={contactFormOpen}
        onClose={() => setContactFormOpen(false)}
      />
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
        <Route path="founders" element={<FoundersPage />} />
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
