'use client';

import { useState } from 'react';
import { useApiKey } from '@/lib/api-key-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import axios from 'axios';

const BASE_URL = 'https://api.eu.bronto.io';

interface ApiKeyGateProps {
  children: React.ReactNode;
}

export function ApiKeyGate({ children }: ApiKeyGateProps) {
  const { hasKey, setApiKey } = useApiKey();
  const [draft, setDraft] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (hasKey) return <>{children}</>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = draft.trim();
    if (!key) return;

    setValidating(true);
    setError(null);

    try {
      const res = await axios.get(`${BASE_URL}/logs`, {
        headers: { 'X-BRONTO-API-KEY': key },
        timeout: 15_000,
      });
      const logs = res.data?.logs;
      if (Array.isArray(logs) && logs.length > 0) {
        setApiKey(key);
      } else {
        setError('Connected, but no datasets found for this API key.');
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { error?: string; message?: string } }; code?: string };
      const status = axiosErr.response?.status;
      if (status === 401 || status === 403) {
        setError('Invalid API key. Please check and try again.');
      } else if (axiosErr.code === 'ECONNABORTED') {
        setError('Connection timed out. Please try again.');
      } else {
        const msg =
          axiosErr.response?.data?.error || axiosErr.response?.data?.message || 'Could not connect to Bronto. Please check your API key.';
        setError(String(msg));
      }
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-foreground">BrontoVibe</h1>
          <p className="text-sm text-muted-foreground">Enter your Bronto API key to get started.</p>
        </div>
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              type={showKey ? 'text' : 'password'}
              placeholder="Paste your Bronto API key"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setError(null);
              }}
              className="pr-10 font-mono text-sm h-9"
              autoFocus
              disabled={validating}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button type="submit" size="sm" className="h-9 text-xs" disabled={!draft.trim() || validating}>
            {validating ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="h-3 w-3 ml-1" />
              </>
            )}
          </Button>
        </form>
        {error && <p className="text-xs text-destructive text-center animate-in fade-in slide-in-from-top-1">{error}</p>}
        <p className="text-[11px] text-muted-foreground text-center">Your key is stored only for this browser session.</p>
      </div>
      <div className="absolute bottom-4 left-4">
        <a href="https://www.bronto.io/blog/brontovibe" target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="text-xs bg-card text-foreground hover:bg-accent">
            More info
          </Button>
        </a>
      </div>
      <div className="absolute bottom-4 right-4">
        <ThemeToggle />
      </div>
    </div>
  );
}
