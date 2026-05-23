import axios from 'axios';
import { useAuthStore } from '../stores';

const api = axios.create({ timeout: 10000 });

api.interceptors.request.use((config) => {
  const { serverUrl, token } = useAuthStore.getState();
  config.baseURL = `${serverUrl}/api`;
  if (token) config.headers.Authorization = `Token ${token}`;
  return config;
});

export default api;

// ─── Produits ─────────────────────────────────────────────
export const searchProducts = async (query: string) => {
  const res = await api.get('/produits/', { params: { search: query, limit: 30 } });
  const data = res.data;
  return Array.isArray(data) ? data : (data.results ?? []);
};

export const getProductByBarcode = async (barcode: string) => {
  const res = await api.get('/produits/', { params: { code_barre: barcode } });
  const data = res.data;
  const list = Array.isArray(data) ? data : (data.results ?? []);
  return list[0] ?? null;
};

// ─── Lots ─────────────────────────────────────────────────
export const getLots = async (produitId: number) => {
  const res = await api.get('/stock-lots/', {
    params: { produit: produitId, ordering: 'date_expiration', include_empty: 'false' },
  });
  const data = res.data;
  return Array.isArray(data) ? data : (data.results ?? []);
};

// ─── Clients ──────────────────────────────────────────────
export const searchClients = async (query: string) => {
  const res = await api.get('/clients/', { params: { search: query, limit: 20 } });
  const data = res.data;
  return Array.isArray(data) ? data : (data.results ?? []);
};

// ─── Auth ─────────────────────────────────────────────────
export const login = async (serverUrl: string, username: string, password: string) => {
  const res = await axios.post(
    `${serverUrl}/api-token-auth/`,
    { username, password },
    { timeout: 8000 }
  );
  return res.data.token as string;
};
