import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, Search, Loader2 } from 'lucide-react';
import { TradingCard } from '../components/share/TradingCard';
import { SocialShareButtons } from '../components/share/SocialShareButtons';
import { useImageExport } from '../hooks/useImageExport';
import { apiClient, type Company } from '../lib/api';
import { shareTemplates } from '../lib/shareUtils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export function CompanyCardPage() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const exportCardRef = useRef<HTMLDivElement>(null);
  const { exporting, exportAsImage, error: exportError } = useImageExport(exportCardRef);

  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewScale, setPreviewScale] = useState(0.5);

  // Compute scale so card fits viewport on mobile (no horizontal scroll)
  useEffect(() => {
    const updateScale = () => {
      const vw = Math.min(window.innerWidth, document.documentElement.clientWidth);
      const availableWidth = vw - 64; // 4rem padding
      const scale = Math.min(0.5, availableWidth / 1080);
      setPreviewScale(Math.max(0.2, scale));
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  useEffect(() => {
    if (slug) {
      fetchCompany(slug);
    }
  }, [slug]);

  const fetchCompany = async (companySlug: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getCompanyBySlug(companySlug);
      setCompany(response.data);
    } catch (err: any) {
      console.error('Error fetching company:', err);
      setError(err.response?.data?.detail || 'Company not found');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const query = searchQuery.trim();
    // Try slug first (lowercase, replace spaces with hyphens)
    const slugQuery = query.toLowerCase().replace(/\s+/g, '-');
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getCompanyBySlug(slugQuery);
      setCompany(response.data);
    } catch {
      // Fallback: search by name via companies API
      try {
        const { data } = await apiClient.getCompanies({ search: query, limit: 5 });
        if (data.companies?.length > 0) {
          const match = data.companies.find(
            c => c.name.toLowerCase() === query.toLowerCase() || c.slug === slugQuery
          ) || data.companies[0];
          setCompany(match);
          setError(null);
        } else {
          setError('Company not found');
          setCompany(null);
        }
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Company not found');
        setCompany(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (company) {
      // Small delay so hidden export card is painted before capture
      await new Promise((r) => setTimeout(r, 100));
      await exportAsImage(`${company.slug}-trading-card`);
    }
  };

  const shareData = company
    ? {
        title: `${company.name} - YC ${company.batch}`,
        text: shareTemplates.company(
          company.name,
          company.one_liner,
          company.batch,
          company.funding_total_usd ? (company.funding_total_usd / 1_000_000).toFixed(1) + 'M' : undefined,
          company.is_hiring
        ).text,
        url: `${window.location.origin}/company/${company.slug}`,
      }
    : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/share')}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-[#FB651E] font-mono mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Share Center
          </button>

          <h1 className="text-3xl font-bold mb-2">
            <span className="text-[#FB651E]">&gt;</span> Company Trading Cards
          </h1>
          <p className="text-muted-foreground font-mono">
            Create beautiful shareable cards for any YC company
          </p>
        </div>

        {/* Search Bar */}
        {!slug && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <form onSubmit={handleSearch} className="flex gap-3 max-w-2xl">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="Search by company name or slug (e.g., 'airbnb' or 'Airbnb')"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="font-mono"
                />
              </div>
              <Button type="submit" disabled={loading} className="bg-[#FB651E] hover:bg-[#E65C00]">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </>
                )}
              </Button>
            </form>
            {error && (
              <p className="text-red-500 text-sm mt-2 font-mono">
                {error}. Try searching for the company slug (e.g., 'airbnb', 'stripe').
              </p>
            )}
          </motion.div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-[#FB651E] mx-auto mb-4" />
              <p className="text-muted-foreground font-mono">Loading company...</p>
            </div>
          </div>
        )}

        {/* Company Card */}
        {company && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Preview - card fits viewport on mobile, no horizontal scroll */}
            <div className="bg-card border border-border rounded-xl p-4 sm:p-8 overflow-hidden">
              <h2 className="text-xl font-bold mb-6 font-mono">
                <span className="text-[#FB651E]">$</span> Card Preview
              </h2>
              <div
                className="mx-auto overflow-hidden flex justify-center w-full max-w-[540px]"
                style={{ aspectRatio: '1080 / 1350' }}
              >
                <div
                  className="transform origin-top shrink-0"
                  style={{
                    transform: `scale(${previewScale})`,
                    transformOrigin: 'top center',
                  }}
                >
                  <TradingCard company={company} />
                </div>
              </div>
            </div>

            {/* Hidden full-size card for export - avoids html2canvas transform/scale bugs */}
            {company && (
              <div
                aria-hidden="true"
                className="fixed z-[-1]"
                style={{ left: -9999, top: 0, width: 1080, height: 1350 }}
              >
                <TradingCard ref={exportCardRef} company={company} />
              </div>
            )}

            {/* Actions */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-lg font-bold mb-4 font-mono">
                <span className="text-[#FB651E]">$</span> Export & Share
              </h3>

              <div className="flex flex-wrap gap-4 mb-6">
                <Button
                  onClick={handleExport}
                  disabled={exporting}
                  className="bg-[#FB651E] hover:bg-[#E65C00]"
                >
                  {exporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Download PNG
                    </>
                  )}
                </Button>
              </div>

              {exportError && (
                <p className="text-red-500 text-sm mb-4 font-mono">{exportError}</p>
              )}

              {shareData && (
                <div>
                  <p className="text-sm text-muted-foreground mb-3 font-mono">
                    Share on social media:
                  </p>
                  <SocialShareButtons
                    shareData={shareData}
                    hashtags={shareTemplates.company(
                      company.name,
                      company.one_liner,
                      company.batch
                    ).hashtags}
                  />
                </div>
              )}
            </div>

            {/* Tips */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6">
              <h3 className="font-bold mb-3 text-blue-400 font-mono">💡 Tips for sharing</h3>
              <ul className="space-y-2 text-sm text-blue-300">
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Download the PNG and share on Twitter, LinkedIn, or Instagram</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Tag your company to increase visibility</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>The QR code links directly to your company profile</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Share during funding announcements or hiring drives</span>
                </li>
              </ul>
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {!company && !loading && !slug && (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto bg-[#FB651E]/10 rounded-2xl flex items-center justify-center mb-6">
              <Search className="h-10 w-10 text-[#FB651E]" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Search for a company</h2>
            <p className="text-muted-foreground font-mono">
              Enter a company name or slug to generate a trading card
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
