'use client';

import type { Widget } from '@/lib/bronto-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WidgetCard } from './widget-card';

interface GroupWidgetCardProps {
  widget: Widget;
  allWidgets: Map<string, Widget>;
  timeRange?: string;
  numOfSlices?: number;
  fromTs?: number;
  toTs?: number;
}

export function GroupWidgetCard({ widget, allWidgets, timeRange, numOfSlices = 20, fromTs, toTs }: GroupWidgetCardProps) {
  const childIds = widget.widget_ids || [];
  const children = childIds.map((id) => allWidgets.get(id)).filter(Boolean) as Widget[];

  if (children.length === 0) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-1 pt-3 px-3">
          <CardTitle className="text-xs font-medium truncate">{widget.name}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
          No child widgets
        </CardContent>
      </Card>
    );
  }

  // Render children in a grid
  const cols = children.length === 1 ? 1 : 2;

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-1 pt-3 px-3 flex-shrink-0">
        <CardTitle className="text-xs font-medium truncate">{widget.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-2 min-h-0 overflow-auto">
        <div
          className="grid gap-2 h-full"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {children.map((child) => (
            <div key={child.id} className="min-h-[120px]">
              <WidgetCard
                widget={child}
                timeRange={timeRange}
                numOfSlices={numOfSlices}
                fromTs={fromTs}
                toTs={toTs}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
