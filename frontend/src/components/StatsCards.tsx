import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { formatNumber } from '../lib/utils';
import {
  StartupBuildingSVG,
  HiringMagnetSVG,
  GrowthRocketSVG,
  GlobalNetworkSVG
} from './illustrations/CustomSVGs';

interface StatsCardsProps {
  totalCompanies: number;
  hiring: number;
  topBatch?: { batch: string; count: number };
  topCountry?: { country: string; count: number };
}

export function StatsCards({ totalCompanies, hiring, topBatch, topCountry }: StatsCardsProps) {
  const total = totalCompanies ?? 0
  const hireCount = hiring ?? 0
  const stats = [
    {
      title: 'Total Companies',
      value: formatNumber(total),
      icon: StartupBuildingSVG,
      color: '#FB651E',
    },
    {
      title: 'Currently Hiring',
      value: formatNumber(hireCount),
      subtitle: `${total > 0 ? ((hireCount / total) * 100).toFixed(1) : 0}% of total`,
      icon: HiringMagnetSVG,
      color: '#4CAF50',
    },
    {
      title: 'Top Batch',
      value: topBatch?.batch || 'N/A',
      subtitle: topBatch ? `${formatNumber(topBatch.count)} companies` : undefined,
      icon: GrowthRocketSVG,
      color: '#2196F3',
    },
    {
      title: 'Top Region',
      value: topCountry?.country || 'N/A',
      subtitle: topCountry ? `${formatNumber(topCountry.count)} companies` : undefined,
      icon: GlobalNetworkSVG,
      color: '#FFC107',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-8 w-8" color={stat.color} />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold truncate" style={{ color: stat.color }} title={String(stat.value)}>
                {stat.value}
              </div>
              {stat.subtitle && (
                <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
