import { Link, useLocation } from 'react-router-dom';
import { Home, BarChart3, Wrench, BookOpen, Map as MapIcon, DollarSign, Share2, Moon, Sun, Command, Briefcase, Mail, Database } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

interface NavTab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
}

const allNavTabs: NavTab[] = [
  { id: 'home', label: 'Home', icon: Home, path: '/' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, path: '/analytics' },
  { id: 'funding', label: 'Funding', icon: DollarSign, path: '/funding' },
  { id: 'hiring', label: 'Hiring', icon: Briefcase, path: '/hiring' },
  { id: 'database', label: 'Database', icon: Database, path: '/database' },
  { id: 'tools', label: 'Tools', icon: Wrench, path: '/tools' },
  { id: 'founders', label: 'Founders', icon: BookOpen, path: '/founders' },
  { id: 'roadmap', label: 'Roadmap', icon: MapIcon, path: '/roadmap' },
  { id: 'share', label: 'Share', icon: Share2, path: '/share' },
];

const showShareNav = import.meta.env.VITE_SHOW_SHARE_NAV === 'true' || import.meta.env.VITE_SHOW_SHARE_NAV === '1';
const navTabs = showShareNav ? allNavTabs : allNavTabs.filter((t) => t.id !== 'share');

export function Navbar() {
  const location = useLocation();
  const { darkMode, setDarkMode, setCommandPaletteOpen, setContactFormOpen } = useApp();

  const isActiveTab = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="hidden md:block sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 font-mono">
      <div className="container mx-auto px-4">
        <div className="flex h-14 items-center justify-between">
          {/* Left: Logo + Title - whitespace-nowrap to prevent bad wrapping on small desktop */}
          <Link to="/" className="flex items-center gap-2 sm:gap-3 group min-w-0 flex-shrink-0">
            <div className="w-9 h-9 bg-[#FB651E] flex items-center justify-center group-hover:shadow-[0_0_16px_rgba(251,101,30,0.4)] transition-shadow flex-shrink-0">
              <span className="text-lg font-bold text-white">Y</span>
            </div>
            <div className="hidden sm:block min-w-0">
              <div className="text-sm font-bold whitespace-nowrap truncate">YC Explorer</div>
              <div className="text-xs text-muted-foreground whitespace-nowrap truncate">$ company-db</div>
            </div>
          </Link>

          {/* Center: Navigation Tabs */}
          <div className="flex items-center gap-0.5 min-w-0 overflow-x-auto">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = isActiveTab(tab.path);

              return (
                <Link
                  key={tab.id}
                  to={tab.path}
                  className={`
                    relative flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 text-sm transition-colors border-b-2 -mb-[1px] whitespace-nowrap min-w-0
                    ${isActive
                      ? 'text-[#FB651E] border-[#FB651E]'
                      : 'text-muted-foreground hover:text-foreground border-transparent hover:border-border'
                    }
                  `}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden md:inline truncate">{tab.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setContactFormOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-[#FB651E] hover:border-[#FB651E]/50 border border-border transition-colors"
              title="Send feedback or bug report"
            >
              <Mail className="w-3 h-3" />
              <span className="hidden sm:inline">Contact</span>
            </button>
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-[#FB651E]/50 border border-border transition-colors"
            >
              <Command className="w-3 h-3" />
              <span className="hidden sm:inline">⌘K</span>
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
