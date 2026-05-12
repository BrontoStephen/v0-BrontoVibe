'use client';

import { useState, useMemo, useRef } from 'react';
import { icons, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

const ICON_NAMES: string[] = [
  'Sparkles',
  'BarChart3',
  'LineChart',
  'PieChart',
  'TrendingUp',
  'TrendingDown',
  'Activity',
  'Gauge',
  'Timer',
  'Clock',
  'Zap',
  'Flame',
  'Target',
  'AlertTriangle',
  'AlertCircle',
  'ShieldCheck',
  'Shield',
  'Lock',
  'Eye',
  'Server',
  'Database',
  'HardDrive',
  'Cpu',
  'MemoryStick',
  'Wifi',
  'Globe',
  'Map',
  'MapPin',
  'Navigation',
  'Compass',
  'Users',
  'User',
  'UserCheck',
  'UserX',
  'Bug',
  'Code',
  'Terminal',
  'FileCode',
  'GitBranch',
  'GitCommit',
  'Search',
  'Filter',
  'SlidersHorizontal',
  'Settings',
  'Wrench',
  'Bell',
  'BellRing',
  'Mail',
  'MessageSquare',
  'Send',
  'Layers',
  'LayoutGrid',
  'LayoutList',
  'Table',
  'Kanban',
  'Folder',
  'FileText',
  'ClipboardList',
  'BookOpen',
  'ListChecks',
  'ArrowUpRight',
  'ArrowDownRight',
  'RefreshCw',
  'RotateCcw',
  'Cloud',
  'CloudOff',
  'Download',
  'Upload',
  'Heart',
  'Star',
  'Bookmark',
  'Flag',
  'Tag',
  'Hash',
  'DollarSign',
  'CreditCard',
  'Receipt',
  'Wallet',
  'Boxes',
  'Package',
  'Container',
  'Truck',
  'Microscope',
  'FlaskConical',
  'Beaker',
  'Atom',
  'Network',
  'Workflow',
  'CircuitBoard',
  'Binary',
  'MonitorCheck',
  'MonitorX',
  'Smartphone',
  'Laptop',
];

interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const validIcons = useMemo(() => {
    return ICON_NAMES.filter((name) => name in icons);
  }, []);

  const SelectedIcon = (icons as Record<string, LucideIcon>)[value] || Sparkles;

  return (
    <div className="relative" ref={containerRef}>
      <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" type="button" onClick={() => setOpen(!open)}>
        <SelectedIcon className="h-4 w-4" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 w-72 rounded-md border bg-popover p-2 shadow-md">
            <div className="max-h-60 overflow-y-auto overscroll-contain" onWheel={(e) => e.stopPropagation()}>
              <div className="grid grid-cols-8 gap-1">
                {validIcons.map((name) => {
                  const Icon = (icons as Record<string, LucideIcon>)[name];
                  return (
                    <button
                      key={name}
                      type="button"
                      title={name}
                      onClick={() => {
                        onChange(name);
                        setOpen(false);
                      }}
                      className={`flex items-center justify-center rounded-md p-1.5 transition-colors hover:bg-accent ${
                        value === name ? 'bg-accent text-accent-foreground ring-1 ring-primary' : 'text-muted-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
