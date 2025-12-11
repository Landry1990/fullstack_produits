export interface Rayon {
  id: number;
  name: string;
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
  rayon_name: string
  fournisseur_name: string
  tva?: string
  rotation_moyenne?: string
  taux_marge?: string
  pourcentage_marge?: string
  created_at?: string
  updated_at?: string
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
  price: string
  selling_price?: string
  lot?: string
  date_expiration?: string
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

export interface Client {
  id: number;
  name: string;
  address: string;
  phone: string;
  email: string;
  client_type?: 'PARTICULIER' | 'PROFESSIONNEL';
  plafond?: string;
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
  paiements_details?: { mode: string; montant: number }[]
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
  lot: string | null
  date_expiration: string | null
  date_reception: string
}
