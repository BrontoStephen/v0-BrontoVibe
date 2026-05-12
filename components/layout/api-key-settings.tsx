'use client';

import { useState } from 'react';
import { useApiKey } from '@/lib/api-key-context';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Check, KeyRound, LogOut } from 'lucide-react';

export function ApiKeySettings() {
  const { apiKey, setApiKey, clearApiKey } = useApiKey();
  const [draft, setDraft] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);
  const [open, setOpen] = useState(false);

  const handleSave = () => {
    if (draft.trim()) {
      setApiKey(draft);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-primary">
          <KeyRound className="h-4 w-4" />
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-sm text-foreground">API Key</h4>
            <p className="text-xs text-muted-foreground mt-1">Update or clear your Bronto API key.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="api-key" className="text-xs">
              API Key
            </Label>
            <div className="relative">
              <Input
                id="api-key"
                type={showKey ? 'text' : 'password'}
                placeholder="Paste your Bronto API key"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="pr-8 text-xs font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="text-xs" onClick={handleSave} disabled={!draft.trim()}>
                <Check className="h-3 w-3 mr-1" />
                Save
              </Button>
              <Button size="sm" variant="outline" className="text-xs" onClick={clearApiKey}>
                <LogOut className="h-3 w-3 mr-1" />
                Sign Out
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">Stored in your browser session only.</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
