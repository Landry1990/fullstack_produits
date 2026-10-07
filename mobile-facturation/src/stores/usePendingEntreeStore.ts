import { create } from 'zustand';
import { Platform } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import { useAuthStore } from './useAuthStore';
import type { PendingEntree } from '../types';

// Réceptions mises en attente — stockage LOCAL uniquement (kv-store),
// comme les ventes en attente (`pending.<user>`) : aucun appel backend.
// Clé par vendeur (`pending.entree.<username>`) pour poste partagé.
const MAX_ITEMS = 30;

const storageKey = () =>
  `pending.entree.${useAuthStore.getState().username ?? 'anon'}`;

const persist = (entries: PendingEntree[]) => {
  if (Platform.OS === 'web') return;
  Storage.setItemAsync(storageKey(), JSON.stringify(entries)).catch(() => {});
};

interface PendingEntreeState {
  entries: PendingEntree[];
  load: () => Promise<void>;
  park: (entree: Omit<PendingEntree, 'id' | 'timestamp'>) => void;
  remove: (id: string) => void;
}

export const usePendingEntreeStore = create<PendingEntreeState>((set, get) => ({
  entries: [],

  load: async () => {
    if (Platform.OS === 'web') {
      set({ entries: [] });
      return;
    }
    try {
      const raw = await Storage.getItemAsync(storageKey());
      const items = raw ? JSON.parse(raw) : [];
      set({ entries: Array.isArray(items) ? items : [] });
    } catch {
      set({ entries: [] });
    }
  },

  park: (entree) => {
    const entry: PendingEntree = {
      ...entree,
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
    };
    const entries = [entry, ...get().entries].slice(0, MAX_ITEMS);
    set({ entries });
    persist(entries);
  },

  remove: (id) => {
    const entries = get().entries.filter((e) => e.id !== id);
    set({ entries });
    persist(entries);
  },
}));
