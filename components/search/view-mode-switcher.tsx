'use client';

import { VIEW_MODES, VIEW_MODE_LIST, type ViewMode } from '@/lib/view-modes';
import { Code, ChartColumnBig } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const MODE_ICONS: Record<ViewMode, React.ComponentType<{ className?: string }>> = {
  bronto: Code,
  grafana: ChartColumnBig,
};

const MODE_ACTIVE_COLORS: Record<ViewMode, string> = {
  bronto: 'text-[hsl(220,100%,56%)]',
  grafana: 'text-[hsl(25,95%,53%)]',
};

interface ViewModeSwitcherProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewModeSwitcher({ value, onChange }: ViewModeSwitcherProps) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as ViewMode)}>
      <TabsList className="h-8">
        {VIEW_MODE_LIST.map((mode) => {
          const cfg = VIEW_MODES[mode];
          const Icon = MODE_ICONS[mode];
          const active = value === mode;
          return (
            <TabsTrigger key={mode} value={mode} className="gap-1 text-xs h-6 px-2">
              <Icon className={cn('h-3 w-3', active && MODE_ACTIVE_COLORS[mode])} />
              {cfg.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
