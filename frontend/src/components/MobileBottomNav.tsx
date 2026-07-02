import { Link, useLocation } from 'react-router-dom';
import { Home, BarChart3, Wrench, Map as MapIcon, DollarSign, Share2, Briefcase, Mail, Database } from 'lucide-react';
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
  { id: 'roadmap', label: 'Roadmap', icon: MapIcon, path: '/roadmap' },
  { id: 'share', label: 'Share', icon: Share2, path: '/share' },
];

const showShareNav = import.meta.env.VITE_SHOW_SHARE_NAV === 'true' || import.meta.env.VITE_SHOW_SHARE_NAV === '1';
const navTabs = showShareNav ? allNavTabs : allNavTabs.filter((t) => t.id !== 'share');

export function MobileBottomNav() {
  const location = useLocation();
  const { setContactFormOpen } = useApp();

  const isActiveTab = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  // Don't show on certain full-screen pages
  const hideOnPaths = ['/batch/', '/validator'];
  const shouldHide = hideOnPaths.some(path => location.pathname.includes(path));

  if (shouldHide) {
    return null;
  }

  return (
    <nav className="fixed left-0 right-0 z-40 md:hidden border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 overflow-x-hidden" style={{ top: '28px' }}>
      <div className="flex items-center justify-around gap-0.5 px-1 pt-2 pb-3 h-14 min-w-0">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = isActiveTab(tab.path);

          return (
            <Link
              key={tab.id}
              to={tab.path}
              className="flex flex-col items-center justify-center flex-1 min-w-0 py-1 px-1 rounded-lg group gap-0.5"
            >
              <div
                className={`
                  flex items-center justify-center w-7 h-7 rounded-lg transition-all flex-shrink-0
                  ${isActive
                    ? 'bg-[#FB651E]/10'
                    : 'group-hover:bg-muted/50'
                  }
                `}
              >
                <Icon
                  className={`
                    w-3.5 h-3.5 transition-colors
                    ${isActive ? 'text-[#FB651E]' : 'text-muted-foreground group-hover:text-foreground'}
                  `}
                />
              </div>
              <span
                className={`
                  text-[9px] font-medium transition-colors flex-shrink-0 leading-tight truncate max-w-full
                  ${isActive ? 'text-[#FB651E]' : 'text-muted-foreground'}
                `}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}

        {/* Contact button */}
        <button
          onClick={() => setContactFormOpen(true)}
          className="flex flex-col items-center justify-center flex-1 min-w-0 py-1 px-1 rounded-lg group gap-0.5 hover:bg-muted/50 transition-colors"
          title="Send feedback or bug report"
        >
          <div className="flex items-center justify-center w-7 h-7 rounded-lg transition-all flex-shrink-0 group-hover:bg-muted/50">
            <Mail className="w-3.5 h-3.5 transition-colors text-muted-foreground group-hover:text-foreground" />
          </div>
          <span className="text-[9px] font-medium transition-colors flex-shrink-0 leading-tight text-muted-foreground">
            Contact
          </span>
        </button>
      </div>
    </nav>
  );
}
