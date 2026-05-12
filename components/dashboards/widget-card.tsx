'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { fetchMetricTimeseries } from '@/lib/bronto-api';
import type { Widget } from '@/lib/bronto-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import { ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const PIE_COLORS = ['#6366f1', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];
const MAX_LEGEND_INLINE = 4;
const MAX_TOOLTIP_ITEMS = 10;

interface TimeseriesPoint {
  timestamp: number;
  [key: string]: number;
}

interface GroupData {
  name: string;
  value: number;
  count: number;
  timeseries?: { '@timestamp': number; count: number; value: number }[];
}

interface ParsedMetric {
  groups: GroupData[];
  seriesName: string;
  totalCount: number;
  totalValue: number;
}

function flattenGroupsSeries(groups: unknown[], parentName?: string): GroupData[] {
  const result: GroupData[] = [];
  for (const g of groups) {
    const group = g as Record<string, unknown>;
    const key = group.key || '';
    const value = group.name || 'Unknown';
    const label = key ? `${key}: ${value}` : value;
    const name = parentName ? `${parentName} > ${label}` : String(label);
    const nested = group.groups_series;
    if (nested && Array.isArray(nested) && nested.length > 0) {
      result.push(...flattenGroupsSeries(nested, name));
    } else {
      result.push({
        name,
        value: Number(group.value ?? 0),
        count: Number(group.count ?? 0),
        timeseries: (group.timeseries as unknown[])?.map((p: unknown) => {
          const point = p as Record<string, unknown>;
          return {
            '@timestamp': Number(point['@timestamp']),
            count: Number(point.count ?? 0),
            value: Number(point.value ?? 0),
          };
        }),
      });
    }
  }
  return result;
}

function parseMetricResponse(data: unknown, label?: string): ParsedMetric {
  if (!data || typeof data !== 'object') return { groups: [], seriesName: '', totalCount: 0, totalValue: 0 };

  const obj = data as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) return { groups: [], seriesName: '', totalCount: 0, totalValue: 0 };

  const metricName = keys[0];
  const metric = obj[metricName] as Record<string, unknown>;
  if (!metric || typeof metric !== 'object') return { groups: [], seriesName: '', totalCount: 0, totalValue: 0 };

  const displayName = label || metricName || 'metric';
  const totalCount = Number(metric.total_count ?? 0);
  const totalValue = Number(metric.total_value ?? 0);

  const groupsSeries = metric.groups_series as unknown[] | undefined;
  if (groupsSeries && groupsSeries.length > 0) {
    return {
      seriesName: displayName,
      groups: flattenGroupsSeries(groupsSeries),
      totalCount,
      totalValue,
    };
  }

  const series = metric.series as unknown[] | undefined;
  if (series && series.length > 0) {
    return {
      seriesName: displayName,
      groups: [{
        name: displayName,
        value: totalValue,
        count: totalCount,
        timeseries: series.map((p: unknown) => {
          const point = p as Record<string, unknown>;
          return {
            '@timestamp': Number(point['@timestamp']),
            count: Number(point.count ?? 0),
            value: Number(point.value ?? 0),
          };
        }),
      }],
      totalCount,
      totalValue,
    };
  }

  const aggregates = metric.aggregates as Array<{ function: string; value: number | string }> | undefined;
  if (aggregates && aggregates.length > 0) {
    return {
      seriesName: displayName,
      groups: [{ name: displayName, value: Number(aggregates[0].value ?? 0), count: totalCount }],
      totalCount,
      totalValue,
    };
  }

  if (totalCount || totalValue) {
    return {
      seriesName: displayName,
      groups: [{ name: displayName, value: totalValue, count: totalCount }],
      totalCount,
      totalValue,
    };
  }

  return { groups: [], seriesName: '', totalCount: 0, totalValue: 0 };
}

function buildTimeseries(groups: GroupData[], useCount: boolean): TimeseriesPoint[] {
  const map = new Map<number, TimeseriesPoint>();
  groups.forEach((group) => {
    if (!group.timeseries) return;
    for (const point of group.timeseries) {
      const ts = point['@timestamp'];
      const existing = map.get(ts) || { timestamp: ts };
      existing[group.name] = useCount ? point.count : (point.value || point.count);
      map.set(ts, existing);
    }
  });
  return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
}

function displayValue(g: GroupData): number {
  return g.value !== 0 ? g.value : g.count;
}

function formatNumber(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(2);
}

interface WidgetCardProps {
  widget: Widget;
  timeRange?: string;
  numOfSlices?: number;
  fromTs?: number;
  toTs?: number;
}

