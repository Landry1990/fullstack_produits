import { create } from 'zustand';
import { Platform } from 'react-native';
import Storage from 'expo-sqlite/kv-store';

const KEY_AUTO_ADD = 'settings.autoAddScan';

interface SettingsState {
  autoAddScan: boolean;
  loaded: boolean;

  load: () => Promise<void>;
  setAutoAddScan: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  autoAddScan: false,
  loaded: false,

  load: async () => {
    if (Platform.OS === 'web') {
      set({ loaded: true });
      return;
    }
    try {
      const v = await Storage.getItemAsync(KEY_AUTO_ADD);
      set({ autoAddScan: v === '1', loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  setAutoAddScan: (v) => {
    set({ autoAddScan: v });
    if (Platform.OS === 'web') return;
    Storage.setItemAsync(KEY_AUTO_ADD, v ? '1' : '0').catch(() => {});
  },
}));
