import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { BatchCount } from '../lib/api'

interface BatchTimelineChartProps {
  data: BatchCount[]
}

export function BatchTimelineChart({ data }: BatchTimelineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        No batch data available
      </div>
    )
  }

  // Sort batches chronologically (most recent first, then reverse for chart)
  // YC batch format: "W24" (Winter 2024), "S23" (Summer 2023), etc.
  const sortedData = [...data].sort((a, b) => {
    const extractYear = (batch: string) => {
      const yearPart = batch.match(/\d+/)?.[0]
      if (!yearPart) return 0
      // Convert 2-digit year to full year (24 -> 2024, 05 -> 2005)
      const year = parseInt(yearPart)
      return year < 100 ? (year < 50 ? 2000 + year : 1900 + year) : year
    }

    const extractSeason = (batch: string) => {
      const season = batch.match(/[A-Za-z]+/)?.[0]?.toUpperCase()
      // W (Winter) = 1, S (Summer) = 2, Fall variations
      if (season === 'W') return 1
      if (season === 'S') return 2
      return 0
    }

    const yearA = extractYear(a.batch)
    const yearB = extractYear(b.batch)

    if (yearA !== yearB) return yearA - yearB

    return extractSeason(a.batch) - extractSeason(b.batch)
  })

  // Take last 15 batches for better readability
  const chartData = sortedData.slice(-15)

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg">
          <p className="font-semibold text-sm">{data.batch}</p>
          <p className="text-sm text-muted-foreground">
            {data.count} {data.count === 1 ? 'company' : 'companies'}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#FB651E" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#FB651E" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="batch"
          tick={{ fontSize: 11 }}
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#FB651E"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorCount)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
