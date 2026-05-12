'use client';

import { useMemo, useState } from 'react';
import type { ProcessedTrace } from '@/lib/trace-utils';
import { formatDuration } from '@/lib/trace-utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface HeatmapCellSelection {
  traceIds: Set<string>;
  label: string;
}

interface TraceDurationHeatmapProps {
  traces: ProcessedTrace[];
  selectedTraceId?: string | null;
  onSelect?: (traceId: string) => void;
  onCellSelect?: (selection: HeatmapCellSelection | null) => void;
  selectedCell?: { col: number; row: number } | null;
}

// Duration buckets (rows, bottom = fast, top = slow)
function buildDurationBuckets(maxMs: number): { label: string; minMs: number; maxMs: number }[] {
  if (maxMs <= 0) return [{ label: '0', minMs: 0, maxMs: 1 }];

  // Create 5 logarithmic-ish buckets
  const buckets: { label: string; minMs: number; maxMs: number }[] = [];
  const thresholds = [0, 1, 10, 100, 500, 1000, 5000, 10000, 30000, 60000, 300000];
  
  // Find relevant thresholds
  const relevant = thresholds.filter(t => t <= maxMs * 1.1);
  if (relevant[relevant.length - 1] < maxMs) relevant.push(Math.ceil(maxMs));
  
  // Pick ~5 evenly spaced
  const step = Math.max(1, Math.floor((relevant.length - 1) / 5));
  const picked: number[] = [0];
  for (let i = step; i < relevant.length; i += step) {
    picked.push(relevant[i]);
  }
  if (picked[picked.length - 1] < maxMs) picked.push(Math.ceil(maxMs * 1.01));

  for (let i = 0; i < picked.length - 1; i++) {
    buckets.push({
      label: formatDuration(picked[i]),
      minMs: picked[i],
      maxMs: picked[i + 1],
    });
  }
  return buckets;
}

