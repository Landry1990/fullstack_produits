export interface AyantDroit {
    id?: number
    client?: number
    matricule: string
    nom: string
    societe?: string
    date_creation?: string
}

export interface Client {
    id: number
    name: string
    address: string
    phone: string
    email: string
    client_type?: 'PARTICULIER' | 'PROFESSIONNEL'
    plafond?: string
    taux_couverture?: string
    remise_automatique?: string
    ayants_droit?: AyantDroit[]
    current_debt?: string
    solde_depot?: string
    is_active?: boolean
    points_fidelite?: number
    is_loyalty_member?: boolean
    is_deposit_enabled?: boolean
    pending_discount?: string
}

export interface DepotClient {
    id: number
    client: number
    type: 'DEPOT' | 'RETRAIT' | 'ACHAT' | 'ANNULATION_ACHAT'
    type_display: string
    montant: string
    date: string
    mode_paiement?: string
    facture?: number
    facture_numero?: string
    created_by?: number
    created_by_name?: string
    notes?: string
}
