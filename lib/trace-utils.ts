import type { SearchEvent } from './bronto-types';

// --- Types ---

export interface TraceSpanNode {
  event: SearchEvent;
  id: string;
  parentId?: string;
  name: string;
  service: string;
  startTimeMs?: number;
  endTimeMs?: number;
  durationMs: number;
  status: 'ok' | 'error';
  kind?: string;
  statusMessage?: string;
}

export interface TraceSpanSegment extends TraceSpanNode {
  depth: number;
  offsetMs: number;
  hasChildren: boolean;
}

export interface TraceSearchResult {
  traceId: string;
  rootSpanName: string;
  service: string;
  durationMs: number;
  timestamp: number;
  spanCount: number;
  hasError: boolean;
  event: SearchEvent;
}

// --- Constants ---

const NANOSECONDS_IN_MILLISECOND = 1_000_000;

export const SERVICE_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-orange-500', 'bg-teal-500',
];

export const SERVICE_TEXT_COLORS = [
  'text-blue-500', 'text-emerald-500', 'text-amber-500', 'text-purple-500',
  'text-rose-500', 'text-cyan-500', 'text-orange-500', 'text-teal-500',
];

// --- Attribute helpers ---

export function getMergedAttrs(event: SearchEvent): Record<string, unknown> {
  const raw = event as Record<string, unknown>;
  const attrs = (event.attributes ?? event) as Record<string, unknown>;
  const kvs = (raw.message_kvs ?? {}) as Record<string, unknown>;
  return { ...kvs, ...attrs };
}

export function getSpanId(attrs: Record<string, unknown>): string {
  return String(
    attrs['$span.span_id'] || attrs['$span.id'] || attrs['span_id'] || attrs['span.id'] ||
    attrs['$span_id'] || attrs['$otelSpanID'] || ''
  );
}

export function getTraceId(attrs: Record<string, unknown>): string {
  return String(
    attrs['$span.trace_id'] || attrs['$trace_id'] || attrs['$otelTraceID'] ||
    attrs['trace_id'] || attrs['span.trace_id'] || ''
  );
}

export function getTraceIdFromEvent(event: SearchEvent): string | null {
  const attrs = getMergedAttrs(event);
  const id = getTraceId(attrs);
  return id || null;
}

export function getParentSpanId(attrs: Record<string, unknown>): string | undefined {
  const val = String(
    attrs['$span.parent_span_id'] || attrs['span.parent_span_id'] || attrs['parent_span_id'] ||
    attrs['$parent_span_id'] || attrs['$otelParentSpanID'] || ''
  );
  return val || undefined;
}

export function getServiceName(attrs: Record<string, unknown>): string {
  return String(
    attrs['$service.name'] || attrs['service.name'] || attrs['$otelServiceName'] ||
    attrs['service'] || 'unknown'
  );
}

export function getSpanName(attrs: Record<string, unknown>, event: SearchEvent): string {
  return String(
    attrs['$span.name'] || attrs['name'] || attrs['span.name'] || event.message || 'Span'
  );
}

export function getSpanKind(attrs: Record<string, unknown>): string {
  return String(attrs['$span.kind'] || attrs['span.kind'] || attrs['kind'] || 'INTERNAL');
}

function getStartTimeMs(attrs: Record<string, unknown>, event: SearchEvent): number | undefined {
  const startNano = Number(
    attrs['$span.start_time_unix_nano'] || attrs['span.start_time_unix_nano'] || attrs['start_time_unix_nano'] || 0
  );
  if (Number.isFinite(startNano) && startNano > 0) return startNano / NANOSECONDS_IN_MILLISECOND;
  const ts = (event as Record<string, unknown>).metadata;
  const metaTs = ts && typeof ts === 'object' ? (ts as Record<string, unknown>).timestamp : undefined;
  if (typeof metaTs === 'number' && Number.isFinite(metaTs)) return metaTs;
  if (event.timestamp && Number.isFinite(event.timestamp)) return event.timestamp;
  return undefined;
}

function getEndTimeMs(attrs: Record<string, unknown>, startTimeMs?: number): number | undefined {
  const endNano = Number(
    attrs['$span.end_time_unix_nano'] || attrs['span.end_time_unix_nano'] || attrs['end_time_unix_nano'] || 0
  );
  if (Number.isFinite(endNano) && endNano > 0) return endNano / NANOSECONDS_IN_MILLISECOND;
  if (startTimeMs && Number.isFinite(startTimeMs)) {
    const durationNano = getDurationNano(attrs);
    if (durationNano > 0) return startTimeMs + durationNano / NANOSECONDS_IN_MILLISECOND;
  }
  return undefined;
}

