import { Link, useLocation } from 'react-router-dom';
import {
  Home, BarChart3, Wrench, BookOpen, Map as MapIcon, DollarSign, Share2,
  Moon, Sun, Command, Briefcase, Mail, Database, Terminal, ChevronDown,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useDevAuth } from '../contexts/DevAuthContext';

interface NavTab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
}

const primaryTabs: NavTab[] = [
  { id: 'home', label: 'Home', icon: Home, path: '/' },
  { id: 'database', label: 'Database', icon: Database, path: '/database' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, path: '/analytics' },
  { id: 'hiring', label: 'Hiring', icon: Briefcase, path: '/hiring' },
];

const showShareNav = import.meta.env.VITE_SHOW_SHARE_NAV === 'true' || import.meta.env.VITE_SHOW_SHARE_NAV === '1';

const moreTabs: NavTab[] = [
  { id: 'funding', label: 'Funding', icon: DollarSign, path: '/funding' },
  { id: 'tools', label: 'Tools', icon: Wrench, path: '/tools' },
  { id: 'founders', label: 'Founders', icon: BookOpen, path: '/founders' },
  { id: 'roadmap', label: 'Roadmap', icon: MapIcon, path: '/roadmap' },
  ...(showShareNav ? [{ id: 'share', label: 'Share', icon: Share2, path: '/share' }] : []),
];

export function Navbar() {
  const location = useLocation();
  const { darkMode, setDarkMode, setCommandPaletteOpen, setContactFormOpen } = useApp();
  const { user } = useDevAuth();

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const apiPath = user ? '/dashboard' : '/api-docs';
  const apiActive = ['/api-docs', '/dashboard', '/signup', '/login'].some((p) => location.pathname.startsWith(p));
  const moreActive = moreTabs.some((t) => isActive(t.path));

  const tabClass = (active: boolean) =>
    `relative flex items-center gap-1.5 px-3 py-2 text-sm transition-colors border-b-2 -mb-[1px] whitespace-nowrap ${
      active ? 'text-[#FB651E] border-[#FB651E]' : 'text-muted-foreground hover:text-foreground border-transparent hover:border-border'
    }`;

  return (
    <nav className="hidden md:block sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 font-mono">
      <div className="container mx-auto px-4">
        <div className="flex h-14 items-center justify-between gap-2">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 sm:gap-3 group min-w-0 flex-shrink-0">
            <div className="w-9 h-9 bg-[#FB651E] flex items-center justify-center group-hover:shadow-[0_0_16px_rgba(251,101,30,0.4)] transition-shadow flex-shrink-0">
              <span className="text-lg font-bold text-white">Y</span>
            </div>
            <div className="hidden lg:block min-w-0">
              <div className="text-sm font-bold whitespace-nowrap truncate">YC Explorer</div>
              <div className="text-xs text-muted-foreground whitespace-nowrap truncate">$ company-db</div>
            </div>
          </Link>

          {/* Center nav */}
          <div className="flex items-center gap-0.5">
            {primaryTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <Link key={tab.id} to={tab.path} className={tabClass(isActive(tab.path))}>
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </Link>
              );
            })}

            {/* API entry */}
            <Link to={apiPath} className={tabClass(apiActive)}>
              <Terminal className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">API</span>
            </Link>

            {/* More dropdown (hover) */}
            <div className="relative group">
              <button className={`${tabClass(moreActive)} cursor-default`} aria-haspopup="true">
                More <ChevronDown className="w-3.5 h-3.5 transition-transform group-hover:rotate-180" />
              </button>
              <div className="absolute right-0 top-full pt-1 hidden group-hover:block z-50">
                <div className="min-w-[180px] border border-border bg-background/98 backdrop-blur shadow-[0_8px_24px_rgba(0,0,0,0.25)] py-1">
                  {moreTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <Link
                        key={tab.id}
                        to={tab.path}
                        className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                          isActive(tab.path)
                            ? 'text-[#FB651E] bg-[#FB651E]/5'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        }`}
                      >
                        <Icon className="w-4 h-4" /> {tab.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setContactFormOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-[#FB651E] hover:border-[#FB651E]/50 border border-border transition-colors"
              title="Send feedback or bug report"
            >
              <Mail className="w-3 h-3" />
              <span className="hidden lg:inline">Contact</span>
            </button>
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-[#FB651E]/50 border border-border transition-colors"
            >
              <Command className="w-3 h-3" />
              <span className="hidden lg:inline">⌘K</span>
            </button>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground border border-border hover:border-[#FB651E]/30 transition-colors"
              aria-label="Toggle theme"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
