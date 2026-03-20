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
    is_active?: boolean
    points_fidelite?: number
    is_loyalty_member?: boolean
}
