'use client';

import { Input } from '@/components/ui/input';
import { Filter } from 'lucide-react';

interface FilterInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function FilterInput({ value, onChange }: FilterInputProps) {
  return (
    <div className="relative flex-1 min-w-[200px]">
      <Filter className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        placeholder='WHERE clause, e.g. status_code >= 500'
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 pl-7 font-mono text-xs"
      />
    </div>
  );
}
