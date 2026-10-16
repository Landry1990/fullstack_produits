import { create } from 'zustand';
import secureStore from '../utils/secureStore';
import type { Client, PosteVente } from '../types';

// Clés de session persistées (SecureStore natif / localStorage web)
const KEY_TOKEN = 'session.token';
const KEY_USERNAME = 'session.username';
const KEY_SERVER_URL = 'session.serverUrl';

// Libère les postes POS actifs du vendeur au logout : un poste « Mobile »
// resté ouvert bloque les autres terminaux (disponibles/ ne le propose
// plus). Fire-and-forget — la session se vide sans attendre le réseau.
// Seuls les postes mode_pos SANS caisse sont fermés : un poste-caisse
// est une vraie session de caisse (fond, clôture), pas au mobile d'y
// toucher. Le token voyage dans les headers même si l'état est déjà vidé.
function releasePostesPos(token: string, serverUrl: string) {
  const headers = { Authorization: `Token ${token}` };
  fetch(`${serverUrl}/api/postes-ventes/mes_actives/`, { headers })
    .then((r) => (r.ok ? r.json() : []))
    .then((data) => {
      const rows = Array.isArray(data) ? data : (data?.results ?? []);
      for (const p of rows as { id: number; mode_pos?: boolean; caisse?: number | null }[]) {
        if (p.mode_pos && p.caisse == null) {
          fetch(`${serverUrl}/api/postes-ventes/${p.id}/fermer/`, {
            method: 'POST',
            headers,
          }).catch(() => {});
        }
      }
    })
    .catch(() => {});
}

interface AuthState {
  token: string | null;
  username: string | null;
  // id Django de l'utilisateur — rempli par getMe() (login + boot), sert à
  // filtrer les factures par created_by dans l'historique. Non persisté.
  userId: number | null;
  serverUrl: string;
  isAuthenticated: boolean;
  maxDiscountRate: number;
  posteVente: PosteVente | null;
  // Client « comptoir » (CLIENTS DIVERS) résolu une fois par session —
  // même convention que la facturation web.
  clientDivers: Client | null;
  clientDiversLoaded: boolean;

  setAuth: (token: string, username: string) => void;
  setServerUrl: (url: string) => void;
  setUserId: (id: number | null) => void;
  setMaxDiscountRate: (rate: number) => void;
  setPosteVente: (p: PosteVente | null) => void;
  setClientDivers: (c: Client | null, loaded?: boolean) => void;
  restoreSession: () => Promise<boolean>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  username: null,
  userId: null,
  serverUrl: 'http://192.168.1.181',
  isAuthenticated: false,
  maxDiscountRate: 0,
  posteVente: null,
  clientDivers: null,
  clientDiversLoaded: false,

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

  setUserId: (userId) => set({ userId }),

  setMaxDiscountRate: (rate) =>
    set({ maxDiscountRate: rate }),

  setPosteVente: (posteVente) =>
    set({ posteVente }),

  setClientDivers: (clientDivers, loaded = true) =>
    set({ clientDivers, clientDiversLoaded: loaded }),

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
    // Libération du poste AVANT de vider la session — le token et
    // l'URL serveur sont lus depuis l'état courant.
    const { token, serverUrl } = get();
    if (token && serverUrl) releasePostesPos(token, serverUrl);
    set({ token: null, username: null, userId: null, isAuthenticated: false, maxDiscountRate: 0, posteVente: null, clientDivers: null, clientDiversLoaded: false });
    [KEY_TOKEN, KEY_USERNAME, KEY_SERVER_URL].forEach((k) => {
      secureStore.deleteItemAsync(k).catch(() => {});
    });
  },
}));
