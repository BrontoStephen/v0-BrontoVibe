'use client';

import { useState, useCallback, useEffect } from 'react';

export const FAVORITES_FOLDER_ID = '__favorites__';

export interface DashboardFolder {
  id: string;
  name: string;
  icon: string;
}

export const FAVORITES_FOLDER: DashboardFolder = {
  id: FAVORITES_FOLDER_ID,
  name: 'Favorites',
  icon: 'Star',
};

type FolderAssignments = Record<string, string>; // dashboard_id -> folder_id

const FOLDERS_KEY = 'dashboard-folders';
const ASSIGNMENTS_KEY = 'dashboard-folder-assignments';
const FAVORITES_KEY = 'dashboard-favorites';

function loadFolders(): DashboardFolder[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(FOLDERS_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((f: unknown) => f && typeof f === 'object' && typeof (f as DashboardFolder).id === 'string' && typeof (f as DashboardFolder).name === 'string')
      .map((f: DashboardFolder) => ({ id: f.id, name: f.name, icon: typeof f.icon === 'string' && f.icon ? f.icon : 'Folder' }));
  } catch {
    return [];
  }
}

function loadAssignments(): FolderAssignments {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(ASSIGNMENTS_KEY) || '{}');
  } catch {
    return {};
  }
}

function loadFavorites(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const parsed = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function useDashboardFolders() {
  const [folders, setFolders] = useState<DashboardFolder[]>([]);
  const [assignments, setAssignments] = useState<FolderAssignments>({});
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  // Load from localStorage after mount
  useEffect(() => {
    setFolders(loadFolders());
    setAssignments(loadAssignments());
    setFavorites(loadFavorites());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
    }
  }, [folders, mounted]);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(assignments));
    }
  }, [assignments, mounted]);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
    }
  }, [favorites, mounted]);

  useEffect(() => {
    setAssignments((prev) => {
      const validFolderIds = new Set(folders.map((f) => f.id));
      let changed = false;
      const next: FolderAssignments = {};
      for (const [dashboardId, folderId] of Object.entries(prev)) {
        if (validFolderIds.has(folderId)) {
          next[dashboardId] = folderId;
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [folders]);

  const createFolder = useCallback((name: string, icon: string = 'Folder') => {
    const id = crypto.randomUUID();
    setFolders((prev) => [...prev, { id, name, icon }]);
    return id;
  }, []);

  const renameFolder = useCallback((id: string, name: string, icon?: string) => {
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name, ...(icon ? { icon } : {}) } : f)));
  }, []);

  const deleteFolder = useCallback((id: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setAssignments((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (next[key] === id) delete next[key];
      }
      return next;
    });
  }, []);

  const moveDashboard = useCallback((dashboardId: string, folderId: string | null) => {
    setAssignments((prev) => {
      const next = { ...prev };
      if (folderId) {
        next[dashboardId] = folderId;
      } else {
        delete next[dashboardId];
      }
      return next;
    });
  }, []);

  const getFolderForDashboard = useCallback(
    (dashboardId: string) => assignments[dashboardId] || null,
    [assignments]
  );

  const isFavorite = useCallback(
    (dashboardId: string) => favorites.has(dashboardId),
    [favorites]
  );

  const toggleFavorite = useCallback((dashboardId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(dashboardId)) {
        next.delete(dashboardId);
      } else {
        next.add(dashboardId);
      }
      return next;
    });
  }, []);

  return { folders, assignments, favorites, createFolder, renameFolder, deleteFolder, moveDashboard, getFolderForDashboard, isFavorite, toggleFavorite };
}
