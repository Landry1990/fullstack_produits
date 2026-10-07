import { create } from 'zustand';
import { Platform } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import { useAuthStore } from './useAuthStore';
import type { EntreeStockLine, Fournisseur, Product } from '../types';

// Brouillon d'entrée en stock persisté (kv-store) — une réception
// complète peut être longue, la liste survit à la fermeture de l'app.
export interface EntreeStockDraft {
  fournisseur: Fournisseur | null;
  lines: EntreeStockLine[];
  uploadedCommandeId: number | null;
}

export type EntreeEditableField =
  | 'quantity' | 'unites_gratuites' | 'price' | 'tva'
  | 'marge' | 'selling_price' | 'lot' | 'date_expiration';

const num = (v: string | number | undefined | null): number => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

// Recalcule les champs liés comme le web (commande type LOC,
// useCommandeProductLines.updateCommandeProduitField) :
//   prix / marge / TVA modifié → PV TTC = round(achat × marge × (1+tva/100))
//   prix de vente modifié      → marge = (PV / (1+tva/100)) / achat
// Exporté : l'éditeur de ligne travaille sur une copie locale avant de
// committer dans le store — mêmes recalculs dans les deux cas.
export const applyLinkedField = (
  line: EntreeStockLine,
  field: EntreeEditableField,
  value: string
): EntreeStockLine => applyLinked({ ...line, [field]: value }, field);

const applyLinked = (line: EntreeStockLine, field: EntreeEditableField): EntreeStockLine => {
  const next = { ...line };
  if (field === 'price' || field === 'marge' || field === 'tva') {
    const price = num(next.price);
    const marge = num(next.marge || '1');
    const tva = num(next.tva);
    if (price > 0) {
      next.selling_price = String(Math.round(price * marge * (1 + tva / 100)));
    }
  } else if (field === 'selling_price') {
    const price = num(next.price);
    const selling = num(next.selling_price);
    const tva = num(next.tva);
    if (price > 0) {
      next.marge = ((selling / (1 + tva / 100)) / price).toFixed(4);
    }
  }
  return next;
};

// Préremplissage depuis la fiche produit (= selectProduct web) :
// dernier prix d'achat (cost_price), coefficient de marge, TVA et prix
// de vente catalogue.
export const buildEntreeLine = (
  product: Product,
  prefill?: { lot?: string; expiration?: string }
): EntreeStockLine => ({
  key: `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  product,
  quantity: '1',
  unites_gratuites: '0',
  price: product.cost_price || '0',
  tva: product.tva || '0',
  marge: product.taux_marge || '1.3',
  selling_price: product.selling_price || '0',
  lot: prefill?.lot ?? '',
  date_expiration: prefill?.expiration ?? '',
});

interface EntreeStockState {
  fournisseur: Fournisseur | null;
  lines: EntreeStockLine[];
  // Commande déjà créée côté serveur par un envoi partiellement réussi :
  // le retry synchronise sur elle au lieu d'en recréer une (bulk_sync =
  // remplacement total des lignes, sans doublon possible).
  uploadedCommandeId: number | null;
  draftLoaded: boolean;

  totalArticles: () => number;
  totalAchat: () => number;

  setFournisseur: (f: Fournisseur | null) => void;
  addLine: (line: EntreeStockLine) => void;
  updateLine: (key: string, field: EntreeEditableField, value: string) => void;
  replaceLine: (line: EntreeStockLine) => void;
  removeLine: (key: string) => void;
  setUploadedCommandeId: (id: number | null) => void;
  loadDraft: () => Promise<void>;
  hydrate: (draft: EntreeStockDraft) => void;
  clear: () => void;
}

export const useEntreeStockStore = create<EntreeStockState>((set, get) => ({
  fournisseur: null,
  lines: [],
  uploadedCommandeId: null,
  draftLoaded: false,

  totalArticles: () =>
    get().lines.reduce((sum, l) => sum + (parseInt(l.quantity, 10) || 0) + (parseInt(l.unites_gratuites, 10) || 0), 0),
  totalAchat: () =>
    get().lines.reduce((sum, l) => sum + (parseInt(l.quantity, 10) || 0) * num(l.price), 0),

  setFournisseur: (fournisseur) => set({ fournisseur }),

  addLine: (line) => set((s) => ({ lines: [...s.lines, line] })),

  updateLine: (key, field, value) =>
    set((s) => ({
      lines: s.lines.map((l) =>
        l.key === key ? applyLinked({ ...l, [field]: value }, field) : l
      ),
    })),

  replaceLine: (line) =>
    set((s) => ({
      lines: s.lines.map((l) => (l.key === line.key ? line : l)),
    })),

  removeLine: (key) =>
    set((s) => ({ lines: s.lines.filter((l) => l.key !== key) })),

  setUploadedCommandeId: (uploadedCommandeId) => set({ uploadedCommandeId }),

  loadDraft: async () => {
    if (get().draftLoaded || Platform.OS === 'web') {
      set({ draftLoaded: true });
      return;
    }
    const user = useAuthStore.getState().username ?? 'anon';
    try {
      const raw = await Storage.getItemAsync(`draft.entree.${user}`);
      const draft = raw ? (JSON.parse(raw) as EntreeStockDraft) : null;
      if (draft && Array.isArray(draft.lines) && draft.lines.length > 0) {
        get().hydrate(draft);
      }
    } catch {}
    set({ draftLoaded: true });
  },

  hydrate: (draft) => set({
    fournisseur: draft.fournisseur ?? null,
    lines: draft.lines ?? [],
    uploadedCommandeId: draft.uploadedCommandeId ?? null,
    draftLoaded: true,
  }),

  clear: () => set({
    fournisseur: null,
    lines: [],
    uploadedCommandeId: null,
  }),
}));

// ─── Brouillon persisté ───────────────────────────────────
// Clé par vendeur (`draft.entree.<username>`), sauvegarde débouncée —
// même convention que le panier (`draft.cart.<user>`).
let draftTimer: ReturnType<typeof setTimeout> | null = null;
useEntreeStockStore.subscribe((state) => {
  if (!state.draftLoaded) return;
  if (draftTimer) clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    draftTimer = null;
    if (Platform.OS === 'web') return;
    const user = useAuthStore.getState().username ?? 'anon';
    const draft: EntreeStockDraft = {
      fournisseur: state.fournisseur,
      lines: state.lines,
      uploadedCommandeId: state.uploadedCommandeId,
    };
    Storage.setItemAsync(`draft.entree.${user}`, JSON.stringify(draft)).catch(() => {});
  }, 400);
});
