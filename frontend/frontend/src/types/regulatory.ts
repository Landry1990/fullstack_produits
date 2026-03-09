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

export interface OrdonnanceData {
    patient_nom: string;
    prescripteur_nom: string;
    lignes: Array<{
        produit_id: number;
        produit_nom: string;
        quantite: number;
        surveillance_category?: string;
    }>;
}
