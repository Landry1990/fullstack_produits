/**
 * Store Zustand — État d'authentification
 */
import { create } from 'zustand';
import type { LoginResponse } from '../types';

interface AuthState {
  isAuthenticated: boolean;
  user: LoginResponse['user'] | null;
  token: string | null;

  setAuthenticated: (user: LoginResponse['user'], token: string) => void;
  setUnauthenticated: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,
  token: null,

  setAuthenticated: (user, token) => {
    set({ isAuthenticated: true, user, token });
  },

  setUnauthenticated: () => {
    set({ isAuthenticated: false, user: null, token: null });
  },
}));
