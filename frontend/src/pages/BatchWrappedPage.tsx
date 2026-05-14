import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import html2canvas from 'html2canvas';
import { BatchWrapped } from '../components/BatchWrapped';
import { LoadingScreen } from '../components/LoadingScreen';
import { api } from '../lib/api';

interface BatchWrappedStats {
  batch: string;
  total_companies: number;
  hiring_count: number;
  hiring_percentage: number;
  top_industries: Array<{ name: string; count: number; percentage: number }>;
  top_countries: Array<{ name: string; count: number; percentage: number }>;
  avg_team_size: number | null;
  notable_companies: Array<{
    name: string;
    team_size: number | null;
    is_hiring: boolean;
    industry: string | null;
  }>;
  fun_fact: string;
}

export function BatchWrappedPage() {
  const { batch } = useParams<{ batch: string }>();
  const navigate = useNavigate();
  const [stats, setStats] = useState<BatchWrappedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wrappedRef = useRef<HTMLDivElement>(null);

  // Fetch batch wrapped stats
  useEffect(() => {
    const fetchStats = async () => {
      if (!batch) {
        setError('No batch specified');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await api.get<BatchWrappedStats>(
          `/api/batch/${encodeURIComponent(batch)}/wrapped`
        );

        setStats(response.data);
      } catch (err: any) {
        console.error('Error fetching batch wrapped stats:', err);
        if (err.response?.status === 404) {
          setError(`Batch "${batch}" not found or has no companies`);
        } else {
          setError(err.response?.data?.detail || 'Failed to load batch wrapped stats');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [batch]);

  // Export current slide as image
  const handleExportImage = async () => {
    if (!wrappedRef.current) return;

    try {
      const canvas = await html2canvas(wrappedRef.current, {
        backgroundColor: '#000000',
        scale: 2, // Higher quality
        logging: false,
      });

      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (!blob) return;

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${stats?.batch || 'batch'}-wrapped.png`;
        link.click();
        URL.revokeObjectURL(url);
      });
    } catch (err) {
      console.error('Error exporting image:', err);
      alert('Failed to export image. Please try again.');
    }
  };

  // Share on Twitter
  const handleShareTwitter = () => {
    const text = `Check out ${stats?.batch} Wrapped! ${stats?.total_companies} companies launched in this incredible batch. 🚀`;
    const url = window.location.href;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, '_blank', 'width=550,height=420');
  };

  // Close wrapped and navigate back
  const handleClose = () => {
    navigate('/');
  };

  // Loading state
  if (loading) {
    return <LoadingScreen progress={50} total={100} />;
  }

  // Error state
  if (error || !stats) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          className="text-center max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mb-6">
            <img src="/yc-logo.png" alt="YC" className="h-16 w-16 mx-auto opacity-80" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            {error || 'Batch not found'}
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            We couldn't find wrapped stats for batch "{batch}". Please check the batch name and try
            again.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-[#FB651E] text-white rounded-lg hover:bg-[#E65C00] font-medium transition-colors"
          >
            Go to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      {/* Dynamic meta tags for SEO and social sharing */}
      <Helmet>
        <title>{stats.batch} Wrapped - YC Company Explorer</title>
        <meta
          name="description"
          content={`Explore ${stats.batch} batch wrapped: ${stats.total_companies} companies, ${stats.hiring_percentage}% hiring, top industry ${stats.top_industries[0]?.name}`}
        />

        {/* Open Graph tags */}
        <meta property="og:title" content={`${stats.batch} Wrapped - YC Company Explorer`} />
        <meta
          property="og:description"
          content={`${stats.total_companies} companies launched in ${stats.batch}. Top industry: ${stats.top_industries[0]?.name}. ${stats.hiring_percentage}% are hiring!`}
        />
        <meta property="og:type" content="website" />
        <meta
          property="og:image"
          content={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/batch/${encodeURIComponent(stats.batch)}/og-image`}
        />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />

        {/* Twitter Card tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${stats.batch} Wrapped`} />
        <meta
          name="twitter:description"
          content={`${stats.total_companies} companies launched in ${stats.batch}!`}
        />
        <meta
          name="twitter:image"
          content={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/batch/${encodeURIComponent(stats.batch)}/og-image`}
        />
      </Helmet>

      {/* Wrapped Component */}
      <div ref={wrappedRef}>
        <BatchWrapped
          stats={stats}
          onClose={handleClose}
          onExportImage={handleExportImage}
          onShareTwitter={handleShareTwitter}
        />
      </div>
    </>
  );
}
