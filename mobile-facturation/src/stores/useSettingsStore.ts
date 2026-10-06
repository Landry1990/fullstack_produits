import { create } from 'zustand';
import { Platform } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import i18n, { LANGUAGE_STORAGE_KEY, AppLanguage } from '../i18n';

const KEY_AUTO_ADD = 'settings.autoAddScan';
// Poste de vente épinglé à L'APPAREIL (pas au vendeur) : cette tablette
// retrouve toujours le même poste, quel que soit le compte connecté.
const KEY_POSTE_ID = 'pos.posteVenteId';

interface SettingsState {
  autoAddScan: boolean;
  posteVenteId: number | null;
  // null = suivre la locale de l'appareil ; 'fr'/'en' = choix forcé.
  language: AppLanguage | null;
  loaded: boolean;

  load: () => Promise<void>;
  setAutoAddScan: (v: boolean) => void;
  setPosteVenteId: (id: number | null) => void;
  setLanguage: (lng: AppLanguage) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  autoAddScan: false,
  posteVenteId: null,
  language: null,
  loaded: false,

  load: async () => {
    if (Platform.OS === 'web') {
      set({ loaded: true });
      return;
    }
    try {
      const [v, posteId, lang] = await Promise.all([
        Storage.getItemAsync(KEY_AUTO_ADD),
        Storage.getItemAsync(KEY_POSTE_ID),
        Storage.getItemAsync(LANGUAGE_STORAGE_KEY),
      ]);
      const parsed = posteId ? parseInt(posteId, 10) : NaN;
      set({
        autoAddScan: v === '1',
        posteVenteId: Number.isFinite(parsed) ? parsed : null,
        language: lang === 'en' || lang === 'fr' ? lang : null,
        loaded: true,
      });
    } catch {
      set({ loaded: true });
    }
  },

  setAutoAddScan: (v) => {
    set({ autoAddScan: v });
    if (Platform.OS === 'web') return;
    Storage.setItemAsync(KEY_AUTO_ADD, v ? '1' : '0').catch(() => {});
  },

  setPosteVenteId: (id) => {
    set({ posteVenteId: id });
    if (Platform.OS === 'web') return;
    if (id === null) {
      Storage.removeItemAsync(KEY_POSTE_ID).catch(() => {});
    } else {
      Storage.setItemAsync(KEY_POSTE_ID, String(id)).catch(() => {});
    }
  },

  setLanguage: (lng) => {
    set({ language: lng });
    void i18n.changeLanguage(lng);
    if (Platform.OS === 'web') return;
    Storage.setItemAsync(LANGUAGE_STORAGE_KEY, lng).catch(() => {});
  },
}));
