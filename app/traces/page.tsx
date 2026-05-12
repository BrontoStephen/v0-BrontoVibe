'use client';

import { Suspense, useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { search } from '@/lib/bronto-api';
import type { SearchParams, BrontoEvent } from '@/lib/bronto-types';
import type { TimeRange } from '@/lib/bronto-utils';
import { TraceSearch, defaultFilters, buildTraceWhere, type TraceSearchFilters } from '@/components/traces/trace-search';
import { TraceResultsList } from '@/components/traces/trace-results-list';
import { TraceDetailViewer } from '@/components/traces/trace-detail-viewer';
import { TraceDurationHeatmap } from '@/components/traces/trace-duration-heatmap';
import { TimeRangePicker } from '@/components/search/time-range-picker';
import { useHeaderSlot } from '@/lib/header-slot-context';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Network, Loader2 } from 'lucide-react';
import { groupSpansByTraceId, type ProcessedTrace } from '@/lib/trace-utils';

export default function TracesPageWrapper() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <TracesPage />
    </Suspense>
  );
}

function TracesPage() {
  const { setSlot } = useHeaderSlot();
  const urlParams = useSearchParams();

  const [filters, setFilters] = useState<TraceSearchFilters>(() => {
    if (!urlParams) return defaultFilters;
    const traceId = urlParams.get('trace_id');
    if (traceId) {
      return { ...defaultFilters, textSearch: traceId };
    }
    return defaultFilters;
  });

  const [datasetIds, setDatasetIds] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState<{ datasetIds: string[]; filters: TraceSearchFilters } | null>(null);
  const [selectedTrace, setSelectedTrace] = useState<ProcessedTrace | null>(null);

  // Auto-search when datasets are ready and we have a trace ID from URL
  const didAutoSearch = useRef(false);
  const handleReady = useCallback((ids: string[]) => {
    setDatasetIds(ids);
    if (!didAutoSearch.current && filters.textSearch && ids.length > 0) {
      didAutoSearch.current = true;
      setSubmitted({ datasetIds: ids, filters });
    }
  }, [filters]);

  const handleSearch = useCallback((ids: string[], f: TraceSearchFilters) => {
    setDatasetIds(ids);
    setSubmitted({ datasetIds: ids, filters: f });
    setSelectedTrace(null);
  }, []);

  // Header slot with time range picker
  useEffect(() => {
    setSlot(
      <div className="flex items-center gap-2">
        <TimeRangePicker 
          value={filters.timeRange} 
          onChange={(timeRange) => setFilters(prev => ({ ...prev, timeRange }))} 
        />
      </div>
    );
    return () => setSlot(null);
  }, [filters.timeRange, setSlot]);

  // Query for traces
  const tracesQuery = useQuery({
    queryKey: ['traces', submitted],
    queryFn: async () => {
      if (!submitted || submitted.datasetIds.length === 0) return null;
      
      const { where, isTraceIdLookup } = buildTraceWhere(submitted.filters);
      
      const params: SearchParams = {
        from: submitted.datasetIds,
        where,
        select: ['*', '@raw'],
        time_range: submitted.filters.timeRange !== 'custom' ? submitted.filters.timeRange : undefined,
        limit: isTraceIdLookup ? 1000 : 100,
        most_recent_first: true,
      };

      const res = await search(params);
      const events = (res.events || []) as BrontoEvent[];
      
      // Group spans by trace ID
      const traces = groupSpansByTraceId(events);
      return { traces, events, isTraceIdLookup };
    },
    enabled: !!submitted && submitted.datasetIds.length > 0,
  });

  const traces = tracesQuery.data?.traces ?? [];
  const isTraceIdLookup = tracesQuery.data?.isTraceIdLookup ?? false;

  // Auto-select trace when doing a trace ID lookup
  useEffect(() => {
    if (isTraceIdLookup && traces.length === 1 && !selectedTrace) {
      setSelectedTrace(traces[0]);
    }
  }, [isTraceIdLookup, traces, selectedTrace]);

  return (
    <div className="flex flex-col h-full min-h-0 min-w-0 w-full gap-4">
      <div className="flex-shrink-0">
        <TraceSearch
          filters={filters}
          onFiltersChange={setFilters}
          onSearch={handleSearch}
          onReady={handleReady}
          isLoading={tracesQuery.isLoading}
          resultCount={traces.length}
        />
      </div>

      {!submitted && datasetIds.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-12">
          <div className="rounded-full bg-muted p-4">
            <Network className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-foreground">No trace datasets found</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Make sure you have .traces datasets in your Bronto account to explore distributed traces.
            </p>
          </div>
        </div>
      )}

      {!submitted && datasetIds.length > 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-12">
          <div className="rounded-full bg-muted p-4">
            <Network className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-foreground">Search for traces</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Use the filters above to search for traces by service, operation, duration, or attributes.
            </p>
          </div>
        </div>
      )}

      {submitted && tracesQuery.isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {tracesQuery.error instanceof Error ? tracesQuery.error.message : 'Failed to fetch traces'}
          </AlertDescription>
        </Alert>
      )}

      {submitted && !tracesQuery.isError && (
        <div className="flex-1 min-h-0 flex gap-4 overflow-hidden">
          {/* Left panel: trace list with optional heatmap */}
          <div className="w-1/3 min-w-[300px] max-w-[450px] flex flex-col gap-3 overflow-hidden">
            {!isTraceIdLookup && traces.length > 0 && (
              <div className="flex-shrink-0">
                <TraceDurationHeatmap
                  traces={traces}
                  selectedTraceId={selectedTrace?.traceId}
                  onSelect={(traceId) => {
                    const t = traces.find(tr => tr.traceId === traceId);
                    if (t) setSelectedTrace(t);
                  }}
                />
              </div>
            )}
            <div className="flex-1 min-h-0 overflow-auto">
              <TraceResultsList
                results={traces}
                isLoading={tracesQuery.isLoading}
                selectedTraceId={selectedTrace?.traceId ?? null}
                onSelectTrace={setSelectedTrace}
              />
            </div>
          </div>

          {/* Right panel: trace detail viewer */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {selectedTrace ? (
              <TraceDetailViewer
                trace={selectedTrace}
                datasetIds={datasetIds}
                timeRange={filters.timeRange}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Select a trace to view details
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
