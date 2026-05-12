'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchLogs } from '@/lib/bronto-api';
import type { BrontoLog } from '@/lib/bronto-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Database, ChevronDown, ChevronRight, Search } from 'lucide-react';

interface DatasetSelectorProps {
  selectedDatasets: string[];
  onSelectionChange: (ids: string[]) => void;
  selectedFromExpr: string;
  onFromExprChange: (expr: string) => void;
}

export function DatasetSelector({ selectedDatasets, onSelectionChange }: DatasetSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['bronto-logs'],
    queryFn: () => fetchLogs(),
  });

  const collections = new Map<string, BrontoLog[]>();
  logs.forEach((log) => {
    const collection = log.logset || 'Uncategorized';
    if (!collections.has(collection)) collections.set(collection, []);
    collections.get(collection)!.push(log);
  });

  const sortedCollections = Array.from(collections.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, datasets]) => [name, datasets.sort((a, b) => (a.log || '').localeCompare(b.log || ''))] as [string, BrontoLog[]]);

  const getLogId = (log: BrontoLog) => log.log_id || log.id || '';
  const getLogName = (log: BrontoLog) => log.log || log.name || log.log_id || '';

  const toggleDataset = (id: string) => {
    const next = selectedDatasets.includes(id) ? selectedDatasets.filter((d) => d !== id) : [...selectedDatasets, id];
    onSelectionChange(next);
  };

  const toggleCollection = (datasets: BrontoLog[]) => {
    const ids = datasets.map(getLogId);
    const allSelected = ids.every((id) => selectedDatasets.includes(id));
    if (allSelected) {
      onSelectionChange(selectedDatasets.filter((id) => !ids.includes(id)));
    } else {
      const newIds = ids.filter((id) => !selectedDatasets.includes(id));
      onSelectionChange([...selectedDatasets, ...newIds]);
    }
  };

  const toggleExpanded = (collectionName: string) => {
    setExpandedCollections((prev) => {
      const next = new Set(prev);
      if (next.has(collectionName)) {
        next.delete(collectionName);
      } else {
        next.add(collectionName);
      }
      return next;
    });
  };

  const matchesSearch = (log: BrontoLog, collectionName: string) => {
    const q = search.toLowerCase();
    return getLogName(log).toLowerCase().includes(q) || collectionName.toLowerCase().includes(q);
  };

  const findLogName = (id: string) => {
    const log = logs.find((l) => getLogId(l) === id);
    return log ? getLogName(log) : id;
  };

  const isCollectionChecked = (datasets: BrontoLog[]) => {
    const ids = datasets.map(getLogId);
    return ids.every((id) => selectedDatasets.includes(id));
  };

  const isCollectionIndeterminate = (datasets: BrontoLog[]) => {
    const ids = datasets.map(getLogId);
    const someSelected = ids.some((id) => selectedDatasets.includes(id));
    const allSelected = ids.every((id) => selectedDatasets.includes(id));
    return someSelected && !allSelected;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 min-w-[160px] justify-between gap-2 text-xs">
          <Database className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">
            {selectedDatasets.length === 0 ? 'Select datasets' : `${selectedDatasets.length} dataset${selectedDatasets.length > 1 ? 's' : ''}`}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <div className="border-b border-border p-2 space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search datasets..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
          <div className="flex items-center justify-between px-1">
            <button
              className="text-xs text-primary hover:underline"
              onClick={() => {
                const allIds = logs.map(getLogId).filter(Boolean);
                onSelectionChange(allIds);
              }}
            >
              Select all
            </button>
            <button className="text-xs text-muted-foreground hover:underline" onClick={() => onSelectionChange([])}>
              Deselect all
            </button>
          </div>
        </div>
        <ScrollArea className="h-[min(400px,_50vh)] overflow-auto">
          <div className="py-1">
            {isLoading && <p className="text-sm text-muted-foreground p-3">Loading...</p>}
            {sortedCollections.map(([collectionName, datasets]) => {
              const filtered = datasets.filter((d) => matchesSearch(d, collectionName));
              if (filtered.length === 0 && search) return null;
              const datasetsToShow = search ? filtered : datasets;
              if (datasetsToShow.length === 0) return null;

              const isExpanded = expandedCollections.has(collectionName) || (search.length > 0 && filtered.length > 0);

              return (
                <div key={collectionName}>
                  <div
                    className="flex items-center gap-1 px-2 py-1.5 hover:bg-accent cursor-pointer select-none"
                    onClick={() => toggleExpanded(collectionName)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <Database className="h-4 w-4 shrink-0 text-primary" />
                    <span className="text-sm font-medium flex-1 truncate">{collectionName}</span>
                    <Checkbox
                      checked={isCollectionChecked(datasetsToShow)}
                      data-state={isCollectionIndeterminate(datasetsToShow) ? 'indeterminate' : undefined}
                      onCheckedChange={() => toggleCollection(datasetsToShow)}
                      onClick={(e) => e.stopPropagation()}
                      className="ml-auto"
                    />
                  </div>

                  {isExpanded && (
                    <div className="ml-5">
                      {datasetsToShow.map((d) => {
                        const id = getLogId(d);
                        return (
                          <label key={id} className="flex items-center gap-2 rounded px-3 py-1.5 text-sm hover:bg-accent cursor-pointer">
                            <Checkbox checked={selectedDatasets.includes(id)} onCheckedChange={() => toggleDataset(id)} />
                            <span className="truncate">{getLogName(d)}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
        {selectedDatasets.length > 0 && (
          <div className="border-t border-border p-2 flex flex-wrap gap-1">
            {selectedDatasets.slice(0, 3).map((id) => (
              <Badge key={id} variant="secondary" className="text-xs">
                {findLogName(id)}
              </Badge>
            ))}
            {selectedDatasets.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{selectedDatasets.length - 3} more
              </Badge>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
