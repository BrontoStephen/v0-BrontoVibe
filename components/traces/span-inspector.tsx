'use client';

import { useMemo } from 'react';
import type { TraceSpanNode } from '@/lib/trace-utils';
import { formatDuration, getMergedAttrs, groupAttributes } from '@/lib/trace-utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, ArrowUp, ArrowUpToLine, X } from 'lucide-react';
import { toast } from 'sonner';

interface SpanInspectorProps {
  span: TraceSpanNode;
  onClose: () => void;
  onJumpToParent?: () => void;
  onJumpToRoot?: () => void;
}

export function SpanInspector({ span, onClose, onJumpToParent, onJumpToRoot }: SpanInspectorProps) {
  const attrs = useMemo(() => getMergedAttrs(span.event), [span.event]);
  const grouped = useMemo(() => groupAttributes(attrs), [attrs]);

  const copyValue = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success('Copied');
  };

  const startTime = span.startTimeMs ? new Date(span.startTimeMs).toLocaleString() : '—';

  return (
    <div className="flex flex-col h-full min-h-0 border-t border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30 flex-shrink-0">
        <div className="min-w-0 flex-1">
          <div className={`text-xs font-semibold truncate ${span.status === 'error' ? 'text-destructive' : 'text-foreground'}`}>
            {span.name}
          </div>
          <div className="text-[10px] text-muted-foreground">{span.service} · {span.kind}</div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onJumpToParent && span.parentId && (
            <Button variant="ghost" size="sm" className="h-6 px-1.5" onClick={onJumpToParent} title="Jump to parent">
              <ArrowUp className="h-3 w-3" />
            </Button>
          )}
          {onJumpToRoot && (
            <Button variant="ghost" size="sm" className="h-6 px-1.5" onClick={onJumpToRoot} title="Jump to root">
              <ArrowUpToLine className="h-3 w-3" />
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-4 p-3">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <div>
              <span className="text-muted-foreground">Span ID</span>
              <div className="font-mono flex items-center gap-1">
                <span className="truncate">{span.id}</span>
                <button onClick={() => copyValue(span.id)} className="shrink-0 text-muted-foreground hover:text-foreground">
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            </div>
            {span.parentId && (
              <div>
                <span className="text-muted-foreground">Parent ID</span>
                <div className="font-mono flex items-center gap-1">
                  <span className="truncate">{span.parentId}</span>
                  <button onClick={() => copyValue(span.parentId!)} className="shrink-0 text-muted-foreground hover:text-foreground">
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Start Time</span>
              <div className="font-mono">{startTime}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Duration</span>
              <div className="font-mono font-semibold">{formatDuration(span.durationMs)}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Status</span>
              <div>
                {span.status === 'error' ? (
                  <Badge variant="destructive" className="text-[9px] px-1 py-0">Error</Badge>
                ) : (
                  <span className="text-emerald-500 font-medium">OK</span>
                )}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Kind</span>
              <div className="font-mono">{span.kind}</div>
            </div>
          </div>

          {/* Error message */}
          {span.statusMessage && (
            <div>
              <h4 className="text-[10px] uppercase tracking-wider text-destructive font-semibold mb-1">Error Message</h4>
              <pre className="text-xs font-mono text-destructive/80 bg-destructive/5 rounded p-2 whitespace-pre-wrap break-all">
                {span.statusMessage}
              </pre>
            </div>
          )}

          {/* Grouped attributes */}
          {Object.entries(grouped).map(([group, entries]) => (
            <div key={group}>
              <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                {group}
              </h4>
              <table className="w-full text-xs font-mono border-collapse">
                <tbody>
                  {Object.entries(entries).map(([key, value]) => {
                    const display = value == null ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value);
                    const isLong = display.length > 100;
                    return (
                      <tr key={key} className="border-b border-border/30 last:border-b-0">
                        <td className="py-1 pr-3 align-top text-muted-foreground whitespace-nowrap w-0">{key}</td>
                        <td className="py-1 align-top text-foreground break-all">
                          {isLong ? (
                            <details>
                              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                {display.slice(0, 80)}…
                              </summary>
                              <pre className="mt-1 whitespace-pre-wrap bg-muted/30 rounded p-1.5">{display}</pre>
                            </details>
                          ) : display}
                        </td>
                        <td className="py-1 pl-1 w-0 align-top">
                          <button onClick={() => copyValue(display)} className="text-muted-foreground hover:text-foreground">
                            <Copy className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
