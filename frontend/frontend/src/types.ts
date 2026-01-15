export interface Rayon {
  id: number;
  name: string;
  parent?: number | null;
  parent_name?: string | null;
}

export interface Fournisseur {
  id: number;
  name: string;
  address: string;
  phone: string;
  email: string;
}

export interface AyantDroit {
  id?: number;
  client?: number;
  matricule: string;
  nom: string;
  societe?: string;
  date_creation?: string;
}

export interface ProduitModel {
  id: number
  name: string
  description: string
  stock: number
  cost_price: string
  selling_price: string
  cip1?: string | null
  cip2?: string | null
  cip3?: string | null
  expire_date?: string | null
  stock_alert: number
  stock_minimum: number
  stock_maximum: number
  rayon?: number | null
  rayon_name: string
  fournisseur?: number | null
  fournisseur_name: string
  tva?: string
  rotation_moyenne?: string
  taux_marge?: string
  pourcentage_marge?: string
  pmp?: string
  created_at?: string
  updated_at?: string
  use_lot_management?: boolean
  // Ordonnancier
  requires_prescription?: boolean
  surveillance_category?: 'NONE' | 'STANDARD' | 'RENFORCEE'
  // Dates dernière transaction
  dernier_achat?: string | null
  dernier_vente?: string | null
}

export interface ProduitForm {
  name: string
  description: string
  stock: string
  cost_price: string
  selling_price: string
  cip1: string
  cip2: string
  cip3: string
  expire_date: string
  stock_alert: string
  stock_minimum: string
  stock_maximum: string
  rayon: string
  fournisseur: string
  tva: string
  requires_prescription?: boolean
  surveillance_category?: 'NONE' | 'STANDARD' | 'RENFORCEE'
}

export interface AchatProduit {
  id: number
  commande: number
  commande_date: string
  fournisseur_name: string
  produit: ProduitModel
  quantity: number
  price: string
  price_cost: string
  lot?: string | null
  date_expiration?: string | null
}

export interface CommandeProduit {
  id: number
  produit: number | ProduitModel
  produit_nom?: string
  quantity: number
  unites_gratuites?: number  // NEW: Unités gratuites reçues
  price: string
  selling_price?: string
  lot?: string
  date_expiration?: string
  tva?: string
  marge?: string
}

export interface Commande {
  id: number
  fournisseur: number
  numero_facture: string | null
  date: string
  status: string
  status_display: string
  total: string
  produits: CommandeProduit[]
}

export interface LigneInventaire {
  id: number;
  inventaire: number;
  produit: ProduitModel;
  produit_nom: string;
  produit_cip?: string;
  produit_rayon?: string;
  produit_description?: string;
  produit_cost_price?: string;
  produit_pmp?: string;
  stock_theorique: number;
  quantite_physique: number;
  ecart: number;
  pmp_snapshot: string;
  // Lot fields
  stock_lot?: number | null;
  lot_numero?: string | null;
  lot_expiration?: string | null;
  lot_quantity_remaining?: number | null;
}

export interface Inventaire {
  id: number;
  date: string;
  description: string;
  status: 'EN_COURS' | 'VALIDEE';
  created_by?: number;
  created_by_name?: string;
  lignes: LigneInventaire[];
  created_at: string;
  total_valeur_theorique?: number;
  total_valeur_physique?: number;
  total_ecart_valeur?: number;
}

export interface Client {
  id: number;
  name: string;
  address: string;
  phone: string;
  email: string;
  client_type?: 'PARTICULIER' | 'PROFESSIONNEL';
  plafond?: string;
  taux_couverture?: string;
  remise_automatique?: string;
  ayants_droit?: AyantDroit[];
  current_debt?: string;
}

export interface FactureProduit {
  id: number
  produit: number | ProduitModel
  produit_nom?: string
  quantity: number
  selling_price: string
  lot?: string
  date_expiration?: string
}

export interface Facture {
  id: number
  client: number
  client_name?: string
  client_name_override?: string | null
  ayant_droit?: number | null
  ayant_droit_details?: AyantDroit
  numero_facture: string | null
  date: string
  status: string
  status_display: string
  remise: string
  tva: string
  notes?: string
  total_ht: string
  total_tva: string
  total_ttc: string
  produits: FactureProduit[]
  is_remise_auto?: boolean
  part_client?: string | number | null
}

export interface TicketCaisse {
  id: number
  facture: number | Facture  // Peut être l'ID ou l'objet complet
  facture_numero?: string
  client_name?: string
  mode_paiement: 'especes' | 'cheque' | 'carte' | 'virement' | 'om' | 'momo' | 'en_compte' | 'Mixte'
  montant: string
  reference?: string | null
  statut: string
  date_paiement: string
  montant_verse?: string
  rendu?: string
  paiements_details?: { mode?: string; mode_paiement?: string; montant: number; part_patient?: number | null; part_assurance?: number | null }[]
}

export interface CaisseParTranche {
  tranche: string
  date_debut: string
  date_fin: string
  nombre_factures: number
  total_ht: string
  total_tva: string
  total_ttc: string
  debug?: {
    factures_ids?: number[]
  }
}

