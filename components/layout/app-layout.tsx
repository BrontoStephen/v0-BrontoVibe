'use client';

import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './app-sidebar';
import { Header } from './header';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <div className="flex items-center border-b border-border px-2">
            <SidebarTrigger className="mr-2" />
            <Header />
          </div>
          <main className="flex-1 overflow-hidden p-4 min-w-0 px-[10px] py-[10px]">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
