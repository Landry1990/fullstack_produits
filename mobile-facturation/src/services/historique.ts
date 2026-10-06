import { Platform } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import { useAuthStore } from '../stores/useAuthStore';
import type { HistoriqueItem } from '../types';

// Historique local des ventes envoyées en caisse — kv-store (même backend
// que le brouillon panier), clé par vendeur : sur poste partagé chacun ne
// voit que ses propres envois. Capé à 200 entrées, plus récentes en tête.
const MAX_ITEMS = 200;

const storageKey = () =>
  `historique.${useAuthStore.getState().username ?? 'anon'}`;

export const getHistorique = async (): Promise<HistoriqueItem[]> => {
  if (Platform.OS === 'web') return [];
  try {
    const raw = await Storage.getItemAsync(storageKey());
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
};

export const addHistoriqueItem = async (
  item: Pick<HistoriqueItem, 'numero_facture' | 'articles_count' | 'total_estime' | 'client' | 'lignes' | 'remise_globale'>
): Promise<void> => {
  if (Platform.OS === 'web') return;
  try {
    const items = await getHistorique();
    const entry: HistoriqueItem = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      status: 'sent',
      ...item,
    };
    await Storage.setItemAsync(
      storageKey(),
      JSON.stringify([entry, ...items].slice(0, MAX_ITEMS))
    );
  } catch {}
};
