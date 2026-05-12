'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState, type ReactNode } from 'react';
import { ApiKeyProvider } from '@/lib/api-key-context';
import { CustomFeaturesProvider } from '@/lib/custom-features-context';
import { HeaderSlotProvider } from '@/lib/header-slot-context';
import { Toaster } from '@/components/ui/sonner';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <ApiKeyProvider>
          <CustomFeaturesProvider>
            <HeaderSlotProvider>
              {children}
              <Toaster />
            </HeaderSlotProvider>
          </CustomFeaturesProvider>
        </ApiKeyProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
