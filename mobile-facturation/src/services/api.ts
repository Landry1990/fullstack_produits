import axios from 'axios';
import { useAuthStore } from '../stores/useAuthStore';
import type { CartLine, Client, AyantDroit, Product, CurrentUser, SudoCreds, PosteVente } from '../types';

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

// api instance (used internally by named exports below)

// ─── Produits ─────────────────────────────────────────────
export const searchProducts = async (query: string) => {
  const res = await api.get('/produits/', { params: { search: query, page_size: 30 } });
  const data = res.data;
  return Array.isArray(data) ? data : (data.results ?? []);
};

// Recherche exacte par code scanné (CIP1-4, EAN, GTIN) — endpoint dédié
// du backend : GET /produits/by-cip/<code>/ (insensible à la casse, 404 si
// inconnu). Retourne le Produit complet (name, selling_price, tva, stock).
export const getProductByBarcode = async (barcode: string) => {
  try {
    const res = await api.get(`/produits/by-cip/${encodeURIComponent(barcode)}/`);
    return res.data as Product;
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) return null;
    throw err;
  }
};

// Détail produit par id — utilisé après un scan datamatrix pour récupérer
// les champs absents du payload by-datamatrix (tva, cips…).
export const getProductById = async (id: number) => {
  const res = await api.get(`/produits/${id}/`);
  return res.data as Product;
};

// ─── Scan datamatrix GS1 ──────────────────────────────────
// GET /stock-lots/by-datamatrix/?cip=<cip>&lot=<lot> — même endpoint que le
// scan datamatrix de la facturation web : résout produit + lot exact.
export interface DatamatrixResult {
  lot_id: number;
  lot_numero: string;
  date_expiration: string | null;
  quantity_remaining: number;
  selling_price: string;
  produit: {
    id: number;
    name: string;
    cip1: string | null;
    selling_price: string;
    stock: number;
  };
}
export const getLotByDatamatrix = async (cip: string, lot: string) => {
  const res = await api.get('/stock-lots/by-datamatrix/', { params: { cip, lot } });
  return res.data as DatamatrixResult;
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
  const res = await api.get('/clients/', { params: { search: query, page_size: 20 } });
  const data = res.data;
  return Array.isArray(data) ? data : (data.results ?? []);
};

// Création rapide depuis le mobile : toujours un particulier, sans plafond.
export const createClient = async ({ name, phone }: { name: string; phone?: string | null }) => {
  const res = await api.post('/clients/', {
    name: name.trim(),
    phone: phone?.trim() || null,
    client_type: 'PARTICULIER',
    plafond: -1,
    taux_couverture: 0,
    remise_automatique: 0,
    majoration_pro_pourcentage: 0,
    is_loyalty_member: true,
  });
  return res.data as Client;
};

export const createAyantDroit = async ({ client, nom, matricule }: { client: number; nom: string; matricule: string }) => {
  const res = await api.post('/ayants-droit/', {
    client,
    nom: nom.trim().toUpperCase(),
    matricule: matricule.trim().toUpperCase(),
    societe: null,
  });
  return res.data as AyantDroit;
};

// ─── Auth ─────────────────────────────────────────────────
// Login par mot de passe seul : le serveur identifie l'utilisateur actif
// dont le mot de passe correspond et renvoie son username.
export const login = async (serverUrl: string, password: string) => {
  const res = await axios.post(
    `${serverUrl}/api/auth/token/`,
    { password, workstation: 'Mobile facturation' },
    { timeout: 8000 }
  );
  return res.data as { token: string; username: string };
};

// Profil complet de l'utilisateur connecté (droits, plafond de remise).
export const getMe = async () => {
  const res = await api.get('/users/me/');
  return res.data as CurrentUser;
};

// Vérifie le mot de passe d'un compte disposant de la permission demandée
// (le mot de passe identifie le compte — vendeur ou superviseur).
// Retourne {id, username} si valide, null si non valide ; erreurs HTTP → throw.
export const verifySudoPassword = async (password: string, permission: string) => {
  const res = await api.post('/users/verify_password/', { password, permission });
  const data = res.data as { valid?: boolean; user?: { id: number; username: string } };
  if (!data?.valid || !data.user?.id) return null;
  return data.user;
};

