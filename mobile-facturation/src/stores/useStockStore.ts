import { create } from 'zustand';

// Dernières valeurs de stock reçues en temps réel via ws/stock/, par
// produit. Le broadcast backend n'envoie que les produits modifiés —
// l'override prime sur product.stock partout où un stock est affiché
// (ProductRow) ou contrôlé (panier → pré-check promis/force).
export interface StockUpdateItem {
  id: number;
  stock: number;
  stock_reserve?: number;
}

interface StockState {
  overrides: Record<number, number>;
  connected: boolean;
  apply: (updates: StockUpdateItem[]) => void;
  setConnected: (connected: boolean) => void;
  reset: () => void;
}

// Cap défensif : la map ne grandit qu'avec les produits touchés pendant
// la session, mais sur une très longue session on oublie les plus
// anciennes clés (l'affichage retombe alors sur product.stock).
const MAX_OVERRIDES = 2000;

export const useStockStore = create<StockState>((set) => ({
  overrides: {},
  connected: false,

  apply: (updates) =>
    set((s) => {
      if (!updates.length) return s;
      const overrides = { ...s.overrides };
      for (const u of updates) {
        if (typeof u?.id === 'number' && typeof u?.stock === 'number') {
          overrides[u.id] = u.stock;
        }
      }
      const keys = Object.keys(overrides);
      if (keys.length > MAX_OVERRIDES) {
        for (const k of keys.slice(0, keys.length - MAX_OVERRIDES)) {
          delete overrides[Number(k)];
        }
      }
      return { overrides };
    }),

  setConnected: (connected) => set({ connected }),
  reset: () => set({ overrides: {}, connected: false }),
}));

// Stock effectif d'un produit : override temps réel si reçu, sinon la
// valeur du serializer. Utilisé hors React (addProduct, pré-checks).
export const effectiveStock = (product: { id: number; stock: number }): number =>
  useStockStore.getState().overrides[product.id] ?? product.stock;
