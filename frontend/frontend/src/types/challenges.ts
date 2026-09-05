export type ChallengeTypeObjectif = 'CA' | 'BOITES' | 'POINTS';
export type ChallengeMode = 'INDIVIDUEL' | 'EQUIPES';
export type ChallengeSourceProduits = 'MANUEL' | 'AUTO_PEREMPTION';

export interface ChallengeEquipe {
    id: number;
    nom: string;
    membres: number[];
    membres_count: number;
    membres_names: string[];
}

export interface ChallengePointTier {
    id: number;
    mois_max: number;
    points: number;
}

export interface Challenge {
    id: number;
    nom: string;
    description: string;
    date_debut: string;
    date_fin: string;
    statut: 'BROU' | 'ENC' | 'CLO' | 'ANN';
    statut_display: string;
    is_active: boolean;
    all_users: boolean;
    participants: number[];
    produits: number[];
    type_objectif: ChallengeTypeObjectif;
    type_objectif_display: string;
    objectif_valeur: number | null;
    mode: ChallengeMode;
    mode_display: string;
    source_produits: ChallengeSourceProduits;
    source_produits_display: string;
    peremption_mois: number | null;
    equipes: ChallengeEquipe[];
    point_tiers: ChallengePointTier[];
    point_tiers_count: number;
    created_by: number | null;
    created_by_name: string;
    participants_count: number;
    produits_count: number;
    equipes_count: number;
    is_ongoing: boolean;
    created_at: string;
    updated_at: string;
}

export interface ChallengeClassementEntry {
    rang: number;
    entity_id: number;
    entity_name: string;
    entity_type: 'INDIVIDUEL' | 'EQUIPE';
    nb_boites: number;
    ca: number;
    nb_ventes: number;
    points?: number;
    objectif: number | null;
    progression: number | null;
    atteint: boolean | null;
}

export interface ChallengeClassement {
    challenge: {
        id: number;
        nom: string;
        date_debut: string;
        date_fin: string;
        statut: string;
        type_objectif: ChallengeTypeObjectif;
        objectif_valeur: number | null;
        mode: ChallengeMode;
        source_produits: ChallengeSourceProduits;
        peremption_mois: number | null;
        produits_count: number;
        point_tiers?: ChallengePointTier[];
    };
    classement: ChallengeClassementEntry[];
}

export interface ChallengeProduitPeremption {
    produit_id: number;
    produit_nom: string;
    date_expiration: string;
    quantity_remaining: number;
    jours_until: number;
}

export interface ChallengeListParams {
    page?: number;
    page_size?: number;
    statut?: string;
    is_active?: boolean;
    search?: string;
}

export interface ChallengeListResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: Challenge[];
}
