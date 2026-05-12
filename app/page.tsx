'use client';

import { Suspense, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { search, fetchLogs, fetchNextPage } from '@/lib/bronto-api';
import type { SearchParams } from '@/lib/bronto-types';
import type { TimeRange } from '@/lib/bronto-utils';
import { SearchControls, type SearchState } from '@/components/search/search-controls';
import { ViewModeSwitcher } from '@/components/search/view-mode-switcher';
import { TimeRangePicker } from '@/components/search/time-range-picker';
import { EventsTable } from '@/components/events/events-table';
import { Histogram } from '@/components/charts/histogram';
import { SummaryInline } from '@/components/charts/summary-cards';
import { ContextViewer } from '@/components/events/context-viewer';
import { useHeaderSlot } from '@/lib/header-slot-context';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Database, Loader2 } from 'lucide-react';
import { VIEW_MODES, type ViewMode } from '@/lib/view-modes';
import { translateQuery, translateBetweenModes } from '@/lib/query-translators';

// Wrapper component to handle Suspense for useSearchParams
export default function SearchPageWrapper() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <SearchPage />
    </Suspense>
  );
}

const defaultState: SearchState = {
  datasets: [],
  fromExpr: '',
  timeRange: 'Last 1 hour',
  where: '',
  aggregates: [],
  groups: [],
  numSlices: 60,
};

const DEFAULT_DATASET_PATTERNS = ['audit_trail', 'audit-trail', 'audit trail', '.usage', '.traces', '.metrics', 'usage', 'traces', 'metrics'];

