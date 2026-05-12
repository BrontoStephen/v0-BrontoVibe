'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fetchDashboards, fetchDashboard } from '@/lib/bronto-api';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, AlertCircle, PanelLeftClose, PanelLeftOpen, Clock, CalendarIcon, BarChart3, LayoutGrid, FolderPlus, LayoutDashboard, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { DashboardDetail } from '@/components/dashboards/dashboard-detail';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useHeaderSlot } from '@/lib/header-slot-context';
import { useDashboardFolders, FAVORITES_FOLDER, type DashboardFolder } from '@/hooks/use-dashboard-folders';
import { CreateFolderDialog } from '@/components/dashboards/create-folder-dialog';
import { DashboardItemMenu } from '@/components/dashboards/dashboard-item-menu';
import { FolderRow } from '@/components/dashboards/folder-row';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Dashboard } from '@/lib/bronto-types';

const QUICK_RANGES = [
  'Last 5 minutes', 'Last 15 minutes', 'Last 20 minutes', 'Last 30 minutes',
  'Last 1 hour', 'Last 2 hours', 'Last 6 hours', 'Last 12 hours',
  'Last 24 hours', 'Last 2 days', 'Last 7 days', 'Last 30 days',
];

export default function DashboardsPageWrapper() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <DashboardsPage />
    </Suspense>
  );
}

function DashboardsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [listCollapsed, setListCollapsed] = useState(false);

  // Folder state
  const { folders, assignments, createFolder, renameFolder, deleteFolder, moveDashboard, getFolderForDashboard, isFavorite, toggleFavorite } = useDashboardFolders();
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<DashboardFolder | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<DashboardFolder | null>(null);

  // Time controls
  const [timeMode, setTimeMode] = useState<'quick' | 'custom'>('quick');
  const [quickRange, setQuickRange] = useState('Last 20 minutes');
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();
  const [numOfSlices, setNumOfSlices] = useState(20);
  const [autoFit, setAutoFit] = useState(true);

  const timeRange = timeMode === 'quick' ? quickRange : undefined;
  const fromTs = timeMode === 'custom' && fromDate ? fromDate.getTime() : undefined;
  const toTs = timeMode === 'custom' && toDate ? toDate.getTime() : undefined;

  const { data: dashboards = [], isLoading, error: listError } = useQuery({
    queryKey: ['bronto-dashboards'],
    queryFn: () => fetchDashboards(),
  });

  useEffect(() => {
    if (!selectedId && dashboards.length > 0) {
      setSelectedId(dashboards[0].dashboard_id);
    }
  }, [dashboards, selectedId]);

  const { data: dashboardDetail, isLoading: isLoadingDetail, error: detailError } = useQuery({
    queryKey: ['bronto-dashboard', selectedId],
    queryFn: () => fetchDashboard(selectedId!),
    enabled: !!selectedId,
  });

  const searchTerm = search.trim().toLowerCase();

  const { setSlot } = useHeaderSlot();

  useEffect(() => {
    setSlot(
      <div className="flex items-center gap-2 flex-wrap">
        {/* Time Range */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Clock className="h-3.5 w-3.5" />
              {timeMode === 'quick'
                ? quickRange
                : fromDate && toDate
                  ? `${format(fromDate, 'MMM d HH:mm')} - ${format(toDate, 'MMM d HH:mm')}`
                  : 'Custom range'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <div className="flex">
              <div className="border-r border-border p-2 space-y-0.5 max-h-72 overflow-auto">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase px-2 pb-1">Quick</p>
                {QUICK_RANGES.map((r) => (
                  <button
                    key={r}
                    onClick={() => { setTimeMode('quick'); setQuickRange(r); }}
                    className={cn(
                      'block w-full text-left text-xs px-2 py-1 rounded hover:bg-accent',
                      timeMode === 'quick' && quickRange === r && 'bg-accent font-medium'
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div className="p-3 space-y-3 min-w-[240px]">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase">Custom Range</p>
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">From</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn('w-full justify-start text-xs', !fromDate && 'text-muted-foreground')}>
                          <CalendarIcon className="h-3 w-3 mr-1.5" />
                          {fromDate ? format(fromDate, 'PPP HH:mm') : 'Select start'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={fromDate}
                          onSelect={(d) => { setFromDate(d); setTimeMode('custom'); }}
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label className="text-xs">To</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn('w-full justify-start text-xs', !toDate && 'text-muted-foreground')}>
                          <CalendarIcon className="h-3 w-3 mr-1.5" />
                          {toDate ? format(toDate, 'PPP HH:mm') : 'Select end'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={toDate}
                          onSelect={(d) => { setToDate(d); setTimeMode('custom'); }}
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Num of slices */}
        <div className="flex items-center gap-1.5">
          <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="number"
            min={1}
            max={500}
            value={numOfSlices}
            onChange={(e) => setNumOfSlices(Math.max(1, Number(e.target.value) || 20))}
            className="w-16 h-8 text-xs"
          />
          <span className="text-xs text-muted-foreground">slices</span>
        </div>

        {/* Auto-fit */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={autoFit ? 'default' : 'outline'}
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => setAutoFit(!autoFit)}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Auto-fit
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">Redistribute widgets evenly across the grid</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
    return () => setSlot(null);
  }, [timeMode, quickRange, fromDate, toDate, numOfSlices, autoFit, setSlot]);

  return (
    <div className="h-full flex gap-3">
      {/* Collapsible list panel */}
      {!listCollapsed && (
        <div className="h-full flex-shrink-0" style={{ width: '30%', minWidth: 240, maxWidth: 400 }}>
          <div className="h-full flex flex-col rounded-lg border border-border bg-card overflow-hidden shadow-md">
            <div className="px-2.5 pt-2.5 pb-1.5 flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setListCollapsed(true)}
              >
                <PanelLeftClose className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                <Input
                  placeholder="Search dashboards..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-sm border-border/60 focus-visible:border-border/25 placeholder:text-muted-foreground/40 placeholder:font-light"
                />
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => setCreateFolderOpen(true)}
                    >
                      <FolderPlus className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom"><p className="text-xs">Create folder</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex-1 min-h-0">
              <ScrollArea className="h-full">
                {isLoading ? (
                  <div className="space-y-1 p-2.5">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full rounded" />
                    ))}
                  </div>
                ) : listError ? (
                  <div className="flex flex-col items-center justify-center py-16 text-destructive">
                    <AlertCircle className="h-10 w-10 mb-3 opacity-50" />
                    <p className="text-xs">{listError instanceof Error ? listError.message : 'Failed to load dashboards'}</p>
                  </div>
                ) : (() => {
                  const dashboardMatchesSearch = (d: Dashboard) => d.name.toLowerCase().includes(searchTerm);

                  const favDashboards = dashboards.filter(
                    (d: Dashboard) => isFavorite(d.dashboard_id) && (!searchTerm || dashboardMatchesSearch(d))
                  );
                  const showFavorites = !searchTerm || favDashboards.length > 0 || 'favorites'.includes(searchTerm);

                  const foldered = folders.map((folder) => {
                    const inFolder = dashboards.filter((d: Dashboard) => assignments[d.dashboard_id] === folder.id);
                    const matchedInFolder = searchTerm ? inFolder.filter(dashboardMatchesSearch) : inFolder;
                    const folderMatches = searchTerm ? folder.name.toLowerCase().includes(searchTerm) : true;
                    return {
                      folder,
                      dashboards: matchedInFolder,
                      visible: folderMatches || matchedInFolder.length > 0,
                    };
                  });

                  const unassigned = dashboards.filter(
                    (d: Dashboard) => !assignments[d.dashboard_id] && !isFavorite(d.dashboard_id) && (!searchTerm || dashboardMatchesSearch(d))
                  );

                  const hasVisibleContent = showFavorites || foldered.some((f) => f.visible) || unassigned.length > 0;
                  if (!hasVisibleContent) {
                    return (
                      <div className="py-6 text-center text-xs text-muted-foreground">
                        {searchTerm ? 'No matching dashboards found' : 'No dashboards found'}
                      </div>
                    );
                  }

                  const renderDashboardRow = (d: Dashboard) => (
                    <div
                      key={d.dashboard_id}
                      onClick={() => setSelectedId(d.dashboard_id)}
                      className={cn(
                        'group px-2 py-2.5 cursor-pointer transition-all duration-200 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1',
                        selectedId === d.dashboard_id ? 'bg-accent/60' : 'hover:bg-accent/30'
                      )}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <LayoutDashboard className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="font-normal text-xs leading-tight truncate min-w-0">{d.name}</span>
                      </div>
                      <DashboardItemMenu
                        folders={folders}
                        currentFolderId={getFolderForDashboard(d.dashboard_id)}
                        isFavorite={isFavorite(d.dashboard_id)}
                        onMove={(folderId) => moveDashboard(d.dashboard_id, folderId)}
                        onToggleFavorite={() => toggleFavorite(d.dashboard_id)}
                      />
                    </div>
                  );

                  return (
                    <div>
                      {showFavorites && (
                        <FolderRow
                          folder={FAVORITES_FOLDER}
                          onRename={() => {}}
                          onDelete={() => {}}
                          hideActions
                        >
                          {favDashboards.length > 0
                            ? favDashboards.map(renderDashboardRow)
                            : <div className="px-3 py-2 text-[11px] text-muted-foreground/50 italic">No favorites yet</div>
                          }
                        </FolderRow>
                      )}
                      {foldered.map(({ folder, dashboards: fDashboards, visible }) =>
                        visible ? (
                          <FolderRow
                            key={folder.id}
                            folder={folder}
                            onRename={(f) => setRenamingFolder(f)}
                            onDelete={(f) => setDeletingFolder(f)}
                          >
                            {fDashboards.length > 0
                              ? fDashboards.map(renderDashboardRow)
                              : <div className="px-3 py-2 text-[11px] text-muted-foreground/50 italic">No dashboards</div>
                            }
                          </FolderRow>
                        ) : null
                      )}
                      {unassigned.map(renderDashboardRow)}
                    </div>
                  );
                })()}
              </ScrollArea>
            </div>
          </div>
        </div>
      )}

      {/* Create folder dialog */}
      <CreateFolderDialog
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        onSubmit={(name, icon) => createFolder(name, icon)}
      />

      {/* Rename folder dialog */}
      {renamingFolder && (
        <CreateFolderDialog
          open={!!renamingFolder}
          onOpenChange={(v) => { if (!v) setRenamingFolder(null); }}
          onSubmit={(name, icon) => { renameFolder(renamingFolder.id, name, icon); setRenamingFolder(null); }}
          initialName={renamingFolder.name}
          initialIcon={renamingFolder.icon}
          title="Rename Folder"
        />
      )}

      {/* Delete folder confirmation */}
      <AlertDialog open={!!deletingFolder} onOpenChange={(v) => { if (!v) setDeletingFolder(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder &quot;{deletingFolder?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Dashboards inside will be moved to the top level. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deletingFolder) { deleteFolder(deletingFolder.id); setDeletingFolder(null); } }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Right panel */}
      <div className="flex-1 min-w-0 h-full overflow-auto">
        {!selectedId ? (
          <div className="flex flex-col items-center justify-center h-full">
            {listCollapsed && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 absolute top-2 left-2"
                onClick={() => setListCollapsed(false)}
              >
                <PanelLeftOpen className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            )}
            <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center mb-3">
              <Search className="h-[18px] w-[18px] text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-foreground/70">No Dashboard Selected</p>
            <p className="text-[11px] text-muted-foreground/50 mt-1 leading-relaxed max-w-[240px] text-center">
              Choose a dashboard from the list to view its widgets and data
            </p>
          </div>
        ) : detailError ? (
          <>
            {listCollapsed && (
              <div className="flex items-center gap-2 mb-4">
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setListCollapsed(false)}>
                  <PanelLeftOpen className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            )}
            <Alert variant="destructive" className="m-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {detailError instanceof Error ? detailError.message : 'Failed to load dashboard'}
              </AlertDescription>
            </Alert>
          </>
        ) : (
          <>
            {listCollapsed && (
              <div className="flex items-center gap-2 mb-4 pt-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setListCollapsed(false)}>
                  <PanelLeftOpen className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
                {dashboardDetail && (
                  <h2 className="text-sm font-medium truncate">{dashboardDetail.name}</h2>
                )}
              </div>
            )}
            <DashboardDetail
              dashboard={dashboardDetail}
              isLoading={isLoadingDetail}
              timeRange={timeRange}
              fromTs={fromTs}
              toTs={toTs}
              numOfSlices={numOfSlices}
              autoFit={autoFit}
            />
          </>
        )}
      </div>
    </div>
  );
}
