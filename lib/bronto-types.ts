export interface BrontoLog {
  log: string;
  log_id: string;
  logset: string;
  level?: string;
  drop_events?: number;
  is_system_generated?: boolean;
  parser_id?: string;
  tags?: Record<string, string>;
  // Keep name/id as aliases
  name?: string;
  id?: string;
  type?: string;
  logs?: BrontoLog[];
  [key: string]: unknown;
}

export interface SearchParams {
  from?: string[];
  from_expr?: string;
  time_range?: string;
  from_ts?: number;
  to_ts?: number;
  where?: string;
  select?: string[];
  groups?: string[];
  num_of_slices?: number;
  most_recent_first?: boolean;
  async_enabled?: boolean;
  limit?: number;
  timeline_enabled?: boolean;
}

export interface SearchEvent {
  message: string;
  timestamp: number;
  metadata?: {
    context?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface TimelineEntry {
  start: number;
  end: number;
  count: number;
  error?: number;
  info?: number;
  warning?: number;
}

/** Timeline timeseries data point from the API */
export interface TimelineTimeseriesPoint {
  '@timestamp': number;
  count: number;
  value: number;
  error: number;
  info: number;
  warning: number;
  quantiles?: Record<string, unknown>;
}

/** The timeline field can be an object with summary + timeseries, or an array of TimelineEntry */
export interface TimelineObject {
  count?: number;
  error?: number;
  info?: number;
  warning?: number;
  count_status?: number;
  timeseries?: TimelineTimeseriesPoint[];
  [key: string]: unknown;
}

export interface GroupSeries {
  name: string;
  series?: { timestamp: number; value: number }[];
  groups?: GroupSeries[];
  total?: number;
}

export interface SearchResponse {
  events?: SearchEvent[];
  result?: Record<string, unknown>[];
  groups_series?: GroupSeries[];
  totals?: Record<string, unknown>;
  timeline?: TimelineEntry[] | TimelineObject;
  explain?: Record<string, string>;
  pagination?: {
    next_page_url?: string;
  };
  links?: { rel: string; href: string }[];
  metadata?: Record<string, unknown>;
  status_code?: number;
}

export interface TopKeyInfo {
  name: string;
  type: string;
}

// Raw API response: { [logId]: { [keyName]: { type, rank, field_type, values } } }
export type TopKeysRawResponse = Record<
  string,
  Record<string, { type: string; rank: number; field_type: string; values: Record<string, unknown> }>
>;

export interface ContextResponse {
  result: SearchEvent[];
  links?: { rel: string; href: string }[];
}

export const VISUALIZATION_TYPES = {
  AREA: 'area',
  BAR: 'bar',
  DONUT: 'donut',
  EVENTS_LIST: 'events-list',
  GEOMAP: 'geomap',
  GROUP: 'group',
  LINE: 'line',
  PIECHART: 'pie',
  SCORE: 'score',
  TABLE: 'table',
  TOPLIST: 'top-list',
  TREEMAP: 'treemap',
} as const;

export type VisualizationType = (typeof VISUALIZATION_TYPES)[keyof typeof VISUALIZATION_TYPES];

export interface WidgetLayout {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  widget_id?: string;
}

export interface Dashboard {
  created: number | string;
  dashboard_id: string;
  description?: string;
  layout: {
    widget_layouts: WidgetLayout[];
  };
  name: string;
  widget_ids: string[];
  widgets: Widget[];
  created_by?: string;
  tags?: Record<string, string>;
}

export interface Widget {
  aux?: Record<string, string>;
  id: string;
  layout?: {
    widget_layouts: WidgetLayout[];
  };
  lbm_ids?: string[];
  metric_ids?: string[];
  metric_labels?: Record<string, string>;
  name: string;
  type?: VisualizationType;
  widget_ids?: string[];
}

export interface SeriesDataPoint {
  '@time': string;
  '@timestamp': string;
  count: string;
  quantiles: Record<string, unknown>;
  value: string;
}

// Metric response is a dynamic object keyed by metric name
export type MetricTimeseriesResponse = Record<string, unknown>;

export interface FlattenedSeries {
  name: string;
  data: { timestamp: number; value: number }[];
  total?: number;
}
