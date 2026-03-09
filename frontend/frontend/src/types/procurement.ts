import type { ProduitModel } from './catalog';
// Actually Fournisseur was at line 20 in types.ts. I should put it in crm or vendor.
// Let's check my plan. Plan said procurement. Let's put it in procurement.

export interface Fournisseur {
    id: number
    name: string
    address: string
    phone: string
    email: string
    solde_dette?: string
    is_active?: boolean
    type_reglement?: 'FACTURE' | 'RELEVE'
    delai_paiement_jours?: number
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
    unites_gratuites?: number
    price: string
    selling_price?: string
    lot?: string
    date_expiration?: string
    tva?: string | number
    marge?: string | number
    prix_euro?: string
}

export interface Commande {
    id: number
    fournisseur: number
    fournisseur_nom?: string
    numero_facture: string | null
    date: string
    status: string
    status_display: string
    total: string
    produits: CommandeProduit[]
    type?: 'LOC' | 'DIR'
    taux_change?: string
    frais_coefficient?: string
    montant_paye?: string
    reste_a_payer?: string
    statut_paiement?: 'PAYE' | 'PARTIEL' | 'IMPAYE' | 'NON_CONCERNE'
    closed_by_name?: string
    items_count?: number
}

export interface PaiementFournisseur {
    id: number;
    fournisseur: number;
    fournisseur_name?: string;
    commande?: number | null;
    commande_numero?: string | null;
    montant: string;
    date_paiement: string;
    mode_paiement: 'ESP' | 'CHQ' | 'VIR' | 'AVOIR' | 'AUTRE';
    reference?: string | null;
    created_by?: number;
    created_by_name?: string;
    notes?: string | null;
    created_at: string;
    commandes_liees?: string[];
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
    est_cloture?: boolean
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
