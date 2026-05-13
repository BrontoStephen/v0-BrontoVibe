'use client';

import { useState } from 'react';
import { useApiKey } from '@/lib/api-key-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { useTheme } from 'next-themes';
import axios from 'axios';

const BASE_URL = 'https://api.eu.bronto.io';

interface ApiKeyGateProps {
  children: React.ReactNode;
}

export function ApiKeyGate({ children }: ApiKeyGateProps) {
  const { hasKey, setApiKey, isLoading } = useApiKey();
  const { resolvedTheme } = useTheme();
  const [draft, setDraft] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Show loading state while checking for stored key
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (hasKey) return <>{children}</>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = draft.trim();
    if (!key) return;

    setValidating(true);
    setError(null);

    console.log('[v0] Validating API key...');

    try {
      const res = await axios.get(`${BASE_URL}/logs`, {
        headers: { 'X-BRONTO-API-KEY': key },
        timeout: 15_000,
      });
      console.log('[v0] API response:', res.data);
      const logs = res.data?.logs;
      if (Array.isArray(logs) && logs.length > 0) {
        console.log('[v0] API key valid, found', logs.length, 'datasets');
        setApiKey(key);
      } else {
        console.log('[v0] API key valid but no datasets found');
        setError('Connected, but no datasets found for this API key.');
      }
    } catch (err: unknown) {
      console.log('[v0] API validation error:', err);
      const axiosErr = err as { response?: { status?: number; data?: { error?: string; message?: string } }; code?: string; message?: string };
      const status = axiosErr.response?.status;
      if (status === 401 || status === 403) {
        setError('Invalid API key. Please check and try again.');
      } else if (axiosErr.code === 'ECONNABORTED') {
        setError('Connection timed out. Please try again.');
      } else if (axiosErr.message?.includes('Network Error')) {
        // CORS or network issue - accept the key anyway and let the main app handle validation
        console.log('[v0] Network/CORS error, accepting key for now');
        setApiKey(key);
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
          <div className="flex items-center justify-center gap-4">
            <img
              src={resolvedTheme === 'dark' ? '/bronto-logo-dark.svg' : '/bronto-logo-light.svg'}
              alt="Bronto"
              className="h-10 w-auto"
            />
            <span className="text-muted-foreground text-xl font-light">+</span>
            <img
              src={resolvedTheme === 'dark' ? '/v0-logo-dark.svg' : '/v0-logo-light.svg'}
              alt="v0"
              className="h-7 w-auto"
            />
          </div>
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

        <div className="pt-6 border-t border-border">
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Want your own custom observability dashboard? Deploy on v0 and vibecode your own Bronto UI.
            </p>
            <a
              href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FBrontoStephen%2FBrontoVibe"
              target="_blank"
              rel="noopener noreferrer"
              className="flex justify-center"
            >
              <img src="/deploy-vercel-button.svg" alt="Deploy with Vercel" height="32" />
            </a>
          </div>
        </div>
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
