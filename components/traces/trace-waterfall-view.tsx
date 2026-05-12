'use client';

import { useMemo, useState, useCallback } from 'react';
import type { SearchEvent } from '@/lib/bronto-types';
import {
  buildTraceSegments,
  formatDuration,
  getDescendants,
  SERVICE_COLORS,
} from '@/lib/trace-utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TraceWaterfallViewProps {
  events: SearchEvent[];
  isLoading: boolean;
  onSelectSpan?: (spanId: string) => void;
  selectedSpanId?: string | null;
}

function TimelineHeader({ totalDurationMs }: { totalDurationMs: number }) {
  const ticks = [0, 25, 50, 75, 100];
  return (
    <div className="flex items-end border-b border-border">
      <div className="shrink-0" style={{ width: 280 }}>
        <span className="text-[11px] font-medium text-muted-foreground px-3">Span</span>
      </div>
      <div className="flex-1 relative h-6 min-w-0">
        {ticks.map(pct => (
          <span
            key={pct}
            className="absolute bottom-0 text-[10px] text-muted-foreground font-mono -translate-x-1/2"
            style={{ left: `${pct}%` }}
          >
            {pct === 100 ? formatDuration(totalDurationMs) : `${pct}%`}
          </span>
        ))}
      </div>
    </div>
  );
}

export function TraceWaterfallView({ events, isLoading, onSelectSpan, selectedSpanId }: TraceWaterfallViewProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const { segments, totalDurationMs, serviceColorMap, childrenMap } = useMemo(() => {
    const { segments: segs, childrenMap: cm } = buildTraceSegments(events);
    const total = segs.length > 0 ? Math.max(...segs.map(s => s.offsetMs + s.durationMs)) || 1 : 1;
    const services = [...new Set(segs.map(s => s.service))];
    const colorMap = new Map(services.map((s, i) => [s, SERVICE_COLORS[i % SERVICE_COLORS.length]]));
    return { segments: segs, totalDurationMs: total, serviceColorMap: colorMap, childrenMap: cm };
  }, [events]);

  const toggleCollapse = useCallback((spanId: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(spanId)) next.delete(spanId);
      else next.add(spanId);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => setCollapsed(new Set()), []);
  const collapseAll = useCallback(() => {
    const withChildren = new Set<string>();
    for (const [id, children] of childrenMap.entries()) {
      if (children.length > 0) withChildren.add(id);
    }
    setCollapsed(withChildren);
  }, [childrenMap]);

  const hiddenIds = useMemo(() => {
    const hidden = new Set<string>();
    for (const cid of collapsed) {
      getDescendants(cid, childrenMap).forEach(d => hidden.add(d));
    }
    return hidden;
  }, [collapsed, childrenMap]);

  const visibleSegments = useMemo(() => segments.filter(s => !hiddenIds.has(s.id)), [segments, hiddenIds]);

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-4">
        No spans found for this trace.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Controls */}
      <div className="flex-shrink-0 px-3 py-1.5 border-b border-border flex items-center justify-between gap-4">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {[...serviceColorMap.entries()].map(([name, color]) => (
            <div key={name} className="flex items-center gap-1.5 text-xs">
              <div className={`w-2.5 h-2.5 rounded-sm ${color}`} />
              <span className="text-muted-foreground">{name}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap mr-2">
            {segments.length} span{segments.length !== 1 ? 's' : ''} · {formatDuration(totalDurationMs)}
          </span>
          <Button variant="ghost" size="sm" className="h-6 px-1.5" onClick={expandAll} title="Expand all">
            <ChevronsUpDown className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 px-1.5" onClick={collapseAll} title="Collapse all">
            <ChevronsDownUp className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <TimelineHeader totalDurationMs={totalDurationMs} />

      <ScrollArea className="flex-1 min-h-0">
        <div>
          {visibleSegments.map((seg) => {
            const leftPct = totalDurationMs > 0 ? (seg.offsetMs / totalDurationMs) * 100 : 0;
            const widthPct = totalDurationMs > 0 ? Math.max((seg.durationMs / totalDurationMs) * 100, 0.5) : 100;
            const color = serviceColorMap.get(seg.service) || 'bg-primary';
            const isSelected = selectedSpanId === seg.id;
            const isError = seg.status === 'error';
            const isCollapsed = collapsed.has(seg.id);

            return (
              <div
                key={seg.id}
                className={`flex items-stretch border-b border-border/30 cursor-pointer hover:bg-muted/50 transition-colors ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
                onClick={() => onSelectSpan?.(seg.id)}
              >
                <div
                  className="shrink-0 flex items-start gap-1 py-2 pr-2 border-r border-border/40"
                  style={{ width: 280, paddingLeft: 8 + seg.depth * 16 }}
                >
                  {seg.hasChildren ? (
                    <button
                      className="shrink-0 mt-0.5 p-0 text-muted-foreground hover:text-foreground"
                      onClick={(e) => { e.stopPropagation(); toggleCollapse(seg.id); }}
                    >
                      {isCollapsed
                        ? <ChevronRight className="h-3.5 w-3.5" />
                        : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  ) : (
                    <span className="shrink-0 w-3.5" />
                  )}
                  <div className="min-w-0 overflow-hidden">
                    <div className={`text-xs font-medium truncate ${isError ? 'text-destructive' : 'text-foreground'}`} title={seg.name}>
                      {seg.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate" title={seg.service}>
                      {seg.service}
                    </div>
                  </div>
                </div>

                <div className="flex-1 relative min-w-0 py-1.5">
                  <div
                    className={`absolute top-2 h-4 rounded-sm ${isError ? 'bg-destructive' : color} opacity-80`}
                    style={{
                      left: `${leftPct}%`,
                      width: `${Math.max(widthPct, 0.3)}%`,
                    }}
                  />
                  {seg.durationMs > 0 && (
                    <span
                      className="absolute top-7 text-[10px] text-muted-foreground font-mono"
                      style={{ left: `${leftPct}%` }}
                    >
                      {formatDuration(seg.durationMs)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
