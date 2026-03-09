import type { ProduitModel } from './catalog';

export interface LigneInventaire {
    id: number
    inventaire: number
    produit: ProduitModel
    produit_nom: string
    produit_cip?: string
    produit_rayon?: string
    produit_description?: string
    produit_cost_price?: string
    produit_pmp?: string
    stock_theorique: number
    quantite_physique: number
    ecart: number
    pmp_snapshot: string
    stock_lot?: number | null
    lot_numero?: string | null
    lot_expiration?: string | null
    lot_quantity_remaining?: number | null
    isLocalOnly?: boolean
}

export interface Inventaire {
    id: number
    date: string
    description: string
    status: 'EN_COURS' | 'VALIDEE'
    inventory_type: 'GLOBAL' | 'RAYON' | 'RESERVE'
    created_by?: number
    created_by_name?: string
    lignes: LigneInventaire[]
    created_at: string
    total_valeur_theorique?: number
    total_valeur_physique?: number
    total_ecart_valeur?: number
}

export interface InventoryStats {
    top_pertes: Array<{
        produit_nom: string;
        ecart: number;
        valeur: number;
    }>;
    top_surplus: Array<{
        produit_nom: string;
        ecart: number;
        valeur: number;
    }>;
    par_rayon: Array<{
        rayon: string;
        total: number;
    }>;
}
