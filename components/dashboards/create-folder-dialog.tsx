'use client';

import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { IconPicker } from '@/components/layout/icon-picker';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string, icon: string) => void;
  initialName?: string;
  initialIcon?: string;
  title?: string;
}

export function CreateFolderDialog({ open, onOpenChange, onSubmit, initialName = '', initialIcon = 'Folder', title }: Props) {
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState(initialIcon);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setIcon(initialIcon);
    }
  }, [open, initialName, initialIcon]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed, icon);
    setName('');
    setIcon('Folder');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title || 'Create Folder'}</DialogTitle>
          <DialogDescription>Choose an icon and enter a name for the folder.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex items-end gap-2">
            <div>
              <Label className="text-xs">Icon</Label>
              <div className="mt-1">
                <IconPicker value={icon} onChange={setIcon} />
              </div>
            </div>
            <div className="flex-1">
              <Label htmlFor="folder-name" className="text-xs">Folder name</Label>
              <Input
                id="folder-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Production"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={!name.trim()}>
              {initialName ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
