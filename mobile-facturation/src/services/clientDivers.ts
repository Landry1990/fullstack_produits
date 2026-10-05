import { searchClients } from './api';
import { useAuthStore } from '../stores/useAuthStore';
import { useCartStore } from '../stores/useCartStore';
import type { Client } from '../types';

// Client « comptoir » par défaut — même convention que la facturation web
// (useFacturationClients auto-sélectionne CLIENTS DIVERS / CLIENT DIVERS).
// Sans ça, une vente sans client partait en « Client de passage » non
// rattachée → hors stats/fidélité par client.
export const isClientDivers = (c: Client): boolean => {
  const n = c.name.trim().toUpperCase();
  return n === 'CLIENTS DIVERS' || n === 'CLIENT DIVERS';
};

// Résout le client divers une fois par session (cache dans useAuthStore),
// puis le sélectionne si le panier n'a pas de client. Échec réseau → non
// marqué « loaded » → retentative possible au prochain appel.
export const ensureClientDivers = async (): Promise<Client | null> => {
  const auth = useAuthStore.getState();
  if (!auth.clientDiversLoaded) {
    try {
      const found = (await searchClients('divers')).find(isClientDivers) ?? null;
      useAuthStore.getState().setClientDivers(found);
    } catch {
      return null;
    }
  }
  const divers = useAuthStore.getState().clientDivers;
  if (divers && !useCartStore.getState().client) {
    useCartStore.getState().setClient(divers);
  }
  return divers;
};
