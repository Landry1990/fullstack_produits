import axios from 'axios';
import { useAuthStore } from '../stores/useAuthStore';
import type { CartLine, Client, AyantDroit } from '../types';

const api = axios.create({ timeout: 10000 });

const generateUUID = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

api.interceptors.request.use((config) => {
  const { serverUrl, token } = useAuthStore.getState();
  config.baseURL = `${serverUrl}/api`;
  if (token) config.headers.Authorization = `Token ${token}`;
  return config;
});

// api instance (used internally by named exports below)

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
    `${serverUrl}/api/auth/token/`,
    { username, password },
    { timeout: 8000 }
  );
  return res.data.token as string;
};

// ─── Vente → caisse centralisée ───────────────────────────
// Envoie le panier via POST /factures/finaliser/ (même contrat que la vente
// tablette web). La facture arrive impayée dans la caisse centralisée ;
// l'encaissement reste réservé à la caissière (can_cash_out).
// Le poste de vente actif du vendeur est résolu côté backend.
export const sendSaleToCaisse = async (cart: {
  lines: CartLine[];
  client: Client | null;
  ayantDroit: AyantDroit | null;
  totalTTC: () => number;
}) => {
  const produits = cart.lines.map((l) => ({
    produit: l.product.id,
    quantity: l.quantite,
    selling_price: String(l.prix_unitaire),
    // remise stockée en % → discount attendu en montant par unité
    discount: ((l.prix_unitaire * l.remise) / 100).toFixed(0),
    tva: parseFloat(l.product.tva) || 0,
    lot_id: l.lotId,
  }));

  const idempotencyKey = generateUUID();
  const res = await api.post(
    '/factures/finaliser/',
    {
      client: cart.client?.id ?? null,
      client_name_override: null,
      ayant_droit: cart.ayantDroit?.id ?? null,
      remise: '0',
      produits,
      paiements: [],
      loyalty: { use_pending_discount: false, points_to_use: 0 },
      totals: { totalTtc: cart.totalTTC(), totalHt: 0, totalTva: 0 },
      sudo: { validated_by_id: null, sudo_password: null },
      type: 'STD',
      centralized_cash_register: true,
      poste_vente_id: null,
      montant_verse: '0',
      montant_rendu: '0',
      idempotency_key: idempotencyKey,
    },
    { headers: { 'Idempotency-Key': idempotencyKey } }
  );
  return res.data as { numero_facture?: string };
};
