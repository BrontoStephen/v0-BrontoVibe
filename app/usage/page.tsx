'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchUsageByLogs, type UsageResponse, fetchLogs } from '@/lib/bronto-api';
import type { BrontoLog } from '@/lib/bronto-types';
import type { TimeRange } from '@/lib/bronto-utils';
import { TimeRangePicker } from '@/components/search/time-range-picker';
import { useHeaderSlot } from '@/lib/header-slot-context';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { HardDriveDownload, Search, ArrowUpDown, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';

type UsageType = 'ingestion' | 'search';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function extractTimeseries(data?: UsageResponse) {
  if (!data?.groups_series) return [];
  const pointMap = new Map<number, Record<string, number>>();

  for (const group of data.groups_series) {
    if (!group.timeseries) continue;
    for (const t of group.timeseries) {
      const ts = Number(t['@timestamp']);
      if (!pointMap.has(ts)) pointMap.set(ts, { timestamp: ts });
      const point = pointMap.get(ts)!;
      point[group.name] = t.value;
      point._total = (point._total || 0) + t.value;
    }
  }

  return Array.from(pointMap.values()).sort((a, b) => a.timestamp - b.timestamp);
}

function UsageCards({ data, type, searchBytes }: { data?: UsageResponse; type: UsageType; searchBytes: number }) {
  const totalValue = data?.groups_series?.reduce((sum, g) => sum + (g.value || 0), 0) ?? 0;
  const datasetCount = data?.groups_series?.length ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total {type === 'ingestion' ? 'Ingested' : 'Searched'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{formatBytes(totalValue)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Datasets</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{datasetCount}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Bytes Searched</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{formatBytes(searchBytes)}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function UsageChart({ data, nameMap }: { data?: UsageResponse; nameMap: Map<string, string> }) {
  const points = extractTimeseries(data);
  const groups = data?.groups_series?.map((g) => g.name) ?? [];

  if (points.length === 0) return null;

  const COLORS = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Usage Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(v) => format(new Date(v), 'MMM d HH:mm')}
                className="text-xs fill-muted-foreground"
                tick={{ fontSize: 11 }}
              />
              <YAxis
                tickFormatter={(v) => formatBytes(v)}
                className="text-xs fill-muted-foreground"
                tick={{ fontSize: 11 }}
                width={80}
              />
              <Tooltip
                labelFormatter={(v) => format(new Date(v as number), 'PPpp')}
                formatter={(v: number, name: string) => [formatBytes(v), nameMap.get(name) || name]}
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 'var(--radius)',
                  color: 'hsl(var(--popover-foreground))',
                }}
              />
              {groups.slice(0, 10).map((name, i) => (
                <Area
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stackId="1"
                  stroke={COLORS[i % COLORS.length]}
                  fill={COLORS[i % COLORS.length]}
                  fillOpacity={0.3}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

type SortKey = 'name' | 'value' | 'count';
type SortDir = 'asc' | 'desc';

function UsageTable({
  data,
  type,
  nameMap,
}: {
  data?: UsageResponse;
  type: UsageType;
  nameMap: Map<string, string>;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('value');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const groups = data?.groups_series ?? [];
  const sorted = useMemo(() => {
    const arr = [...groups];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'name': {
          const na = (nameMap.get(a.name) || a.name).toLowerCase();
          const nb = (nameMap.get(b.name) || b.name).toLowerCase();
          return na < nb ? -dir : na > nb ? dir : 0;
        }
        case 'value':
          return ((a.value || 0) - (b.value || 0)) * dir;
        case 'count':
          return ((a.count || 0) - (b.count || 0)) * dir;
        default:
          return 0;
      }
    });
    return arr;
  }, [groups, sortKey, sortDir, nameMap]);

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="h-3 w-3 ml-0.5 opacity-40" />;
    return sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-0.5" />
      : <ArrowDown className="h-3 w-3 ml-0.5" />;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Usage by Dataset</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="py-2.5 h-auto text-xs cursor-pointer select-none" onClick={() => toggleSort('name')}>
                <span className="inline-flex items-center">Dataset {sortIcon('name')}</span>
              </TableHead>
              <TableHead className="text-right py-2.5 h-auto text-xs cursor-pointer select-none" onClick={() => toggleSort('value')}>
                <span className="inline-flex items-center justify-end">{type === 'ingestion' ? 'Ingested' : 'Searched'} {sortIcon('value')}</span>
              </TableHead>
              <TableHead className="text-right py-2.5 h-auto text-xs cursor-pointer select-none" onClick={() => toggleSort('count')}>
                <span className="inline-flex items-center justify-end">Events {sortIcon('count')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-2">
                  No usage data
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((g) => (
                <TableRow key={g.name}>
                  <TableCell className="font-medium py-2.5">{nameMap.get(g.name) || g.name}</TableCell>
                  <TableCell className="text-right font-mono py-2.5">
                    {formatBytes(g.value || 0)}
                  </TableCell>
                  <TableCell className="text-right font-mono py-2.5">
                    {(g.count || 0).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-[340px]" />
      <Skeleton className="h-[300px]" />
    </div>
  );
}

export default function UsagePageWrapper() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <UsagePage />
    </Suspense>
  );
}

function UsagePage() {
  const [usageType, setUsageType] = useState<UsageType>('ingestion');
  const [timeRange, setTimeRange] = useState<TimeRange>('Last 7 days');

  const { setSlot } = useHeaderSlot();

  useEffect(() => {
    setSlot(
      <div className="flex items-center gap-2">
        <Tabs value={usageType} onValueChange={(v) => setUsageType(v as UsageType)}>
          <TabsList className="h-8">
            <TabsTrigger value="ingestion" className="gap-1 text-xs h-6 px-2">
              <HardDriveDownload className="h-3 w-3" />
              Ingestion
            </TabsTrigger>
            <TabsTrigger value="search" className="gap-1 text-xs h-6 px-2">
              <Search className="h-3 w-3" />
              Search
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <TimeRangePicker value={timeRange} onChange={setTimeRange} />
      </div>
    );
    return () => setSlot(null);
  }, [timeRange, usageType, setSlot]);

  const { data: logs } = useQuery({
    queryKey: ['logs'],
    queryFn: ({ signal }) => fetchLogs(signal),
    staleTime: 5 * 60_000,
  });

  const nameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!logs) return map;
    const walk = (items: BrontoLog[]) => {
      for (const item of items) {
        if (item.log_id && item.log) map.set(item.log_id, item.log);
        if (item.logs) walk(item.logs);
      }
    };
    walk(logs);
    return map;
  }, [logs]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['usage', usageType, timeRange],
    queryFn: ({ signal }) => fetchUsageByLogs(usageType, timeRange, undefined, undefined, 60, signal),
    retry: (failureCount, error) => {
      // Don't retry on 403 (permission denied)
      if ((error as { status?: number })?.status === 403) return false;
      return failureCount < 3;
    },
  });

  const isPermissionError = (error as { status?: number })?.status === 403;

  const { data: searchUsageData } = useQuery({
    queryKey: ['usage-search-bytes', timeRange],
    queryFn: ({ signal }) => fetchUsageByLogs('search', timeRange, undefined, undefined, 1, signal),
    staleTime: 60_000,
  });
  const searchBytes = searchUsageData?.groups_series?.reduce((sum, g) => sum + (g.value || 0), 0) ?? 0;

  return (
    <div className="flex flex-col gap-4 h-full overflow-auto">
      {isLoading ? (
        <LoadingSkeleton />
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center">
            {isPermissionError ? (
              <div className="flex flex-col items-center">
                <HardDriveDownload className="h-10 w-10 mb-3 text-muted-foreground opacity-50" />
                <p className="text-sm font-medium text-foreground mb-1">Usage data not available</p>
                <p className="text-xs text-muted-foreground">Your API key does not have access to usage data. Contact your Bronto administrator to enable this feature.</p>
              </div>
            ) : (
              <p className="text-destructive">{error instanceof Error ? error.message : 'Failed to load usage data'}</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <UsageCards
            data={data}
            type={usageType}
            searchBytes={searchBytes}
          />
          <UsageChart data={data} nameMap={nameMap} />
          <UsageTable data={data} type={usageType} nameMap={nameMap} />
        </div>
      )}
    </div>
  );
}