function getDurationNano(attrs: Record<string, unknown>): number {
  return (
    Number(attrs['$span.duration_nano']) || Number(attrs['$span.duration.nano']) ||
    Number(attrs['$span.duration']) || Number(attrs['$duration']) || Number(attrs['$duration_nano']) || 0
  );
}

function getDurationMs(attrs: Record<string, unknown>, startTimeMs?: number, endTimeMs?: number): number {
  if (startTimeMs && endTimeMs && Number.isFinite(startTimeMs) && Number.isFinite(endTimeMs)) {
    return endTimeMs - startTimeMs;
  }
  const durationNano = getDurationNano(attrs);
  return durationNano / NANOSECONDS_IN_MILLISECOND;
}

// --- Span parsing ---

export function toTraceSpanNodes(events: SearchEvent[]): TraceSpanNode[] {
  const spans = new Map<string, TraceSpanNode>();
  for (const event of events) {
    const attrs = getMergedAttrs(event);
    const spanId = getSpanId(attrs);
    if (!spanId) continue;
    const parentId = getParentSpanId(attrs);
    const startTimeMs = getStartTimeMs(attrs, event);
    const endTimeMs = getEndTimeMs(attrs, startTimeMs);
    const durationMs = getDurationMs(attrs, startTimeMs, endTimeMs);
    const status: 'ok' | 'error' = attrs['$span.status_code'] === 'STATUS_CODE_ERROR' ? 'error' : 'ok';
    const statusMessage = status === 'error' ? String(attrs['$span.status_message'] || attrs['exception.message'] || '') : undefined;
    spans.set(spanId, {
      event, id: spanId, parentId,
      name: getSpanName(attrs, event),
      service: getServiceName(attrs),
      startTimeMs, endTimeMs, durationMs, status,
      kind: getSpanKind(attrs),
      statusMessage,
    });
  }
  return Array.from(spans.values());
}

export function buildTraceSegments(events: SearchEvent[]): {
  segments: TraceSpanSegment[];
  childrenMap: Map<string, string[]>;
  nodesById: Map<string, TraceSpanNode>;
} {
  const nodes = toTraceSpanNodes(events);
  if (!nodes.length) return { segments: [], childrenMap: new Map(), nodesById: new Map() };

  const nodesById = new Map(nodes.map(n => [n.id, n]));
  const childrenMap = new Map<string, string[]>();

  for (const node of nodes) {
    if (node.parentId && nodesById.has(node.parentId)) {
      const siblings = childrenMap.get(node.parentId) ?? [];
      siblings.push(node.id);
      childrenMap.set(node.parentId, siblings);
    }
  }

  const roots = nodes.filter(n => !n.parentId || !nodesById.has(n.parentId));
  const allStartTimes = nodes.map(n => n.startTimeMs).filter((v): v is number => Number.isFinite(v));
  const baseStart = allStartTimes.length ? Math.min(...allStartTimes) : 0;

  const segments: TraceSpanSegment[] = [];

  function walk(node: TraceSpanNode, depth: number) {
    const offsetMs = node.startTimeMs && Number.isFinite(node.startTimeMs) ? node.startTimeMs - baseStart : 0;
    const hasChildren = (childrenMap.get(node.id)?.length ?? 0) > 0;
    segments.push({ ...node, depth, offsetMs, hasChildren });
    const children = (childrenMap.get(node.id) || []).map(id => nodesById.get(id)!).filter(Boolean);
    children.sort((a, b) => (a.startTimeMs ?? 0) - (b.startTimeMs ?? 0));
    children.forEach(child => walk(child, depth + 1));
  }

  roots.sort((a, b) => (a.startTimeMs ?? 0) - (b.startTimeMs ?? 0));
  roots.forEach(root => walk(root, 0));

  return { segments, childrenMap, nodesById };
}

// --- Display helpers ---

export function formatDuration(durationMs: number): string {
  if (durationMs >= 1000) return `${(durationMs / 1000).toFixed(2)}s`;
  if (durationMs >= 1) return `${durationMs.toFixed(1)}ms`;
  return `${(durationMs * 1000).toFixed(0)}µs`;
}

