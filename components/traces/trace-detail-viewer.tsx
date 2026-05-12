'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { fetchLogs, search } from '@/lib/bronto-api';
import type { SearchParams } from '@/lib/bronto-types';
import type { TraceSearchResult } from '@/lib/trace-utils';
import { formatDuration, toTraceSpanNodes } from '@/lib/trace-utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Copy, FileText, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { TraceWaterfallView } from './trace-waterfall-view';
import { SpansTable } from './spans-table';
import { TraceMetadata } from './trace-metadata';
import { SpanInspector } from './span-inspector';
import { Skeleton } from '@/components/ui/skeleton';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';

interface TraceDetailViewerProps {
  trace: TraceSearchResult;
  onClose: () => void;
  onFindSimilar?: (service: string, operation: string) => void;
}

export function TraceDetailViewer({ trace, onClose, onFindSimilar }: TraceDetailViewerProps) {
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('waterfall');
  const router = useRouter();

  // Fetch all datasets
  const { data: logs = [] } = useQuery({
    queryKey: ['bronto-logs'],
    queryFn: () => fetchLogs(),
  });

  const traceDatasetIds = useMemo(() => {
    return logs.filter(l => (l.logset || '') === '.traces').map(l => l.log_id || l.id || '').filter(Boolean);
  }, [logs]);

  // Fetch all spans for this trace
  const { data, isLoading } = useQuery({
    queryKey: ['trace-detail', trace.traceId, traceDatasetIds],
    queryFn: () => {
      const params: SearchParams = {
        from: traceDatasetIds,
        select: ['*', '@raw'],
        limit: 1000,
        where: `"$span.trace_id"='${trace.traceId}' OR "$trace_id"='${trace.traceId}' OR "$otelTraceID"='${trace.traceId}' OR "trace_id"='${trace.traceId}'`,
        time_range: 'Last 24 hours',
      };
      return search(params);
    },
    enabled: !!trace.traceId && traceDatasetIds.length > 0,
  });

  const events = data?.events ?? [];
  const nodes = useMemo(() => toTraceSpanNodes(events), [events]);
  const nodesById = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  const selectedNode = selectedSpanId ? nodesById.get(selectedSpanId) ?? null : null;

  const handleJumpToParent = useCallback(() => {
    if (selectedNode?.parentId) setSelectedSpanId(selectedNode.parentId);
  }, [selectedNode]);

  const handleJumpToRoot = useCallback(() => {
    const root = nodes.find(n => !n.parentId || !nodesById.has(n.parentId));
    if (root) setSelectedSpanId(root.id);
  }, [nodes, nodesById]);

  const copyTraceId = () => {
    navigator.clipboard.writeText(trace.traceId);
    toast.success('Trace ID copied');
  };

  const totalDuration = useMemo(() => {
    if (nodes.length === 0) return trace.durationMs;
    const starts = nodes.map(n => n.startTimeMs).filter((v): v is number => Number.isFinite(v));
    const ends = nodes.map(n => n.endTimeMs ?? (n.startTimeMs ? n.startTimeMs + n.durationMs : 0)).filter((v): v is number => Number.isFinite(v));
    if (!starts.length || !ends.length) return trace.durationMs;
    return Math.max(...ends) - Math.min(...starts);
  }, [nodes, trace.durationMs]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Sticky header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-border bg-card">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-sm font-semibold text-foreground truncate">{trace.rootSpanName}</h2>
              {trace.hasError && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-medium">Error</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{trace.service}</span>
              <span className="font-mono font-semibold text-foreground">{formatDuration(totalDuration)}</span>
              <span>{new Date(trace.timestamp).toLocaleString()}</span>
              <span className="font-mono">{nodes.length} spans</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="text-[10px] text-muted-foreground font-mono">{trace.traceId}</span>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={copyTraceId} title="Copy trace ID">
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                const ts = trace.timestamp;
                const fromTs = Math.round(ts - 60_000);
                const toTs = Math.round(ts + (totalDuration || 0) + 60_000);
                const where = `"$trace_id"='${trace.traceId}' OR '${trace.traceId}'`;
                const params = new URLSearchParams({
                  where,
                  from_ts: String(fromTs),
                  to_ts: String(toTs),
                  autorun: '1',
                  trace_id: trace.traceId,
                });
                router.push(`/?${params.toString()}`);
              }}
            >
              <FileText className="h-3 w-3 mr-1" /> View related logs
            </Button>
            {onFindSimilar && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onFindSimilar(trace.service, trace.rootSpanName)}
              >
                <Search className="h-3 w-3 mr-1" /> Find similar
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main content with tabs */}
      {isLoading ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-8 w-48" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col">
            <TabsList className="flex-shrink-0 mx-4 mt-2 w-fit">
              <TabsTrigger value="waterfall" className="text-xs">Waterfall</TabsTrigger>
              <TabsTrigger value="spans" className="text-xs">Spans Table</TabsTrigger>
              <TabsTrigger value="metadata" className="text-xs">Metadata</TabsTrigger>
            </TabsList>

            <div className="flex-1 min-h-0">
              {selectedNode ? (
                <ResizablePanelGroup direction="vertical" className="h-full">
                  <ResizablePanel defaultSize={60} minSize={30}>
                    <TabsContent value="waterfall" className="h-full m-0 mt-0">
                      <TraceWaterfallView
                        events={events}
                        isLoading={false}
                        onSelectSpan={setSelectedSpanId}
                        selectedSpanId={selectedSpanId}
                      />
                    </TabsContent>
                    <TabsContent value="spans" className="h-full m-0 mt-0">
                      <SpansTable
                        events={events}
                        onSelectSpan={setSelectedSpanId}
                        selectedSpanId={selectedSpanId}
                      />
                    </TabsContent>
                    <TabsContent value="metadata" className="h-full m-0 mt-0">
                      <TraceMetadata events={events} />
                    </TabsContent>
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                  <ResizablePanel defaultSize={40} minSize={20}>
                    <SpanInspector
                      span={selectedNode}
                      onClose={() => setSelectedSpanId(null)}
                      onJumpToParent={handleJumpToParent}
                      onJumpToRoot={handleJumpToRoot}
                    />
                  </ResizablePanel>
                </ResizablePanelGroup>
              ) : (
                <>
                  <TabsContent value="waterfall" className="h-full m-0 mt-0">
                    <TraceWaterfallView
                      events={events}
                      isLoading={false}
                      onSelectSpan={setSelectedSpanId}
                      selectedSpanId={selectedSpanId}
                    />
                  </TabsContent>
                  <TabsContent value="spans" className="h-full m-0 mt-0">
                    <SpansTable
                      events={events}
                      onSelectSpan={setSelectedSpanId}
                      selectedSpanId={selectedSpanId}
                    />
                  </TabsContent>
                  <TabsContent value="metadata" className="h-full m-0 mt-0">
                    <TraceMetadata events={events} />
                  </TabsContent>
                </>
              )}
            </div>
          </Tabs>
        </div>
      )}
    </div>
  );
}
