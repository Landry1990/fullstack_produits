export interface Forme {
    id: number
    nom: string
    description?: string
}

export interface Groupe {
    id: number
    nom: string
    description?: string
}

export interface Rayon {
    id: number
    name: string
    parent?: number | null
    parent_name?: string | null
}

export interface StockLot {
    id: number
    produit: number
    produit_nom: string
    fournisseur: number
    fournisseur_nom: string
    quantity_initial: number
    quantity_remaining: number
    quantity_reserved?: number
    quantity_total?: number
    price_cost: string
    selling_price?: string
    lot: string | null
    date_expiration: string | null
    date_reception: string
}

export interface ProduitModel {
    id: number
    name: string
    description: string
    stock: number
    total_stock?: number
    cost_price: string
    selling_price: string
    cip1?: string | null
    cip2?: string | null
    cip3?: string | null
    expire_date?: string | null
    stock_alert?: number | null
    stock_minimum?: number | null
    unite_mesure?: string | null
    is_perissable?: boolean
    tva?: number | null
    forme?: number | null
    forme_name?: string | null
    groupe?: number | null
    groupe_name?: string | null
    rayon?: number | null
    rayon_name?: string | null
    lot_management?: boolean
    is_supplier_exclusive?: boolean
    is_active?: boolean
    is_chronic?: boolean
    default_treatment_days?: number
    stock_reserve?: number
    has_reserve_storage?: boolean
    capacite_rayon?: number
    min_rayon?: number
    next_expiring_date?: string | null
    rotation_moyenne?: number | string
    fournisseur?: number | null
    fournisseur_name?: string | null
    taux_marge?: string | number
    is_deleted?: boolean
    stock_maximum?: number
    pourcentage_marge?: string | number
    requires_prescription?: boolean
    surveillance_category?: 'NONE' | 'STANDARD' | 'RENFORCEE'
    dernier_achat?: string | null
    dernier_vente?: string | null
    famille_risque?: number | null
    famille_risque_nom?: string | null
    quantity_change?: number
    quantity_after?: number
    use_lot_management?: boolean
    last_purchase_price?: string | number
    active_promis_count?: number
    message_alerte?: string | null
    blocking_alerte?: boolean
    // DCI / Clinique
    substances?: number[]
    dci_reference?: number | null
    dci_reference_nom?: string | null
    produit_reference?: number | null
    produit_reference_name?: string | null
    is_generic?: boolean
    code_atc?: string | null
    substance_active?: string | null
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
    unite_mesure: string
    is_perissable: boolean
    tva: string
    forme: string
    groupe: string
    rayon: string
    fournisseur: string
    is_supplier_exclusive?: boolean
    use_lot_management?: boolean
    requires_prescription?: boolean
    surveillance_category?: 'NONE' | 'STANDARD' | 'RENFORCEE'
    is_chronic?: boolean
    default_treatment_days?: string
    has_reserve_storage?: boolean
    capacite_rayon?: string
    min_rayon?: string
    message_alerte?: string
    blocking_alerte?: boolean
    // DCI / Clinique
    substances?: number[]
    dci_reference?: string
    is_generic?: boolean
    produit_reference?: string
    code_atc?: string
    substance_active?: string
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
    valorisation: number
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

export interface StockAdjustmentStats {
    total_count: number;
    positive_sum: number;
    negative_sum: number;
}
