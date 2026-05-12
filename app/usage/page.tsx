'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartArea } from 'lucide-react';

export default function UsagePage() {
  return (
    <div className="flex flex-col h-full items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 rounded-full bg-muted p-4">
            <ChartArea className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle>Usage</CardTitle>
          <CardDescription>Usage analytics coming soon. Track your ingestion, search, and export usage here.</CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          Monitor your Bronto usage patterns and costs.
        </CardContent>
      </Card>
    </div>
  );
}
