'use client';

import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronRight, Folder, MoreHorizontal, Pencil, Trash2, icons, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DashboardFolder } from '@/hooks/use-dashboard-folders';

interface Props {
  folder: DashboardFolder;
  children: React.ReactNode;
  onRename: (folder: DashboardFolder) => void;
  onDelete: (folder: DashboardFolder) => void;
  hideActions?: boolean;
}

export function FolderRow({ folder, children, onRename, onDelete, hideActions }: Props) {
  const [open, setOpen] = useState(false);

  const FolderIcon = (folder.icon && (icons as Record<string, LucideIcon>)[folder.icon]) || Folder;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="group flex items-center px-3 py-2 hover:bg-accent/30 transition-colors">
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
            <ChevronRight
              className={cn(
                'h-3 w-3 text-muted-foreground transition-transform shrink-0',
                open && 'rotate-90'
              )}
            />
            <FolderIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs font-medium truncate">{folder.name}</span>
          </button>
        </CollapsibleTrigger>
        {!hideActions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem className="text-xs gap-2" onClick={() => onRename(folder)}>
                <Pencil className="h-3.5 w-3.5" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs gap-2 text-destructive" onClick={() => onDelete(folder)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <CollapsibleContent>
        <div className="relative ml-[21px]">
          {/* Vertical tree line */}
          <div className="absolute left-0 top-0 bottom-0 w-[2px] rounded-full bg-border" />
          <div className="pl-4">{children}</div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
