import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, BarChart3, Wrench, BookOpen, Map as MapIcon, DollarSign, Share2,
  Moon, Sun, Command, Briefcase, Mail, Database, Terminal, ChevronDown,
  LayoutDashboard, LogOut, KeyRound,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useDevAuth } from '../contexts/DevAuthContext';
import { Avatar } from './ui/Avatar';
import { Logo } from './ui/Logo';

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
  const { user, logout } = useDevAuth();
  const [openMenu, setOpenMenu] = useState<null | 'more' | 'account'>(null);
  const navRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click, Escape, or route change
  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenMenu(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onEsc); };
  }, [openMenu]);
  useEffect(() => { setOpenMenu(null); }, [location.pathname]);

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const apiPath = user ? '/dashboard' : '/api-docs';
  const apiActive = ['/api-docs', '/dashboard', '/signup', '/login'].some((p) => location.pathname.startsWith(p));
  const moreActive = moreTabs.some((t) => isActive(t.path));

  const tabClass = (active: boolean) =>
    `relative flex items-center gap-1.5 px-3 py-2 text-sm transition-colors border-b-2 -mb-[1px] whitespace-nowrap ${
      active ? 'text-[#FB651E] border-[#FB651E]' : 'text-muted-foreground hover:text-foreground border-transparent hover:border-border'
    }`;

  // Solid panel (no transparency so page content can't bleed through)
  const panelClass = 'absolute right-0 top-full mt-1 z-50 border border-border bg-background shadow-[0_8px_24px_rgba(0,0,0,0.35)] py-1';

  return (
    <nav className="hidden lg:block sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 font-mono">
      <div className="container mx-auto px-4">
        <div ref={navRef} className="flex h-14 items-center justify-between gap-2">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 xl:gap-3 group min-w-0 flex-shrink-0">
            <Logo size={36} className="group-hover:shadow-[0_0_16px_rgba(251,101,30,0.4)] transition-shadow" />
            <div className="hidden xl:block min-w-0">
              <div className="text-sm font-bold whitespace-nowrap truncate">ExploreYC</div>
              <div className="text-xs text-muted-foreground whitespace-nowrap truncate">$ startup-db</div>
            </div>
          </Link>

          {/* Center nav */}
          <div className="flex items-center gap-0.5 min-w-0">
            {primaryTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <Link key={tab.id} to={tab.path} className={tabClass(isActive(tab.path))}>
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </Link>
              );
            })}

            <Link to={apiPath} className={tabClass(apiActive)}>
              <Terminal className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">API</span>
            </Link>

            {/* More (click) */}
            <div className="relative">
              <button
                onClick={() => setOpenMenu((m) => (m === 'more' ? null : 'more'))}
                className={tabClass(moreActive)}
                aria-haspopup="true"
                aria-expanded={openMenu === 'more'}
              >
                More <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openMenu === 'more' ? 'rotate-180' : ''}`} />
              </button>
              {openMenu === 'more' && (
                <div className={`${panelClass} min-w-[180px]`}>
                  {moreTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <Link
                        key={tab.id}
                        to={tab.path}
                        className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                          isActive(tab.path) ? 'text-[#FB651E] bg-[#FB651E]/5' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                        }`}
                      >
                        <Icon className="w-4 h-4" /> {tab.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => setContactFormOpen(true)}
              className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-[#FB651E] hover:border-[#FB651E]/50 border border-border transition-colors"
              title="Send feedback or bug report"
            >
              <Mail className="w-3 h-3" />
              <span className="hidden xl:inline">Contact</span>
            </button>
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-[#FB651E]/50 border border-border transition-colors"
              title="Command palette (⌘K)"
            >
              <Command className="w-3 h-3" />
              <span className="hidden xl:inline">⌘K</span>
            </button>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground border border-border hover:border-[#FB651E]/30 transition-colors"
              aria-label="Toggle theme"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Account (click) */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setOpenMenu((m) => (m === 'account' ? null : 'account'))}
                  className="flex items-center gap-1.5 pl-1 pr-1.5 h-8 border border-border hover:border-[#FB651E]/50 transition-colors"
                  aria-label="Account"
                  aria-expanded={openMenu === 'account'}
                >
                  <Avatar src={user.avatar_url} name={user.company_name || user.email} size={24} />
                  <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${openMenu === 'account' ? 'rotate-180' : ''}`} />
                </button>
                {openMenu === 'account' && (
                  <div className={`${panelClass} min-w-[210px]`}>
                    <div className="px-3 py-2 border-b border-border">
                      <div className="text-xs font-semibold truncate">{user.company_name || 'Developer'}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{user.email}</div>
                      <div className="text-[10px] text-[#FB651E] mt-0.5 uppercase">{user.plan_name || user.plan} plan</div>
                    </div>
                    <Link to="/dashboard" className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60">
                      <LayoutDashboard className="w-4 h-4" /> Dashboard
                    </Link>
                    <Link to="/api-docs" className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60">
                      <Terminal className="w-4 h-4" /> API Docs
                    </Link>
                    <button onClick={() => { setOpenMenu(null); logout(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-500/5">
                      <LogOut className="w-4 h-4" /> Log out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/signup"
                className="flex items-center gap-1.5 h-8 px-3 text-xs font-semibold bg-[#FB651E] hover:bg-[#E65C00] text-white transition-colors"
              >
                <KeyRound className="w-3.5 h-3.5" /> <span className="hidden xl:inline">Get API key</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
