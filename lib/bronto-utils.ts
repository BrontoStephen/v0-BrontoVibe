import type { GroupSeries, FlattenedSeries, SearchResponse, TimelineObject, TimelineEntry } from './bronto-types';

interface TimeseriesPoint {
  timestamp: number;
  count: number;
  [key: string]: number;
}

export interface NamedSeries {
  name: string;
  dataKey: string;
}

export function isPlainCount(aggregates?: string[]): boolean {
  if (!aggregates || aggregates.length === 0) return true;
  return aggregates.length === 1 && aggregates[0] === 'count(*)';
}

export function extractTimeseriesPoints(
  data?: SearchResponse,
  aggregates?: string[],
  groups?: string[]
): TimeseriesPoint[] {
  if (!data) return [];

  const multiAgg = aggregates && aggregates.length > 1;
  const hasNonCountAgg = aggregates && aggregates.length > 0 && !isPlainCount(aggregates);
  const plainCount = isPlainCount(aggregates);
  const hasGroups = groups && groups.length > 0;

  if (plainCount && !hasGroups && data.timeline && !Array.isArray(data.timeline)) {
    const tl = data.timeline as TimelineObject;
    if (tl.timeseries && tl.timeseries.length > 0) {
      return tl.timeseries.map((t) => ({
        timestamp: t['@timestamp'],
        count: t.count,
        info: t.info ?? 0,
        warning: t.warning ?? 0,
        error: t.error ?? 0,
      }));
    }
  }

  const gs = data.groups_series as unknown as GroupSeriesEntry[] | undefined;
  if (gs && gs.length > 0 && hasTimeseries(gs)) {
    return mergeGroupSeries(gs);
  }

  if (hasNonCountAgg && data.result && Array.isArray((data as unknown as Record<string, unknown>).result)) {
    const result = (data as unknown as Record<string, unknown>).result as Array<Record<string, unknown>>;
    if (result.length > 0 && result[0]['@timestamp'] != null) {
      return result.map((r) => {
        const firstAgg = aggregates![0];
        const point: TimeseriesPoint = {
          timestamp: Number(r['@timestamp']),
          count: Number(r['count(*)'] ?? r.count ?? r[firstAgg] ?? r.value ?? 0),
        };
        if (multiAgg) {
          for (const agg of aggregates!) {
            const key = sanitizeKey(agg);
            point[key] = Number(r[agg] ?? r[key] ?? 0);
          }
        } else {
          const val = r[firstAgg];
          if (val != null) point.count = Number(val);
        }
        return point;
      });
    }
  }

  if (data.timeline && !Array.isArray(data.timeline)) {
    const tl = data.timeline as TimelineObject;
    if (tl.timeseries && tl.timeseries.length > 0) {
      return tl.timeseries.map((t) => ({
        timestamp: t['@timestamp'],
        count: t.count,
      }));
    }
  }

  const totals = data.totals as Record<string, unknown> | undefined;
  if (totals?.timeseries && Array.isArray(totals.timeseries)) {
    const tsArr = totals.timeseries as Array<Record<string, unknown>>;
    return tsArr.map((t) => {
      const point: TimeseriesPoint = {
        timestamp: Number(t['@timestamp']),
        count: Number(t.count ?? t.value ?? 0),
      };
      if (multiAgg) {
        for (const agg of aggregates!) {
          const key = sanitizeKey(agg);
          point[key] = Number(t[agg] ?? t[key] ?? t[agg.toLowerCase()] ?? 0);
        }
      }
      return point;
    });
  }

  if (data.result && Array.isArray((data as unknown as Record<string, unknown>).result)) {
    const result = (data as unknown as Record<string, unknown>).result as Array<Record<string, unknown>>;
    if (result.length > 0 && result[0]['@timestamp'] != null) {
      return result.map((r) => ({
        timestamp: Number(r['@timestamp']),
        count: Number(r['count(*)'] ?? r.count ?? r.value ?? 0),
      }));
    }
  }

  if (data.timeline && Array.isArray(data.timeline) && data.timeline.length > 0) {
    return (data.timeline as TimelineEntry[]).map((t) => ({
      timestamp: (t as unknown as Record<string, unknown>)['@timestamp'] as number || t.start,
      count: t.count,
    }));
  }

  return [];
}

export function extractSeriesNames(
  data?: SearchResponse,
  aggregates?: string[],
  groups?: string[]
): NamedSeries[] {
  const hasGroups = groups && groups.length > 0;
  if (isPlainCount(aggregates) && !hasGroups && data?.timeline && !Array.isArray(data.timeline)) {
    const tl = data.timeline as TimelineObject;
    if (tl.timeseries && tl.timeseries.length > 0) {
      return [
        { name: 'Info', dataKey: 'info' },
        { name: 'Warning', dataKey: 'warning' },
        { name: 'Error', dataKey: 'error' },
      ];
    }
  }

  const gs = data?.groups_series as unknown as GroupSeriesEntry[] | undefined;
  if (gs && gs.length > 0 && hasTimeseries(gs)) {
    return collectLeafNames(gs);
  }

  if (aggregates && aggregates.length > 1) {
    return aggregates.map((agg) => ({
      name: agg,
      dataKey: sanitizeKey(agg),
    }));
  }

  return [];
}

