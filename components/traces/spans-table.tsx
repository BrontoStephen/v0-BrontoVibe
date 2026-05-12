'use client';

import { useMemo, useState } from 'react';
import type { SearchEvent } from '@/lib/bronto-types';
import { toTraceSpanNodes, formatDuration } from '@/lib/trace-utils';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SpansTableProps {
  events: SearchEvent[];
  onSelectSpan?: (spanId: string) => void;
  selectedSpanId?: string | null;
}

export function SpansTable({ events, onSelectSpan, selectedSpanId }: SpansTableProps) {
  const [filter, setFilter] = useState('');
  const [errorsOnly, setErrorsOnly] = useState(false);

  const nodes = useMemo(() => toTraceSpanNodes(events), [events]);

  const allStartTimes = useMemo(() => {
    return nodes.map(n => n.startTimeMs).filter((v): v is number => Number.isFinite(v));
  }, [nodes]);
  const baseStart = allStartTimes.length ? Math.min(...allStartTimes) : 0;

  const filtered = useMemo(() => {
    let result = nodes;
    if (errorsOnly) result = result.filter(n => n.status === 'error');
    if (filter) {
      const lower = filter.toLowerCase();
      result = result.filter(n =>
        n.name.toLowerCase().includes(lower) ||
        n.service.toLowerCase().includes(lower)
      );
    }
    // Sort by start time
    result.sort((a, b) => (a.startTimeMs ?? 0) - (b.startTimeMs ?? 0));
    return result;
  }, [nodes, errorsOnly, filter]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Filter bar */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border flex-shrink-0">
        <Input
          placeholder="Filter spans..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-7 text-xs flex-1"
        />
        <div className="flex items-center gap-1.5">
          <Switch id="errors-only" checked={errorsOnly} onCheckedChange={setErrorsOnly} className="scale-75" />
          <Label htmlFor="errors-only" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
            Errors only
          </Label>
        </div>
      </div>

      {/* Table */}
      <ScrollArea className="flex-1 min-h-0">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider">
              <th className="text-left py-1.5 px-3 font-medium">Span Name</th>
              <th className="text-left py-1.5 px-2 font-medium">Service</th>
              <th className="text-right py-1.5 px-2 font-medium">Duration</th>
              <th className="text-right py-1.5 px-2 font-medium">Offset</th>
              <th className="text-center py-1.5 px-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((node) => {
              const offset = node.startTimeMs ? node.startTimeMs - baseStart : 0;
              const isSelected = selectedSpanId === node.id;
              return (
                <tr
                  key={node.id}
                  className={`border-b border-border/30 cursor-pointer hover:bg-muted/50 transition-colors ${
                    isSelected ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => onSelectSpan?.(node.id)}
                >
                  <td className="py-1.5 px-3 font-medium truncate max-w-[200px]" title={node.name}>
                    {node.name}
                  </td>
                  <td className="py-1.5 px-2 text-muted-foreground truncate max-w-[120px]" title={node.service}>
                    {node.service}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono">
                    {formatDuration(node.durationMs)}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono text-muted-foreground">
                    +{formatDuration(offset)}
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    {node.status === 'error' ? (
                      <Badge variant="destructive" className="text-[9px] px-1 py-0">Error</Badge>
                    ) : (
                      <span className="text-emerald-500 text-[10px]">OK</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-xs text-muted-foreground">
            No spans match the current filters.
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
