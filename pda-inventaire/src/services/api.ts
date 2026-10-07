import axios from 'axios';
import { useAuthStore } from '../stores/useAuthStore';

const api = axios.create({ timeout: 10000 });

api.interceptors.request.use((config) => {
  const { serverUrl, token } = useAuthStore.getState();
  config.baseURL = `${serverUrl}/api`;
  if (token) config.headers.Authorization = `Token ${token}`;
  return config;
});

// Token expiré/révoqué → déconnexion immédiate : App.tsx rend l'écran de
// login via useAuthStore.isAuthenticated.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(err);
  }
);

export default api;

// ─── Auth ─────────────────────────────────────────────────
// Login par mot de passe seul : le serveur identifie l'utilisateur actif
// dont le mot de passe correspond et renvoie son username.
export const login = async (serverUrl: string, password: string) => {
  const res = await axios.post(
    `${serverUrl}/api/auth/token/`,
    { password, workstation: 'PDA Inventaire' },
    { timeout: 8000 }
  );
  return res.data as { token: string; username: string };
};

// Types pour les réponses API
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