// ─── Points de vente ──────────────────────────────────────
// Un PosteVente actif est exigé par /factures/finaliser/. Comme le web :
// réutiliser un poste déjà actif (activer en ferme les autres POS du user),
// sinon activer la 1re définition disponible (mode POS, sans caisse).
export const getMesPostesActifs = async () => {
  const res = await api.get('/postes-ventes/mes_actives/');
  const data = res.data;
  return (Array.isArray(data) ? data : (data.results ?? [])) as PosteVente[];
};

export const getPostesDisponibles = async () => {
  const res = await api.get('/postes-ventes/disponibles/');
  const data = res.data;
  return (Array.isArray(data) ? data : (data.results ?? [])) as PosteVente[];
};

export const activerPosteVente = async (id: number) => {
  const res = await api.post(`/postes-ventes/${id}/activer/`, {});
  return res.data as PosteVente;
};

export const ensurePosteVente = async (): Promise<PosteVente> => {
  const actifs = await getMesPostesActifs();
  if (actifs.length > 0) {
    return actifs.find((p) => p.mode_pos === true) ?? actifs[0];
  }
  const dispo = await getPostesDisponibles();
  if (dispo.length === 0) {
    throw new Error('NO_POSTE_DISPONIBLE');
  }
  try {
    return await activerPosteVente(dispo[0].id);
  } catch (err: unknown) {
    // Course avec un autre terminal qui l'a activé entre-temps → relire.
    const e = err as { response?: { status?: number; data?: { detail?: string } } };
    if (e?.response?.status === 400) {
      const actifs2 = await getMesPostesActifs();
      if (actifs2.length > 0) return actifs2.find((p) => p.mode_pos === true) ?? actifs2[0];
    }
    throw err;
  }
};

// ─── Vente → caisse centralisée ───────────────────────────
// Envoie le panier via POST /factures/finaliser/ (même contrat que la vente
// tablette web). La facture arrive impayée dans la caisse centralisée ;
// l'encaissement reste réservé à la caissière (can_cash_out).
// Le point de vente actif est passé explicitement (résolu par
// ensurePosteVente au login / au besoin depuis l'écran).
export const sendSaleToCaisse = async (cart: {
  lines: CartLine[];
  client: Client | null;
  ayantDroit: AyantDroit | null;
  remiseGlobale: number;
  remiseMode: 'taux' | 'montant';
  remiseSudoCreds: SudoCreds | null;
  prixSudoCreds: SudoCreds | null;
  remiseGlobaleMontant: () => number;
  totalTTC: () => number;
}, posteVenteId: number | null) => {
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
      // remise globale = montant en F (pas un taux), déjà arrondi par le store
      remise: String(cart.remiseGlobaleMontant()),
      produits,
      paiements: [],
      loyalty: { use_pending_discount: false, points_to_use: 0 },
      // totals.totalTtc = total NET après remise globale
      totals: { totalTtc: cart.totalTTC(), totalHt: 0, totalTva: 0 },
      sudo: { validated_by_id: null, sudo_password: null },
      // Validations superviseur exigées par le backend dès qu'une remise ou
      // un prix modifié est présent (champs top-level, pas dans `sudo`).
      remise_validated_by_id: cart.remiseSudoCreds?.validatorId ?? null,
      remise_validated_password: cart.remiseSudoCreds?.password ?? undefined,
      prix_validated_by_id: cart.prixSudoCreds?.validatorId ?? null,
      prix_validated_password: cart.prixSudoCreds?.password ?? undefined,
      type: 'STD',
      centralized_cash_register: true,
      poste_vente_id: posteVenteId,
      montant_verse: '0',
      montant_rendu: '0',
      idempotency_key: idempotencyKey,
    },
    { headers: { 'Idempotency-Key': idempotencyKey } }
  );
  return res.data as { numero_facture?: string };
};
