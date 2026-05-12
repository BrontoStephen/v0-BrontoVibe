'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

const STORAGE_KEY = 'bronto-api-key';

interface ApiKeyContextValue {
  apiKey: string;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
  hasKey: boolean;
}

const ApiKeyContext = createContext<ApiKeyContextValue | null>(null);

export function ApiKeyProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState] = useState(() => {
    if (typeof window === 'undefined') return '';
    return sessionStorage.getItem(STORAGE_KEY) || '';
  });

  const setApiKey = useCallback((key: string) => {
    const cleaned = key.trim();
    setApiKeyState(cleaned);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY, cleaned);
    }
  }, []);

  const clearApiKey = useCallback(() => {
    setApiKeyState('');
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return (
    <ApiKeyContext.Provider value={{ apiKey, hasKey: !!apiKey, setApiKey, clearApiKey }}>
      {children}
    </ApiKeyContext.Provider>
  );
}

export function useApiKey() {
  const ctx = useContext(ApiKeyContext);
  if (!ctx) throw new Error('useApiKey must be used within ApiKeyProvider');
  return ctx;
}

/** Get the current API key (for use outside React components) */
export function getStoredApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(STORAGE_KEY) || null;
}
