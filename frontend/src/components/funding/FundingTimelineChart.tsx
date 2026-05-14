import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

interface Company {
  id: number;
  name: string;
  funding_total_usd: number;
  batch: string;
  last_funding_date?: string;
}

interface FundingTimelineChartProps {
  companies: Company[];
}

export function FundingTimelineChart({ companies }: FundingTimelineChartProps) {
  // Parse batch to get year
  const parseBatchYear = (batch: string): number => {
    const match = batch.match(/\d{4}/);
    if (match) return parseInt(match[0]);

    // Handle short format like "W21" or "S21"
    const shortMatch = batch.match(/[WS](\d{2})/i);
    if (shortMatch) {
      const year = parseInt(shortMatch[1]);
      return year < 50 ? 2000 + year : 1900 + year;
    }
    return 0;
  };

  // Aggregate funding by year
  const timelineData = useMemo(() => {
    const yearMap = new Map<number, { total: number; count: number; companies: string[] }>();

    companies.forEach((company) => {
      const year = parseBatchYear(company.batch);
      if (year === 0) return;

      const existing = yearMap.get(year) || { total: 0, count: 0, companies: [] };
      yearMap.set(year, {
        total: existing.total + company.funding_total_usd,
        count: existing.count + 1,
        companies: [...existing.companies, company.name].slice(0, 5), // Keep top 5 for tooltip
      });
    });

    // Convert to array and sort by year
    const data = Array.from(yearMap.entries())
      .map(([year, stats]) => ({
        year,
        total: stats.total,
        totalB: stats.total / 1_000_000_000, // In billions
        count: stats.count,
        avg: stats.total / stats.count,
        avgM: stats.total / stats.count / 1_000_000, // In millions
        companies: stats.companies,
      }))
      .sort((a, b) => a.year - b.year);

    // Calculate cumulative
    let cumulative = 0;
    return data.map((item) => {
      cumulative += item.total;
      return {
        ...item,
        cumulative,
        cumulativeB: cumulative / 1_000_000_000,
      };
    });
  }, [companies]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-4 shadow-lg">
          <div className="font-bold text-base mb-2 font-mono">{data.year}</div>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Raised this year:</span>
              <span className="font-bold text-emerald-500">${data.totalB.toFixed(2)}B</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Companies:</span>
              <span className="font-semibold">{data.count}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Avg per company:</span>
              <span className="font-semibold">${data.avgM.toFixed(1)}M</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Total to date:</span>
              <span className="font-bold text-[#FB651E]">${data.cumulativeB.toFixed(2)}B</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (timelineData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        No timeline data available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-emerald-500" />
          <h3 className="text-lg font-bold font-mono">Funding Over Time</h3>
        </div>
        <div className="text-sm text-muted-foreground font-mono">
          {timelineData[0]?.year} - {timelineData[timelineData.length - 1]?.year}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs font-mono">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-emerald-500/50 rounded-sm" />
          <span className="text-muted-foreground">Annual Funding</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[#FB651E]/50 rounded-sm" />
          <span className="text-muted-foreground">Cumulative Total</span>
        </div>
      </div>

      {/* Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={timelineData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FB651E" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#FB651E" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              tickFormatter={(value) => `$${(value / 1_000_000_000).toFixed(0)}B`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#FB651E', strokeWidth: 2 }} />

            {/* Annual funding */}
            <Area
              type="monotone"
              dataKey="total"
              stroke="#10b981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorTotal)"
              animationDuration={1500}
            />

            {/* Cumulative funding */}
            <Area
              type="monotone"
              dataKey="cumulative"
              stroke="#FB651E"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorCumulative)"
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
        <div className="text-center">
          <div className="text-2xl font-bold font-mono text-emerald-500">
            ${(timelineData.reduce((sum, d) => sum + d.total, 0) / 1_000_000_000).toFixed(1)}B
          </div>
          <div className="text-xs text-muted-foreground mt-1">Total Raised</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold font-mono text-[#FB651E]">
            {Math.max(...timelineData.map(d => d.count))}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Peak Year Companies</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold font-mono text-blue-500">
            ${(timelineData.reduce((sum, d) => sum + d.avg, 0) / timelineData.length / 1_000_000).toFixed(1)}M
          </div>
          <div className="text-xs text-muted-foreground mt-1">Avg Per Company</div>
        </div>
      </div>
    </div>
  );
}
