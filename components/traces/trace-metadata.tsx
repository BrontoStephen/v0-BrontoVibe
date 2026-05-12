'use client';

import { useMemo } from 'react';
import type { SearchEvent } from '@/lib/bronto-types';
import { getMergedAttrs, toTraceSpanNodes } from '@/lib/trace-utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';

interface TraceMetadataProps {
  events: SearchEvent[];
}

const INTERESTING_KEYS = [
  'http.route', 'http.method', 'http.status_code', 'http.url', 'http.target',
  'rpc.method', 'rpc.service',
  'db.system', 'db.statement',
  '$service.name', 'deployment.environment', 'service.version',
  'enduser.id', 'user.id',
];

export function TraceMetadata({ events }: TraceMetadataProps) {
  const traceAttrs = useMemo(() => {
    const attrs: Record<string, unknown> = {};
    // Collect interesting attributes from root spans and first occurrences
    for (const event of events) {
      const merged = getMergedAttrs(event);
      for (const key of INTERESTING_KEYS) {
        if (!attrs[key] && merged[key]) {
          attrs[key] = merged[key];
        }
      }
    }
    return attrs;
  }, [events]);

  const serviceBreakdown = useMemo(() => {
    const nodes = toTraceSpanNodes(events);
    const services = new Map<string, { count: number; totalDurationMs: number; errors: number }>();
    for (const node of nodes) {
      const existing = services.get(node.service) ?? { count: 0, totalDurationMs: 0, errors: 0 };
      existing.count++;
      existing.totalDurationMs += node.durationMs;
      if (node.status === 'error') existing.errors++;
      services.set(node.service, existing);
    }
    return Array.from(services.entries()).sort((a, b) => b[1].totalDurationMs - a[1].totalDurationMs);
  }, [events]);

  const copyValue = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success('Copied to clipboard');
  };

  const traceEntries = Object.entries(traceAttrs).filter(([, v]) => v != null);

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-4">
        {/* Trace-level attributes */}
        {traceEntries.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Trace Attributes
            </h3>
            <table className="w-full text-xs font-mono border-collapse">
              <tbody>
                {traceEntries.map(([key, value]) => {
                  const display = typeof value === 'object' ? JSON.stringify(value) : String(value);
                  return (
                    <tr key={key} className="border-b border-border/40 last:border-b-0">
                      <td className="py-1.5 pr-4 align-top text-muted-foreground whitespace-nowrap w-0">{key}</td>
                      <td className="py-1.5 align-top text-foreground break-all">{display}</td>
                      <td className="py-1.5 pl-2 w-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0"
                          onClick={() => copyValue(display)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Service breakdown */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Service Breakdown
          </h3>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider">
                <th className="text-left py-1.5 font-medium">Service</th>
                <th className="text-right py-1.5 font-medium">Spans</th>
                <th className="text-right py-1.5 font-medium">Errors</th>
                <th className="text-right py-1.5 font-medium">Total Duration</th>
              </tr>
            </thead>
            <tbody>
              {serviceBreakdown.map(([service, stats]) => (
                <tr key={service} className="border-b border-border/30">
                  <td className="py-1.5 font-medium">{service}</td>
                  <td className="py-1.5 text-right font-mono">{stats.count}</td>
                  <td className="py-1.5 text-right font-mono">
                    {stats.errors > 0 ? (
                      <span className="text-destructive">{stats.errors}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right font-mono">
                    {(stats.totalDurationMs / 1000).toFixed(2)}s
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {traceEntries.length === 0 && serviceBreakdown.length === 0 && (
          <div className="text-center py-8 text-xs text-muted-foreground">
            No metadata available for this trace.
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
