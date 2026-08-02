import { Link } from 'react-router-dom';
import { Github, Coffee } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { openSupport } from '../lib/support';

const GITHUB_URL = 'https://github.com/KonstantinMB/exploreyc';

/**
 * Slim global site footer — mounted app-wide in the main Layout. Fills a real
 * gap (there was no shared footer) and hosts the persistent "Support" link.
 */
export function Footer() {
  const { setContactFormOpen } = useApp();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-background font-mono">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* brand */}
          <div className="text-center sm:text-left">
            <span className="text-sm font-bold">
              Explore<span className="text-[#FB651E]">YC</span>
            </span>
            <p className="mt-1 text-xs text-muted-foreground">
              YC company intelligence — free, fast, ad-free. © {year}
            </p>
          </div>

          {/* links */}
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="h-3.5 w-3.5" /> GitHub
            </a>
            <Link to="/api-docs" className="text-muted-foreground hover:text-foreground transition-colors">
              API
            </Link>
            <button
              type="button"
              onClick={() => setContactFormOpen(true)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Contact
            </button>
            <button
              type="button"
              onClick={() => openSupport('footer')}
              className="inline-flex items-center gap-1.5 text-[#FB651E] hover:text-[#ff7a33] font-semibold transition-colors"
            >
              <Coffee className="h-3.5 w-3.5" /> Buy me a coffee
            </button>
          </nav>
        </div>
      </div>
    </footer>
  );
}
