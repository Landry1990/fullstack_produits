import axios from 'axios';
import { useAuthStore } from '../stores/useAuthStore';
import type { CartLine, Client, AyantDroit, Product, CurrentUser, SudoCreds, PosteVente } from '../types';
import { useSettingsStore } from '../stores/useSettingsStore';

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

// Détail complet d'un client (ClientSerializer, GET /clients/<id>/) :
// ayants droit réels, message_alerte, conditions financières — la liste
// ne renvoie pas ces champs. Fetché une fois à la sélection du client
// (comme getAyantsDroit côté web).
export const getClient = async (id: number) => {
  const res = await api.get(`/clients/${id}/`);
  return res.data as Client;
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

// Postes actifs rattachés à une caisse physique = les caisses ouvertes.
// Utilisé pour le choix de la caisse destinataire en multi-caisses :
// le backend route la vente sur poste_caisse (= facture.poste_caisse,
// visible dans la file de la caissière + notif WS + clôture).
export const getCaissesOuvertes = async () => {
  const res = await api.get('/postes-ventes/actives/');
  const data = res.data;
  const postes = (Array.isArray(data) ? data : (data.results ?? [])) as PosteVente[];
  return postes.filter((p) => p.caisse != null);
};

// Levé quand aucun poste n'est réutilisable automatiquement : l'appareil
// doit afficher le sélecteur de poste (FacturationScreen → PostePickerModal).
// Levé quand aucun poste n'est réutilisable automatiquement : l'appareil
// doit afficher le sélecteur de poste (FacturationScreen → PostePickerModal).
export class PosteChoiceRequired extends Error {
  disponibles: PosteVente[];
  constructor(disponibles: PosteVente[]) {
    super('POSTE_CHOIX_REQUIS');
    this.name = 'PosteChoiceRequired';
    this.disponibles = disponibles;
  }
}

// Convention de nommage : les postes « Mobile… » sont réservés à l'app,
// les « Comptoir… » à la vente web — chaque canal ne voit que les siens.
export const isPosteMobile = (p: PosteVente) =>
  p.nom.trim().toUpperCase().startsWith('MOBILE');

export const ensurePosteVente = async (): Promise<PosteVente> => {
  // Ne réutiliser qu'un poste POS « Mobile » : un poste mode_pos=false est
  // une caisse centrale ouverte par ce compte, et un poste « Comptoir »
  // appartient au canal web — s'y greffer mélangerait les ventes.
  const actifs = await getMesPostesActifs();
  const pos = actifs.find((p) => p.mode_pos === true && isPosteMobile(p));
  if (pos) {
    // L'appareil suit le poste effectivement utilisé (poste partagé entre
    // terminaux : on épingle celui réellement actif).
    useSettingsStore.getState().setPosteVenteId(pos.id);
    return pos;
  }

  // Pool mobile : définitions libres (ou fermées par ce vendeur) dont le
  // nom commence par « Mobile ». Le poste épinglé s'il y figure est
  // réactivé ; sinon → sélecteur.
  const dispo = (await getPostesDisponibles()).filter(isPosteMobile);
  const rememberedId = useSettingsStore.getState().posteVenteId;
  const remembered = rememberedId ? dispo.find((d) => d.id === rememberedId) : undefined;
  if (remembered) {
    try {
      return await activerPosteVente(remembered.id);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      // 400 = pris par un autre vendeur entre-temps, 404 = supprimé →
      // on tombera sur le sélecteur. Autre erreur (réseau) → remonter.
      if (status !== 400 && status !== 404) throw err;
    }
  }

  if (dispo.length === 0) {
    throw new Error('NO_POSTE_DISPONIBLE');
  }
  throw new PosteChoiceRequired(dispo);
};

// ─── Statut d'encaissement (historique) ───────────────────
// GET /factures/?include_pending=true : la liste masque par défaut les
// ventes VALIDEE sans paiement (envoyées en caisse) — include_pending les
// réaffiche et court-circuite le cache liste (60 s) → statut temps réel.
// Filtré par created_by → une seule requête couvre tout l'historique
// local du vendeur (match par numero_facture).
export const getFactureStatuses = async (userId: number): Promise<Record<string, string>> => {
  const res = await api.get('/factures/', {
    params: { include_pending: 'true', created_by: userId, page_size: 100 },
  });
  const data = res.data;
  const rows = Array.isArray(data) ? data : (data.results ?? []);
  const map: Record<string, string> = {};
  for (const f of rows as { numero_facture?: string; status?: string }[]) {
    if (f.numero_facture && f.status) map[f.numero_facture] = f.status;
  }
  return map;
};

// ─── Tiers payant (clients pro) ───────────────────────────
// Répartition mutuelle/patient identique au backend
// (Facture.calculate_totals : part_client = TTC × (100 − taux)/100 à
// 0,01 près) et au web (finance.ts). Seule la part mutuelle devient une
// créance « en compte » du client pro ; la part patient est encaissée
// à la caisse par le bénéficiaire.
export const tiersPayantSplit = (totalTtc: number, tauxCouverture: number) => {
  if (tauxCouverture <= 0) return { partAssurance: 0, partPatient: totalTtc };
  const partPatient = Math.round(((totalTtc * (100 - tauxCouverture)) / 100) * 100) / 100;
  return { partAssurance: totalTtc - partPatient, partPatient };
};

// ─── Ajustement de stock ──────────────────────────────────
// Motifs personnalisés (ConfigurationOption type STOCK_ADJ) — s'ajoutent
// aux motifs standards (StockAdjustment.ReasonType côté backend).
export interface AdjustmentReason {
  code: string;
  label: string;
}
export const getStockAdjustmentReasons = async () => {
  const res = await api.get('/configuration-options/', {
    params: { type: 'STOCK_ADJ', is_active: 'true' },
  });
  const data = res.data?.results ?? res.data;
  return (Array.isArray(data) ? data : []) as AdjustmentReason[];
};

// POST /produits/<id>/adjust_stock/ : le backend attend la quantité CIBLE
// (pas un delta). Re-lire le produit juste avant l'envoi pour calculer la
// cible depuis un stock frais. Permission can_adjust_stock : si le compte
// connecté ne l'a pas → 403, rejouer avec validated_by_id + sudo_password
// (validate_sudo_mode).
export interface AdjustStockPayload {
  new_quantity: number;
  reason_type: string;
  reason_detail?: string;
  stock_lot_id?: number | null;
  // Création d'un lot (stock retrouvé sans lot existant) : le backend crée
  // un StockLot et lui affecte le delta (new_quantity - stock actuel).
  new_lot_number?: string;
  new_lot_expiration?: string; // 'YYYY-MM-DD'
  validated_by_id?: number;
  sudo_password?: string;
}
export const adjustStock = async (produitId: number, payload: AdjustStockPayload) => {
  const key = generateUUID();
  const res = await api.post(`/produits/${produitId}/adjust_stock/`, payload, {
    headers: { 'Idempotency-Key': key },
  });
  return res.data as Product;
};

// ─── Signalements de besoin (ruptures terrain) ────────────
// « Produit manquant / demandé par un client » → alimente les suggestions
// de commande web. Distinct de ruptures-fournisseurs (indispo grossiste).
export interface SignalementBesoin {
  id: number;
  produit: number;
  produit_nom?: string;
  produit_stock?: number;
  quantite: number | null;
  note: string;
  utilisateur_nom?: string;
  statut: 'NOUVEAU' | 'INTEGRE' | 'IGNORE';
  created_at: string;
}

export const createSignalementBesoin = async (produitId: number, quantite: number | null, note: string) => {
  const res = await api.post('/signalements-besoins/', {
    produit: produitId,
    quantite,
    note: note.trim(),
  });
  return res.data as SignalementBesoin;
};

export const getMesSignalements = async () => {
  const res = await api.get('/signalements-besoins/', { params: { page_size: 20 } });
  const data = res.data;
  return (Array.isArray(data) ? data : (data.results ?? [])) as SignalementBesoin[];
};

// ─── Dashboard ────────────────────────────────────────────
// GET /dashboard/stats/ : pour VENDEUR/CAISSIER le backend ne renvoie que
// { role, user_stats } (stats personnelles) ; les autres rôles reçoivent
// en plus le CA global, le nombre de ventes et le top produits du jour.
export interface DashboardStats {
  role: string;
  user_stats: { sales: number; count: number; avg_basket: number };
  revenue?: { value: number; change: number };
  sales?: { value: number; change: number };
  top_products?: { id: number; name: string; qty: number; revenue: number }[];
}

export const getDashboardStats = async () => {
  const res = await api.get('/dashboard/stats/');
  return res.data as DashboardStats;
};

// ─── Vente → caisse centralisée ───────────────────────────
// Envoie le panier via POST /factures/finaliser/ (même contrat que la vente
// tablette web). La facture arrive impayée dans la caisse centralisée ;
// l'encaissement reste réservé à la caissière (can_cash_out).
// Le point de vente actif est passé explicitement (résolu par
// ensurePosteVente au login / au besoin depuis l'écran).
export const sendSaleToCaisse = async (
  cart: {
  lines: CartLine[];
  client: Client | null;
  ayantDroit: AyantDroit | null;
  remiseGlobale: number;
  remiseMode: 'taux' | 'montant';
  remiseSudoCreds: SudoCreds | null;
  prixSudoCreds: SudoCreds | null;
  stockSudoCreds: SudoCreds | null;
  remiseGlobaleMontant: () => number;
  totalTTC: () => number;
}, posteVenteId: number | null, posteCaisseId: number | null = null) => {
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
  // Mêmes paiements déclarés que la vente tablette web
  // (buildPaymentsList) : ils ne sont PAS enregistrés en centralisé —
  // ils alimentent seulement `paiement_immediat` pour le contrôle du
  // plafond de crédit. Sans eux, tout le TTC serait compté comme
  // nouvelle dette → blocage 400 d'un client pro sous plafond alors
  // que seule la part mutuelle devient réellement une créance.
  const totalTtc = cart.totalTTC();
  const tauxCouverture = parseFloat(cart.client?.taux_couverture ?? '0') || 0;
  const { partAssurance, partPatient } = tiersPayantSplit(totalTtc, tauxCouverture);
  const paiements = partAssurance > 0
    ? [
        { mode: 'especes', montant: partPatient, part_patient: partPatient, part_assurance: null },
        { mode: 'en_compte', montant: partAssurance, part_patient: null, part_assurance: partAssurance },
      ]
    : [{ mode: 'especes', montant: totalTtc, part_patient: null, part_assurance: null }];
  const payload = {
    client: cart.client?.id ?? null,
    client_name_override: null,
    ayant_droit: cart.ayantDroit?.id ?? null,
    // remise globale = montant en F (pas un taux), déjà arrondi par le store
    remise: String(cart.remiseGlobaleMontant()),
    produits,
    paiements,
    loyalty: { use_pending_discount: false, points_to_use: 0 },
    // totals.totalTtc = total NET après remise globale
    totals: { totalTtc: cart.totalTTC(), totalHt: 0, totalTva: 0 },
    // Forçage de stock (qté > stock) : creds superviseur validés dans
    // FacturationScreen — validate_sudo_mode exige alors
    // can_sell_negative_stock sur le compte validateur.
    sudo: {
      validated_by_id: cart.stockSudoCreds?.validatorId ?? null,
      sudo_password: cart.stockSudoCreds?.password ?? null,
    },
    // Validations superviseur exigées par le backend dès qu'une remise ou
    // un prix modifié est présent (champs top-level, pas dans `sudo`).
    remise_validated_by_id: cart.remiseSudoCreds?.validatorId ?? null,
    remise_validated_password: cart.remiseSudoCreds?.password ?? undefined,
    prix_validated_by_id: cart.prixSudoCreds?.validatorId ?? null,
    prix_validated_password: cart.prixSudoCreds?.password ?? undefined,
    type: 'STD',
    centralized_cash_register: true,
    poste_vente_id: posteVenteId,
    // Caisse destinataire choisie (multi-caisses) ; null → le backend
    // route vers la dernière caisse ouverte (comportement historique).
    poste_caisse_id: posteCaisseId,
    montant_verse: '0',
    montant_rendu: '0',
    idempotency_key: idempotencyKey,
  };
  const config = { headers: { 'Idempotency-Key': idempotencyKey } };

  try {
    const res = await api.post('/factures/finaliser/', payload, config);
    return res.data as { numero_facture?: string };
  } catch (err: unknown) {
    // Erreur transitoire (timeout / coupure réseau, pas de réponse HTTP) :
    // la requête a pu aboutir côté serveur → on réessaie UNE fois avec la
    // MÊME Idempotency-Key, le backend dédoublonne. Pas une file offline.
    const hasResponse = !!(err as { response?: unknown })?.response;
    if (hasResponse) throw err;
    await new Promise((r) => setTimeout(r, 800));
    const res = await api.post('/factures/finaliser/', payload, config);
    return res.data as { numero_facture?: string };
  }
};
