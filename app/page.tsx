'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { search, fetchLogs } from '@/lib/bronto-api';
import type { SearchParams, SearchResponse, SearchEvent } from '@/lib/bronto-types';
import type { TimeRange } from '@/lib/bronto-utils';
import { SearchControls, type SearchState } from '@/components/search/search-controls';
import { ViewModeSwitcher } from '@/components/search/view-mode-switcher';
import { TimeRangePicker } from '@/components/search/time-range-picker';
import { useHeaderSlot } from '@/lib/header-slot-context';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { VIEW_MODES, type ViewMode } from '@/lib/view-modes';
import { translateQuery, translateBetweenModes } from '@/lib/query-translators';

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

export default function SearchPage() {
  const { setSlot } = useHeaderSlot();
  const urlParams = useSearchParams();

  const initialState = useMemo<SearchState>(() => {
    const where = urlParams?.get('where');
    const fromTs = urlParams?.get('from_ts');
    const toTs = urlParams?.get('to_ts');
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
        most_recent_first: true,
        timeline_enabled: true,
      };
    },
    [viewMode]
  );

  const eventsQuery = useQuery({
    queryKey: ['bronto-events', submitted],
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

  const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleString();
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
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {eventsQuery.isError && (
            <Alert variant="destructive" className="flex-shrink-0 mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Query failed: {eventsQuery.error instanceof Error ? eventsQuery.error.message : String(eventsQuery.error)}
              </AlertDescription>
            </Alert>
          )}

          {eventsQuery.isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}

          {eventsQuery.data && (
            <div className="flex-1 min-h-0 overflow-hidden">
              <Card className="h-full flex flex-col">
                <CardHeader className="py-3 flex-shrink-0">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>Events</span>
                    <Badge variant="secondary">{eventsQuery.data.events?.length || 0} results</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 min-h-0 p-0">
                  <ScrollArea className="h-full">
                    <div className="space-y-2 p-4 pt-0">
                      {eventsQuery.data.events?.map((event: SearchEvent, idx: number) => (
                        <div key={idx} className="rounded-lg border border-border p-3 text-xs font-mono bg-muted/30 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-muted-foreground">{formatTimestamp(event.timestamp)}</span>
                            {event.metadata?.context && (
                              <Button variant="ghost" size="sm" className="h-5 text-[10px]">
                                Context
                              </Button>
                            )}
                          </div>
                          <div className="whitespace-pre-wrap break-all text-foreground">{event.message || JSON.stringify(event, null, 2)}</div>
                        </div>
                      ))}
                      {(!eventsQuery.data.events || eventsQuery.data.events.length === 0) && (
                        <div className="text-center py-8 text-muted-foreground">No events found for this query.</div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