export function formatRelativeTime(timestampMs: number): string {
  const now = Date.now();
  const diff = now - timestampMs;
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function getDescendants(id: string, childrenMap: Map<string, string[]>): Set<string> {
  const result = new Set<string>();
  const stack = [...(childrenMap.get(id) || [])];
  while (stack.length) {
    const cid = stack.pop()!;
    result.add(cid);
    (childrenMap.get(cid) || []).forEach(gc => stack.push(gc));
  }
  return result;
}

/** Parse a root span event into a trace search result */
export function parseTraceResult(event: SearchEvent): TraceSearchResult | null {
  const attrs = getMergedAttrs(event);
  const traceId = getTraceId(attrs);
  if (!traceId) return null;

  const startTimeMs = getStartTimeMs(attrs, event);
  const endTimeMs = getEndTimeMs(attrs, startTimeMs);
  const durationMs = getDurationMs(attrs, startTimeMs, endTimeMs);
  const status = attrs['$span.status_code'] === 'STATUS_CODE_ERROR' ? true : false;
  const spanCount = Number(attrs['$span.span_count'] || attrs['span_count'] || 1);

  return {
    traceId,
    rootSpanName: getSpanName(attrs, event),
    service: getServiceName(attrs),
    durationMs,
    timestamp: startTimeMs ?? event.timestamp ?? Date.now(),
    spanCount,
    hasError: status,
    event,
  };
}

/** Group attributes by prefix for organized display */
export function groupAttributes(attrs: Record<string, unknown>): Record<string, Record<string, unknown>> {
  const groups: Record<string, Record<string, unknown>> = {};
  const prefixes = ['http', 'db', 'rpc', 'messaging', 'net', 'exception', 'enduser', 'thread', 'code'];

  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith('$') || key.startsWith('@')) continue; // skip internal keys
    const prefix = prefixes.find(p => key.startsWith(`${p}.`));
    const group = prefix || 'General';
    if (!groups[group]) groups[group] = {};
    groups[group][key] = value;
  }

  // Add $ keys to a "Span" group
  const spanKeys: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith('$')) {
      spanKeys[key] = value;
    }
  }
  if (Object.keys(spanKeys).length > 0) {
    groups['Span'] = spanKeys;
  }

  return groups;
}

// --- Processed Trace type ---

export interface ProcessedTrace {
  traceId: string;
  rootSpanName: string;
  service: string;
  durationMs: number;
  timestamp: number;
  spanCount: number;
  hasError: boolean;
  spans: SearchEvent[];
}

/** Group spans by their trace ID and return processed traces */
export function groupSpansByTraceId(events: SearchEvent[]): ProcessedTrace[] {
  const traceMap = new Map<string, SearchEvent[]>();

  // Group all events by trace ID
  for (const event of events) {
    const attrs = getMergedAttrs(event);
    const traceId = getTraceId(attrs);
    if (!traceId) continue;

    const existing = traceMap.get(traceId) || [];
    existing.push(event);
    traceMap.set(traceId, existing);
  }

  // Convert to ProcessedTrace array
  const traces: ProcessedTrace[] = [];
  for (const [traceId, spans] of traceMap) {
    // Find the root span (no parent or parent_span_id === '0000000000000000')
    let rootSpan: SearchEvent | undefined;
    for (const span of spans) {
      const attrs = getMergedAttrs(span);
      const parentId = getParentSpanId(attrs);
      if (!parentId || parentId === '0000000000000000') {
        rootSpan = span;
        break;
      }
    }

    // If no explicit root, use the first span
    if (!rootSpan && spans.length > 0) {
      rootSpan = spans[0];
    }
    if (!rootSpan) continue;

    const rootAttrs = getMergedAttrs(rootSpan);
    const startTimeMs = getStartTimeMs(rootAttrs, rootSpan);
    const endTimeMs = getEndTimeMs(rootAttrs, startTimeMs);
    const durationMs = getDurationMs(rootAttrs, startTimeMs, endTimeMs);
    const hasError = spans.some(s => {
      const a = getMergedAttrs(s);
      return a['$span.status_code'] === 'STATUS_CODE_ERROR';
    });

    traces.push({
      traceId,
      rootSpanName: getSpanName(rootAttrs, rootSpan),
      service: getServiceName(rootAttrs),
      durationMs,
      timestamp: startTimeMs ?? rootSpan.timestamp ?? Date.now(),
      spanCount: spans.length,
      hasError,
      spans,
    });
  }

  // Sort by timestamp descending (most recent first)
  traces.sort((a, b) => b.timestamp - a.timestamp);
  return traces;
}


