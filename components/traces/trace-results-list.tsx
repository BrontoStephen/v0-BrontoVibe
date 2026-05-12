'use client';

import { useMemo, useState, useCallback } from 'react';
import type { ProcessedTrace } from '@/lib/trace-utils';
import { formatDuration, formatRelativeTime } from '@/lib/trace-utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, ArrowUpDown, Clock, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type SortField = 'timestamp' | 'duration';
type SortDir = 'asc' | 'desc';

interface TraceResultsListProps {
  results: ProcessedTrace[];
  isLoading: boolean;
  selectedTraceId: string | null;
  onSelectTrace: (result: ProcessedTrace) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

export function TraceResultsList({
  results,
  isLoading,
  selectedTraceId,
  onSelectTrace,
  onLoadMore,
  hasMore,
  isLoadingMore,
}: TraceResultsListProps) {
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [focusIndex, setFocusIndex] = useState(-1);

  const sorted = useMemo(() => {
    if (!results || !Array.isArray(results)) return [];
    const copy = [...results];
    copy.sort((a, b) => {
      const mul = sortDir === 'desc' ? -1 : 1;
      if (sortField === 'timestamp') return (a.timestamp - b.timestamp) * mul;
      return (a.durationMs - b.durationMs) * mul;
    });
    return copy;
  }, [results, sortField, sortDir]);

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }, [sortField]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusIndex(i => Math.min(i + 1, sorted.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && focusIndex >= 0 && focusIndex < sorted.length) {
      onSelectTrace(sorted[focusIndex]);
    }
  }, [sorted, focusIndex, onSelectTrace]);

  if (isLoading) {
    return (
      <div className="space-y-1 p-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <div className="rounded-full bg-muted p-3">
          <Layers className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">No traces found</p>
          <p className="text-xs text-muted-foreground max-w-[240px]">
            Try widening the time range, removing filters, or selecting a different service.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Column header */}
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 px-3 py-1.5 border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider flex-shrink-0">
        <span className="text-left">Operation</span>
        <span className="text-center">Service</span>
        <span className="text-center">Spans</span>
        <span className="cursor-pointer hover:text-foreground inline-flex items-center justify-center gap-0.5" onClick={() => toggleSort('timestamp')}>
          <Clock className="h-3 w-3" /> Time
          {sortField === 'timestamp' && <ArrowUpDown className="h-2.5 w-2.5" />}
        </span>
        <span className="cursor-pointer hover:text-foreground text-right inline-flex items-center gap-0.5 justify-end" onClick={() => toggleSort('duration')}>
          Duration
          {sortField === 'duration' && <ArrowUpDown className="h-2.5 w-2.5" />}
        </span>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div>
          {sorted.map((trace, i) => (
            <button
              key={`${trace.traceId}-${i}`}
              className={`w-full text-left px-3 py-2 transition-colors border-b border-transparent grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 ${
                selectedTraceId === trace.traceId
                  ? 'bg-primary/10 border-b-primary/20'
                  : focusIndex === i
                    ? 'bg-muted/70'
                    : 'hover:bg-muted/50'
              }`}
              onClick={() => { onSelectTrace(trace); setFocusIndex(i); }}
            >
              {/* Operation */}
              <div className="min-w-0 flex items-center gap-1.5 justify-start">
                <span className="text-xs font-medium text-foreground truncate">{trace.rootSpanName}</span>
                {trace.hasError && (
                  <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4 shrink-0">
                    <AlertCircle className="h-2.5 w-2.5 mr-0.5" /> Error
                  </Badge>
                )}
              </div>

              {/* Service */}
              <span className="text-[11px] text-muted-foreground truncate text-center">{trace.service}</span>

              {/* Spans */}
              <span className="text-[11px] text-muted-foreground text-center font-mono">
                {trace.spanCount}
              </span>

              {/* Time */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap text-center block">
                    {formatRelativeTime(trace.timestamp)}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <span className="font-mono text-xs">{new Date(trace.timestamp).toLocaleString()}</span>
                </TooltipContent>
              </Tooltip>

              {/* Duration */}
              <span className="text-xs font-mono font-semibold text-foreground text-right">
                {formatDuration(trace.durationMs)}
              </span>
            </button>
          ))}
          {hasMore && (
            <div className="py-2 text-center">
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={onLoadMore} disabled={isLoadingMore}>
                {isLoadingMore ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
