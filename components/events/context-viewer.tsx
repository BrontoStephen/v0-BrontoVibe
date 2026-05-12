"use client";

import { useQuery } from '@tanstack/react-query';
import { fetchContext } from '@/lib/bronto-api';
import type { SearchEvent } from '@/lib/bronto-types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ContextViewerProps {
  contextUrl: string | null;
  onClose: () => void;
}

export function ContextViewer({ contextUrl, onClose }: ContextViewerProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['bronto-context', contextUrl],
    queryFn: () => fetchContext(contextUrl!),
    enabled: !!contextUrl,
  });

  return (
    <Sheet open={!!contextUrl} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Event Context</SheetTitle>
          <SheetDescription>Surrounding log events</SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-120px)] mt-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {(data?.result || []).map((event: SearchEvent, idx: number) => (
                <div
                  key={idx}
                  className="px-2 py-1 rounded text-xs font-mono hover:bg-muted/50"
                >
                  <span className="text-muted-foreground mr-2">
                    {event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : ''}
                  </span>
                  <span className="text-foreground">
                    {event.message || JSON.stringify(event).slice(0, 300)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
