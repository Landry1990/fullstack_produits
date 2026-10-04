import { create } from 'zustand';
import { Platform } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import { useAuthStore } from './useAuthStore';
import type { PendingSale } from '../types';

// Ventes mises en attente — stockage LOCAL uniquement (kv-store), comme la
// version web (localStorage `ventesEnAttente`) : aucun appel backend. Clé
// par vendeur (`pending.<username>`) pour poste partagé.
// ⚠️ Les creds Sudo ne sont jamais dans PendingSale → une vente restaurée
// avec remise/prix modifié repasse par la revalidation à l'envoi.
const MAX_ITEMS = 50;

const storageKey = () =>
  `pending.${useAuthStore.getState().username ?? 'anon'}`;

const persist = (sales: PendingSale[]) => {
  if (Platform.OS === 'web') return;
  Storage.setItemAsync(storageKey(), JSON.stringify(sales)).catch(() => {});
};

interface PendingState {
  sales: PendingSale[];
  load: () => Promise<void>;
  park: (sale: Omit<PendingSale, 'id' | 'timestamp'>) => void;
  remove: (id: string) => void;
}

export const usePendingStore = create<PendingState>((set, get) => ({
  sales: [],

  load: async () => {
    if (Platform.OS === 'web') {
      set({ sales: [] });
      return;
    }
    try {
      const raw = await Storage.getItemAsync(storageKey());
      const items = raw ? JSON.parse(raw) : [];
      set({ sales: Array.isArray(items) ? items : [] });
    } catch {
      set({ sales: [] });
    }
  },

  park: (sale) => {
    const entry: PendingSale = {
      ...sale,
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
    };
    const sales = [entry, ...get().sales].slice(0, MAX_ITEMS);
    set({ sales });
    persist(sales);
  },

  remove: (id) => {
    const sales = get().sales.filter((s) => s.id !== id);
    set({ sales });
    persist(sales);
  },
}));
