'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export interface CustomFeature {
  id: string;
  name: string;
  icon: string;
  createdAt: number;
}

interface CustomFeaturesContextValue {
  features: CustomFeature[];
  addFeature: (name: string, icon?: string) => CustomFeature;
  removeFeature: (id: string) => void;
}

const STORAGE_KEY = 'bronto-custom-features';

const CustomFeaturesContext = createContext<CustomFeaturesContextValue | null>(null);

export function CustomFeaturesProvider({ children }: { children: ReactNode }) {
  const [features, setFeatures] = useState<CustomFeature[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on client side
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setFeatures(JSON.parse(stored));
      }
    } catch {
      // Ignore errors
    }
    setIsHydrated(true);
  }, []);

  // Save to localStorage when features change
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(features));
    }
  }, [features, isHydrated]);

  const addFeature = useCallback((name: string, icon: string = 'Sparkles') => {
    const feature: CustomFeature = {
      id: crypto.randomUUID(),
      name,
      icon,
      createdAt: Date.now(),
    };
    setFeatures((prev) => [...prev, feature]);
    return feature;
  }, []);

  const removeFeature = useCallback((id: string) => {
    setFeatures((prev) => prev.filter((f) => f.id !== id));
  }, []);

  return (
    <CustomFeaturesContext.Provider value={{ features, addFeature, removeFeature }}>
      {children}
    </CustomFeaturesContext.Provider>
  );
}

export function useCustomFeatures() {
  const ctx = useContext(CustomFeaturesContext);
  if (!ctx) throw new Error('useCustomFeatures must be used within CustomFeaturesProvider');
  return ctx;
}
