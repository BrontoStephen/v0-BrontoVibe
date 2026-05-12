'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchLogs, search } from '@/lib/bronto-api';
import type { SearchParams } from '@/lib/bronto-types';
import type { TimeRange } from '@/lib/bronto-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Loader2, Search } from 'lucide-react';

export interface TraceSearchFilters {
  timeRange: TimeRange;
  service: string;
  operation: string;
  statusFilter: 'any' | 'error';
  minDuration: string;
  maxDuration: string;
  textSearch: string;
  advancedFilters: { key: string; operator: string; value: string }[];
}

export const defaultFilters: TraceSearchFilters = {
  timeRange: 'Last 1 hour',
  service: '',
  operation: '',
  statusFilter: 'any',
  minDuration: '',
  maxDuration: '',
  textSearch: '',
  advancedFilters: [],
};

interface TraceSearchProps {
  onSearch: (datasetIds: string[], filters: TraceSearchFilters) => void;
  isLoading: boolean;
  resultCount?: number;
  filters: TraceSearchFilters;
  onFiltersChange: (filters: TraceSearchFilters) => void;
  onReady?: (datasetIds: string[]) => void;
}

export function TraceSearch({ onSearch, isLoading, resultCount, filters, onFiltersChange, onReady }: TraceSearchProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Fetch logs to find .traces datasets
  const { data: logs = [] } = useQuery({
    queryKey: ['bronto-logs'],
    queryFn: () => fetchLogs(),
  });

  const traceDatasetIds = useMemo(() => {
    return logs.filter(l => (l.logset || '') === '.traces').map(l => l.log_id || l.id || '').filter(Boolean);
  }, [logs]);

  // Notify parent when datasets are loaded
  useEffect(() => {
    if (traceDatasetIds.length > 0 && onReady) {
      onReady(traceDatasetIds);
    }
  }, [traceDatasetIds, onReady]);

  const { data: servicesData } = useQuery({
    queryKey: ['trace-services', traceDatasetIds, filters.timeRange],
    queryFn: async () => {
      if (traceDatasetIds.length === 0) return [];
      const params: SearchParams = {
        from: traceDatasetIds,
        select: ['count(*)'],
        groups: ['"$service.name"'],
        where: '"$span.parent_span_id"=\'0000000000000000\'',
        time_range: filters.timeRange !== 'custom' ? filters.timeRange : 'Last 1 hour',
        limit: 1000,
      };
      const res = await search(params);
      const gs = res.groups_series as unknown as Array<{ name: string }> | undefined;
      return gs?.map(g => g.name).filter(Boolean).sort() ?? [];
    },
    enabled: traceDatasetIds.length > 0,
    staleTime: 60_000,
  });

  // Fetch operations for selected service
  const { data: operationsData } = useQuery({
    queryKey: ['trace-operations', traceDatasetIds, filters.timeRange, filters.service],
    queryFn: async () => {
      if (traceDatasetIds.length === 0) return [];
      const whereClause = filters.service
        ? `"$span.parent_span_id"='0000000000000000' AND "$service.name"='${filters.service}'`
        : '"$span.parent_span_id"=\'0000000000000000\'';
      const params: SearchParams = {
        from: traceDatasetIds,
        select: ['count(*)'],
        groups: ['"$span.name"'],
        where: whereClause,
        time_range: filters.timeRange !== 'custom' ? filters.timeRange : 'Last 1 hour',
        limit: 1000,
      };
      const res = await search(params);
      const gs = res.groups_series as unknown as Array<{ name: string }> | undefined;
      return gs?.map(g => g.name).filter(Boolean).sort() ?? [];
    },
    enabled: traceDatasetIds.length > 0,
    staleTime: 60_000,
  });

  const services = servicesData ?? [];
  const operations = operationsData ?? [];

  const handleSearch = useCallback(() => {
    onSearch(traceDatasetIds, filters);
  }, [onSearch, traceDatasetIds, filters]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  }, [handleSearch]);

  const update = useCallback((patch: Partial<TraceSearchFilters>) => {
    onFiltersChange({ ...filters, ...patch });
  }, [filters, onFiltersChange]);

  const addAdvancedFilter = () => {
    update({
      advancedFilters: [...filters.advancedFilters, { key: '', operator: '=', value: '' }],
    });
  };

  const removeAdvancedFilter = (index: number) => {
    update({
      advancedFilters: filters.advancedFilters.filter((_, i) => i !== index),
    });
  };

  const updateAdvancedFilter = (index: number, patch: Partial<{ key: string; operator: string; value: string }>) => {
    const updated = [...filters.advancedFilters];
    updated[index] = { ...updated[index], ...patch };
    update({ advancedFilters: updated });
  };

  return (
    <div className="space-y-3" onKeyDown={handleKeyDown}>
      {/* All controls in one row */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex-1 min-w-[150px]">
          <Input
            placeholder="Search attributes..."
            value={filters.textSearch}
            onChange={(e) => update({ textSearch: e.target.value })}
            className="h-8 text-xs"
          />
        </div>

        <Select value={filters.service || '_all'} onValueChange={(v) => update({ service: v === '_all' ? '' : v, operation: '' })}>
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue placeholder="All services" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All services</SelectItem>
            {services.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.operation || '_all'} onValueChange={(v) => update({ operation: v === '_all' ? '' : v })}>
          <SelectTrigger className="h-8 w-[200px] text-xs">
            <SelectValue placeholder="All operations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All operations</SelectItem>
            {operations.map((op) => (
              <SelectItem key={op} value={op}>{op}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.statusFilter} onValueChange={(v) => update({ statusFilter: v as 'any' | 'error' })}>
          <SelectTrigger className="h-8 w-auto min-w-[70px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any status</SelectItem>
            <SelectItem value="error">Errors only</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <Input
            placeholder="Min ms"
            value={filters.minDuration}
            onChange={(e) => update({ minDuration: e.target.value })}
            className="h-8 w-[80px] text-xs font-mono"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <Input
            placeholder="Max ms"
            value={filters.maxDuration}
            onChange={(e) => update({ maxDuration: e.target.value })}
            className="h-8 w-[80px] text-xs font-mono"
          />
        </div>

        <Button size="sm" className="h-8 text-xs" onClick={handleSearch} disabled={isLoading || traceDatasetIds.length === 0}>
          {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Search className="h-3.5 w-3.5 mr-1.5" />}
          Search
        </Button>
      </div>

      {/* Active filters as chips */}
      {filters.advancedFilters.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filters.advancedFilters.map((f, i) => (
            f.key && f.value ? (
              <Badge key={i} variant="secondary" className="text-xs gap-1 pr-1">
                <span className="font-mono">{f.key}{f.operator}{f.value}</span>
                <button onClick={() => removeAdvancedFilter(i)} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ) : null
          ))}
        </div>
      )}

      {/* Advanced filters toggle */}
      <div className="flex items-center gap-2">
        <button
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? '▾ Hide filters' : '▸ Add filters'}
        </button>
        {resultCount !== undefined && (
          <span className="text-xs text-muted-foreground ml-auto">
            {resultCount} trace{resultCount !== 1 ? 's' : ''} · {filters.timeRange}
          </span>
        )}
      </div>

      {/* Advanced filter builder */}
      {showAdvanced && (
        <div className="space-y-2 border border-border rounded-md p-3 bg-muted/20">
          {filters.advancedFilters.map((f, i) => (
            <div key={i} className="flex gap-1.5 items-center">
              <Input
                placeholder="key"
                value={f.key}
                onChange={(e) => updateAdvancedFilter(i, { key: e.target.value })}
                className="h-7 w-[140px] text-xs font-mono"
              />
              <Select value={f.operator} onValueChange={(v) => updateAdvancedFilter(i, { operator: v })}>
                <SelectTrigger className="h-7 w-[60px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="=">=</SelectItem>
                  <SelectItem value="!=">!=</SelectItem>
                  <SelectItem value="contains">contains</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="value"
                value={f.value}
                onChange={(e) => updateAdvancedFilter(i, { value: e.target.value })}
                className="h-7 flex-1 text-xs font-mono"
              />
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeAdvancedFilter(i)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addAdvancedFilter}>
            <Plus className="h-3 w-3 mr-1" /> Add filter
          </Button>
        </div>
      )}
    </div>
  );
}

/** Detect if a string looks like a trace ID (16-32 hex chars) */
function looksLikeTraceId(s: string): boolean {
  return /^[a-f0-9]{16,64}$/i.test(s.trim());
}

/** Build the WHERE clause from filters */
export function buildTraceWhere(filters: TraceSearchFilters): { where: string; isTraceIdLookup: boolean } {
  const textSearch = filters.textSearch.trim();

  // If the text search looks like a trace ID, search by trace ID directly (no root span filter)
  if (textSearch && looksLikeTraceId(textSearch)) {
    const clauses: string[] = [
      `"$span.trace_id"='${textSearch}' OR "$trace_id"='${textSearch}' OR "$otelTraceID"='${textSearch}' OR "trace_id"='${textSearch}'`,
    ];
    return { where: clauses[0], isTraceIdLookup: true };
  }

  const clauses: string[] = ['"$span.parent_span_id"=\'0000000000000000\''];

  if (filters.service) {
    clauses.push(`"$service.name"='${filters.service}'`);
  }
  if (filters.operation) {
    clauses.push(`"$span.name"='${filters.operation}'`);
  }
  if (filters.statusFilter === 'error') {
    clauses.push('"$span.status_code"=\'STATUS_CODE_ERROR\'');
  }
  if (filters.minDuration) {
    const nanos = parseFloat(filters.minDuration) * 1_000_000;
    if (Number.isFinite(nanos)) {
      clauses.push(`"$span.duration_nano">=${nanos}`);
    }
  }
  if (filters.maxDuration) {
    const nanos = parseFloat(filters.maxDuration) * 1_000_000;
    if (Number.isFinite(nanos)) {
      clauses.push(`"$span.duration_nano"<=${nanos}`);
    }
  }
  if (textSearch) {
    clauses.push(`'${textSearch}'`);
  }
  for (const f of filters.advancedFilters) {
    if (f.key && f.value) {
      clauses.push(`"${f.key}"${f.operator}'${f.value}'`);
    }
  }

  return { where: clauses.join(' AND '), isTraceIdLookup: false };
}
