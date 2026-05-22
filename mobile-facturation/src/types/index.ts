/**
 * Barrel export — Types centralisés
 */
export type { Product, ProductFromServer, ProductSearchParams } from './product';
export type { CartItem, Cart } from './cart';
export type {
  InvoiceStatus,
  InvoiceItem,
  Invoice,
  InvoiceRow,
} from './invoice';
export type {
  ServerConfig,
  CreateInvoicePayload,
  SyncInvoiceResponse,
  ApiResponse,
  PaginatedResponse,
  LoginPayload,
  LoginResponse,
  NetworkError,
} from './api';

/**
 * Types alignés avec le système principal GestionDivers
 * Supporte 2 modes : PDA Autonome (avec paiement) ou Envoi à la Caisse
 */

// ─── MODE DE FONCTIONNEMENT ─────────────────────────────
export type OperatingMode = 'autonomous' | 'cashier_queue';

// ─── TYPES DE PAIEMENT (alignés avec le principal) ───────
export type PaymentMode = 
  | 'ESPECES' 
  | 'CARTE' 
  | 'CHEQUE' 
  | 'MOBILE_MONEY' 
  | 'VIREMENT' 
  | 'CREDIT' 
  | 'MULTI';

export interface PaymentDetail {
  mode: PaymentMode;
  montant: string;           // String pour précision décimale
  reference?: string;        // Numéro chèque, ref transaction...
  banque?: string;           // Pour chèques/virements
}

// ─── CLIENT (aligné avec le backend) ─────────────────────
export interface Client {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  type_reglement?: 'FACTURE' | 'RELEVE';
  delai_paiement_jours?: number;
  has_credit?: boolean;
  solde_dette?: string;
  address?: string;
  ayants_droit?: AyantDroit[];
  created_at?: string;
  updated_at?: string;
}

export interface AyantDroit {
  id: number;
  nom: string;
  prenom: string;
  numero_carte: string;
  taux_couverture: number;    // ex: 80 pour 80%
  societe?: string;
}

// ─── LIGNE FACTURE (alignée avec LigneFacture principal) ─
export interface LigneFacture {
  produit: Product;
  quantite: number;
  prix_unitaire: string;      // String pour précision
  remise_produit: string;       // % de remise (ex: "10" pour 10%)
  tva: string;                  // TVA applicable (ex: "18")
  // Calculés
  total_ht: string;
  total_ttc: string;
  // Lot (optionnel)
  lotId?: number | null;
  lotText?: string | null;
}

// ─── STOCK LOT (pour sélection FEFO) ─
export interface StockLot {
  id: number;
  produit: number;
  lot: string | null;
  quantity_remaining: number;
  date_expiration: string | null;
  date_reception: string;
  selling_price?: string;
}

// ─── TICKET DE CAISSE (aligné avec le principal) ─────────
export interface TicketCaisse {
  id: number;
  numero_ticket: string;        // ex: TCK-2026-0001
  date_creation: string;
  vendeur_id: number;
  vendeur_name?: string;
  caisse_id?: number;
  
  // Client
  client?: Client;
  ayant_droit?: AyantDroit;
  taux_couverture?: number;
  
  // Articles
  lignes: LigneFacture[];
  
  // Totaux
  total_ht: string;
  total_tva: string;
  total_ttc: string;
  part_assurance?: string;
  part_patient?: string;
  
  // Paiement
  paiements: PaymentDetail[];
  monnaie_rendu?: string;
  
  // Sync
  server_id?: number;
  synced_at?: string;
  status: 'pending' | 'synced' | 'error';
  error_message?: string;
}

// ─── FILE D'ATTENTE CAISSE (Mode Envoi à la Caisse) ──────
export interface CashierQueueItem {
  id: string;                   // UUID local
  pda_id: string;               // Identifiant du PDA
  created_at: string;
  status: 'waiting' | 'processing' | 'completed' | 'cancelled';
  
  // Articles scannés
  lignes: LigneFacture[];
  client?: Client;
  ayant_droit?: AyantDroit;
  
  // Métadonnées
  articles_count: number;
  total_estime: string;
  
  // Résultat après traitement caisse
  ticket_number?: string;
  completed_at?: string;
}

// ─── ANCIENS TYPES (deprecated, gardés pour compatibilité) ─
/** @deprecated Use TicketCaisse instead */
export interface Invoice {
  id: number;
  uuid: string;
  date_creation: string;
  client: string | null;
  total: number;
  items: InvoiceItem[];
  status: 'pending' | 'synced' | 'error';
  server_id: number | null;
  server_number: string | null;
  error_message: string | null;
  synced_at: string | null;
  created_at: string;
}

/** @deprecated Use LigneFacture instead */
export interface InvoiceItem {
  product_id: number;
  code_barre: string;
  designation: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}
