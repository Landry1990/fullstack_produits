import { create } from 'zustand';
import type { CartLine, Product, StockLot, Client, AyantDroit } from '../types';

interface CartState {
  lines: CartLine[];
  client: Client | null;
  ayantDroit: AyantDroit | null;

  // Totaux calculés
  totalTTC: () => number;
  totalArticles: () => number;

  // Actions lignes
  addProduct: (product: Product, qty?: number) => void;
  removeLine: (productId: number) => void;
  updateQty: (productId: number, qty: number) => void;
  updatePrix: (productId: number, prix: number) => void;
  updateRemise: (productId: number, remise: number) => void;
  setLot: (productId: number, lot: StockLot | null) => void;

  // Actions client
  setClient: (client: Client | null) => void;
  setAyantDroit: (ad: AyantDroit | null) => void;

  // Reset
  clear: () => void;
}

function calcLine(line: Omit<CartLine, 'total_ttc'>): CartLine {
  const base = line.prix_unitaire * line.quantite;
  const remise = base * (line.remise / 100);
  const total_ttc = base - remise;
  return { ...line, total_ttc };
}

export const useCartStore = create<CartState>((set, get) => ({
  lines: [],
  client: null,
  ayantDroit: null,

  totalTTC: () => get().lines.reduce((sum, l) => sum + l.total_ttc, 0),
  totalArticles: () => get().lines.reduce((sum, l) => sum + l.quantite, 0),

  addProduct: (product, qty = 1) => {
    const existing = get().lines.find((l) => l.product.id === product.id);
    if (existing) {
      set((s) => ({
        lines: s.lines.map((l) =>
          l.product.id === product.id
            ? calcLine({ ...l, quantite: l.quantite + qty })
            : l
        ),
      }));
    } else {
      const newLine = calcLine({
        product,
        quantite: qty,
        prix_unitaire: parseFloat(product.prix_vente),
        remise: 0,
        lotId: null,
        lotText: null,
      });
      set((s) => ({ lines: [...s.lines, newLine] }));
    }
  },

  removeLine: (productId) =>
    set((s) => ({ lines: s.lines.filter((l) => l.product.id !== productId) })),

  updateQty: (productId, qty) => {
    if (qty <= 0) { get().removeLine(productId); return; }
    set((s) => ({
      lines: s.lines.map((l) =>
        l.product.id === productId ? calcLine({ ...l, quantite: qty }) : l
      ),
    }));
  },

  updatePrix: (productId, prix) =>
    set((s) => ({
      lines: s.lines.map((l) =>
        l.product.id === productId ? calcLine({ ...l, prix_unitaire: prix }) : l
      ),
    })),

  updateRemise: (productId, remise) =>
    set((s) => ({
      lines: s.lines.map((l) =>
        l.product.id === productId ? calcLine({ ...l, remise }) : l
      ),
    })),

  setLot: (productId, lot) =>
    set((s) => ({
      lines: s.lines.map((l) =>
        l.product.id === productId
          ? { ...l, lotId: lot?.id ?? null, lotText: lot?.lot ?? null }
          : l
      ),
    })),

  setClient: (client) => set({ client }),
  setAyantDroit: (ayantDroit) => set({ ayantDroit }),

  clear: () => set({ lines: [], client: null, ayantDroit: null }),
}));