function sanitizeKey(expr: string): string {
  return expr.replace(/[^a-zA-Z0-9_]/g, '_');
}

function normalizeName(name: string | undefined | null): string {
  if (name == null || name === '' || name === 'null' || name === 'undefined') return 'NULL';
  return name;
}

interface GroupSeriesEntry {
  key?: string;
  name: string;
  timeseries?: Array<{ '@timestamp': number; count: number; value: number }>;
  groups_series?: GroupSeriesEntry[];
  count?: number;
  value?: number;
  stat?: string;
  series_resolution_ms?: number;
}

function hasTimeseries(entries: GroupSeriesEntry[]): boolean {
  for (const e of entries) {
    if (e.timeseries && e.timeseries.length > 0) return true;
    if (e.groups_series && hasTimeseries(e.groups_series)) return true;
  }
  return false;
}

function collectLeafNames(entries: GroupSeriesEntry[], prefix = ''): NamedSeries[] {
  const result: NamedSeries[] = [];
  for (const e of entries) {
    const eName = normalizeName(e.name);
    const label = prefix ? `${prefix} > ${eName}` : eName;
    if (e.groups_series && e.groups_series.length > 0) {
      result.push(...collectLeafNames(e.groups_series, label));
    } else {
      const dataKey = label.replace(/[^a-zA-Z0-9_ >-]/g, '_');
      result.push({ name: label, dataKey });
    }
  }
  return result;
}

function collectLeafTimeseries(
  entries: GroupSeriesEntry[],
  prefix = ''
): Array<{ dataKey: string; timeseries: Array<{ '@timestamp': number; value: number }> }> {
  const result: Array<{ dataKey: string; timeseries: Array<{ '@timestamp': number; value: number }> }> = [];
  for (const e of entries) {
    const eName = normalizeName(e.name);
    const label = prefix ? `${prefix} > ${eName}` : eName;
    if (e.groups_series && e.groups_series.length > 0) {
      result.push(...collectLeafTimeseries(e.groups_series, label));
    } else if (e.timeseries) {
      const dataKey = label.replace(/[^a-zA-Z0-9_ >-]/g, '_');
      result.push({
        dataKey,
        timeseries: e.timeseries.map((t) => ({ '@timestamp': t['@timestamp'], value: Number(t.count ?? t.value ?? 0) })),
      });
    }
  }
  return result;
}

function mergeGroupSeries(entries: GroupSeriesEntry[]): TimeseriesPoint[] {
  const leaves = collectLeafTimeseries(entries);
  if (leaves.length === 0) return [];

  const pointMap = new Map<number, TimeseriesPoint>();
  for (const leaf of leaves) {
    for (const t of leaf.timeseries) {
      const ts = t['@timestamp'];
      if (!pointMap.has(ts)) {
        pointMap.set(ts, { timestamp: ts, count: 0 });
      }
      const point = pointMap.get(ts)!;
      point[leaf.dataKey] = t.value;
      point.count += t.value;
    }
  }

  return Array.from(pointMap.values()).sort((a, b) => a.timestamp - b.timestamp);
}

export function flattenGroupSeries(groups: GroupSeries[], prefix = ''): FlattenedSeries[] {
  const result: FlattenedSeries[] = [];
  for (const group of groups) {
    const name = prefix ? `${prefix} > ${group.name}` : group.name;
    if (group.series && group.series.length > 0) {
      result.push({ name, data: group.series, total: group.total });
    }
    if (group.groups && group.groups.length > 0) {
      result.push(...flattenGroupSeries(group.groups, name));
    }
  }
  return result;
}

export const TIME_RANGES = [
  'Last 5 minutes',
  'Last 15 minutes',
  'Last 30 minutes',
  'Last 1 hour',
  'Last 2 hours',
  'Last 6 hours',
  'Last 12 hours',
  'Last 24 hours',
  'Last 2 days',
  'Last 7 days',
  'Last 30 days',
] as const;

export type TimeRange = (typeof TIME_RANGES)[number] | 'custom';

export const AGGREGATE_OPTIONS = [
  { label: 'Average', value: 'average' },
  { label: 'Count', value: 'count' },
  { label: 'Max', value: 'max' },
  { label: 'Mean', value: 'mean' },
  { label: 'Median', value: 'median' },
  { label: 'Min', value: 'min' },
  { label: 'P75', value: 'p75' },
  { label: 'P90', value: 'p90' },
  { label: 'P95', value: 'p95' },
  { label: 'P99', value: 'p99' },
  { label: 'Sum', value: 'sum' },
] as const;
