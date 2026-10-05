// ─── Produit (contrat réel API : ProduitSerializer/ListSerializer) ──
export interface Product {
  id: number;
  name: string;
  cip1: string | null;
  cip2?: string | null;
  cip3?: string | null;
  cip4?: string | null;
  selling_price: string;
  stock: number;
  tva: string;
  use_lot_management?: boolean;
  is_active?: boolean;
  // 5 premiers lots non vides triés FEFO (SerializerMethodField du
  // ProduitSerializer — présent sur list/retrieve/by-cip).
  stock_lots?: StockLot[];
}

// ─── Stock Lot ────────────────────────────────────────────
export interface StockLot {
  id: number;
  produit: number;
  lot: string | null;
  quantity_remaining: number;
  date_expiration: string | null;
  date_reception?: string;
  selling_price?: string;
}

// ─── Client / Ayant droit (contrat ClientSerializer) ──────
export interface Client {
  id: number;
  name: string;
  phone?: string | null;
  client_type?: 'PARTICULIER' | 'PROFESSIONNEL';
  taux_couverture?: string;
  ayants_droit?: AyantDroit[];
}

export interface AyantDroit {
  id: number;
  matricule: string;
  nom: string;
  societe?: string | null;
}

// ─── Validation Sudo (superviseur) ────────────────────────
export interface SudoCreds {
  validatorId: number;
  password: string;
}

// ─── Utilisateur connecté (GET /users/me/) ────────────────
export interface CurrentUser {
  id: number;
  username: string;
  is_superuser?: boolean;
  profile?: {
    max_discount_rate?: number | string;
    can_do_remise?: boolean;
    can_modify_price?: boolean;
  };
}

// ─── Ligne du panier ──────────────────────────────────────
export interface CartLine {
  product: Product;
  quantite: number;
  prix_unitaire: number;
  remise: number;       // % remise
  lotId: number | null;
  lotText: string | null;
  lotExp?: string | null;   // expiration du lot choisi (affichage)
  total_ttc: number;
}

// ─── Point de vente (contrat /postes-ventes/) ─────────────
export interface PosteVente {
  id: number;
  nom: string;
  est_actif: boolean;
  mode_pos?: boolean;
  caisse?: number | null;
  caisse_nom?: string | null;
  vendeur_name?: string | null;
}

// ─── Résultat d'un scan (résolution sans ajout au panier) ─
export interface ScanResult {
  product: Product;
  lot: StockLot | null;
  prix: number;
  label: string;
}

// ─── Vente mise en attente (local, comme le web) ──────────
export interface PendingSale {
  id: string;
  timestamp: string;
  lines: CartLine[];
  client: Client | null;
  ayantDroit: AyantDroit | null;
  remiseGlobale: number;
  remiseMode: 'taux' | 'montant';
}

// ─── Historique local ─────────────────────────────────────
export interface HistoriqueLine {
  name: string;
  quantite: number;
  prix_unitaire: number;
  remise: number;
  total_ttc: number;
}

export interface HistoriqueItem {
  id: string;
  timestamp: string;
  numero_facture: string | null;
  articles_count: number;
  total_estime: number;
  client: string | null;
  status: 'sent' | 'confirmed' | 'cancelled';
  // Optionnel : les entrées antérieures à cette fonctionnalité n'en ont pas.
  lignes?: HistoriqueLine[];
}
