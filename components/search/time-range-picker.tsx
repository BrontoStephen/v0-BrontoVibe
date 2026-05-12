'use client';

import { TIME_RANGES, type TimeRange } from '@/lib/bronto-utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock } from 'lucide-react';

interface TimeRangePickerProps {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
}

export function TimeRangePicker({ value, onChange }: TimeRangePickerProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as TimeRange)}>
      <SelectTrigger className="h-8 w-[150px] text-xs">
        <Clock className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TIME_RANGES.map((tr) => (
          <SelectItem key={tr} value={tr}>
            {tr}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
