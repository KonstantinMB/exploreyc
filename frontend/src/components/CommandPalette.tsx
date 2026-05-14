import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  BarChart3,
  Map,
  Download,
  ExternalLink,
  Lightbulb,
  Sparkles,
  Home,
  Wrench,
  BookOpen,
  Briefcase,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { apiClient } from '../lib/api';
import { getSecondMostRecentBatch, batchToShortFormat } from '../lib/batchUtils';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface CommandItem {
  id: string;
  type: 'action' | 'company';
  label: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { companies, setSelectedCompany, stats } = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleNavigation = useCallback((path: string) => {
    navigate(path);
    onClose();
  }, [navigate, onClose]);

  const actions: CommandItem[] = [
    {
      id: 'home',
      type: 'action',
      label: 'Go to Home',
      subtitle: 'Back to homepage',
      icon: <Home className="h-4 w-4" />,
      action: () => handleNavigation('/'),
    },
    {
      id: 'explore',
      type: 'action',
      label: 'Go to Map',
      subtitle: 'Interactive map and companies',
      icon: <Map className="h-4 w-4" />,
      action: () => {
        handleNavigation('/');
        setTimeout(() => document.getElementById('map')?.scrollIntoView({ behavior: 'smooth' }), 100);
      },
    },
    {
      id: 'analytics',
      type: 'action',
      label: 'Go to Analytics',
      subtitle: 'View charts and metrics',
      icon: <BarChart3 className="h-4 w-4" />,
      action: () => handleNavigation('/analytics'),
    },
    {
      id: 'all-batches',
      type: 'action',
      label: 'All Batches Analytics',
      subtitle: 'Comprehensive trends across all batches',
      icon: <Sparkles className="h-4 w-4" />,
      action: () => handleNavigation('/analytics/batches'),
    },
    {
      id: 'hiring',
      type: 'action',
      label: 'Go to Hiring Board',
      subtitle: 'Browse 1,425+ YC job openings',
      icon: <Briefcase className="h-4 w-4" />,
      action: () => handleNavigation('/hiring'),
    },
    {
      id: 'tools',
      type: 'action',
      label: 'Go to Tools',
      subtitle: 'Founder tools and utilities',
      icon: <Wrench className="h-4 w-4" />,
      action: () => handleNavigation('/tools'),
    },
    {
      id: 'founders',
      type: 'action',
      label: 'Go to Founders',
      subtitle: 'Paul Graham essays and YC updates',
      icon: <BookOpen className="h-4 w-4" />,
      action: () => handleNavigation('/founders'),
    },
    {
      id: 'validator',
      type: 'action',
      label: 'Validate Startup Idea',
      subtitle: 'Check if idea exists in YC portfolio',
      icon: <Lightbulb className="h-4 w-4" />,
      action: () => handleNavigation('/validator'),
    },
    {
      id: 'batch-wrapped',
      type: 'action',
      label: 'Batch Wrapped',
      subtitle: 'Spotify-style batch stats',
      icon: <Sparkles className="h-4 w-4" />,
      action: () => {
        const wrappedBatch = getSecondMostRecentBatch(stats?.by_batch);
        if (wrappedBatch) {
          handleNavigation(`/batch/${batchToShortFormat(wrappedBatch.name)}/wrapped`);
        } else {
          onClose();
        }
      },
    },
    {
      id: 'export-json',
      type: 'action',
      label: 'Export as JSON',
      subtitle: 'Download companies data',
      icon: <Download className="h-4 w-4" />,
      action: () => {
        apiClient.exportJSON({});
        onClose();
      },
    },
    {
      id: 'export-csv',
      type: 'action',
      label: 'Export as CSV',
      subtitle: 'Download companies data',
      icon: <Download className="h-4 w-4" />,
      action: () => {
        apiClient.exportCSV({});
        onClose();
      },
    },
  ];

  const companyResults = query.length >= 2
    ? companies
        .filter(
          (c) =>
            c.name.toLowerCase().includes(query.toLowerCase()) ||
            c.one_liner?.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 8)
        .map((c) => ({
          id: `company-${c.id}`,
          type: 'company' as const,
          label: c.name,
          subtitle: c.one_liner,
          icon: <ExternalLink className="h-4 w-4" />,
          action: () => {
            setSelectedCompany(c);
            onClose();
          },
        }))
    : [];

  const filteredActions = query.length >= 2
    ? actions.filter(
        (a) =>
          a.label.toLowerCase().includes(query.toLowerCase()) ||
          a.subtitle?.toLowerCase().includes(query.toLowerCase())
      )
    : actions;

  const displayItems = companyResults.length > 0 ? companyResults : filteredActions;

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, displayItems.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter' && displayItems[selectedIndex]) {
        e.preventDefault();
        displayItems[selectedIndex].action();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, displayItems, selectedIndex]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] sm:pt-[15vh] px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <motion.div
          className="relative w-full max-w-xl max-h-[80vh] overflow-hidden rounded-xl border bg-background shadow-2xl"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 25 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search input with terminal style */}
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <span className="font-mono text-[#FB651E]">&gt;</span>
            <Search className="h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search companies or run command..."
              className="flex-1 bg-transparent font-mono text-base outline-none placeholder:text-muted-foreground"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <kbd className="rounded border px-2 py-1 font-mono text-xs text-muted-foreground">ESC</kbd>
          </div>

          {/* Results */}
          <div className="max-h-[50vh] sm:max-h-[320px] overflow-y-auto py-2">
            {displayItems.length === 0 ? (
              <div className="px-4 py-8 text-center font-mono text-sm text-muted-foreground">
                No results found
              </div>
            ) : (
              displayItems.map((item, i) => (
                <button
                  key={item.id}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                    i === selectedIndex ? 'bg-[#FB651E]/10' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => item.action()}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FB651E]/10 text-[#FB651E]">
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{item.label}</div>
                    {item.subtitle && (
                      <div className="truncate text-xs text-muted-foreground">{item.subtitle}</div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="flex items-center gap-4 border-t px-4 py-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="rounded border px-1.5 py-0.5">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border px-1.5 py-0.5">↵</kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border px-1.5 py-0.5">⌘K</kbd>
              Open
            </span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
