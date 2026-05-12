'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Network } from 'lucide-react';

export default function TracesPage() {
  return (
    <div className="flex flex-col h-full items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 rounded-full bg-muted p-4">
            <Network className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle>Traces</CardTitle>
          <CardDescription>Distributed tracing view coming soon. This will allow you to explore traces and spans from your Bronto data.</CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          Use the Search page to query your trace data in the meantime.
        </CardContent>
      </Card>
    </div>
  );
}
