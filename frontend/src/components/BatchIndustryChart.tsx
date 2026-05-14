import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { HackerCard } from './ui/hacker-card';
import { Layers } from 'lucide-react';
import { getSortedBatches, batchToShortFormat } from '../lib/batchUtils';

interface BatchIndustryChartProps {
  byBatch: Record<string, number>;
  byBatchIndustry: Record<string, Record<string, number>>;
}

const INDUSTRY_COLORS = [
  '#FB651E', '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B',
  '#EF4444', '#06B6D4', '#EC4899', '#84CC16', '#F97316',
  '#6366F1', '#14B8A6', '#E11D48', '#A855F7', '#0EA5E9',
  '#D946EF', '#22C55E', '#FACC15', '#64748B', '#78716C',
];

const MUTED_OPACITY = 0.15;

export function BatchIndustryChart({ byBatch, byBatchIndustry }: BatchIndustryChartProps) {
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [showMoreDropdown, setShowMoreDropdown] = useState(false);

  const sortedBatches = useMemo(() => {
    return getSortedBatches(byBatch).reverse();
  }, [byBatch]);

  const allIndustries = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const batchIndustries of Object.values(byBatchIndustry)) {
      for (const [ind, count] of Object.entries(batchIndustries)) {
        totals[ind] = (totals[ind] || 0) + count;
      }
    }
    return Object.entries(totals)
      .sort(([, a], [, b]) => b - a)
      .map(([name]) => name);
  }, [byBatchIndustry]);

  const top5 = useMemo(() => new Set(allIndustries.slice(0, 5)), [allIndustries]);

  const industryColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    allIndustries.forEach((ind, i) => {
      map[ind] = INDUSTRY_COLORS[i % INDUSTRY_COLORS.length];
    });
    return map;
  }, [allIndustries]);

  const barData = useMemo(() => {
    return sortedBatches.map(batch => {
      const industries = byBatchIndustry[batch.name] || {};
      const total = Object.values(industries).reduce((s, v) => s + v, 0);
      const segments = allIndustries
        .map(ind => ({
          industry: ind,
          count: industries[ind] || 0,
          pct: total > 0 ? ((industries[ind] || 0) / total) * 100 : 0,
        }))
        .filter(s => s.count > 0);
      return { batch: batch.name, total, segments };
    });
  }, [sortedBatches, byBatchIndustry, allIndustries]);

  const handleLegendClick = useCallback((industry: string) => {
    setSelectedIndustry(prev => prev === industry ? null : industry);
  }, []);

  const legendIndustries = useMemo(() => {
    if (selectedIndustry && !top5.has(selectedIndustry)) {
      return [...allIndustries.slice(0, 5), selectedIndustry];
    }
    return allIndustries.slice(0, 5);
  }, [allIndustries, top5, selectedIndustry]);

  const otherIndustries = useMemo(() => {
    const legendSet = new Set(legendIndustries);
    return allIndustries.filter(i => !legendSet.has(i));
  }, [allIndustries, legendIndustries]);

  return (
    <HackerCard glowColor="blue" className="p-6">
      <div className="flex items-center gap-2 mb-4 font-mono">
        <Layers className="h-5 w-5 text-blue-500" />
        <span className="text-muted-foreground">$</span>
        <h3 className="font-bold">Industry Mix by Batch</h3>
        <span className="text-xs text-muted-foreground ml-auto">% of companies per batch</span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4 font-mono text-xs">
        {legendIndustries.map(ind => {
          const isSelected = selectedIndustry === ind;
          return (
            <button
              key={ind}
              onClick={() => handleLegendClick(ind)}
              className={`flex items-center gap-1.5 transition-opacity hover:opacity-100 ${
                selectedIndustry && !isSelected ? 'opacity-40' : 'opacity-100'
              }`}
            >
              <span
                className="inline-block w-2.5 h-2.5 shrink-0"
                style={{
                  backgroundColor: industryColorMap[ind],
                  opacity: isSelected ? 1 : 0.8,
                  outline: isSelected ? '2px solid currentColor' : 'none',
                  outlineOffset: '1px',
                }}
              />
              <span className={isSelected ? 'text-foreground' : 'text-muted-foreground'}>
                {ind}
              </span>
            </button>
          );
        })}
        {otherIndustries.length > 0 && (
          <div
            className="relative"
            onMouseEnter={() => setShowMoreDropdown(true)}
            onMouseLeave={() => setShowMoreDropdown(false)}
          >
            <button className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
              <span className="inline-block w-2.5 h-2.5 shrink-0 border border-muted-foreground/40" />
              <span>+{otherIndustries.length} more</span>
            </button>
            {showMoreDropdown && (
              <div className="absolute z-50 top-full left-0 pt-1">
                <div className="bg-card border border-border p-3 shadow-lg max-h-60 overflow-y-auto min-w-48">
                  <div className="space-y-1">
                    {otherIndustries.map(ind => (
                      <button
                        key={ind}
                        onClick={() => { handleLegendClick(ind); setShowMoreDropdown(false); }}
                        className="flex items-center gap-1.5 w-full text-left hover:text-foreground transition-colors"
                      >
                        <span
                          className="inline-block w-2 h-2 shrink-0"
                          style={{ backgroundColor: industryColorMap[ind] }}
                        />
                        <span className={selectedIndustry === ind ? 'text-foreground' : 'text-muted-foreground'}>
                          {ind}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {selectedIndustry && (
          <button
            onClick={() => setSelectedIndustry(null)}
            className="text-muted-foreground hover:text-foreground transition-colors ml-2"
          >
            [clear]
          </button>
        )}
      </div>

      {/* Chart */}
      <div className="w-full h-[320px] flex">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between text-xs text-muted-foreground font-mono py-0.5 pr-2 shrink-0">
          <span>100%</span>
          <span>50%</span>
          <span>0%</span>
        </div>

        {/* Chart area */}
        <div className="flex-1 relative">
          <svg className="w-full h-full" viewBox={`0 0 ${barData.length * 10} 100`} preserveAspectRatio="none">
            {[0, 25, 50, 75, 100].map(y => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2={barData.length * 10}
                y2={y}
                stroke="currentColor"
                strokeWidth="0.15"
                opacity="0.1"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {barData.map((bar, barIdx) => {
              const barWidth = 10;
              const x = barIdx * barWidth;
              let yOffset = 0;

              return (
                <g
                  key={bar.batch}
                  onMouseEnter={() => setHoveredBar(barIdx)}
                  onMouseLeave={() => setHoveredBar(null)}
                >
                  {bar.segments.map(seg => {
                    const segHeight = seg.pct;
                    const segY = 100 - yOffset - segHeight;
                    yOffset += segHeight;

                    const isHighlighted = selectedIndustry === seg.industry;
                    const isMuted = selectedIndustry !== null && !isHighlighted;

                    return (
                      <rect
                        key={seg.industry}
                        x={x + barWidth * 0.1}
                        y={segY}
                        width={barWidth * 0.8}
                        height={Math.max(segHeight, 0.2)}
                        fill={industryColorMap[seg.industry]}
                        opacity={isMuted ? MUTED_OPACITY : 0.85}
                        className="transition-opacity duration-150"
                      >
                        <title>{`${bar.batch}\n${seg.industry}: ${seg.count} (${seg.pct.toFixed(1)}%)`}</title>
                      </rect>
                    );
                  })}
                </g>
              );
            })}
          </svg>

          {/* X-axis labels */}
          <div className="absolute -bottom-6 left-0 right-0 flex justify-between px-1 text-xs text-muted-foreground font-mono">
            {barData[0] && <span>{batchToShortFormat(barData[0].batch)}</span>}
            {barData[Math.floor(barData.length / 2)] && (
              <span>{batchToShortFormat(barData[Math.floor(barData.length / 2)].batch)}</span>
            )}
            {barData[barData.length - 1] && (
              <span>{batchToShortFormat(barData[barData.length - 1].batch)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Hover tooltip */}
      {hoveredBar !== null && barData[hoveredBar] && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 pt-3 border-t border-border"
        >
          <div className="font-mono text-xs">
            <span className="text-[#FB651E]">&gt;</span>{' '}
            <span className="text-foreground font-bold">{barData[hoveredBar].batch}</span>
            <span className="text-muted-foreground"> — {barData[hoveredBar].total} companies</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 font-mono text-xs text-muted-foreground">
            {barData[hoveredBar].segments
              .sort((a, b) => b.count - a.count)
              .slice(0, 8)
              .map(seg => (
                <span key={seg.industry} className="flex items-center gap-1">
                  <span
                    className="inline-block w-1.5 h-1.5"
                    style={{ backgroundColor: industryColorMap[seg.industry] }}
                  />
                  {seg.industry}: {seg.pct.toFixed(1)}%
                </span>
              ))}
          </div>
        </motion.div>
      )}

      {hoveredBar === null && (
        <div className="mt-8 pt-3 border-t border-border flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <span className="text-[#FB651E]">&gt;</span>
          Hover over a bar to see breakdown. Click an industry to highlight it across batches.
        </div>
      )}
    </HackerCard>
  );
}
