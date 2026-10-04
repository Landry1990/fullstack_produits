import { create } from 'zustand';
import { Platform } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import { useAuthStore } from './useAuthStore';
import type { CartLine, Product, StockLot, Client, AyantDroit, SudoCreds } from '../types';

// Brouillon persisté (kv-store). ⚠️ Les creds Sudo (mots de passe
// superviseur) ne sont JAMAIS sérialisés — ils restent en mémoire.
export interface CartDraft {
  lines: CartLine[];
  client: Client | null;
  ayantDroit: AyantDroit | null;
  remiseGlobale: number;
  remiseMode: 'taux' | 'montant';
}

interface CartState {
  lines: CartLine[];
  client: Client | null;
  ayantDroit: AyantDroit | null;
  remiseGlobale: number;
  remiseMode: 'taux' | 'montant';
  remiseSudoCreds: SudoCreds | null;
  prixSudoCreds: SudoCreds | null;

  // Totaux calculés
  sousTotal: () => number;
  remiseGlobaleMontant: () => number;
  totalTTC: () => number;
  totalArticles: () => number;

  // Actions lignes
  addProduct: (product: Product, qty?: number) => void;
  addLine: (line: CartLine) => void;
  removeLine: (productId: number) => void;
  updateQty: (productId: number, qty: number) => void;
  updatePrix: (productId: number, prix: number) => void;
  updateRemise: (productId: number, remise: number) => void;
  setLot: (productId: number, lot: StockLot | null) => void;

  // Remise globale + validations superviseur
  setRemiseGlobale: (value: number, mode: 'taux' | 'montant') => void;
  setRemiseSudoCreds: (creds: SudoCreds | null) => void;
  setPrixSudoCreds: (creds: SudoCreds | null) => void;

  // Actions client
  setClient: (client: Client | null) => void;
  setAyantDroit: (ad: AyantDroit | null) => void;

  // Restauration d'un brouillon persisté (creds Sudo toujours null)
  hydrate: (draft: CartDraft) => void;

  // Reset
  clear: () => void;
}

function calcLine(line: Omit<CartLine, 'total_ttc'>): CartLine {
  const base = line.prix_unitaire * line.quantite;
  const remise = base * (line.remise / 100);
  // F CFA : pas de centimes
  const total_ttc = Math.round(base - remise);
  return { ...line, total_ttc };
}

export const useCartStore = create<CartState>((set, get) => ({
  lines: [],
  client: null,
  ayantDroit: null,
  remiseGlobale: 0,
  remiseMode: 'taux',
  remiseSudoCreds: null,
  prixSudoCreds: null,

  sousTotal: () => get().lines.reduce((sum, l) => sum + l.total_ttc, 0),
  remiseGlobaleMontant: () => {
    const { remiseGlobale, remiseMode } = get();
    const st = get().sousTotal();
    // F CFA : montant entier, cohérent avec `remise` envoyé au backend
    if (remiseMode === 'taux') return Math.round(st * (remiseGlobale / 100));
    return Math.round(Math.min(remiseGlobale, st));
  },
  totalTTC: () => Math.max(0, get().sousTotal() - get().remiseGlobaleMontant()),
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
        prix_unitaire: parseFloat(product.selling_price),
        remise: 0,
        lotId: null,
        lotText: null,
      });
      set((s) => ({ lines: [...s.lines, newLine] }));
    }
  },

  // Ajoute une ligne telle quelle (fusion d'une vente en attente) —
  // l'appelant garantit que product.id n'existe pas déjà dans le panier.
  addLine: (line) =>
    set((s) => ({ lines: [...s.lines, calcLine(line)] })),

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
          ? { ...l, lotId: lot?.id ?? null, lotText: lot?.lot ?? null, lotExp: lot?.date_expiration ?? null }
          : l
      ),
    })),

  setRemiseGlobale: (value, mode) => set({ remiseGlobale: value, remiseMode: mode }),
  setRemiseSudoCreds: (remiseSudoCreds) => set({ remiseSudoCreds }),
  setPrixSudoCreds: (prixSudoCreds) => set({ prixSudoCreds }),

  // Changement de client = ayant droit précédent invalide
  setClient: (client) => set({ client, ayantDroit: null }),
  setAyantDroit: (ayantDroit) => set({ ayantDroit }),

  // Recalcule total_ttc de chaque ligne via calcLine ; les creds Sudo
  // n'étant jamais persistés, ils restent null après restauration.
  hydrate: (draft) => set({
    lines: (draft.lines ?? []).map((l) => calcLine(l)),
    client: draft.client ?? null,
    ayantDroit: draft.ayantDroit ?? null,
    remiseGlobale: draft.remiseGlobale ?? 0,
    remiseMode: draft.remiseMode ?? 'taux',
    remiseSudoCreds: null,
    prixSudoCreds: null,
  }),

  clear: () => set({
    lines: [],
    client: null,
    ayantDroit: null,
    remiseGlobale: 0,
    remiseMode: 'taux',
    remiseSudoCreds: null,
    prixSudoCreds: null,
  }),
}));

// ─── Brouillon persisté ───────────────────────────────────
// Clé par vendeur (`draft.cart.<username>`) : sur poste partagé, on ne
// restaure jamais le panier d'un autre vendeur. Sauvegarde débouncée
// (400 ms) à chaque mutation — y compris clear() qui écrit le draft vide.
// ⚠️ Jamais les creds Sudo (remiseSudoCreds / prixSudoCreds).
let draftTimer: ReturnType<typeof setTimeout> | null = null;
useCartStore.subscribe((state) => {
  if (draftTimer) clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    draftTimer = null;
    if (Platform.OS === 'web') return;
    const user = useAuthStore.getState().username ?? 'anon';
    const draft: CartDraft = {
      lines: state.lines,
      client: state.client,
      ayantDroit: state.ayantDroit,
      remiseGlobale: state.remiseGlobale,
      remiseMode: state.remiseMode,
    };
    Storage.setItemAsync(`draft.cart.${user}`, JSON.stringify(draft)).catch(() => {});
  }, 400);
});
