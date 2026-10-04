import { create } from 'zustand';
import secureStore from '../utils/secureStore';
import type { PosteVente } from '../types';

// Clés de session persistées (SecureStore natif / localStorage web)
const KEY_TOKEN = 'session.token';
const KEY_USERNAME = 'session.username';
const KEY_SERVER_URL = 'session.serverUrl';

interface AuthState {
  token: string | null;
  username: string | null;
  serverUrl: string;
  isAuthenticated: boolean;
  maxDiscountRate: number;
  posteVente: PosteVente | null;

  setAuth: (token: string, username: string) => void;
  setServerUrl: (url: string) => void;
  setMaxDiscountRate: (rate: number) => void;
  setPosteVente: (p: PosteVente | null) => void;
  restoreSession: () => Promise<boolean>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  username: null,
  serverUrl: 'http://192.168.1.181',
  isAuthenticated: false,
  maxDiscountRate: 0,
  posteVente: null,

  setAuth: (token, username) => {
    set({ token, username, isAuthenticated: true });
    // Session persistée — survit à un kill de l'app
    const { serverUrl } = get();
    secureStore.setItemAsync(KEY_TOKEN, token).catch(() => {});
    secureStore.setItemAsync(KEY_USERNAME, username).catch(() => {});
    secureStore.setItemAsync(KEY_SERVER_URL, serverUrl).catch(() => {});
  },

  setServerUrl: (url) => {
    const clean = url.replace(/\/$/, '');
    set({ serverUrl: clean });
    secureStore.setItemAsync(KEY_SERVER_URL, clean).catch(() => {});
  },

  setMaxDiscountRate: (rate) =>
    set({ maxDiscountRate: rate }),

  setPosteVente: (posteVente) =>
    set({ posteVente }),

  // Restaure la session au boot : les 3 clés doivent être présentes.
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
    set({ token: null, username: null, isAuthenticated: false, maxDiscountRate: 0, posteVente: null });
    [KEY_TOKEN, KEY_USERNAME, KEY_SERVER_URL].forEach((k) => {
      secureStore.deleteItemAsync(k).catch(() => {});
    });
  },
}));
