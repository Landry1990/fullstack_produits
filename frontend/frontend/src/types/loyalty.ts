export interface LoyaltyHistoryEntry {
    id: number;
    client: number;
    client_name: string;
    facture: number | null;
    facture_numero: string | null;
    type_transaction: 'GAIN' | 'UTILISATION' | 'REMISE_AUTO' | 'AJUSTEMENT';
    type_display: string;
    points: number;
    solde_apres: number;
    montant: string;
    created_by: number | null;
    created_by_name: string;
    created_at: string;
    notes: string;
}

export interface LoyaltySettings {
    id: number;
    amount_per_point: string;
    point_value: string;
    auto_reward_threshold: number;
    auto_reward_percent: string;
}
