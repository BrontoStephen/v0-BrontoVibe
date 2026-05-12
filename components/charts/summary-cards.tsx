"use client";

import { Clock, Search, FileText } from 'lucide-react';

interface ExplainInfo {
  'Bytes searched'?: string;
  'Execution time (millis)'?: string;
  'Matching events'?: string;
  [key: string]: string | undefined;
}

interface SummaryInlineProps {
  totals?: Record<string, unknown>;
  aggregates?: string[];
  explain?: ExplainInfo;
}

function canonicalise(key: string): string {
  let k = key.replace(/"/g, '').replace(/'/g, '').trim().toLowerCase();
  k = k.replace(/^average\(/, 'avg(');
  if (k === 'count') k = 'count(*)';
  return k;
}

function formatLabel(key: string): string {
  let label = key.replace(/"/g, '').replace(/'/g, '');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatBytes(bytesStr: string): string {
  const bytes = parseInt(bytesStr, 10);
  if (isNaN(bytes)) return bytesStr;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDuration(millisStr: string): string {
  const ms = parseInt(millisStr, 10);
  if (isNaN(ms)) return millisStr;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function SummaryInline({ totals, aggregates, explain }: SummaryInlineProps) {
  const hasTotals = totals && Object.keys(totals).length > 0;
  const hasExplain = explain && Object.keys(explain).length > 0;

  if (!hasTotals && !hasExplain) return null;

  let scalarEntries = hasTotals
    ? Object.entries(totals!).filter(
        ([, value]) => typeof value === 'number' || typeof value === 'string'
      )
    : [];

  const canonAggs = aggregates && aggregates.length > 0
    ? new Set(aggregates.map(canonicalise))
    : null;

  if (canonAggs) {
    scalarEntries = scalarEntries.filter(([key]) => canonAggs.has(canonicalise(key)));
  }

  if (explain?.['Matching events']) {
    scalarEntries = scalarEntries.filter(([key]) => {
      const c = canonicalise(key);
      return c !== 'count(*)' && c !== 'count';
    });
  }

  const seen = new Map<string, unknown>();
  for (const [key, value] of scalarEntries) {
    const label = formatLabel(key);
    if (!seen.has(label)) {
      seen.set(label, value);
    }
  }

  const formatValue = (value: unknown): string => {
    if (typeof value === 'number') return value.toLocaleString();
    if (typeof value === 'string') return value;
    return '—';
  };

  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
      {hasExplain && (
        <>
          {explain!['Matching events'] && (
            <span className="inline-flex items-center gap-1">
              <FileText className="h-3 w-3" />
              <span className="text-foreground font-medium">{parseInt(explain!['Matching events']).toLocaleString()}</span> matches
            </span>
          )}
          {explain!['Bytes searched'] && (
            <span className="inline-flex items-center gap-1">
              <Search className="h-3 w-3" />
              {formatBytes(explain!['Bytes searched'])} searched
            </span>
          )}
          {explain!['Execution time (millis)'] && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(explain!['Execution time (millis)'])}
            </span>
          )}
          {seen.size > 0 && <span className="text-border">|</span>}
        </>
      )}
      {Array.from(seen.entries()).map(([label, value]) => (
        <span key={label}>
          <span className="font-medium">{label}:</span>{' '}
          <span className="text-foreground">{formatValue(value)}</span>
        </span>
      ))}
    </div>
  );
}
