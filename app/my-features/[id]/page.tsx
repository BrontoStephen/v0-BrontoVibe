'use client';

import { use } from 'react';
import { useCustomFeatures } from '@/lib/custom-features-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';

export default function CustomFeaturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { features } = useCustomFeatures();
  const feature = features.find((f) => f.id === id);

  if (!feature) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Feature Not Found</CardTitle>
            <CardDescription>This custom feature does not exist or has been deleted.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 rounded-full bg-muted p-4">
            <Sparkles className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle>{feature.name}</CardTitle>
          <CardDescription>This is your custom feature workspace. Build and customize your own views here.</CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          Created: {new Date(feature.createdAt).toLocaleDateString()}
        </CardContent>
      </Card>
    </div>
  );
}