export interface CaisseTransaction {
  id: number
  facture: number
  facture_numero: string
  mode_paiement: 'especes' | 'cheque' | 'carte' | 'virement' | 'om' | 'momo' | 'en_compte'
  mode_paiement_display: string
  montant: string
  reference: string | null
  statut: 'en_attente' | 'completee' | 'annulee'
  date_paiement: string
  user_details: {
    id: number
    username: string
    full_name: string
  } | null
  client_name: string
  releve_reference?: string
  releve_id?: number
  is_creance_settlement?: boolean
}

export interface StockLot {
  id: number
  produit: number
  produit_nom: string
  fournisseur: number
  fournisseur_nom: string
  quantity_initial: number
  quantity_remaining: number
  price_cost: string
  selling_price?: string // Added
  lot: string | null
  date_expiration: string | null
  date_reception: string
}

export interface Paiement {
  id: number
  mode_paiement: string
  mode_paiement_display: string
  montant: string
  reference?: string | null
  statut: string
  date_paiement: string
  user_details?: {
    id: number
    username: string
    full_name: string
  } | null
}

export interface Creance {
  id: number
  numero_facture: string | null
  client: number
  client_name: string
  client_name_override?: string | null
  ayant_droit?: number | null
  ayant_droit_details?: AyantDroit
  date: string
  status: string
  status_display: string
  total_ht: string
  remise: string
  tva: string
  total_tva: string
  total_ttc: string
  montant_paye: string
  reste_a_payer: string
  paiements: Paiement[]
  notes?: string
}

export interface MouvementCaisse {
  id: number;
  type: 'ENTREE' | 'SORTIE';
  montant: string;
  motif: string;
  description?: string;
  date: string;
  user: number;
  user_nom?: string;
}




export interface Avoir {
  id: number
  numero: string
  fournisseur: number | Fournisseur
  fournisseur_name?: string
  type_avoir: 'PERIME' | 'AVARIE' | 'NON_FACTURE' | 'ERREUR' | 'AUTRE'
  type_avoir_display?: string
  date: string
  observations: string
  status: 'BROUILLON' | 'VALIDEE'
  status_display?: string
  created_by?: number
  created_by_name?: string
  created_at: string
  updated_at: string
  total_ht: string
  produits: LigneAvoir[]
}

export interface LigneAvoir {
  id: number
  avoir: number
  produit: ProduitModel | number
  produit_nom?: string
  produit_cip?: string
  stock_lot?: number | null
  lot_numero?: string | null
  lot_expiration?: string | null
  lot_quantity_remaining?: number | null
  quantity: number
  price: string
  lot: string
  date_expiration: string
  total: string
}

export interface Promis {
  id: number
  facture: number
  client?: number
  client_name?: string
  client_display?: string
  client_phone?: string
  client_phone_display?: string
  produit: number
  produit_name?: string
  produit_cip?: string
  quantite: number
  status: 'ATT' | 'DEL' | 'ANN'
  status_display?: string
  date_promis: string
  date_livraison?: string
  notes?: string
}

export interface StockAdjustment {
  id: number
  produit: number
  produit_name: string
  produit_cip?: string
  stock_lot: number | null
  lot_number: string | null
  user: number | null
  user_name: string
  username: string
  quantity_before: number
  quantity_after: number
  quantity_change: number
  reason_type: 'INVENTAIRE' | 'CASSE' | 'VOL' | 'CONFUSION' | 'ERR_ENTREE' | 'AVARIE' | 'USAGE_INT'
  reason_type_display: string
  reason_detail?: string
  created_at: string
}

export const STOCK_ADJUSTMENT_REASONS = [
  { value: 'INVENTAIRE', label: 'Ajustement inventaire' },
  { value: 'CASSE', label: 'Cassé' },
  { value: 'VOL', label: 'Vol' },
  { value: 'CONFUSION', label: 'Confusion' },
  { value: 'ERR_ENTREE', label: 'Erreur d\'entrée en stock' },
  { value: 'AVARIE', label: 'Avarié' },
  { value: 'USAGE_INT', label: 'Usage interne' },
] as const

export interface LigneOrdonnancier {
  id: number
  ordonnancier: number
  produit: number | null
  produit_name?: string | null
  produit_nom: string
  quantite: number
  surveillance_category: 'NONE' | 'STANDARD' | 'RENFORCEE'
}

export interface Ordonnancier {
  numero_ordre: number
  date_delivrance: string
  patient_nom: string
  prescripteur_nom: string
  facture?: number | null
  facture_numero?: string | null
  lignes: LigneOrdonnancier[]
  enregistre_par?: number | null
  enregistre_par_nom?: string
  created_at: string
}

export interface User {
  id?: number;
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  is_superuser: boolean;
  token?: string;
  allowed_menus?: string[];
  // Permissions
  can_do_returns?: boolean;
  can_sell_negative_stock?: boolean;
  can_cash_out?: boolean;
  can_delete_product?: boolean;
  can_adjust_stock?: boolean;
  can_delete_commande?: boolean;
  can_close_commande?: boolean;
  can_delete_fournisseur?: boolean;
}
