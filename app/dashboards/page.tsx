'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutDashboard } from 'lucide-react';

export default function DashboardsPage() {
  return (
    <div className="flex flex-col h-full items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 rounded-full bg-muted p-4">
            <LayoutDashboard className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle>Dashboards</CardTitle>
          <CardDescription>Dashboard management coming soon. View and manage your Bronto dashboards here.</CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          Dashboards will be synced from your Bronto account.
        </CardContent>
      </Card>
    </div>
  );
}
