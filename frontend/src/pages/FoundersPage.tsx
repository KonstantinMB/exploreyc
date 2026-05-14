import { Link } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { PaulGrahamEssays } from '../components/PaulGrahamEssays';
import { EmailSubscription } from '../components/EmailSubscription';
import { DataInsightsSVG } from '../components/illustrations/CustomSVGs';
import { TrendingUp, ArrowRight } from 'lucide-react';

export function FoundersPage() {
  const { stats } = useApp();

  const totalCompanies = stats?.total_companies || 0;
  const totalCountries = stats?.by_country ? Object.keys(stats.by_country).length : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="max-w-6xl mx-auto mb-12">
          <div className="flex items-center gap-3 mb-6">
            <DataInsightsSVG className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">For Founders</h1>
              <p className="text-sm text-muted-foreground font-mono">
                Paul Graham essays and daily YC updates
              </p>
            </div>
          </div>
        </div>

        {/* Founder Tools - Quick Links */}
        <div className="max-w-6xl mx-auto mb-8">
          <h3 className="font-bold mb-4 text-[#FB651E] font-mono">Founder Tools</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              to="/funding"
              className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all group"
            >
              <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">Fundraising Tracker</div>
                <div className="text-xs text-muted-foreground">Funding network by sector</div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-emerald-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
            </Link>
            <Link
              to="/tools"
              className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-[#FB651E]/50 hover:bg-[#FB651E]/5 transition-all group"
            >
              <div className="w-10 h-10 bg-[#FB651E] rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-lg">🛠</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">All Founder Tools</div>
                <div className="text-xs text-muted-foreground">Idea validator, batch wrapped, fundraising</div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-[#FB651E] group-hover:translate-x-1 transition-all flex-shrink-0" />
            </Link>
            <Link
              to="/roadmap"
              className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group"
            >
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-lg">🗺</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">Product Roadmap</div>
                <div className="text-xs text-muted-foreground">Vote on features</div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-blue-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
            </Link>
          </div>
        </div>

        {/* Paul Graham Essays + Email Subscription */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 max-w-6xl mx-auto">
          <PaulGrahamEssays />
          <EmailSubscription />
        </div>

        {/* YC Database Insights */}
        {stats && (
          <div className="max-w-6xl mx-auto">
            <div className="bg-muted/30 border border-border rounded-xl p-6">
              <h3 className="font-bold mb-4 text-[#FB651E] font-mono">YC Database Insights</h3>
              <p className="text-muted-foreground mb-4 font-mono text-sm">
                Comprehensive data on {totalCompanies.toLocaleString()} Y Combinator companies across{' '}
                {Object.keys(stats.by_batch || {}).length} batches
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <div className="text-muted-foreground text-sm">Total Companies</div>
                  <div className="text-2xl font-bold">{totalCompanies.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-sm">Currently Hiring</div>
                  <div className="text-2xl font-bold text-green-600">
                    {(stats.hiring ?? 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-sm">Total Batches</div>
                  <div className="text-2xl font-bold">
                    {Object.keys(stats.by_batch || {}).length}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-sm">Countries</div>
                  <div className="text-2xl font-bold">{totalCountries}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
