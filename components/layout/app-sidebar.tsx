'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Search, LayoutDashboard, ChartArea, Plus, Sparkles, Trash2, GitFork, icons, type LucideIcon } from 'lucide-react';
import { IconPicker } from './icon-picker';
import { NavLink } from '@/components/nav-link';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from './theme-toggle';
import { ApiKeySettings } from './api-key-settings';
import { useCustomFeatures } from '@/lib/custom-features-context';
import { useTheme } from 'next-themes';

const TracesIcon = ({ size = 24, className, ...props }: { size?: number; className?: string; [key: string]: unknown }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    {...props}
  >
    <rect x="2" y="2" width="20" height="5" rx="2" stroke="currentColor" strokeWidth="2" />
    <rect x="5" y="10" width="12" height="5" rx="2" stroke="currentColor" strokeWidth="2" />
    <rect x="12" y="18" width="10" height="5" rx="2" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const items = [
  { title: 'Search', url: '/', icon: Search },
  { title: 'Traces', url: '/traces', icon: TracesIcon },
  { title: 'Dashboards', url: '/dashboards', icon: LayoutDashboard },
  { title: 'Usage', url: '/usage', icon: ChartArea },
];

const featureIdeas = [
  'Executive Dashboard',
  'Error Rate by Service',
  'Top Error Messages',
  'Status Code Breakdown',
  'Request Volume Over Time',
  'Slowest API Endpoints',
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { resolvedTheme } = useTheme();
  const { features, addFeature, removeFeature } = useCustomFeatures();
  const router = useRouter();
  const pathname = usePathname();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [featureName, setFeatureName] = useState('');
  const [featureIcon, setFeatureIcon] = useState('Sparkles');

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const handleCreate = () => {
    const name = featureName.trim();
    if (!name) return;
    const feature = addFeature(name, featureIcon);
    setFeatureName('');
    setFeatureIcon('Sparkles');
    setDialogOpen(false);
    router.push(`/my-features/${feature.id}`);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    removeFeature(deleteTarget.id);
    if (pathname === `/my-features/${deleteTarget.id}`) {
      router.push('/');
    }
    setDeleteTarget(null);
  };

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader className="flex items-center justify-center px-2 pt-4 pb-3 relative h-14">
          <span className={`font-bold text-lg transition-opacity duration-300 ${collapsed ? 'opacity-0' : 'opacity-100'}`}>
            BrontoVibe
          </span>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Core Features</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink
                        href={item.url}
                        end={item.url === '/'}
                        className="hover:bg-sidebar-accent/50 transition-colors"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium hover:!bg-sidebar-accent"
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>My Features</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {features.map((f) => (
                  <SidebarMenuItem key={f.id}>
                    <SidebarMenuButton asChild tooltip={f.name}>
                      <NavLink
                        href={`/my-features/${f.id}`}
                        className="hover:bg-sidebar-accent/50 transition-colors group/feature"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium hover:!bg-sidebar-accent"
                      >
                        {(() => {
                          const Icon = (icons as Record<string, LucideIcon>)[f.icon] || Sparkles;
                          return <Icon className="h-4 w-4" />;
                        })()}
                        <span className="flex-1 truncate">{f.name}</span>
                        {!collapsed && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDeleteTarget({ id: f.id, name: f.name });
                            }}
                            className="opacity-0 group-hover/feature:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Add New Feature">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-center gap-1.5 border-dashed text-muted-foreground hover:text-foreground text-xs h-7"
                      onClick={() => setDialogOpen(true)}
                    >
                      <Plus className="h-3 w-3" />
                      {!collapsed && <span>Add</span>}
                    </Button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter
          className={collapsed ? 'flex flex-col items-center gap-1 pb-3' : 'flex flex-row items-center gap-1 px-3 pb-3'}
        >
          <ApiKeySettings />
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            asChild
          >
            <a
              href="https://github.com/BrontoStephen/v0-github-integration"
              target="_blank"
              rel="noopener noreferrer"
              title="Fork on GitHub"
            >
              <GitFork className="h-4 w-4" />
              <span className="sr-only">Fork on GitHub</span>
            </a>
          </Button>
        </SidebarFooter>
      </Sidebar>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Feature</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <IconPicker value={featureIcon} onChange={setFeatureIcon} />
              <Input
                placeholder="Name your feature..."
                value={featureName}
                onChange={(e) => setFeatureName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="h-9"
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">Or pick an idea to get started:</p>
            <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto pr-1">
              {featureIdeas.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  onClick={() => setFeatureName(idea)}
                  className="rounded-md border border-border px-3 py-2 text-left text-xs text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground transition-colors"
                >
                  {idea}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!featureName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete feature?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
