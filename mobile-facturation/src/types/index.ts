// ─── Produit ──────────────────────────────────────────────
export interface Product {
  id: number;
  code_barre: string;
  designation: string;
  prix_vente: string;
  stock: number;
  tva: string;
  is_deleted?: boolean;
}

// ─── Stock Lot ────────────────────────────────────────────
export interface StockLot {
  id: number;
  produit: number;
  lot: string | null;
  quantity_remaining: number;
  date_expiration: string | null;
  date_reception: string;
  selling_price?: string;
}

// ─── Client / Ayant droit ─────────────────────────────────
export interface Client {
  id: number;
  nom: string;
  prenom?: string;
  telephone?: string;
  ayants_droit?: AyantDroit[];
}

export interface AyantDroit {
  id: number;
  nom: string;
  prenom?: string;
  taux_couverture: number;
  assurance?: string;
}

// ─── Ligne du panier ──────────────────────────────────────
export interface CartLine {
  product: Product;
  quantite: number;
  prix_unitaire: number;
  remise: number;       // % remise
  lotId: number | null;
  lotText: string | null;
  total_ttc: number;
}

// ─── Payload envoyé au WebSocket caisse ───────────────────
export interface CashierPayload {
  type: 'cashier_item_new';
  pda_id: string;
  item_id: string;
  articles: CashierArticle[];
  client: Client | null;
  ayant_droit: AyantDroit | null;
  total_estime: number;
  articles_count: number;
  timestamp: string;
}

export interface CashierArticle {
  produit_id: number;
  code_barre: string;
  designation: string;
  quantite: number;
  prix_unitaire: number;
  remise: number;
  lot_id: number | null;
  lot_text: string | null;
  total_ttc: number;
}

// ─── Historique local ─────────────────────────────────────
export interface HistoriqueItem {
  id: string;
  timestamp: string;
  articles_count: number;
  total_estime: number;
  client: string | null;
  status: 'sent' | 'confirmed' | 'cancelled';
}