export function WidgetCard({ widget, timeRange = 'Last 20 minutes', numOfSlices = 20, fromTs, toTs }: WidgetCardProps) {
  const metricIds = widget.metric_ids || [];
  const lbmIds = widget.lbm_ids || [];
  const metricLabels = widget.metric_labels || {};

  const metricQueries = useQueries({
    queries: metricIds.map((metricId, idx) => {
      const lbmId = lbmIds[idx];
      const label = metricLabels[lbmId] || metricLabels[metricId] || undefined;
      return {
        queryKey: ['bronto-metric', metricId, timeRange, numOfSlices, fromTs, toTs],
        queryFn: () => fetchMetricTimeseries(metricId, timeRange, numOfSlices, undefined, fromTs, toTs),
        staleTime: 30_000,
        meta: { label },
      };
    }),
  });

  const isLoading = metricQueries.some((q) => q.isLoading);
  const hasError = metricQueries.some((q) => q.isError);

  const allParsed = metricQueries.map((q, idx) => {
    const lbmId = lbmIds[idx];
    const metricId = metricIds[idx];
    const label = metricLabels[lbmId] || metricLabels[metricId] || undefined;
    return parseMetricResponse(q.data, label);
  });

  const allGroups = allParsed.flatMap((p) => p.groups);
  const useCount = allGroups.every(g => g.value === 0) && allGroups.some(g => g.count > 0);
  const timeseries = buildTimeseries(allGroups, useCount);
  const chartType = widget.type || 'area';

  const colorMap = useMemo(() => {
    const names = [...new Set(allGroups.map((g) => g.name))];
    const m: Record<string, string> = {};
    names.forEach((name, i) => { m[name] = PIE_COLORS[i % PIE_COLORS.length]; });
    return m;
  }, [allGroups]);

  const CustomTooltip = useCallback(({ active, payload, label }: TooltipProps<number, string>) => {
    if (!active || !payload || payload.length === 0) return null;
    const sorted = [...payload]
      .filter((p) => p.value != null)
      .sort((a, b) => ((b.value as number) ?? 0) - ((a.value as number) ?? 0));
    const visible = sorted.slice(0, MAX_TOOLTIP_ITEMS);
    const rest = sorted.slice(MAX_TOOLTIP_ITEMS);
    const othersSum = rest.reduce((sum, p) => sum + ((p.value as number) ?? 0), 0);
    return (
      <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-[11px] max-h-[280px] overflow-y-auto" style={{ minWidth: 140, maxWidth: 260 }}>
        <p className="text-muted-foreground mb-1">
          {typeof label === 'number' ? new Date(label).toLocaleString() : label}
        </p>
        {visible.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-2 py-px">
            <span className="flex items-center gap-1 truncate min-w-0">
              <span className="inline-block h-2 w-2 rounded-sm shrink-0" style={{ backgroundColor: colorMap[entry.dataKey as string] || entry.color }} />
              <span className="truncate">{entry.name}</span>
            </span>
            <span className="font-medium tabular-nums shrink-0">{formatNumber(entry.value as number)}</span>
          </div>
        ))}
        {rest.length > 0 && (
          <div className="flex items-center justify-between gap-2 py-px text-muted-foreground border-t border-border mt-1 pt-1">
            <span>+{rest.length} others</span>
            <span className="font-medium tabular-nums">{formatNumber(othersSum)}</span>
          </div>
        )}
      </div>
    );
  }, [colorMap]);

  const renderChart = () => {
    if (isLoading) return <Skeleton className="h-full w-full rounded" />;
    if (hasError) return <div className="flex items-center justify-center h-full text-xs text-destructive">Error loading data</div>;
    if (allGroups.length === 0) {
      return <div className="flex items-center justify-center h-full text-xs text-muted-foreground">No data</div>;
    }

    const groupNames = [...new Set(allGroups.map((g) => g.name))];
    const tickFormatter = (v: number) =>
      new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const axisStyle = { stroke: 'hsl(var(--muted-foreground))', fontSize: 10 };

    if (chartType === 'score') {
      const total = allParsed.reduce((sum, p) => sum + (p.totalValue || p.totalCount), 0);
      return (
        <div className="flex flex-col items-center justify-center h-full gap-1">
          <span className="text-3xl font-bold text-foreground">{formatNumber(total)}</span>
          {allParsed[0]?.seriesName && (
            <span className="text-[10px] text-muted-foreground">{allParsed[0].seriesName}</span>
          )}
        </div>
      );
    }

    if (chartType === 'pie' || chartType === 'donut') {
      const pieData = allGroups.map((g) => ({ name: g.name, value: displayValue(g) })).filter(d => d.value > 0);
      if (pieData.length === 0) return <div className="flex items-center justify-center h-full text-xs text-muted-foreground">No data</div>;
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={chartType === 'donut' ? '40%' : 0}
              outerRadius="70%"
              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
              labelLine={false}
              fontSize={9}
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(val: number) => formatNumber(val)} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === 'table') {
      return (
        <div className="h-full overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-1 px-1 text-muted-foreground font-medium">Name</th>
                <th className="text-right py-1 px-1 text-muted-foreground font-medium">Count</th>
                <th className="text-right py-1 px-1 text-muted-foreground font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {allGroups.map((g, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  <td className="py-1 px-1 truncate max-w-[150px] text-foreground">{g.name}</td>
                  <td className="py-1 px-1 text-right font-mono text-muted-foreground">{formatNumber(g.count)}</td>
                  <td className="py-1 px-1 text-right font-mono text-muted-foreground">{formatNumber(g.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (chartType === 'top-list') {
      const sorted = [...allGroups].sort((a, b) => displayValue(b) - displayValue(a));
      const maxVal = Math.max(...sorted.map(displayValue), 1);
      return (
        <div className="h-full overflow-auto space-y-1 px-1">
          {sorted.map((g, i) => {
            const val = displayValue(g);
            const pct = (val / maxVal) * 100;
            return (
              <div key={i} className="space-y-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate text-foreground">{g.name}</span>
                  <span className="font-mono text-muted-foreground ml-2 shrink-0">{formatNumber(val)}</span>
                </div>
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (chartType === 'events-list') {
      return (
        <div className="h-full overflow-auto text-xs text-muted-foreground px-1">
          <p>Events list - {allGroups.length} groups</p>
        </div>
      );
    }

    if (timeseries.length === 0) {
      const barData = allGroups.map((g) => ({ name: g.name, value: displayValue(g) }));
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" {...axisStyle} tick={{ fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={40} />
            <YAxis {...axisStyle} tickFormatter={formatNumber} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" fillOpacity={0.8}>
              {barData.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === 'bar') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={timeseries}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="timestamp" tickFormatter={tickFormatter} {...axisStyle} />
            <YAxis {...axisStyle} tickFormatter={formatNumber} />
            <Tooltip content={<CustomTooltip />} />
            {groupNames.map((name, i) => (
              <Bar key={name} dataKey={name} stackId="a" fill={PIE_COLORS[i % PIE_COLORS.length]} fillOpacity={0.8} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={timeseries}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="timestamp" tickFormatter={tickFormatter} {...axisStyle} />
            <YAxis {...axisStyle} tickFormatter={formatNumber} />
            <Tooltip content={<CustomTooltip />} />
            {groupNames.map((name, i) => (
              <Line key={name} type="monotone" dataKey={name} stroke={PIE_COLORS[i % PIE_COLORS.length]} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={timeseries}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="timestamp" tickFormatter={tickFormatter} {...axisStyle} />
          <YAxis {...axisStyle} tickFormatter={formatNumber} />
          <Tooltip content={<CustomTooltip />} />
          {groupNames.map((name, i) => (
            <Area key={name} type="monotone" dataKey={name} stroke={PIE_COLORS[i % PIE_COLORS.length]} fill={PIE_COLORS[i % PIE_COLORS.length]} fillOpacity={0.15} strokeWidth={2} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  };

  const isTimeseriesType = ['area', 'line', 'bar'].includes(chartType) || (!['score', 'pie', 'donut', 'table', 'top-list', 'events-list'].includes(chartType));
  const groupNames = [...new Set(allGroups.map((g) => g.name))];
  const showLegend = isTimeseriesType && groupNames.length > 1;

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-1 pt-3 px-3 flex-shrink-0">
        <CardTitle className="text-xs font-medium truncate">{widget.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-2 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0">
          {renderChart()}
        </div>
        {showLegend && (
          <div className="flex-shrink-0 pt-1.5">
            <div className="flex items-center gap-x-2.5 gap-y-0.5 flex-wrap">
              {groupNames.slice(0, MAX_LEGEND_INLINE).map((name, i) => (
                <span key={name} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground max-w-[140px]">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-sm shrink-0"
                    style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <span className="truncate" title={name}>{name}</span>
                </span>
              ))}
              {groupNames.length > MAX_LEGEND_INLINE && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                      <ChevronDown className="h-2.5 w-2.5" />
                      +{groupNames.length - MAX_LEGEND_INLINE} more
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-56 p-0"
                    align="end"
                    side="top"
                    sideOffset={4}
                  >
                    <div className="max-h-48 overflow-y-auto p-2 space-y-0.5">
                      {groupNames.slice(MAX_LEGEND_INLINE).map((name, i) => (
                        <div key={name} className="flex items-center gap-1.5 text-[11px] text-muted-foreground py-0.5">
                          <span
                            className="inline-block h-2 w-2 rounded-sm shrink-0"
                            style={{ backgroundColor: PIE_COLORS[(i + MAX_LEGEND_INLINE) % PIE_COLORS.length] }}
                          />
                          <span className="truncate" title={name}>{name}</span>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
