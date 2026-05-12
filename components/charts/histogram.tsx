"use client";

import { useMemo, useState, useCallback } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import type { SearchResponse } from '@/lib/bronto-types';
import { Skeleton } from '@/components/ui/skeleton';
import { extractTimeseriesPoints, extractSeriesNames } from '@/lib/bronto-utils';
import { cn } from '@/lib/utils';

interface HistogramProps {
  data?: SearchResponse;
  isLoading: boolean;
  barColor?: string;
  aggregates?: string[];
  groups?: string[];
  hideNull?: boolean;
}

const SEVERITY_COLORS: Record<string, string> = {
  info: 'hsl(220, 100%, 56%)',
  warning: 'hsl(35, 90%, 55%)',
  error: 'hsl(0, 70%, 55%)',
};

const SERIES_COLORS = [
  'hsl(210, 80%, 55%)',
  'hsl(150, 60%, 45%)',
  'hsl(35, 90%, 55%)',
  'hsl(0, 70%, 55%)',
  'hsl(270, 60%, 55%)',
  'hsl(180, 60%, 45%)',
];

export function Histogram({ data, isLoading, barColor, aggregates, groups, hideNull }: HistogramProps) {
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  const points = useMemo(() => extractTimeseriesPoints(data, aggregates, groups), [data, aggregates, groups]);
  const allSeriesNames = useMemo(() => extractSeriesNames(data, aggregates, groups), [data, aggregates, groups]);
  const seriesNames = useMemo(() => hideNull ? allSeriesNames.filter(s => !s.name.includes('NULL')) : allSeriesNames, [allSeriesNames, hideNull]);

  const toggleSeries = useCallback((dataKey: string) => {
    setHiddenSeries(prev => {
      const next = new Set(prev);
      if (next.has(dataKey)) next.delete(dataKey);
      else next.add(dataKey);
      return next;
    });
  }, []);

  if (isLoading) return <Skeleton className="h-16 w-full rounded" />;
  if (points.length === 0) return null;

  const isSeverity = seriesNames.length > 0 && seriesNames.every(s => s.dataKey in SEVERITY_COLORS);
  const isMultiSeries = seriesNames.length > 1 && !isSeverity;

  const allBars = isSeverity
    ? seriesNames.map((s) => ({
        dataKey: s.dataKey,
        name: s.name,
        fill: SEVERITY_COLORS[s.dataKey],
        stackId: 'severity',
      }))
    : isMultiSeries
    ? seriesNames.map((s, i) => ({
        dataKey: s.dataKey,
        name: s.name,
        fill: SERIES_COLORS[i % SERIES_COLORS.length],
        stackId: undefined,
      }))
    : [{ dataKey: 'count', name: 'count', fill: barColor || 'hsl(var(--primary))', stackId: undefined }];

  const bars = allBars.filter(b => !hiddenSeries.has(b.dataKey));

  return (
    <div className="space-y-1">
      <div className="h-28 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="timestamp"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(v: number) => {
                const d = new Date(v);
                const h = String(d.getHours()).padStart(2, '0');
                const m = String(d.getMinutes()).padStart(2, '0');
                return `${h}:${m}`;
              }}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                fontSize: '11px',
              }}
              labelFormatter={(v: number) => new Date(v).toLocaleString()}
            />
            {bars.map((b) => (
              <Bar
                key={b.dataKey}
                dataKey={b.dataKey}
                name={b.name}
                fill={b.fill}
                fillOpacity={0.7}
                radius={[1, 1, 0, 0]}
                stackId={b.stackId}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {allBars.length > 1 && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {allBars.map((b) => {
            const isHidden = hiddenSeries.has(b.dataKey);
            return (
              <button
                key={b.dataKey}
                onClick={() => toggleSeries(b.dataKey)}
                className={cn(
                  'inline-flex items-center gap-1 text-[10px] transition-opacity',
                  isHidden ? 'opacity-40 line-through' : 'opacity-100'
                )}
              >
                <span
                  className="inline-block h-2 w-2 rounded-sm shrink-0 transition-colors"
                  style={{ backgroundColor: isHidden ? 'hsl(var(--muted-foreground))' : b.fill }}
                />
                <span className="truncate text-muted-foreground">{b.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
