import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, BarChart3, Wrench, BookOpen, Map as MapIcon, DollarSign, Share2, Briefcase,
  Mail, Database, Terminal, Menu, X, Moon, Sun, Command,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useDevAuth } from '../contexts/DevAuthContext';

type Item = { label: string; icon: React.ComponentType<{ className?: string }>; path: string };

const showShareNav = import.meta.env.VITE_SHOW_SHARE_NAV === 'true' || import.meta.env.VITE_SHOW_SHARE_NAV === '1';

const groups: { title: string; items: Item[] }[] = [
  {
    title: 'Explore',
    items: [
      { label: 'Home', icon: Home, path: '/' },
      { label: 'Database', icon: Database, path: '/database' },
      { label: 'Analytics', icon: BarChart3, path: '/analytics' },
      { label: 'Hiring', icon: Briefcase, path: '/hiring' },
      { label: 'Funding', icon: DollarSign, path: '/funding' },
    ],
  },
  {
    title: 'More',
    items: [
      { label: 'Tools', icon: Wrench, path: '/tools' },
      { label: 'Founders', icon: BookOpen, path: '/founders' },
      { label: 'Roadmap', icon: MapIcon, path: '/roadmap' },
      ...(showShareNav ? [{ label: 'Share', icon: Share2, path: '/share' }] : []),
    ],
  },
];

export function MobileBottomNav() {
  const location = useLocation();
  const { darkMode, setDarkMode, setCommandPaletteOpen, setContactFormOpen } = useApp();
  const { user } = useDevAuth();
  const [open, setOpen] = useState(false);

  const hideOnPaths = ['/batch/', '/validator'];
  if (hideOnPaths.some((p) => location.pathname.includes(p))) return null;

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const close = () => setOpen(false);

  return (
    <>
      {/* Top bar with burger */}
      <nav
        className="fixed left-0 right-0 z-40 md:hidden h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 font-mono"
        style={{ top: '28px' }}
      >
        <div className="flex h-full items-center justify-between px-4">
          <Link to="/" onClick={close} className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 bg-[#FB651E] flex items-center justify-center flex-shrink-0">
              <span className="text-base font-bold text-white">Y</span>
            </div>
            <span className="text-sm font-bold truncate">YC Explorer</span>
          </Link>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
            className="w-9 h-9 flex items-center justify-center border border-border text-muted-foreground hover:text-[#FB651E] hover:border-[#FB651E]/50 transition-colors"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Full-screen overlay menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 md:hidden bg-background font-mono overflow-y-auto"
          >
            {/* Overlay header */}
            <div className="flex items-center justify-between px-4 h-14 border-b border-border" style={{ marginTop: '28px' }}>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Terminal className="w-4 h-4 text-[#FB651E]" /> <span>$ navigate</span>
              </div>
              <button onClick={close} aria-label="Close" className="w-9 h-9 flex items-center justify-center border border-border text-muted-foreground hover:text-[#FB651E]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-6">
              {groups.map((group) => (
                <div key={group.title}>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-2">{group.title}</div>
                  <div className="grid grid-cols-2 gap-2">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.path);
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={close}
                          className={`flex items-center gap-2 px-3 py-3 border transition-colors ${
                            active
                              ? 'border-[#FB651E]/50 bg-[#FB651E]/10 text-[#FB651E]'
                              : 'border-border text-foreground hover:border-[#FB651E]/30'
                          }`}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span className="text-sm truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Developers */}
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-2">Developers</div>
                <div className="grid grid-cols-2 gap-2">
                  <Link to="/api-docs" onClick={close}
                        className="flex items-center gap-2 px-3 py-3 border border-border text-foreground hover:border-[#FB651E]/30">
                    <Terminal className="w-4 h-4" /> <span className="text-sm">API Docs</span>
                  </Link>
                  <Link to={user ? '/dashboard' : '/signup'} onClick={close}
                        className="flex items-center gap-2 px-3 py-3 border border-[#FB651E]/40 bg-[#FB651E]/10 text-[#FB651E]">
                    <Terminal className="w-4 h-4" /> <span className="text-sm">{user ? 'Dashboard' : 'Get a key'}</span>
                  </Link>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <button onClick={() => { close(); setContactFormOpen(true); }}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-3 border border-border text-sm text-muted-foreground hover:text-[#FB651E]">
                  <Mail className="w-4 h-4" /> Contact
                </button>
                <button onClick={() => { close(); setCommandPaletteOpen(true); }}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-3 border border-border text-sm text-muted-foreground hover:text-foreground">
                  <Command className="w-4 h-4" /> Search
                </button>
                <button onClick={() => setDarkMode(!darkMode)} aria-label="Toggle theme"
                        className="w-12 flex items-center justify-center px-3 py-3 border border-border text-muted-foreground hover:text-foreground">
                  {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
