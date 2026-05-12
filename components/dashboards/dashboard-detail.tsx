'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import type { Dashboard, Widget } from '@/lib/bronto-types';
import { Skeleton } from '@/components/ui/skeleton';
import { WidgetCard } from './widget-card';
import { GroupWidgetCard } from './group-widget-card';

interface DashboardDetailProps {
  dashboard?: Dashboard;
  isLoading: boolean;
  timeRange?: string;
  fromTs?: number;
  toTs?: number;
  numOfSlices: number;
  autoFit: boolean;
}

export function DashboardDetail({ dashboard, isLoading, timeRange, fromTs, toTs, numOfSlices, autoFit }: DashboardDetailProps) {
  const widgets = dashboard?.widgets || [];
  const widgetLayouts = dashboard?.layout?.widget_layouts || [];
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) {
        setWidth(w);
        setMounted(true);
      }
    };
    measure();
    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    return () => observer.disconnect();
  }, [isLoading]);

  const widgetMap = useMemo(() => {
    const map = new Map<string, Widget>();
    for (const w of widgets) {
      map.set(w.id, w);
    }
    return map;
  }, [widgets]);

  const renderableIds = useMemo(() => {
    if (widgetLayouts.length > 0) {
      return widgetLayouts.map((wl, idx) => wl.id || wl.widget_id || widgets[idx]?.id || `widget-${idx}`);
    }
    return widgets.map((w) => w.id);
  }, [widgets, widgetLayouts]);

  const layout = useMemo(() => {
    const count = renderableIds.length;

    if (autoFit && count > 0) {
      const cols = 2;
      const colW = 6;
      const rowH = 2;
      return renderableIds.map((id, idx) => ({
        i: id,
        x: (idx % cols) * colW,
        y: Math.floor(idx / cols) * rowH,
        w: colW,
        h: rowH,
        minW: 2,
        minH: 2,
      }));
    }

    if (widgetLayouts.length > 0) {
      return widgetLayouts.map((wl, idx) => {
        const id = wl.id || wl.widget_id || widgets[idx]?.id || `widget-${idx}`;
        const gridW = Math.max(Math.round((wl.w ?? 1) * 12), 2);
        const gridX = Math.round((wl.x ?? 0) * 12);
        const clampedX = Math.min(gridX, 12 - gridW);
        return {
          i: id,
          x: Math.max(0, clampedX),
          y: wl.y ?? 0,
          w: gridW,
          h: wl.h ?? 2,
          minW: 2,
          minH: 2,
        };
      });
    }
    return widgets.map((w, idx) => ({
      i: w.id,
      x: (idx % 2) * 6,
      y: Math.floor(idx / 2) * 2,
      w: 6,
      h: 2,
      minW: 2,
      minH: 2,
    }));
  }, [widgets, widgetLayouts, autoFit, renderableIds]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return <p className="text-muted-foreground">Dashboard not found</p>;
  }

  return (
    <div ref={containerRef}>
      {widgets.length === 0 && widgetLayouts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No widgets in this dashboard</p>
      ) : !mounted ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: Math.min(4, renderableIds.length) }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <GridLayout
          className="layout"
          layout={layout}
          cols={12}
          rowHeight={40}
          width={width}
          isDraggable={!autoFit}
          isResizable={!autoFit}
          compactType="vertical"
          margin={[12, 12]}
          containerPadding={[0, 0]}
        >
          {layout.map((item) => {
            const widget = widgetMap.get(item.i);
            return (
              <div key={item.i} className="h-full">
                {widget ? (
                  widget.type === 'group' ? (
                    <GroupWidgetCard
                      widget={widget}
                      allWidgets={widgetMap}
                      timeRange={timeRange}
                      numOfSlices={numOfSlices}
                      fromTs={fromTs}
                      toTs={toTs}
                    />
                  ) : (
                    <WidgetCard
                      widget={widget}
                      timeRange={timeRange}
                      numOfSlices={numOfSlices}
                      fromTs={fromTs}
                      toTs={toTs}
                    />
                  )
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground border border-dashed border-border rounded">
                    Layout item: {item.i.slice(0, 8)}...
                  </div>
                )}
              </div>
            );
          })}
        </GridLayout>
      )}
    </div>
  );
}
