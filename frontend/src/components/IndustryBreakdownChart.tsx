import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface IndustryBreakdownChartProps {
  data: Record<string, number>
}

export function IndustryBreakdownChart({ data }: IndustryBreakdownChartProps) {
  // Transform data for Recharts
  const chartData = Object.entries(data)
    .map(([industry, count]) => ({
      industry,
      count,
      // Shorten long industry names for display
      displayName: industry.length > 20 ? industry.substring(0, 17) + '...' : industry,
    }))
    .sort((a, b) => b.count - a.count) // Sort by count descending
    .slice(0, 8) // Top 8 industries

  // YC orange color scheme
  const COLORS = [
    '#FB651E', // YC orange
    '#E65C00', // Darker orange
    '#FF8A4C', // Lighter orange
    '#D4551A', // Even darker
    '#FFA066', // Even lighter
    '#C24E17', // Darkest
    '#FFB380', // Lightest
    '#B04515', // Very dark
  ]

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const percentage = ((data.count / chartData.reduce((sum, item) => sum + item.count, 0)) * 100).toFixed(1)

      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg">
          <p className="font-semibold text-sm">{data.industry}</p>
          <p className="text-sm text-muted-foreground">
            {data.count} {data.count === 1 ? 'company' : 'companies'} ({percentage}%)
          </p>
        </div>
      )
    }
    return null
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        No industry data available
      </div>
    )
  }

  // Calculate max value for proper domain
  const maxValue = Math.max(...chartData.map(item => item.count))
  const domainMax = Math.ceil(maxValue * 1.1) // Add 10% padding

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
        barCategoryGap="20%"
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={true} vertical={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 12 }}
          domain={[0, domainMax]}
          allowDataOverflow={false}
          includeHidden={false}
          allowDecimals={false}
          tickLine={true}
          axisLine={true}
        />
        <YAxis
          type="category"
          dataKey="displayName"
          tick={{ fontSize: 12 }}
          width={90}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(251, 101, 30, 0.1)' }} />
        <Bar
          dataKey="count"
          radius={[0, 4, 4, 0]}
          maxBarSize={40}
        >
          {chartData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
