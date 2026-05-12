export type ViewMode = 'bronto' | 'grafana';

export interface ViewModeConfig {
  label: string;
  icon: string;
  filterPlaceholder: string;
  searchButtonLabel: string;
  accentColor: string;
  histogramColor: string;
  eventExpandedBg: string;
  queryBarClassName: string;
}

export const VIEW_MODES: Record<ViewMode, ViewModeConfig> = {
  bronto: {
    label: 'SQL',
    icon: '🦕',
    filterPlaceholder: `WHERE clause, e.g. "status_code" >= 500 AND "method"='POST'`,
    searchButtonLabel: 'Search',
    accentColor: '220 70% 50%',
    histogramColor: 'hsl(220, 70%, 50%)',
    eventExpandedBg: 'bg-muted/30',
    queryBarClassName: '',
  },
  grafana: {
    label: 'LogQL',
    icon: '📊',
    filterPlaceholder: 'Enter a LogQL query, e.g. {job="api"} |= "error"',
    searchButtonLabel: 'Search',
    accentColor: '25 95% 53%',
    histogramColor: 'hsl(25, 95%, 53%)',
    eventExpandedBg: 'bg-orange-500/5',
    queryBarClassName: '',
  },
};

export const VIEW_MODE_LIST: ViewMode[] = ['bronto', 'grafana'];
