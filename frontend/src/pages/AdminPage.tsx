import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import {
  Shield,
  Play,
  RefreshCw,
  Database,
  TrendingUp,
  DollarSign,
  Building2,
  Clock,
  LogOut,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { HackerCard } from '../components/ui/hacker-card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { api } from '../lib/api';

interface EnrichmentStats {
  total_companies: number;
  enriched_count: number;
  unenriched_count: number;
  with_funding_amount: number;
  with_funding_rounds: number;
  recent_enrichments_24h: number;
  enrichment_percentage: number;
  funding_data_percentage: number;
  top_enriched: Array<{
    id: number;
    name: string;
    batch: string;
    funding_total_usd: number | null;
    funding_last_round_name: string | null;
    funding_last_round_date: string | null;
    investors_count: number | null;
  }>;
  coresignal_enabled: boolean;
}

export function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [enrichmentParams, setEnrichmentParams] = useState({
    batch: '',
    limit: 100,
    top_only: false,
    force_refresh: false,
    refresh_days: 30
  });

  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [emailTestResult, setEmailTestResult] = useState<{type: 'success' | 'error', message: string} | null>(null);

  // Check if already logged in
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      // Verify session
      fetch('/api/admin/session', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => res.ok ? setIsAuthenticated(true) : localStorage.removeItem('admin_token'))
        .catch(() => localStorage.removeItem('admin_token'))
        .finally(() => setIsLoggingIn(false));
    } else {
      setIsLoggingIn(false);
    }
  }, []);

  // Fetch enrichment stats
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<EnrichmentStats>({
    queryKey: ['admin-enrichment-stats'],
    queryFn: async () => {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/enrichment/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const response = await api.post('/api/admin/login', { username, password });
      return response.data;
    },
    onSuccess: (data) => {
      localStorage.setItem('admin_token', data.token);
      setIsAuthenticated(true);
      setLoginError('');
    },
    onError: () => {
      setLoginError('Invalid credentials');
    }
  });

  // Logout
  const handleLogout = async () => {
    const token = localStorage.getItem('admin_token');
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } finally {
      localStorage.removeItem('admin_token');
      setIsAuthenticated(false);
      navigate('/');
    }
  };

  // Start enrichment
  const enrichmentMutation = useMutation({
    mutationFn: async (params: typeof enrichmentParams) => {
      const token = localStorage.getItem('admin_token');
      const queryParams = new URLSearchParams();
      if (params.batch) queryParams.append('batch', params.batch);
      queryParams.append('limit', params.limit.toString());
      queryParams.append('top_only', params.top_only.toString());
      queryParams.append('force_refresh', params.force_refresh.toString());
      if (params.force_refresh) {
        queryParams.append('refresh_days', params.refresh_days.toString());
      }

      const response = await fetch(`/api/admin/enrich-funding/bulk?${queryParams}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Enrichment failed');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-enrichment-stats'] });
      // Show different message if all companies already enriched
      if (data.status === 'complete' && data.total === 0) {
        // This will be shown in the error state, but it's actually success
      }
    }
  });

  // Test verification email
  const testVerificationEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/test-verification-email', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to send test email');
      }
      return response.json();
    },
    onSuccess: () => {
      setEmailTestResult({ type: 'success', message: `✅ Verification email sent to ${testEmailAddress}! Check your inbox.` });
    },
    onError: (error: any) => {
      setEmailTestResult({ type: 'error', message: `❌ Failed: ${error.message}` });
    }
  });

  // Get email configuration status
  const { data: emailConfig } = useQuery({
    queryKey: ['admin-email-config'],
    queryFn: async () => {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/email-config', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch email config');
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const formatCurrency = (amount: number) => {
    if (amount >= 1_000_000_000) {
      return `$${(amount / 1_000_000_000).toFixed(2)}B`;
    }
    if (amount >= 1_000_000) {
      return `$${(amount / 1_000_000).toFixed(1)}M`;
    }
    return `$${(amount / 1_000).toFixed(0)}K`;
  };

  // Login Form
  if (isLoggingIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-500" />
          <p className="mt-4 text-muted-foreground font-mono">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <Helmet>
          <title>Admin Login - YC Company Explorer</title>
        </Helmet>
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md"
          >
            <HackerCard glowColor="green" className="p-8">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 mb-4">
                  <Shield className="h-8 w-8 text-emerald-500" />
                </div>
                <h1 className="text-2xl font-bold font-mono mb-2">Admin Login</h1>
                <p className="text-sm text-muted-foreground font-mono">
                  Access admin dashboard and enrichment tools
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  loginMutation.mutate({ username, password });
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium font-mono mb-2">
                    Username
                  </label>
                  <Input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="font-mono"
                    placeholder="admin_xxxxxxxx"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium font-mono mb-2">
                    Password
                  </label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="font-mono"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    required
                  />
                </div>

                {loginError && (
                  <div className="flex items-center gap-2 text-sm text-red-500 font-mono">
                    <AlertCircle className="h-4 w-4" />
                    {loginError}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-600"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    'Login'
                  )}
                </Button>
              </form>

              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-xs text-muted-foreground font-mono text-center">
                  Credentials are in <code className="bg-muted px-1 py-0.5 rounded">.env</code> file
                </p>
              </div>
            </HackerCard>
          </motion.div>
        </div>
      </>
    );
  }

  // Admin Dashboard
  return (
    <>
      <Helmet>
        <title>Admin Dashboard - YC Company Explorer</title>
      </Helmet>

      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-2 font-mono text-sm text-muted-foreground">
                <Shield className="h-4 w-4 text-emerald-500" />
                <span>$ admin --dashboard</span>
              </div>
              <h1 className="text-3xl font-bold font-mono">
                <span className="text-emerald-500">&gt;</span> Admin Dashboard
              </h1>
            </div>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="font-mono"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>

          {/* Stats Overview */}
          {statsLoading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-500" />
              <p className="mt-4 text-muted-foreground font-mono">Loading stats...</p>
            </div>
          ) : stats ? (
            <>
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <HackerCard glowColor="green" className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-emerald-500/10 rounded-lg">
                      <Database className="h-6 w-6 text-emerald-500" />
                    </div>
                    <div>
                      <div className="text-sm font-mono text-muted-foreground">
                        ENRICHED
                      </div>
                      <div className="text-2xl font-bold font-mono">
                        {stats.enriched_count.toLocaleString()}
                        <span className="text-sm text-muted-foreground ml-2">
                          / {stats.total_companies.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-xs text-emerald-500 font-mono">
                        {stats.enrichment_percentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </HackerCard>

                <HackerCard glowColor="blue" className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-500/10 rounded-lg">
                      <DollarSign className="h-6 w-6 text-blue-500" />
                    </div>
                    <div>
                      <div className="text-sm font-mono text-muted-foreground">
                        WITH_FUNDING
                      </div>
                      <div className="text-2xl font-bold font-mono">
                        {stats.with_funding_amount.toLocaleString()}
                      </div>
                      <div className="text-xs text-blue-500 font-mono">
                        {stats.funding_data_percentage.toFixed(1)}% of enriched
                      </div>
                    </div>
                  </div>
                </HackerCard>

                <HackerCard glowColor="purple" className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-violet-500/10 rounded-lg">
                      <Building2 className="h-6 w-6 text-violet-500" />
                    </div>
                    <div>
                      <div className="text-sm font-mono text-muted-foreground">
                        PENDING
                      </div>
                      <div className="text-2xl font-bold font-mono">
                        {stats.unenriched_count.toLocaleString()}
                      </div>
                      <div className="text-xs text-violet-500 font-mono">
                        companies remaining
                      </div>
                    </div>
                  </div>
                </HackerCard>

                <HackerCard glowColor="orange" className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-[#FB651E]/10 rounded-lg">
                      <Clock className="h-6 w-6 text-[#FB651E]" />
                    </div>
                    <div>
                      <div className="text-sm font-mono text-muted-foreground">
                        RECENT_24H
                      </div>
                      <div className="text-2xl font-bold font-mono">
                        {stats.recent_enrichments_24h.toLocaleString()}
                      </div>
                      <div className="text-xs text-[#FB651E] font-mono">
                        last 24 hours
                      </div>
                    </div>
                  </div>
                </HackerCard>
              </div>

              {/* Enrichment Controls */}
              <HackerCard glowColor="green" className="p-6 mb-8">
                <h2 className="text-xl font-bold font-mono mb-4 flex items-center gap-2">
                  <Play className="h-5 w-5 text-emerald-500" />
                  Bulk Enrichment
                  {!enrichmentParams.force_refresh && (
                    <span className="ml-auto text-xs font-normal text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">
                      🛡️ SAFE MODE
                    </span>
                  )}
                </h2>

                {!stats.coresignal_enabled && (
                  <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-yellow-500 font-mono text-sm">
                      <AlertCircle className="h-4 w-4" />
                      Coresignal API key not configured
                    </div>
                  </div>
                )}

                {/* Safety mode info */}
                {!enrichmentParams.force_refresh && (
                  <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-emerald-500 font-mono text-xs">
                      <CheckCircle2 className="h-4 w-4" />
                      <div>
                        <span className="font-medium">Safe Mode Active:</span> Only new companies will be enriched.
                        Already-enriched companies are automatically skipped to save API credits.
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium font-mono mb-2">
                      Batch (optional)
                    </label>
                    <Input
                      type="text"
                      placeholder="W25, S24, etc."
                      value={enrichmentParams.batch}
                      onChange={(e) => setEnrichmentParams({ ...enrichmentParams, batch: e.target.value })}
                      className="font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium font-mono mb-2">
                      Limit
                    </label>
                    <Input
                      type="number"
                      min="1"
                      max="200"
                      value={enrichmentParams.limit}
                      onChange={(e) => setEnrichmentParams({ ...enrichmentParams, limit: parseInt(e.target.value) || 100 })}
                      className="font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium font-mono mb-2">
                      Top Companies Only
                    </label>
                    <label className="flex items-center gap-2 mt-2">
                      <input
                        type="checkbox"
                        checked={enrichmentParams.top_only}
                        onChange={(e) => setEnrichmentParams({ ...enrichmentParams, top_only: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm font-mono">Yes</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium font-mono mb-2">
                      Force Re-enrich
                    </label>
                    <label className="flex items-center gap-2 mt-2">
                      <input
                        type="checkbox"
                        checked={enrichmentParams.force_refresh}
                        onChange={(e) => setEnrichmentParams({ ...enrichmentParams, force_refresh: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm font-mono">Yes</span>
                    </label>
                  </div>
                </div>

                {/* Refresh days - only show if force_refresh is enabled */}
                {enrichmentParams.force_refresh && (
                  <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-mono text-sm text-yellow-500 font-medium mb-2">
                          Re-enrichment Mode Active
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          This will re-fetch data from Coresignal for companies that were already enriched.
                          Use this to update old data.
                        </p>
                        <div className="flex items-center gap-4">
                          <label className="text-sm font-mono">
                            Only re-enrich if older than:
                          </label>
                          <Input
                            type="number"
                            min="0"
                            max="365"
                            value={enrichmentParams.refresh_days}
                            onChange={(e) => setEnrichmentParams({ ...enrichmentParams, refresh_days: parseInt(e.target.value) || 30 })}
                            className="font-mono w-24"
                          />
                          <span className="text-sm font-mono text-muted-foreground">days</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 font-mono">
                          Set to 0 to re-enrich ALL companies regardless of age
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-4">
                  <Button
                    onClick={() => enrichmentMutation.mutate(enrichmentParams)}
                    disabled={enrichmentMutation.isPending || !stats.coresignal_enabled}
                    className="bg-emerald-500 hover:bg-emerald-600"
                  >
                    {enrichmentMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Start Enrichment
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={() => refetchStats()}
                    variant="outline"
                    disabled={statsLoading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${statsLoading ? 'animate-spin' : ''}`} />
                    Refresh Stats
                  </Button>
                </div>

                {enrichmentMutation.isSuccess && enrichmentMutation.data && (
                  <div className={`mt-4 p-4 rounded-lg ${
                    enrichmentMutation.data.total === 0
                      ? 'bg-blue-500/10 border border-blue-500/20'
                      : 'bg-emerald-500/10 border border-emerald-500/20'
                  }`}>
                    <div className={`flex items-center gap-2 font-mono text-sm ${
                      enrichmentMutation.data.total === 0 ? 'text-blue-500' : 'text-emerald-500'
                    }`}>
                      <CheckCircle2 className="h-4 w-4" />
                      {enrichmentMutation.data.total === 0 ? (
                        <div>
                          <div className="font-medium mb-1">All companies already enriched!</div>
                          <div className="text-xs">
                            {enrichmentMutation.data.message}
                          </div>
                        </div>
                      ) : (
                        <div>
                          Enrichment started successfully! Enriching {enrichmentMutation.data.total} companies.
                          Check backend logs for progress.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {enrichmentMutation.isError && (
                  <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-red-500 font-mono text-sm">
                      <AlertCircle className="h-4 w-4" />
                      {enrichmentMutation.error?.message || 'Failed to start enrichment'}
                    </div>
                  </div>
                )}
              </HackerCard>

              {/* Email Testing */}
              <HackerCard glowColor="purple" className="p-6 mb-8">
                <h2 className="text-xl font-bold font-mono mb-4 flex items-center gap-2">
                  <span className="text-2xl">📧</span>
                  Email System Testing
                </h2>

                {/* Email Config Status */}
                <div className="mb-4 p-4 bg-muted/50 rounded-lg">
                  <div className="font-mono text-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Resend API:</span>
                      {emailConfig?.resend_configured ? (
                        <span className="text-emerald-500 flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4" />
                          Configured
                        </span>
                      ) : (
                        <span className="text-red-500 flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          Not Configured
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">From Email:</span>
                      <span className="text-foreground">{emailConfig?.from_email || 'Not set'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Cron Secret:</span>
                      {emailConfig?.cron_secret_configured ? (
                        <span className="text-emerald-500 flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4" />
                          Configured
                        </span>
                      ) : (
                        <span className="text-red-500 flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          Not Configured
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {!emailConfig?.resend_configured && (
                  <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <div className="flex items-start gap-2 text-yellow-600 dark:text-yellow-400 font-mono text-sm">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium mb-1">Email not configured</div>
                        <div className="text-xs">
                          Set RESEND_API_KEY and RESEND_FROM_EMAIL in environment variables.
                          See SETUP_EMAIL_SCHEDULER.md for instructions.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Test Email Form */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium font-mono mb-2">
                      Test Email Address
                    </label>
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={testEmailAddress}
                      onChange={(e) => setTestEmailAddress(e.target.value)}
                      className="font-mono"
                    />
                  </div>

                  <div className="flex gap-4">
                    <Button
                      onClick={() => {
                        if (!testEmailAddress) {
                          setEmailTestResult({ type: 'error', message: 'Please enter an email address' });
                          return;
                        }
                        setEmailTestResult(null);
                        testVerificationEmailMutation.mutate(testEmailAddress);
                      }}
                      disabled={testVerificationEmailMutation.isPending || !emailConfig?.resend_configured}
                      variant="outline"
                    >
                      {testVerificationEmailMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <span className="mr-2">✉️</span>
                          Send Test Verification Email
                        </>
                      )}
                    </Button>

                    <a
                      href="/api/admin/digest-preview"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline">
                        <span className="mr-2">👁️</span>
                        Preview Digest
                      </Button>
                    </a>
                  </div>

                  {/* Test Result */}
                  {emailTestResult && (
                    <div className={`p-4 rounded-lg ${
                      emailTestResult.type === 'success'
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500'
                        : 'bg-red-500/10 border border-red-500/20 text-red-500'
                    }`}>
                      <div className="font-mono text-sm">
                        {emailTestResult.message}
                      </div>
                    </div>
                  )}

                  {/* Help Text */}
                  <div className="text-xs text-muted-foreground font-mono bg-muted/30 p-3 rounded-lg">
                    <div className="font-medium mb-1">💡 Testing Tips:</div>
                    <ul className="space-y-1 ml-4 list-disc">
                      <li>Verification email tests the welcome + email confirmation flow</li>
                      <li>Digest preview shows what would be sent in daily emails (opens in new tab)</li>
                      <li>Check SETUP_EMAIL_SCHEDULER.md for full scheduler setup</li>
                    </ul>
                  </div>
                </div>
              </HackerCard>

              {/* Top Enriched Companies */}
              <HackerCard glowColor="blue" className="p-6">
                <h2 className="text-xl font-bold font-mono mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                  Top Enriched Companies
                </h2>

                <div className="overflow-x-auto">
                  <table className="w-full font-mono text-sm">
                    <thead className="border-b border-border">
                      <tr className="text-left text-muted-foreground">
                        <th className="pb-2">Company</th>
                        <th className="pb-2">Batch</th>
                        <th className="pb-2">Total Funding</th>
                        <th className="pb-2">Last Round</th>
                        <th className="pb-2">Investors</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {stats.top_enriched.map((company) => (
                        <tr key={company.id} className="hover:bg-muted/50">
                          <td className="py-3 font-medium">{company.name}</td>
                          <td className="py-3 text-muted-foreground">{company.batch}</td>
                          <td className="py-3 text-emerald-500">
                            {company.funding_total_usd ? formatCurrency(company.funding_total_usd) : '-'}
                          </td>
                          <td className="py-3 text-muted-foreground">
                            {company.funding_last_round_name || '-'}
                          </td>
                          <td className="py-3 text-muted-foreground">
                            {company.investors_count || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </HackerCard>
            </>
          ) : (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
              <p className="text-muted-foreground font-mono">Failed to load stats</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
