/**
 * Store Zustand — Panier de vente aligné avec GestionDivers
 * Supporte 2 modes : Autonome (paiement PDA) ou Envoi à la Caisse
 */
import { create } from 'zustand';
import type { 
  Product, 
  LigneFacture, 
  Client, 
  AyantDroit,
  PaymentDetail,
  TicketCaisse,
  CashierQueueItem,
  OperatingMode 
} from '../types';
import { calculateLineTotals, calculateCartTotals } from '../utils/finance';

interface CartState {
  // ─── Configuration ─────────────────────────
  operatingMode: OperatingMode;
  setOperatingMode: (mode: OperatingMode) => void;
  
  // ─── État Panier ──────────────────────────
  lignes: LigneFacture[];
  client: Client | null;
  ayantDroit: AyantDroit | null;
  
  // ─── Paiement (mode autonome) ─────────────
  paiements: PaymentDetail[];
  montantPaye: string;
  monnaieRendu: string;
  
  // ─── Computed (getters) ───────────────────
  totalHT: () => string;
  totalTVA: () => string;
  totalTTC: () => string;
  partPatient: () => string;
  partAssurance: () => string;
  articlesCount: () => number;
  uniqueArticlesCount: () => number;
  
  // ─── Actions Lignes ───────────────────────
  addProduct: (product: Product, quantity?: number) => void;
  removeLigne: (productId: number) => void;
  updateQuantite: (productId: number, quantity: number) => void;
  updatePrixUnitaire: (productId: number, prix: string) => void;
  updateRemise: (productId: number, remise: string) => void;
  incrementQuantite: (productId: number) => void;
  decrementQuantite: (productId: number) => void;
  
  // ─── Actions Lot ─────────────────────────
  setLotForLigne: (productId: number, lotId: number | null, lotText: string | null) => void;
  
  // ─── Actions Client ───────────────────────
  setClient: (client: Client | null) => void;
  setAyantDroit: (ayantDroit: AyantDroit | null) => void;
  
  // ─── Actions Paiement ─────────────────────
  addPayment: (payment: PaymentDetail) => void;
  removePayment: (index: number) => void;
  calculateMonnaie: () => void;
  
  // ─── Sérialisation ───────────────────────
  toTicketCaisse: (vendeurId: number) => TicketCaisse;
  toCashierQueueItem: (pdaId: string) => CashierQueueItem;
  clearCart: () => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  // ─── Configuration ─────────────────────────
  operatingMode: 'cashier_queue', // Par défaut : envoi à la caisse (plus sûr)
  setOperatingMode: (mode) => set({ operatingMode: mode }),
  
  // ─── État ─────────────────────────────────
  lignes: [],
  client: null,
  ayantDroit: null,
  paiements: [],
  montantPaye: '0',
  monnaieRendu: '0',

  // ─── Computed ─────────────────────────────
  totalHT: () => {
    const total = get().lignes.reduce((sum, ligne) => {
      return sum + parseFloat(ligne.total_ht || '0');
    }, 0);
    return total.toFixed(2);
  },

  totalTVA: () => {
    const total = get().lignes.reduce((sum, ligne) => {
      const ht = parseFloat(ligne.total_ht || '0');
      const tva = parseFloat(ligne.tva || '0');
      return sum + (ht * tva / 100);
    }, 0);
    return total.toFixed(2);
  },

  totalTTC: () => {
    return calculateCartTotals(get().lignes).totalTTC;
  },

  partAssurance: () => {
    const { ayantDroit } = get();
    if (!ayantDroit || ayantDroit.taux_couverture <= 0) return '0.00';
    
    const ttc = parseFloat(get().totalTTC());
    const part = ttc * (ayantDroit.taux_couverture / 100);
    return part.toFixed(2);
  },

  partPatient: () => {
    const ttc = parseFloat(get().totalTTC());
    const assurance = parseFloat(get().partAssurance());
    return (ttc - assurance).toFixed(2);
  },

  articlesCount: () => {
    return get().lignes.reduce((sum, ligne) => sum + ligne.quantite, 0);
  },

  uniqueArticlesCount: () => get().lignes.length,

  // ─── Actions Lignes ───────────────────────
  addProduct: (product: Product, quantity: number = 1) => {
    set((state) => {
      const existingIndex = state.lignes.findIndex(
        (l) => l.produit.id === product.id
      );

      if (existingIndex >= 0) {
        // Produit existant → incrémenter
        const updatedLignes = [...state.lignes];
        const existing = updatedLignes[existingIndex];
        const newQty = existing.quantite + quantity;
        
        updatedLignes[existingIndex] = {
          ...existing,
          quantite: newQty,
          ...calculateLineTotals(existing.produit, newQty, existing.remise_produit, existing.tva)
        };
        
        return { lignes: updatedLignes };
      }

      // Nouveau produit
      const tvaDefaut = product.tva?.toString() || '18';
      const prix = product.prix_vente?.toString() || '0';
      
      const newLigne: LigneFacture = {
        produit: product,
        quantite: quantity,
        prix_unitaire: prix,
        remise_produit: '0',
        tva: tvaDefaut,
        ...calculateLineTotals(product, quantity, '0', tvaDefaut)
      };

      return { lignes: [...state.lignes, newLigne] };
    });
  },

