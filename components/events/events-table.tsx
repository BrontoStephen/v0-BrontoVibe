"use client";

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useReactTable, getCoreRowModel, flexRender, createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { SearchEvent, SearchResponse } from "@/lib/bronto-types";
import { EventDetailPanel } from "./event-detail-panel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Loader2 } from "lucide-react";

interface EventsTableProps {
  data?: SearchResponse;
  isLoading: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  onViewContext?: (contextUrl: string) => void;
  mostRecentFirst: boolean;
  onToggleSort: () => void;
  timeRange?: string;
}

const ROW_HEIGHT = 32;

const columnHelper = createColumnHelper<SearchEvent>();

export function EventsTable({
  data,
  isLoading,
  onLoadMore,
  isLoadingMore,
  onViewContext,
  mostRecentFirst,
  onToggleSort,
  timeRange,
}: EventsTableProps) {
  const [selectedEvent, setSelectedEvent] = useState<SearchEvent | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState<number>(0);

  const events = useMemo(() => data?.events || [], [data?.events]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setContentWidth(el.scrollWidth);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [events]);

  const columns = useMemo<ColumnDef<SearchEvent, unknown>[]>(
    () =>
      [
        columnHelper.accessor(
          (row) => {
            const ts = row["@time"];
            if (ts == null || ts === "") return "";
            const num = typeof ts === "number" ? ts : Number(ts);
            let d: Date;
            if (!isNaN(num) && num > 0) {
              const ms = num < 1e12 ? num * 1000 : num;
              d = new Date(ms);
            } else {
              d = new Date(String(ts));
            }
            if (isNaN(d.getTime())) return String(ts);
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const mon = months[d.getMonth()];
            const day = d.getDate();
            const h = String(d.getHours()).padStart(2, "0");
            const m = String(d.getMinutes()).padStart(2, "0");
            const s = String(d.getSeconds()).padStart(2, "0");
            const ms2 = String(d.getMilliseconds()).padStart(3, "0");
            return `${mon} ${day} ${h}:${m}:${s}.${ms2}`;
          },
          {
            id: "date",
            header: "Date",
            size: 200,
            minSize: 160,
            maxSize: 260,
            cell: (info) => {
              const formatted = info.getValue() as string;
              if (!formatted) return <span className="text-muted-foreground">—</span>;
              return <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">{formatted}</span>;
            },
          },
        ),
        columnHelper.accessor((row) => (row["@raw"] as string) ?? row.message ?? "", {
          id: "content",
          header: "Content",
          cell: (info) => {
            const raw = info.getValue() as string;
            return <span className="font-mono text-xs whitespace-nowrap">{raw || "—"}</span>;
          },
        }),
      ] as ColumnDef<SearchEvent, unknown>[],
    [],
  );

  const table = useReactTable({
    data: events,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const { rows } = table.getRowModel();

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    const handleScroll = () => {
      if (isLoadingMore || !data?.pagination?.next_page_url || !onLoadMore) return;
      const { scrollTop, scrollHeight, clientHeight } = scrollEl;
      if (scrollHeight - scrollTop - clientHeight < 200) {
        onLoadMore();
      }
    };
    scrollEl.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", handleScroll);
  }, [isLoadingMore, data?.pagination?.next_page_url, onLoadMore]);

  const handleRowClick = useCallback((event: SearchEvent) => setSelectedEvent(event), []);

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm">No events found</p>
        <p className="text-xs mt-1">Try adjusting your search filters or time range</p>
      </div>
    );
  }

  const getSeverityColor = (status: string | undefined): string => {
    if (!status) return 'bg-muted-foreground/30';
    switch (status.toLowerCase()) {
      case 'emergency':
      case 'fatal':
      case 'critical':
        return 'bg-destructive';
      case 'alert':
      case 'severe':
      case 'error':
        return 'bg-destructive/70';
      case 'warn':
      case 'warning':
      case 'notice':
        return 'bg-yellow-500';
      case 'info':
        return 'bg-primary';
      case 'debug':
      case 'trace':
        return 'bg-muted-foreground/50';
      default:
        return 'bg-muted-foreground/30';
    }
  };

  return (
    <>
      <div className="rounded-lg border border-border bg-card flex flex-col min-h-0 h-full overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-3 py-2 flex-shrink-0">
          <span className="text-sm font-medium text-muted-foreground">
            {events.length} event{events.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div ref={scrollRef} className="overflow-auto flex-1 min-h-0">
          <div ref={contentRef} className="inline-flex flex-col min-w-full">
            <div className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm border-b border-border flex min-w-full">
              {table.getHeaderGroups().map((headerGroup) =>
                headerGroup.headers.map((header) => (
                  <div
                    key={header.id}
                    className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                    style={{
                      width: header.id === "content" ? undefined : header.getSize(),
                      minWidth: header.id === "content" ? 0 : header.getSize(),
                      flex: header.id === "content" ? "1 1 0%" : "0 0 auto",
                    }}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </div>
                )),
              )}
            </div>

            <div
              style={{
                height: virtualizer.getTotalSize(),
                position: "relative",
                minWidth: contentWidth > 0 ? contentWidth : "100%",
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index];
                const isSelected = selectedEvent === row.original;
                return (
                  <div
                    key={row.id}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    className={`absolute left-0 right-0 flex items-center border-b border-border/50 cursor-pointer hover:bg-muted/50 group ${
                      isSelected ? "bg-muted/60" : ""
                    }`}
                    style={{
                      top: virtualRow.start,
                      minHeight: ROW_HEIGHT,
                    }}
                    onClick={() => handleRowClick(row.original)}
                  >
                    <div className="flex items-center justify-center shrink-0" style={{ width: 20 }}>
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${getSeverityColor(row.original['@status'] as string | undefined)}`}
                        title={row.original['@status'] as string || ''}
                      />
                    </div>
                    {row.getVisibleCells().map((cell) => (
                      <div
                        key={cell.id}
                        className="px-3 py-1"
                        style={{
                          width: cell.column.id === "content" ? undefined : cell.column.getSize(),
                          minWidth: cell.column.id === "content" ? 0 : cell.column.getSize(),
                          flex: cell.column.id === "content" ? "1 1 0%" : "0 0 auto",
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    ))}
                    {onViewContext && row.original.metadata?.context && (
                      <div className="sticky right-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 whitespace-nowrap bg-card/90 backdrop-blur-sm border border-border/50 shadow-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewContext(row.original.metadata!.context as string);
                          }}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Context
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {isLoadingMore && (
          <div className="border-t border-border p-3 text-center flex-shrink-0">
            <Loader2 className="h-4 w-4 animate-spin inline-block" />
            <span className="text-xs text-muted-foreground ml-2">Loading more...</span>
          </div>
        )}
      </div>

      <EventDetailPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} timeRange={timeRange} />
    </>
  );
}