function SearchPage() {
  const { setSlot } = useHeaderSlot();
  const urlParams = useSearchParams();

  const initialState = useMemo<SearchState>(() => {
    if (!urlParams) return defaultState;
    const where = urlParams.get('where');
    const fromTs = urlParams.get('from_ts');
    const toTs = urlParams.get('to_ts');
    if (where || fromTs) {
      return {
        ...defaultState,
        where: where ?? '',
        timeRange: fromTs && toTs ? ('custom' as TimeRange) : defaultState.timeRange,
        fromTs: fromTs ? Number(fromTs) : undefined,
        toTs: toTs ? Number(toTs) : undefined,
      };
    }
    return defaultState;
  }, [urlParams]);

  const [searchState, setSearchState] = useState<SearchState>(initialState);
  const [submitted, setSubmitted] = useState<SearchState | null>(null);
  const [mostRecentFirst, setMostRecentFirst] = useState(true);
  const [contextUrl, setContextUrl] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const { data: allLogs = [] } = useQuery({
    queryKey: ['bronto-logs'],
    queryFn: () => fetchLogs(),
  });

  const didAutoSelect = useRef(false);
  useEffect(() => {
    if (allLogs.length > 0 && !didAutoSelect.current) {
      didAutoSelect.current = true;
      const flatten = (items: typeof allLogs): typeof allLogs => {
        const result: typeof allLogs = [];
        for (const item of items) {
          if (item.log_id) result.push(item);
          if (item.logs) result.push(...flatten(item.logs));
        }
        return result;
      };
      const flat = flatten(allLogs);
      const defaultIds = flat
        .filter((l) => {
          const name = (l.log || l.name || '').toLowerCase().replace(/[.\s-]/g, '_');
          return DEFAULT_DATASET_PATTERNS.some((n) => name.includes(n.toLowerCase().replace(/[.\s-]/g, '_')));
        })
        .map((l) => l.log_id || l.id || '')
        .filter(Boolean);
      const selectedIds = defaultIds.length > 0 ? defaultIds : [];
      const stateWithDatasets = { ...searchState, datasets: selectedIds };
      setSearchState(stateWithDatasets);
      if (selectedIds.length > 0) setSubmitted(stateWithDatasets);
    }
  }, [allLogs, searchState]);

  const [viewMode, setViewMode] = useState<ViewMode>('bronto');
  const modeConfig = VIEW_MODES[viewMode];

  const handleViewModeChange = useCallback(
    (newMode: ViewMode) => {
      setSearchState((prev) => ({
        ...prev,
        where: translateBetweenModes(prev.where, viewMode, newMode),
      }));
      setViewMode(newMode);
    },
    [viewMode]
  );

  // Auto-refresh when time range changes
  const prevTimeRange = useRef(searchState.timeRange);
  useEffect(() => {
    if (prevTimeRange.current !== searchState.timeRange && submitted && searchState.datasets.length > 0) {
      prevTimeRange.current = searchState.timeRange;
      setSubmitted({ ...searchState });
    } else {
      prevTimeRange.current = searchState.timeRange;
    }
  }, [searchState.timeRange, submitted, searchState]);

  useEffect(() => {
    setSlot(
      <div className="flex items-center gap-2">
        <ViewModeSwitcher value={viewMode} onChange={handleViewModeChange} />
        <TimeRangePicker value={searchState.timeRange} onChange={(timeRange) => setSearchState((s) => ({ ...s, timeRange }))} />
      </div>
    );
    return () => setSlot(null);
  }, [searchState.timeRange, viewMode, handleViewModeChange, setSlot]);

  const buildParams = useCallback(
    (state: SearchState): SearchParams => {
      const translatedWhere = state.where ? translateQuery(state.where, viewMode) : undefined;
      return {
        from: state.datasets,
        time_range: state.timeRange !== 'custom' ? state.timeRange : undefined,
        from_ts: state.fromTs,
        to_ts: state.toTs,
        where: translatedWhere || undefined,
        select: ['*', '@raw'],
        most_recent_first: mostRecentFirst,
        timeline_enabled: true,
      };
    },
    [viewMode, mostRecentFirst]
  );

  const eventsQuery = useQuery({
    queryKey: ['bronto-events', submitted, mostRecentFirst],
    queryFn: () => {
      const params = buildParams(submitted!);
      return search(params);
    },
    enabled: !!submitted && submitted.datasets.length > 0,
  });

  const handleSearch = useCallback(() => {
    if (searchState.datasets.length === 0) {
      toast.error('Select at least one dataset');
      return;
    }
    setSubmitted({ ...searchState });
  }, [searchState]);

  const handleLoadMore = async () => {
    const url = eventsQuery.data?.pagination?.next_page_url;
    if (!url) return;
    setLoadingMore(true);
    try {
      const more = await fetchNextPage(url);
      eventsQuery.data!.events = [...(eventsQuery.data!.events || []), ...(more.events || [])];
      eventsQuery.data!.pagination = more.pagination;
    } catch (err: unknown) {
      toast.error('Failed to load more', { description: String(err) });
    }
    setLoadingMore(false);
  };

  return (
    <div className="flex flex-col h-full min-h-0 min-w-0 w-full gap-4">
      <div className="flex-shrink-0">
        <SearchControls state={searchState} onChange={setSearchState} onSearch={handleSearch} isLoading={eventsQuery.isFetching} viewMode={viewMode} />
      </div>

      {!submitted && (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-16">
          <div className="rounded-full bg-muted p-4">
            <Database className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-foreground">No dataset selected</h3>
            <p className="text-sm text-muted-foreground max-w-sm">Select one or more datasets above, then hit search to explore your logs.</p>
          </div>
        </div>
      )}

      {submitted && (
        <>
          <div className="flex-shrink-0 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-4">
              <SummaryInline 
                totals={eventsQuery.data?.totals} 
                aggregates={submitted?.aggregates?.length ? submitted.aggregates : undefined} 
                explain={eventsQuery.data?.explain as Record<string, string> | undefined} 
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col overflow-hidden gap-4">
            {eventsQuery.isError && (
              <Alert variant="destructive" className="flex-shrink-0">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Query failed: {eventsQuery.error instanceof Error ? eventsQuery.error.message : String(eventsQuery.error)}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex-shrink-0">
              <Histogram 
                data={eventsQuery.data} 
                isLoading={eventsQuery.isLoading} 
                barColor={modeConfig.histogramColor} 
              />
            </div>

            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <EventsTable
                data={eventsQuery.data}
                isLoading={eventsQuery.isLoading}
                onLoadMore={handleLoadMore}
                isLoadingMore={loadingMore}
                onViewContext={setContextUrl}
                mostRecentFirst={mostRecentFirst}
                onToggleSort={() => setMostRecentFirst((v) => !v)}
                timeRange={submitted?.timeRange}
              />
            </div>
          </div>
        </>
      )}

      <ContextViewer contextUrl={contextUrl} onClose={() => setContextUrl(null)} />
    </div>
  );
}
