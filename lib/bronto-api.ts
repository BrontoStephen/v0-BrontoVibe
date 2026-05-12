import type {
  BrontoLog,
  SearchParams,
  SearchResponse,
  TopKeysRawResponse,
  TopKeyInfo,
  ContextResponse,
  Dashboard,
  Widget,
  MetricTimeseriesResponse,
} from './bronto-types';
import { getStoredApiKey } from './api-key-context';
import axios, { type AxiosRequestConfig } from 'axios';

const BASE_URL = 'https://api.eu.bronto.io';

class BrontoApiError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'BrontoApiError';
    this.status = status;
    this.details = details;
  }
}

function getApiKey(): string {
  const key = getStoredApiKey();
  if (!key) throw new BrontoApiError('No API key configured. Please set a custom API key in settings.', 401);
  return key;
}

async function request<T>(
  path: string,
  method: string = 'GET',
  body?: unknown,
  queryParams?: Record<string, string>,
  signal?: AbortSignal,
): Promise<T> {
  const apiKey = getApiKey();

  const config: AxiosRequestConfig = {
    method,
    url: path.startsWith('http') ? path : `${BASE_URL}${path}`,
    headers: {
      'X-BRONTO-API-KEY': apiKey,
    },
    params: queryParams,
    signal,
    timeout: 30_000,
  };

  if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    config.data = body;
    config.headers!['Content-Type'] = 'application/json';
  }

  try {
    const res = await axios(config);
    return res.data;
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.name === 'CanceledError' || (err as { code?: string }).code === 'ERR_CANCELED') {
        throw new DOMException('Aborted', 'AbortError');
      }
      if ((err as { code?: string }).code === 'ECONNABORTED') {
        throw new BrontoApiError('Request timed out after 30s', 408);
      }
      const axiosErr = err as { response?: { status?: number; data?: { error?: string; message?: string } } };
      const status = axiosErr.response?.status || 0;
      const data = axiosErr.response?.data;
      const msg = data?.error || data?.message || err.message || 'Request failed';
      throw new BrontoApiError(String(msg), status, data);
    }
    throw new BrontoApiError('Request failed', 0);
  }
}

function isInProgress(res: { status?: string; status_code?: number }): boolean {
  return res?.status === 'IN_PROGRESS' || res?.status_code === 202;
}

async function pollAsync(statusUrl: string, signal?: AbortSignal): Promise<SearchResponse> {
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const res = await request<SearchResponse>(statusUrl, 'GET', undefined, undefined, signal);
    if (!isInProgress(res)) return res;
  }
  throw new BrontoApiError('Query timed out', 408);
}

export async function fetchLogs(signal?: AbortSignal): Promise<BrontoLog[]> {
  const data = await request<{ logs?: BrontoLog[] }>('/logs', 'GET', undefined, undefined, signal);
  return data.logs || [];
}

export async function search(params: SearchParams, signal?: AbortSignal): Promise<SearchResponse> {
  const res = await request<SearchResponse>('/search', 'POST', { ...params, async_enabled: true }, undefined, signal);
  if (isInProgress(res)) {
    const statusLink = res.links?.find((l) => l.rel === 'status');
    if (statusLink) return pollAsync(statusLink.href, signal);
  }
  return res;
}

export async function fetchTopKeys(
  logId?: string,
  timeRange?: string,
  fromTs?: number,
  toTs?: number,
  signal?: AbortSignal,
): Promise<TopKeyInfo[]> {
  const params: Record<string, string> = {};
  if (logId) params.log_id = logId;
  if (timeRange) params.time_range = timeRange;
  if (fromTs) params.from_ts = String(fromTs);
  if (toTs) params.to_ts = String(toTs);
  const raw = await request<TopKeysRawResponse>('/top-keys', 'GET', undefined, params, signal);
  const allKeys = new Map<string, string>();
  for (const logData of Object.values(raw)) {
    for (const [name, info] of Object.entries(logData)) {
      if (!allKeys.has(name)) allKeys.set(name, info.type || 'STRING');
    }
  }
  return Array.from(allKeys.entries())
    .map(([name, type]) => ({ name, type }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchContext(contextUrl: string, signal?: AbortSignal): Promise<ContextResponse> {
  return request<ContextResponse>(contextUrl, 'GET', undefined, undefined, signal);
}

export async function fetchDashboards(signal?: AbortSignal): Promise<Dashboard[]> {
  const data = await request<{ dashboards: Dashboard[] }>('/dashboards', 'GET', undefined, undefined, signal);
  return data.dashboards || [];
}

export async function fetchDashboard(id: string, signal?: AbortSignal): Promise<Dashboard> {
  return request<Dashboard>(`/dashboards/${id}`, 'GET', undefined, undefined, signal);
}

export async function fetchMetricTimeseries(
  metricId: string,
  timeRange: string = 'Last 20 minutes',
  numOfSlices: number = 20,
  signal?: AbortSignal,
  fromTs?: number,
  toTs?: number,
): Promise<MetricTimeseriesResponse> {
  const params: Record<string, string> = {
    filter: '',
    num_of_slices: String(numOfSlices),
  };
  if (fromTs && toTs) {
    params.from_ts = String(fromTs);
    params.to_ts = String(toTs);
  } else {
    params.time_range = timeRange;
  }
  return request<MetricTimeseriesResponse>(`/metrics/${metricId}`, 'GET', undefined, params, signal);
}

export async function fetchWidget(widgetId: string, signal?: AbortSignal): Promise<Widget> {
  return request<Widget>(`/widgets/${widgetId}`, 'GET', undefined, undefined, signal);
}

export async function fetchNextPage(nextPageUrl: string, signal?: AbortSignal): Promise<SearchResponse> {
  return request<SearchResponse>(nextPageUrl, 'GET', undefined, undefined, signal);
}

export interface UsageResponse {
  name: string;
  filter: string;
  stat: string;
  key: string;
  is_exact: boolean;
  groups_series: UsageGroupItem[];
}

export interface UsageGroupItem {
  name: string;
  count: number;
  stat: string;
  value: number;
  quantiles?: Record<string, number>;
  series_resolution_ms?: number;
  timeseries?: Array<{ '@timestamp': string; count: number; value: number }>;
  groups_series?: UsageGroupItem[];
}

export async function fetchUsageByLogs(
  usageType: 'ingestion' | 'search' | 'export',
  timeRange?: string,
  fromTs?: number,
  toTs?: number,
  numOfSlices?: number,
  signal?: AbortSignal,
): Promise<UsageResponse> {
  const params: Record<string, string> = { usage_type: usageType };
  if (timeRange) params.time_range = timeRange;
  if (fromTs) params.from_ts = String(fromTs);
  if (toTs) params.to_ts = String(toTs);
  if (numOfSlices) params.num_of_slices = String(numOfSlices);
  return request<UsageResponse>('/usage/organizations/logs', 'GET', undefined, params, signal);
}

export { BrontoApiError };
