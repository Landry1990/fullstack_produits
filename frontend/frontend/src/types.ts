export interface Rayon {
  id: number;
  name: string;
}

export interface Fournisseur {
  id: number;
  name: string;
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
  produit: ProduitModel
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
}

export interface FactureProduit {
  id: number
  produit: ProduitModel
  quantity: number
  selling_price: string
  lot?: string
  date_expiration?: string
}

export interface Facture {
  id: number
  client: number
  client_name?: string
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
  mode_paiement: 'especes' | 'cheque' | 'carte' | 'virement'
  montant: string
  reference?: string | null
  statut: string
  date_paiement: string
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