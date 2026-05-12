'use client';

import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, FolderInput, FolderMinus, Star, StarOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DashboardFolder } from '@/hooks/use-dashboard-folders';
import { FAVORITES_FOLDER_ID } from '@/hooks/use-dashboard-folders';

interface Props {
  folders: DashboardFolder[];
  currentFolderId: string | null;
  isFavorite: boolean;
  onMove: (folderId: string | null) => void;
  onToggleFavorite: () => void;
}

export function DashboardItemMenu({ folders, currentFolderId, isFavorite, onMove, onToggleFavorite }: Props) {
  const nonFavFolders = folders.filter((f) => f.id !== FAVORITES_FOLDER_ID);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground bg-transparent hover:bg-transparent transition-colors"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-52" onClick={(e) => e.stopPropagation()}>
        {/* Favorite toggle */}
        <DropdownMenuItem className="text-xs gap-2" onClick={onToggleFavorite}>
          {isFavorite ? (
            <><StarOff className="h-3.5 w-3.5" /> Remove from Favorites</>
          ) : (
            <><Star className="h-3.5 w-3.5" /> Add to Favorites</>
          )}
        </DropdownMenuItem>

        {/* Move to folder */}
        {nonFavFolders.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="text-xs gap-2">
                <FolderInput className="h-3.5 w-3.5" />
                Move to folder
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-40">
                {nonFavFolders.map((f) => (
                  <DropdownMenuItem
                    key={f.id}
                    className="text-xs"
                    disabled={f.id === currentFolderId}
                    onClick={() => onMove(f.id)}
                  >
                    {f.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}
        {currentFolderId && currentFolderId !== FAVORITES_FOLDER_ID && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs gap-2" onClick={() => onMove(null)}>
              <FolderMinus className="h-3.5 w-3.5" />
              Remove from folder
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
