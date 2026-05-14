import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { apiClient } from '../lib/api';
import type { Company, Stats } from '../lib/api';
import { usePrefetchHiringJobs } from '../hooks/usePrefetchHiringJobs';

const MAP_CACHE_KEY = 'yc-map-companies';
const MAP_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface AppContextType {
  companies: Company[];
  totalMapCompanies: number;
  stats: Stats | null;
  loading: boolean;
  loadingProgress: number;
  loadingTotal: number;
  error: string | null;
  refreshData: () => Promise<void>;
  loadAllMapCompanies: () => Promise<void>;
  selectedCompany: Company | null;
  setSelectedCompany: (company: Company | null) => void;
  comparisonCompanies: Company[];
  addToComparison: (company: Company) => void;
  removeFromComparison: (companyId: number) => void;
  clearComparison: () => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  contactFormOpen: boolean;
  setContactFormOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function getCachedMapData(): { companies: Company[]; totalMap?: number; timestamp: number } | null {
  try {
    const raw = localStorage.getItem(MAP_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.timestamp > MAP_CACHE_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

function setCachedMapData(companies: Company[], totalMap?: number) {
  try {
    localStorage.setItem(
      MAP_CACHE_KEY,
      JSON.stringify({ companies, totalMap, timestamp: Date.now() })
    );
  } catch {
    // Ignore storage errors
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [totalMapCompanies, setTotalMapCompanies] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingTotal, setLoadingTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [comparisonCompanies, setComparisonCompanies] = useState<Company[]>([]);
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('darkMode');
    return stored ? JSON.parse(stored) : false; // Default to light mode
  });
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [contactFormOpen, setContactFormOpen] = useState(false);

  // Sync dark mode with document class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const addToComparison = (company: Company) => {
    setComparisonCompanies((prev) => {
      if (prev.find((c) => c.id === company.id)) return prev;
      if (prev.length >= 4) return prev;
      return [...prev, company];
    });
  };

  const removeFromComparison = (companyId: number) => {
    setComparisonCompanies((prev) => prev.filter((c) => c.id !== companyId));
  };

  const clearComparison = () => setComparisonCompanies([]);

  const loadData = async (retryCount = 0) => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 1500;

    setLoading(true);
    setError(null);
    setLoadingProgress(0);
    setLoadingTotal(0);

    try {
      // Hydrate from cache immediately so map has data ready when platform shows
      const cached = getCachedMapData();
      if (cached?.companies.length) {
        setCompanies(cached.companies);
        setTotalMapCompanies(cached.totalMap ?? cached.companies.length);
        setLoadingProgress(cached.companies.length);
        setLoadingTotal(cached.companies.length);
      }

      // Single bootstrap call: stats + map in one round-trip (recent 4 batches only)
      setLoadingTotal(1000);
      const { data } = await apiClient.getBootstrap(4);

      setStats(data.stats);
      const loadedCompanies = data.companies;
      setCompanies(loadedCompanies);
      setTotalMapCompanies(data.total_map ?? loadedCompanies.length);
      setLoadingProgress(loadedCompanies.length);
      setLoadingTotal(loadedCompanies.length);
      setCachedMapData(loadedCompanies, data.total_map);
    } catch (err) {
      console.error('Failed to load data:', err);
      const isNetworkError =
        (err as { code?: string; message?: string }).code === 'ERR_NETWORK' ||
        (err as { message?: string }).message?.includes('Network Error');
      if (isNetworkError && retryCount < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        return loadData(retryCount + 1);
      }
      setError(
        isNetworkError
          ? 'Connection issue. Check your network and try again.'
          : 'Failed to load data. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Prefetch all hiring jobs on app startup
  usePrefetchHiringJobs();

  const refreshData = async () => {
    await loadData();
  };

  const loadAllMapCompanies = async () => {
    try {
      const { data } = await apiClient.getMapData();
      setCompanies(data.companies);
      setTotalMapCompanies(data.total);
      setCachedMapData(data.companies, data.total);
    } catch (err) {
      console.error('Failed to load all map companies:', err);
    }
  };

  return (
    <AppContext.Provider
      value={{
        companies,
        totalMapCompanies,
        stats,
        loading,
        loadingProgress,
        loadingTotal,
        error,
        refreshData,
        loadAllMapCompanies,
        selectedCompany,
        setSelectedCompany,
        comparisonCompanies,
        addToComparison,
        removeFromComparison,
        clearComparison,
        darkMode,
        setDarkMode,
        commandPaletteOpen,
        setCommandPaletteOpen,
        contactFormOpen,
        setContactFormOpen,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
