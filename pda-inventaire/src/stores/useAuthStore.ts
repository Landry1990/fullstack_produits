import { create } from 'zustand';
import secureStore from '../utils/secureStore';

const KEY_TOKEN = 'pda.session.token';
const KEY_USERNAME = 'pda.session.username';
const KEY_SERVER_URL = 'pda.session.serverUrl';

interface AuthState {
  token: string | null;
  username: string | null;
  serverUrl: string;
  isAuthenticated: boolean;

  setAuth: (token: string, username: string) => void;
  setServerUrl: (url: string) => void;
  restoreSession: () => Promise<boolean>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  username: null,
  // Fallback identique à l'ancienne config : localhost en web, IP locale
  // par défaut sur device physique.
  serverUrl: 'http://192.168.1.181',
  isAuthenticated: false,

  setAuth: (token, username) => {
    set({ token, username, isAuthenticated: true });
    const { serverUrl } = get();
    secureStore.setItemAsync(KEY_TOKEN, token).catch(() => {});
    secureStore.setItemAsync(KEY_USERNAME, username).catch(() => {});
    secureStore.setItemAsync(KEY_SERVER_URL, serverUrl).catch(() => {});
  },

  setServerUrl: (url) => {
    const clean = url.replace(/\/+$/, '');
    set({ serverUrl: clean });
    secureStore.setItemAsync(KEY_SERVER_URL, clean).catch(() => {});
  },

  restoreSession: async () => {
    try {
      const [token, username, serverUrl] = await Promise.all([
        secureStore.getItemAsync(KEY_TOKEN),
        secureStore.getItemAsync(KEY_USERNAME),
        secureStore.getItemAsync(KEY_SERVER_URL),
      ]);
      if (token && username && serverUrl) {
        set({ token, username, serverUrl, isAuthenticated: true });
        return true;
      }
    } catch {}
    return false;
  },

  logout: () => {
    set({ token: null, username: null, isAuthenticated: false });
    [KEY_TOKEN, KEY_USERNAME, KEY_SERVER_URL].forEach((k) => {
      secureStore.deleteItemAsync(k).catch(() => {});
    });
  },
}));
