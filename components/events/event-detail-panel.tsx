"use client";

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SearchEvent } from '@/lib/bronto-types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Network, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

function getTraceId(event: SearchEvent): string | null {
  const attrs = (event.attributes ?? event) as Record<string, unknown>;
  const kvs = (event as Record<string, unknown>).message_kvs as Record<string, unknown> | undefined;
  return (
    (attrs['$trace_id'] as string) ||
    (attrs['$otelTraceID'] as string) ||
    (attrs['trace_id'] as string) ||
    (event['$trace_id'] as string) ||
    (kvs?.['$trace_id'] as string) ||
    (kvs?.['$otelTraceID'] as string) ||
    (kvs?.['trace_id'] as string) ||
    null
  );
}

function RawSection({ raw }: { raw: string | undefined }) {
  const parsed = useMemo(() => {
    if (!raw) return null;
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return null;
    }
  }, [raw]);

  if (!raw) return null;

  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Raw Event
      </h3>
      <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-all bg-muted/30 rounded p-3 max-h-[400px] overflow-auto">
        {parsed ?? raw}
      </pre>
    </div>
  );
}

interface EventDetailPanelProps {
  event: SearchEvent | null;
  onClose: () => void;
  timeRange?: string;
}

function KeyValueSection({ title, data, defaultOpen = true }: { title: string; data: Record<string, unknown>; defaultOpen?: boolean }) {
  const entries = Object.entries(data);
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 w-full px-3 py-2.5 hover:bg-accent/30 transition-colors text-left">
            {open ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {title}
            </h3>
            <span className="text-[10px] text-muted-foreground/60 ml-auto">{entries.length} items</span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border">
            {entries.length === 0 ? (
              <p className="text-xs text-muted-foreground italic px-3 py-2">No {title.toLowerCase()} available</p>
            ) : (
              <div className="overflow-auto max-h-[35vh]">
                <div className="grid grid-cols-[minmax(140px,auto)_1fr] gap-x-4 text-xs font-mono px-3">
                  {entries.map(([key, value]) => {
                    const display =
                      value == null
                        ? ''
                        : typeof value === 'object'
                          ? JSON.stringify(value)
                          : String(value);
                    return (
                      <div key={key} className="contents">
                        <div className="py-1.5 text-muted-foreground whitespace-nowrap border-b border-border/40">
                          {key}
                        </div>
                        <div className="py-1.5 text-foreground break-all border-b border-border/40">
                          {display || <span className="text-muted-foreground/50">—</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function EventDetails({ event }: { event: SearchEvent }) {
  const attributes = (event.attributes ?? {}) as Record<string, unknown>;
  const messageKvs = (event.message_kvs ?? {}) as Record<string, unknown>;

  return (
    <div className="flex flex-col h-full min-h-0 gap-4 pr-2">
      {event.message && (
        <div className="space-y-1 shrink-0">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Message
          </h3>
          <p className="text-xs font-mono text-foreground whitespace-pre-wrap break-all bg-muted/30 rounded p-2">
            {event.message}
          </p>
        </div>
      )}

      <KeyValueSection title="Attributes" data={attributes} />
      <KeyValueSection title="Message Key-Values" data={messageKvs} />

      <div className="shrink-0">
        <RawSection raw={event['@raw'] as string | undefined} />
      </div>
    </div>
  );
}

export function EventDetailPanel({ event, onClose, timeRange = 'Last 1 hour' }: EventDetailPanelProps) {
  const router = useRouter();

  const traceId = event ? getTraceId(event) : null;

  const timestamp = event?.timestamp
    ? new Date(event.timestamp).toLocaleString()
    : '';

  const severity = (event?.severity as string) || (event?.level as string) || '';

  return (
    <Sheet
      open={!!event}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent side="right" className="w-[60vw] !max-w-[60vw]">
        <SheetHeader>
          <SheetTitle className="text-sm font-medium">Event Detail</SheetTitle>
          <SheetDescription className="flex items-center gap-2 text-xs">
            {timestamp && <span className="font-mono">{timestamp}</span>}
            {severity && (
              <Badge variant="outline" className="text-[10px] uppercase">
                {severity}
              </Badge>
            )}
          </SheetDescription>
        </SheetHeader>

        {traceId && (
          <div className="mt-3">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => {
                onClose();
                router.push(`/traces?trace_id=${traceId}`);
              }}
            >
              <Network className="h-3 w-3" />
              View related trace
            </Button>
          </div>
        )}

        <div className="h-[calc(100vh-160px)] mt-4 flex flex-col min-h-0">
          {event && <EventDetails event={event} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
