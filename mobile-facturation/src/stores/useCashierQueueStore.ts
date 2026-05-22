/**
 * Store Zustand — File d'attente pour envoi à la Caisse Centrale
 * Gère les ventes scannées sur PDA qui attendent d'être traitées par la caisse
 */
import { create } from 'zustand';
import type { 
  CashierQueueItem, 
  TicketCaisse,
  LigneFacture,
  Client,
  AyantDroit 
} from '../types';

interface CashierQueueState {
  // ─── État ─────────────────────────────────
  items: CashierQueueItem[];
  pdaId: string;
  
  // ─── Computed ─────────────────────────────
  waitingCount: () => number;
  processingCount: () => number;
  completedToday: () => number;
  
  // ─── Actions ──────────────────────────────
  addToQueue: (
    lignes: LigneFacture[],
    client: Client | null,
    ayantDroit: AyantDroit | null
  ) => CashierQueueItem;
  
  markAsProcessing: (id: string) => void;
  markAsCompleted: (id: string, ticket: TicketCaisse) => void;
  markAsCancelled: (id: string, reason?: string) => void;
  removeFromQueue: (id: string) => void;
  
  // ─── Sync ─────────────────────────────────
  getPendingItems: () => CashierQueueItem[];
  loadPendingItems: () => CashierQueueItem[];
  clearCompleted: () => void;
  
  // ─── Initialisation ───────────────────────
  setPdaId: (id: string) => void;
}

// Générer un ID PDA unique si pas déjà défini
const generatePdaId = (): string => {
  return `PDA-${Date.now().toString(36).toUpperCase()}`;
};

export const useCashierQueueStore = create<CashierQueueState>((set, get) => ({
  // ─── État ─────────────────────────────────
  items: [],
  pdaId: generatePdaId(),

  // ─── Computed ─────────────────────────────
  waitingCount: () => {
    return get().items.filter((i) => i.status === 'waiting').length;
  },

  processingCount: () => {
    return get().items.filter((i) => i.status === 'processing').length;
  },

  completedToday: () => {
    const today = new Date().toISOString().split('T')[0];
    return get().items.filter(
      (i) => i.status === 'completed' && i.completed_at?.startsWith(today)
    ).length;
  },

  // ─── Actions ──────────────────────────────
  addToQueue: (lignes, client, ayantDroit) => {
    const newItem: CashierQueueItem = {
      id: crypto.randomUUID(),
      pda_id: get().pdaId,
      created_at: new Date().toISOString(),
      status: 'waiting',
      lignes,
      client: client || undefined,
      ayant_droit: ayantDroit || undefined,
      articles_count: lignes.reduce((sum, l) => sum + l.quantite, 0),
      total_estime: lignes
        .reduce((sum, l) => sum + parseFloat(l.total_ttc || '0'), 0)
        .toFixed(2),
    };

    set((state) => ({
      items: [newItem, ...state.items],
    }));

    return newItem;
  },

  markAsProcessing: (id) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, status: 'processing' } : item
      ),
    }));
  },

  markAsCompleted: (id, ticket) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id
          ? {
              ...item,
              status: 'completed',
              ticket_number: ticket.numero_ticket,
              completed_at: new Date().toISOString(),
            }
          : item
      ),
    }));
  },

  markAsCancelled: (id, reason) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id
          ? { 
              ...item, 
              status: 'cancelled',
              // On garde le reason pour debug
            }
          : item
      ),
    }));
  },

  removeFromQueue: (id) => {
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    }));
  },

  // ─── Sync ─────────────────────────────────
  getPendingItems: () => {
    return get().items.filter(
      (i) => i.status === 'waiting' || i.status === 'processing'
    );
  },
  
  loadPendingItems: () => {
    // Les items sont déjà en mémoire via Zustand
    // Cette méthode est pour compatibilité avec l'UI qui attend un reload
    return get().items;
  },

  clearCompleted: () => {
    set((state) => ({
      items: state.items.filter((i) => i.status !== 'completed'),
    }));
  },

  // ─── Initialisation ───────────────────────
  setPdaId: (id) => set({ pdaId: id }),
}));
