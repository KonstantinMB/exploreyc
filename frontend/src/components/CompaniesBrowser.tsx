import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, ExternalLink, Briefcase, MapPin, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { apiClient } from '../lib/api';
import type { Company, CompanyFilter } from '../lib/api';
import { formatNumber } from '../lib/utils';
import { SourceBadge, MergedSourceBadges } from './ui/SourceBadge';
import { CompanyLogo } from './ui/CompanyLogo';

interface CompaniesBrowserProps {
  refreshTrigger?: number;
}

export function CompaniesBrowser({ refreshTrigger }: CompaniesBrowserProps) {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [search, setSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [hiringFilter, setHiringFilter] = useState<boolean | undefined>(undefined);
  // Show all sources merged by default (same company across YC/HN/a16z = one card);
  // users can uncheck to return to per-source rows. Semantic = all-source vector search.
  const [mergeSources, setMergeSources] = useState(true);
  const [semantic, setSemantic] = useState(false);
  // Showcase only companies with a real logo by default (hides logo-less rows).
  const [logoOnly, setLogoOnly] = useState(true);

  const PAGE_SIZE = 20;

  useEffect(() => {
    loadCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, refreshTrigger, mergeSources, semantic, logoOnly]);

  const loadCompanies = async () => {
    setLoading(true);
    try {
      // Semantic search: all-source vector search (single page of ranked matches).
      if (semantic && search.trim()) {
        const response = await apiClient.getSimilarCompanies(search.trim(), PAGE_SIZE);
        setCompanies(response.data.companies);
        setTotal(response.data.companies.length);
        return;
      }

      const filters: CompanyFilter = {
        limit: PAGE_SIZE,
        offset: currentPage * PAGE_SIZE,
      };

      if (search) filters.search = search;
      if (batchFilter) filters.batch = batchFilter;
      if (hiringFilter !== undefined) filters.is_hiring = hiringFilter;
      if (mergeSources) {
        filters.merged = true;
        filters.source = 'all';
      }
      if (logoOnly) filters.has_logo = true;

      const response = await apiClient.getCompanies(filters);
      setCompanies(response.data.companies);
      setTotal(response.data.total);
    } catch (error) {
      console.error('Failed to load companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setCurrentPage(0);
    loadCompanies();
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Filter Companies</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="sm:col-span-2">
              <Input
                placeholder="Search companies..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>

            <div>
              <Input
                placeholder="Batch (e.g., Summer 2026)"
                value={batchFilter}
                onChange={(e) => setBatchFilter(e.target.value)}
              />
            </div>

            <div>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={hiringFilter === undefined ? '' : hiringFilter ? 'true' : 'false'}
                onChange={(e) => {
                  if (e.target.value === '') setHiringFilter(undefined);
                  else setHiringFilter(e.target.value === 'true');
                }}
              >
                <option value="">All Status</option>
                <option value="true">Hiring</option>
                <option value="false">Not Hiring</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mt-4">
            <div className="flex flex-wrap items-center gap-4">
              <Button onClick={handleSearch} className="bg-[#FB651E] hover:bg-[#E65C00]">
                <Search className="mr-2 h-4 w-4" />
                Search
              </Button>

              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={mergeSources}
                  onChange={(e) => { setMergeSources(e.target.checked); setCurrentPage(0); }}
                />
                Merge sources
              </label>

              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer" title="All-source semantic (vector) search">
                <input
                  type="checkbox"
                  checked={semantic}
                  onChange={(e) => { setSemantic(e.target.checked); setCurrentPage(0); }}
                />
                Semantic search
              </label>

              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer" title="Only show companies that have a real logo">
                <input
                  type="checkbox"
                  checked={logoOnly}
                  onChange={(e) => { setLogoOnly(e.target.checked); setCurrentPage(0); }}
                />
                With logo
              </label>
            </div>

            <span className="text-sm text-muted-foreground">
              {formatNumber(total)} companies found
            </span>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((company, index) => (
            <motion.div
              key={company.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                className="h-full hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/company/${company.slug}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{company.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        {company.merged_sources && company.merged_sources.length > 0 ? (
                          <MergedSourceBadges sources={company.merged_sources} />
                        ) : (
                          <SourceBadge source={company.source} />
                        )}
                        {company.is_hiring && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            <Briefcase className="h-3 w-3 mr-1" />
                            Hiring
                          </span>
                        )}
                      </div>
                    </div>
                    <CompanyLogo
                      src={company.small_logo_thumb_url}
                      name={company.name}
                      className="w-12 h-12"
                      letterClass="text-lg"
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {company.one_liner}
                  </p>

                  <div className="space-y-2 text-xs text-muted-foreground">
                    {company.batch && (
                      <div className="flex items-center">
                        <Calendar className="h-3 w-3 mr-2" />
                        {company.batch}
                      </div>
                    )}

                    {company.all_locations && (
                      <div className="flex items-center">
                        <MapPin className="h-3 w-3 mr-2" />
                        {company.all_locations}
                      </div>
                    )}

                    {company.team_size > 0 && (
                      <div className="flex items-center">
                        Team: {company.team_size} people
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-4">
                    {company.website && (
                      <a
                        href={company.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-sm text-[#FB651E] hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Visit Website
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button
            variant="outline"
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
          >
            Previous
          </Button>

          <span className="flex items-center px-4 text-sm text-muted-foreground">
            Page {currentPage + 1} of {totalPages}
          </span>

          <Button
            variant="outline"
            onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
