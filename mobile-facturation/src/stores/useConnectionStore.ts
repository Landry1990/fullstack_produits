/**
 * Store Zustand — État de connexion réseau et configuration serveur
 */
import { create } from 'zustand';

interface ConnectionState {
  // ─── État réseau ───────────────────────────
  isOnline: boolean;
  serverUrl: string | null;
  isServerConfigured: boolean;

  // ─── État synchronisation ──────────────────
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: string | null;

  // ─── Actions ───────────────────────────────
  setOnline: (isOnline: boolean) => void;
  setServerUrl: (url: string) => void;
  clearServerUrl: () => void;
  setSyncing: (isSyncing: boolean) => void;
  setPendingCount: (count: number) => void;
  setLastSyncAt: (date: string | null) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  isOnline: false,
  serverUrl: null,
  isServerConfigured: false,

  isSyncing: false,
  pendingCount: 0,
  lastSyncAt: null,

  setOnline: (isOnline) => set({ isOnline }),

  setServerUrl: (url) => set({ serverUrl: url, isServerConfigured: true }),

  clearServerUrl: () => set({ serverUrl: null, isServerConfigured: false }),

  setSyncing: (isSyncing) => set({ isSyncing }),

  setPendingCount: (count) => set({ pendingCount: count }),

  setLastSyncAt: (date) => set({ lastSyncAt: date }),
}));
