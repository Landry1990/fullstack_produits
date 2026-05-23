import { create } from 'zustand';

interface AuthState {
  token: string | null;
  username: string | null;
  serverUrl: string;
  isAuthenticated: boolean;

  setAuth: (token: string, username: string) => void;
  setServerUrl: (url: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  username: null,
  serverUrl: 'http://192.168.1.181:8000',
  isAuthenticated: false,

  setAuth: (token, username) =>
    set({ token, username, isAuthenticated: true }),

  setServerUrl: (url) =>
    set({ serverUrl: url.replace(/\/$/, '') }),

  logout: () =>
    set({ token: null, username: null, isAuthenticated: false }),
}));
