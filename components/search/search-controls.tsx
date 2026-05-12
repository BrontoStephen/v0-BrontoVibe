'use client';

import { DatasetSelector } from './dataset-selector';
import { FilterInput } from './filter-input';
import { Button } from '@/components/ui/button';
import { Search as SearchIcon } from 'lucide-react';
import { VIEW_MODES, type ViewMode } from '@/lib/view-modes';
import type { TimeRange } from '@/lib/bronto-utils';

export interface SearchState {
  datasets: string[];
  fromExpr: string;
  timeRange: TimeRange;
  where: string;
  aggregates: string[];
  groups: string[];
  numSlices: number;
  fromTs?: number;
  toTs?: number;
}

interface SearchControlsProps {
  state: SearchState;
  onChange: (state: SearchState) => void;
  onSearch: () => void;
  isLoading?: boolean;
  viewMode?: ViewMode;
}

export function SearchControls({ state, onChange, onSearch, isLoading, viewMode = 'bronto' }: SearchControlsProps) {
  const config = VIEW_MODES[viewMode];

  const update = (partial: Partial<SearchState>) => onChange({ ...state, ...partial });

  return (
    <div className="space-y-3 min-w-0 w-full overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 min-w-0">
        <DatasetSelector
          selectedDatasets={state.datasets}
          onSelectionChange={(datasets) => update({ datasets })}
          selectedFromExpr={state.fromExpr}
          onFromExprChange={(fromExpr) => update({ fromExpr })}
        />

        <div className="flex-1 min-w-[200px]">
          <FilterInput value={state.where} onChange={(where) => update({ where })} />
        </div>
        <Button onClick={onSearch} size="sm" className="h-8 text-xs" disabled={isLoading || state.datasets.length === 0}>
          <SearchIcon className="h-3.5 w-3.5 mr-1.5" />
          {isLoading ? 'Searching...' : config.searchButtonLabel}
        </Button>
      </div>
    </div>
  );
}
