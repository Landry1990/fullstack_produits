import type { ProduitModel } from './catalog';

export interface Fournisseur {
    id: number
    name: string
    address?: string
    phone: string
    email?: string
    solde_dette?: string
    is_active?: boolean
    type_reglement?: 'FACTURE' | 'RELEVE'
    delai_paiement_jours?: number
    periode_releve_jours?: number
    is_divers?: boolean
    delai_livraison_jours?: number
    marge_retard_jours?: number
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
    price_cost?: string
    selling_price?: string
    lot?: string
    date_expiration?: string
    tva?: string | number
    marge?: string | number  // Alias frontend pour taux_marge
    taux_marge?: string | number  // Champ backend
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
    total_ht?: string
    total_tva?: string
    total_ttc?: string
    produits: CommandeProduit[]
    type?: 'LOC' | 'DIR' | 'DIV'
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
    motif?: string
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
    stock_decharge?: boolean
    stock_decharge_at?: string
    stock_decharge_by?: number
}

export interface OrderSchedule {
    id?: number;
    fournisseur: number;
    active_days: number[];
    active_month_days: number[];
    frequency_weeks: number;
    start_date: string;
    time: string;
    is_active: boolean;
    has_alert_sound: boolean;
    has_teletransmission: boolean;
    teletransmission_mode: 'IMMEDIATE' | 'BATCH';
    needs_financial_reception: boolean;
    print_copies: number;
    delivery_time: string | null;
    auto_reception_delay: number;
    notify_sms: boolean;
    notify_whatsapp: boolean;
    special_code: string;
    comment: string;
    min_amount: number;
    min_items: number;
    condition_logic: 'AND' | 'OR';
    execution_mode: 'SIMPLE' | 'OPTIMISE' | 'CUMULATIF';
    analysis_period_days: number;
    delai_couverture_jours: number;
    last_run?: string;
    created_at?: string;
}
