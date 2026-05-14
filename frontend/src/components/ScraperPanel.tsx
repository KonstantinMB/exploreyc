import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { apiClient, createWebSocket } from '../lib/api';
import type { ScrapeRequest } from '../lib/api';

interface ScraperPanelProps {
  onScrapeComplete?: () => void;
}

export function ScraperPanel({ onScrapeComplete }: ScraperPanelProps) {
  const [isScraping, setIsScraping] = useState(false);
  const [jobId, setJobId] = useState<number | null>(null);
  const [progress, setProgress] = useState({ total: 0, page: 0 });
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [query, setQuery] = useState('');
  const [batches, setBatches] = useState('');
  const [isHiring, setIsHiring] = useState<boolean | undefined>(undefined);
  const [maxPages, setMaxPages] = useState(5);

  useEffect(() => {
    if (!isScraping) return;

    const ws = createWebSocket((data) => {
      if (data.job_id === jobId) {
        setProgress({ total: data.total_scraped, page: data.current_page });
        setStatus(data.status);

        if (data.status === 'completed') {
          setIsScraping(false);
          onScrapeComplete?.();
        } else if (data.status === 'failed') {
          setIsScraping(false);
          setError(data.error || 'Scraping failed');
        }
      }
    });

    return () => ws.close();
  }, [isScraping, jobId, onScrapeComplete]);

  const handleStartScrape = async () => {
    setIsScraping(true);
    setStatus('running');
    setError(null);
    setProgress({ total: 0, page: 0 });

    const request: ScrapeRequest = {
      query,
      max_pages: maxPages,
    };

    if (batches) {
      request.batch = batches.split(',').map((b) => b.trim());
    }

    if (isHiring !== undefined) {
      request.is_hiring = isHiring;
    }

    try {
      const response = await apiClient.startScrape(request);
      setJobId(response.data.job_id);
    } catch (err) {
      setIsScraping(false);
      setStatus('failed');
      setError('Failed to start scraping');
      console.error(err);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Scrape YC Companies</CardTitle>
          <CardDescription>
            Configure filters and start scraping companies from Y Combinator's directory
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="query">Search Query (optional)</Label>
              <Input
                id="query"
                placeholder="e.g., AI, healthcare"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={isScraping}
              />
            </div>

            <div>
              <Label htmlFor="batches">Batches (comma-separated)</Label>
              <Input
                id="batches"
                placeholder="e.g., Summer 2026, Winter 2026"
                value={batches}
                onChange={(e) => setBatches(e.target.value)}
                disabled={isScraping}
              />
            </div>

            <div>
              <Label htmlFor="hiring">Hiring Status</Label>
              <select
                id="hiring"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={isHiring === undefined ? '' : isHiring ? 'true' : 'false'}
                onChange={(e) => {
                  if (e.target.value === '') setIsHiring(undefined);
                  else setIsHiring(e.target.value === 'true');
                }}
                disabled={isScraping}
              >
                <option value="">All</option>
                <option value="true">Hiring Only</option>
                <option value="false">Not Hiring</option>
              </select>
            </div>

            <div>
              <Label htmlFor="maxPages">Max Pages</Label>
              <Input
                id="maxPages"
                type="number"
                min="1"
                max="20"
                value={maxPages}
                onChange={(e) => setMaxPages(Number(e.target.value))}
                disabled={isScraping}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4">
            <Button
              onClick={handleStartScrape}
              disabled={isScraping}
              className="bg-[#FF6600] hover:bg-[#E65C00]"
            >
              {isScraping ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scraping...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start Scraping
                </>
              )}
            </Button>

            {status !== 'idle' && (
              <div className="flex items-center gap-2">
                {status === 'running' && (
                  <span className="text-sm text-muted-foreground">
                    Scraped {progress.total} companies (Page {progress.page})
                  </span>
                )}
                {status === 'completed' && (
                  <div className="flex items-center text-green-600">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    <span className="text-sm">Completed! Scraped {progress.total} companies</span>
                  </div>
                )}
                {status === 'failed' && (
                  <div className="flex items-center text-red-600">
                    <XCircle className="mr-2 h-4 w-4" />
                    <span className="text-sm">{error || 'Failed'}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {isScraping && (
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <motion.div
                className="bg-[#FF6600] h-2.5 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(progress.page / maxPages) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
