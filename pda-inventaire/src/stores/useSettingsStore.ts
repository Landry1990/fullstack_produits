import { create } from 'zustand';
import secureStore from '../utils/secureStore';

const KEY_LANGUAGE = 'pda.settings.language';

export type AppLanguage = 'fr' | 'en';

interface SettingsState {
  language: AppLanguage;
  loaded: boolean;
  setLanguage: (lng: AppLanguage) => void;
  load: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  language: 'fr',
  loaded: false,

  setLanguage: (language) => {
    set({ language });
    secureStore.setItemAsync(KEY_LANGUAGE, language).catch(() => {});
  },

  load: async () => {
    try {
      const v = await secureStore.getItemAsync(KEY_LANGUAGE);
      if (v === 'en' || v === 'fr') {
        set({ language: v, loaded: true });
        return;
      }
    } catch {}
    set({ loaded: true });
  },
}));