// Time columns
function buildTimeColumns(minTs: number, maxTs: number, targetCols: number): { label: string; fromTs: number; toTs: number }[] {
  const range = maxTs - minTs;
  if (range <= 0) return [{ label: '', fromTs: minTs, toTs: maxTs + 1 }];

  const colWidth = range / targetCols;
  const cols: { label: string; fromTs: number; toTs: number }[] = [];

  for (let i = 0; i < targetCols; i++) {
    const from = minTs + i * colWidth;
    const to = from + colWidth;
    const d = new Date(from);
    const label = i % Math.max(1, Math.floor(targetCols / 8)) === 0
      ? `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
      : '';
    cols.push({ label, fromTs: from, toTs: to });
  }
  return cols;
}

interface CellData {
  count: number;
  errorCount: number;
  traces: ProcessedTrace[];
}

export function TraceDurationHeatmap({ traces, selectedTraceId, onCellSelect, selectedCell }: TraceDurationHeatmapProps) {
  const [localSelectedCell, setLocalSelectedCell] = useState<{ col: number; row: number } | null>(null);
  const activeCell = selectedCell !== undefined ? selectedCell : localSelectedCell;
  const { rows, cols, grid, maxCount } = useMemo(() => {
    if (!traces || traces.length === 0) {
      return { rows: [], cols: [], grid: [], maxCount: 0 };
    }
    const timestamps = traces.map(r => r.timestamp);
    const durations = traces.map(r => r.durationMs);
    const minTs = Math.min(...timestamps);
    const maxTs = Math.max(...timestamps);
    const maxDur = Math.max(...durations);

    const cols = buildTimeColumns(minTs, maxTs, Math.min(40, Math.max(10, traces.length)));
    const rows = buildDurationBuckets(maxDur);

    // Build grid[row][col]
    const grid: CellData[][] = rows.map(() => cols.map(() => ({ count: 0, errorCount: 0, traces: [] })));

    let maxCount = 0;
    for (const r of traces) {
      const colIdx = cols.findIndex((c, i) => r.timestamp >= c.fromTs && (i === cols.length - 1 || r.timestamp < c.toTs));
      const rowIdx = rows.findIndex((b, i) => r.durationMs >= b.minMs && (i === rows.length - 1 || r.durationMs < b.maxMs));
      if (colIdx >= 0 && rowIdx >= 0) {
        grid[rowIdx][colIdx].count++;
        grid[rowIdx][colIdx].traces.push(r);
        if (r.hasError) grid[rowIdx][colIdx].errorCount++;
        maxCount = Math.max(maxCount, grid[rowIdx][colIdx].count);
      }
    }

    return { rows, cols, grid, maxCount };
  }, [traces]);

  if (!traces || traces.length === 0) return null;

  // Color scale: green for ok-heavy, red for error-heavy, intensity by count
  function getCellColor(cell: CellData): string {
    if (cell.count === 0) return 'bg-muted/30';
    const intensity = Math.min(cell.count / Math.max(maxCount, 1), 1);
    const errorRatio = cell.errorCount / cell.count;

    if (errorRatio > 0.5) {
      // Red scale
      if (intensity > 0.7) return 'bg-red-700';
      if (intensity > 0.4) return 'bg-red-500';
      if (intensity > 0.15) return 'bg-red-400';
      return 'bg-red-300';
    }
    if (errorRatio > 0) {
      // Orange/amber
      if (intensity > 0.7) return 'bg-amber-600';
      if (intensity > 0.4) return 'bg-amber-500';
      if (intensity > 0.15) return 'bg-amber-400';
      return 'bg-amber-300';
    }
    // Green scale (like GitHub)
    if (intensity > 0.75) return 'bg-emerald-700';
    if (intensity > 0.5) return 'bg-emerald-500';
    if (intensity > 0.25) return 'bg-emerald-400';
    if (intensity > 0.1) return 'bg-emerald-300';
    return 'bg-emerald-200';
  }

  const hasSelected = (cell: CellData) => cell.traces.some(t => t.traceId === selectedTraceId);

  return (
    <div className="border border-border rounded-md bg-card p-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground">Duration distribution</span>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span>Less</span>
          <div className="w-2.5 h-2.5 rounded-[2px] bg-muted/30 border border-border/50" />
          <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-200" />
          <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-400" />
          <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-600" />
          <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-700" />
          <span>More</span>
          <span className="mx-1">·</span>
          <div className="w-2.5 h-2.5 rounded-[2px] bg-red-500" />
          <span>Errors</span>
        </div>
      </div>

      <div className="flex gap-0.5">
        {/* Row labels */}
        <div className="flex flex-col gap-[2px] shrink-0 pr-1 justify-end">
          {[...rows].reverse().map((r, i) => (
            <div key={i} className="h-[16px] flex items-center justify-end">
              <span className="text-[9px] text-muted-foreground font-mono leading-none whitespace-nowrap">{r.label}</span>
            </div>
          ))}
        </div>

        {/* Grid - full width */}
        <div className="flex-1 flex gap-[2px] min-w-0">
          {cols.map((col, ci) => (
            <div key={ci} className="flex-1 flex flex-col gap-[2px] min-w-0">
              {[...rows].reverse().map((_, ri) => {
                const actualRowIdx = rows.length - 1 - ri;
                const cell = grid[actualRowIdx][ci];
                const selected = hasSelected(cell);

                return (
                  <Tooltip key={ri}>
                    <TooltipTrigger asChild>
                      <button
                        className={`w-full h-[16px] rounded-[2px] transition-all ${getCellColor(cell)} ${
                          activeCell?.col === ci && activeCell?.row === actualRowIdx
                            ? 'ring-2 ring-primary ring-offset-1 ring-offset-background'
                            : selected ? 'ring-1 ring-primary ring-offset-1 ring-offset-background' : ''
                        } ${cell.count > 0 ? 'cursor-pointer hover:ring-1 hover:ring-foreground/30' : 'cursor-default'}`}
                        onClick={() => {
                          if (cell.count === 0) return;
                          const isDeselect = activeCell?.col === ci && activeCell?.row === actualRowIdx;
                          if (isDeselect) {
                            setLocalSelectedCell(null);
                            onCellSelect?.(null);
                          } else {
                            const cellCoord = { col: ci, row: actualRowIdx };
                            setLocalSelectedCell(cellCoord);
                            const traceIds = new Set(cell.traces.map(t => t.traceId));
                            const rowData = rows[actualRowIdx];
                            onCellSelect?.({
                              traceIds,
                              label: `${rowData.label} – ${formatDuration(rowData.maxMs)} · ${new Date(cols[ci].fromTs).toLocaleTimeString()}`,
                            });
                          }
                        }}
                      />
                    </TooltipTrigger>
                    {cell.count > 0 && (
                      <TooltipContent side="top" className="text-xs">
                        <div className="font-medium">{cell.count} trace{cell.count !== 1 ? 's' : ''}</div>
                        {cell.errorCount > 0 && (
                          <div className="text-destructive">{cell.errorCount} error{cell.errorCount !== 1 ? 's' : ''}</div>
                        )}
                        <div className="text-muted-foreground font-mono">
                          {rows[actualRowIdx].label} – {formatDuration(rows[actualRowIdx].maxMs)}
                        </div>
                        <div className="text-muted-foreground font-mono">
                          {new Date(col.fromTs).toLocaleTimeString()}
                        </div>
                      </TooltipContent>
                    )}
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Time labels */}
      <div className="flex gap-[2px]" style={{ paddingLeft: 60 }}>
        {cols.map((col, i) => (
          <div key={i} className="flex-1 min-w-0 text-center">
            {col.label && (
              <span className="text-[8px] text-muted-foreground font-mono">{col.label}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
