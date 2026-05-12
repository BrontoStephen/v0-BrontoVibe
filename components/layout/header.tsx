'use client';

import { usePathname } from 'next/navigation';
import { useHeaderSlot } from '@/lib/header-slot-context';
import { useCustomFeatures } from '@/lib/custom-features-context';

const pageTitles: Record<string, string> = {
  '/': 'Search & Explore',
  '/traces': 'Traces',
  '/dashboards': 'Dashboards',
  '/usage': 'Usage',
};

export function Header() {
  const { slot } = useHeaderSlot();
  const pathname = usePathname();
  const { features } = useCustomFeatures();

  let title = pageTitles[pathname];
  if (!title && pathname.startsWith('/my-features/')) {
    const featureId = pathname.split('/my-features/')[1];
    const feature = features.find((f) => f.id === featureId);
    title = feature?.name || 'Custom Feature';
  }
  title = title || 'Search & Explore';

  return (
    <header className="flex h-14 flex-1 items-center justify-between bg-card px-[10px]">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-bold tracking-tight text-foreground">{title}</h1>
      </div>
      <div className="flex items-center gap-2">{slot}</div>
    </header>
  );
}
