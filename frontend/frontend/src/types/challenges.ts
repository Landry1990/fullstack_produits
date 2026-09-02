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
    created_by: number | null;
    created_by_name: string;
    participants_count: number;
    produits_count: number;
    is_ongoing: boolean;
    created_at: string;
    updated_at: string;
}

export interface ChallengeClassementEntry {
    rang: number;
    user_id: number;
    username: string;
    nb_boites: number;
    ca: number;
    nb_ventes: number;
}

export interface ChallengeClassement {
    challenge: {
        id: number;
        nom: string;
        date_debut: string;
        date_fin: string;
        statut: string;
        all_users: boolean;
        produits_count: number;
    };
    classement_ca: ChallengeClassementEntry[];
    classement_boites: ChallengeClassementEntry[];
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