  removeLigne: (productId: number) => {
    set((state) => ({
      lignes: state.lignes.filter((l) => l.produit.id !== productId),
    }));
  },

  updateQuantite: (productId: number, quantity: number) => {
    if (quantity <= 0) {
      get().removeLigne(productId);
      return;
    }

    set((state) => ({
      lignes: state.lignes.map((l) =>
        l.produit.id === productId
          ? { 
              ...l, 
              quantite: quantity,
              ...calculateLineTotals(l.produit, quantity, l.remise_produit, l.tva)
            }
          : l
      ),
    }));
  },

  updatePrixUnitaire: (productId: number, prix: string) => {
    set((state) => ({
      lignes: state.lignes.map((l) =>
        l.produit.id === productId
          ? { 
              ...l, 
              prix_unitaire: prix,
              ...calculateLineTotals(l.produit, l.quantite, l.remise_produit, l.tva, prix)
            }
          : l
      ),
    }));
  },

  updateRemise: (productId: number, remise: string) => {
    set((state) => ({
      lignes: state.lignes.map((l) =>
        l.produit.id === productId
          ? { 
              ...l, 
              remise_produit: remise,
              ...calculateLineTotals(l.produit, l.quantite, remise, l.tva)
            }
          : l
      ),
    }));
  },

  incrementQuantite: (productId: number) => {
    const ligne = get().lignes.find((l) => l.produit.id === productId);
    if (ligne) {
      get().updateQuantite(productId, ligne.quantite + 1);
    }
  },

  decrementQuantite: (productId: number) => {
    const ligne = get().lignes.find((l) => l.produit.id === productId);
    if (ligne) {
      if (ligne.quantite <= 1) {
        get().removeLigne(productId);
      } else {
        get().updateQuantite(productId, ligne.quantite - 1);
      }
    }
  },

  // ─── Actions Lot ─────────────────────────
  setLotForLigne: (productId: number, lotId: number | null, lotText: string | null) => {
    set((state) => ({
      lignes: state.lignes.map((l) =>
        l.produit.id === productId
          ? { ...l, lotId, lotText }
          : l
      ),
    }));
  },

  // ─── Actions Client ───────────────────────
  setClient: (client) => set({ client }),
  setAyantDroit: (ayantDroit) => set({ ayantDroit }),

  // ─── Actions Paiement ─────────────────────
  addPayment: (payment) => {
    set((state) => ({
      paiements: [...state.paiements, payment],
    }));
    get().calculateMonnaie();
  },

  removePayment: (index: number) => {
    set((state) => ({
      paiements: state.paiements.filter((_, i) => i !== index),
    }));
    get().calculateMonnaie();
  },

  calculateMonnaie: () => {
    const totalPaye = get().paiements.reduce(
      (sum, p) => sum + parseFloat(p.montant || '0'), 
      0
    );
    const totalTTC = parseFloat(get().totalTTC());
    const monnaie = totalPaye - totalTTC;
    
    set({ 
      montantPaye: totalPaye.toFixed(2),
      monnaieRendu: monnaie > 0 ? monnaie.toFixed(2) : '0.00'
    });
  },

  // ─── Sérialisation ────────────────────────
  toTicketCaisse: (vendeurId: number): TicketCaisse => {
    const state = get();
    const totals = calculateCartTotals(state.lignes);
    
    return {
      id: 0, // Sera attribué par SQLite
      numero_ticket: '', // Sera généré par le serveur
      date_creation: new Date().toISOString(),
      vendeur_id: vendeurId,
      client: state.client || undefined,
      ayant_droit: state.ayantDroit || undefined,
      taux_couverture: state.ayantDroit?.taux_couverture,
      lignes: state.lignes,
      total_ht: totals.totalHT,
      total_tva: totals.totalTVA,
      total_ttc: totals.totalTTC,
      part_assurance: get().partAssurance(),
      part_patient: get().partPatient(),
      paiements: state.paiements,
      monnaie_rendu: state.monnaieRendu,
      status: 'pending',
    };
  },

  toCashierQueueItem: (pdaId: string): CashierQueueItem => {
    const state = get();
    
    return {
      id: crypto.randomUUID(),
      pda_id: pdaId,
      created_at: new Date().toISOString(),
      status: 'waiting',
      lignes: state.lignes,
      client: state.client || undefined,
      ayant_droit: state.ayantDroit || undefined,
      articles_count: get().articlesCount(),
      total_estime: get().totalTTC(),
    };
  },

  clearCart: () => {
    set({ 
      lignes: [], 
      client: null, 
      ayantDroit: null,
      paiements: [],
      montantPaye: '0',
      monnaieRendu: '0',
    });
  },
}));
