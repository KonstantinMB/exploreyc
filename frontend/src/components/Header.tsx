import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Moon, Sun, Database, Command, Lightbulb } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { YCLogo } from './illustrations/CustomSVGs';
import { useApp } from '../contexts/AppContext';
import type { Company } from '../lib/api';

interface HeaderProps {
  onThemeToggle?: () => void;
  isDark?: boolean;
  onCommandPalette?: () => void;
}

export function Header({ onThemeToggle, isDark = false, onCommandPalette }: HeaderProps) {
  const { stats, companies, setSelectedCompany } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Company[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Transition header style on scroll
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSearch = (query: string) => {
    setSearchQuery(query);

    if (query.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    // Search in loaded companies
    const results = companies.filter(
      (company) =>
        company.name.toLowerCase().includes(query.toLowerCase()) ||
        company.one_liner?.toLowerCase().includes(query.toLowerCase()) ||
        company.industry?.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 8);

    setSearchResults(results);
    setShowResults(true);
  };


  return (
    <motion.header
      className={`fixed inset-x-0 top-0 z-40 w-full border-b backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-colors ${
        scrolled ? 'bg-background/98 shadow-sm' : 'bg-background/95'
      }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 100 }}
    >
      <div className="container mx-auto px-3 sm:px-4 max-w-7xl">
        {/* Top Bar */}
        <div className="flex h-14 sm:h-16 items-center justify-between gap-2">
          {/* Logo and Title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink">
            <YCLogo className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold bg-gradient-to-r from-[#FB651E] to-[#FF8833] bg-clip-text text-transparent truncate">
                YC Company Explorer
              </h1>
              <p className="text-xs text-muted-foreground font-mono hidden sm:block">
                {(stats?.total_companies ?? 0).toLocaleString()} companies indexed
              </p>
            </div>
          </div>

          {/* Search Bar - hidden on small screens, show icon to open */}
          <div className="flex-1 max-w-md mx-2 sm:mx-8 relative hidden md:block">
            <div className="relative flex items-center">
              <span className="absolute left-3 font-mono text-[#FB651E] text-sm">&gt;</span>
              <Search className="absolute left-8 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search companies, industries..."
                className="pl-12 font-mono text-sm border-[#FB651E]/20 focus:border-[#FB651E]/50"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowResults(true)}
                onBlur={() => setTimeout(() => setShowResults(false), 200)}
              />
            </div>

            {/* Search Results Dropdown */}
            {showResults && searchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-full mt-2 w-full bg-background border rounded-lg shadow-lg overflow-hidden z-50"
              >
                {searchResults.map((company) => (
                  <button
                    key={company.id}
                    className="w-full px-4 py-3 text-left hover:bg-accent transition-colors border-b last:border-b-0"
                    onClick={() => {
                      setSelectedCompany(company);
                      setShowResults(false);
                      setSearchQuery('');
                    }}
                  >
                    <div className="font-semibold text-sm">{company.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {company.one_liner}
                    </div>
                    <div className="flex gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-700">
                        {company.batch}
                      </span>
                      {company.is_hiring && (
                        <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">
                          Hiring
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <a
              href="/validator"
              className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-[#FB651E] hover:bg-[#FB651E]/10 transition-colors font-mono"
            >
              <Lightbulb className="h-4 w-4" />
              <span>Validate idea</span>
            </a>
            <Button
              variant="ghost"
              size="icon"
              onClick={onCommandPalette}
              className="md:hidden"
              title="Search (⌘K)"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCommandPalette}
              className="hidden md:flex font-mono text-xs"
              title="Command palette (⌘K)"
            >
              <Command className="h-4 w-4 mr-2" />
              ⌘K
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onThemeToggle}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="border-t py-2 overflow-x-auto">
          <div className="flex items-center gap-3 sm:gap-6 text-xs font-mono text-muted-foreground flex-wrap sm:flex-nowrap min-w-0">
            <div className="flex items-center gap-2">
              <Database className="h-3 w-3" />
              <span>
                <span className="text-[#FB651E] font-semibold">
                  {(stats?.hiring ?? 0).toLocaleString()}
                </span>{' '}
                hiring
              </span>
            </div>
            <div className="h-3 w-px bg-border" />
            <div>
              Top batch:{' '}
              <span className="text-foreground font-semibold">
                {Object.entries(stats?.by_batch || {}).sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A'}
              </span>
            </div>
            <div className="h-3 w-px bg-border" />
            <div>
              {Object.keys(stats?.by_industry || {}).length} industries
            </div>
            <div className="h-3 w-px bg-border" />
            <div>
              {Object.keys(stats?.by_country || {}).length} countries
            </div>
          </div>
        </div>
      </div>
    </motion.header>
  );
}
