import api from './api';
import type { Creance } from '../types';
import { generateUUID } from '../utils/uuid';

export interface CreanceFilters {
    client_id?: string;
    date_debut?: string;
    date_fin?: string;
    /** 'true' = masque les factures déjà couvertes par un relevé émis non soldé */
    exclude_transmis?: string;
}

export interface CreanceAgingBucket {
    montant: number;
    nb: number;
}

export interface CreanceAging {
    b_0_30: CreanceAgingBucket;
    b_30_60: CreanceAgingBucket;
    b_60_90: CreanceAgingBucket;
    b_90_plus: CreanceAgingBucket;
    total: CreanceAgingBucket;
}

export interface RelancePreview {
    client_id: number;
    client_name: string;
    phone: string;
    phone_wa: string;
    email: string;
    email_configured: boolean;
    solde_du: number;
    nb_factures: number;
    message: string;
    whatsapp_configured: boolean;
}

export interface AjouterPaiementPayload {
    mode_paiement: string;
    montant: number;
    reference?: string;
    validated_by_id: number;
    sudo_password: string;
}

export interface BulkPaiementPayload {
    facture_ids: number[];
    mode_paiement: string;
    reference: string;
    validated_by_id: number;
    sudo_password: string;
    montant_total?: number; // Optionnel: pour paiement partiel
    releve_id?: number; // Optionnel: règlement d'un relevé émis
}

export type ReleveStatut = 'EMIS' | 'PARTIEL' | 'SOLDE';

export interface ReleveEmis {
    id: number;
    reference: string;
    client_id: number;
    client: string;
    created_at: string;
    created_by: string | null;
    /** true = relevé émis pour règlement ; false = regroupement de paiement historique */
    emis: boolean;
    statut: ReleveStatut;
    montant_du: string;
    montant_paye: string;
    reste: string;
    nb_factures: number | null;
    factures_impayees: Array<{ id: number; numero_facture: string; reste: string }>;
    date_debut: string | null;
    date_fin: string | null;
    /** Délai de règlement du client (jours) — null pour les regroupements historiques */
    delai_paiement_jours: number | null;
    /** Jours de retard au-delà du délai client (0 = dans les délais ou soldé) */
    jours_retard: number;
}

export interface TransmettreRelevesResponse {
    releves: Array<{
        id: number;
        reference: string;
        client_id: number;
        client: string;
        montant_du: string;
        nb_factures: number;
    }>;
    clients_sans_creance: number[];
}

const creanceService = {
    getAll: async (params: CreanceFilters = {}): Promise<Creance[]> => {
        // Le endpoint est paginé (20/page) : on boucle pour ne pas tronquer
        // silencieusement les clients ayant plus de 20 factures.
        const allResults: Creance[] = [];
        const MAX_PAGES = 50;
        for (let page = 1; page <= MAX_PAGES; page++) {
            const response = await api.get<unknown>('creances/', {
                params: { ...params, page, page_size: 1000 }
            });
            const data = response.data as Creance[] | { results: Creance[]; next?: string | null };
            if (Array.isArray(data)) return allResults.concat(data);
            allResults.push(...(data.results || []));
            if (!data.next) break;
        }
        return allResults;
    },

    getReleve: async (params: { client_id: string; date_debut?: string; date_fin?: string; include_products?: boolean }): Promise<unknown> => {
        const response = await api.get('creances/releve/', { params });
        return response.data;
    },

    ajouterPaiement: async (id: number, payload: AjouterPaiementPayload): Promise<{ detail: string; paiement_id: number; creance?: unknown }> => {
        const response = await api.post(`creances/${id}/ajouter_paiement/`, payload, {
            headers: { 'Idempotency-Key': generateUUID() },
        });
        return response.data;
    },

    bulkPaiement: async (payload: BulkPaiementPayload): Promise<{
        detail: string;
        releve_id: number;
        releve_reference?: string;
        total_amount: string;
        total_dettes: string;
        reste_a_payer: string;
        paiements: Array<{
            facture_id: number;
            numero_facture: string;
            montant_total_facture: string;
            montant_paye: string;
            reste_avant: string;
            reste_apres: string;
            est_soldee: boolean;
        }>;
    }> => {
        const response = await api.post('creances/bulk_paiement/', payload, {
            headers: { 'Idempotency-Key': generateUUID() },
        });
        return response.data;
    },

    imprimerRecu: async (creanceId: number, paiementId?: number): Promise<Blob> => {
        const url = `creances/${creanceId}/imprimer_recu/${paiementId ? `?paiement_id=${paiementId}` : ''}`;
        const response = await api.get(url, { responseType: 'blob' });
        return response.data;
    },

    getSynthese: async (params: { date_debut?: string; date_fin?: string; exclude_transmis?: string } = {}): Promise<unknown[]> => {
        const response = await api.get('creances/synthese_clients/', { params });
        return Array.isArray(response.data) ? response.data : [];
    },

    getAging: async (params: { client_id?: string; date_debut?: string; date_fin?: string; exclude_transmis?: string } = {}): Promise<CreanceAging | null> => {
        const response = await api.get('creances/aging/', { params });
        return response.data as CreanceAging;
    },

    getRelancePreview: async (clientId: number): Promise<RelancePreview> => {
        const response = await api.get('creances/relance_preview/', { params: { client_id: clientId } });
        return response.data as RelancePreview;
    },

    relancer: async (payload: { client_id: number; channel: 'email' | 'sms' | 'whatsapp' | 'whatsapp_link'; message: string }): Promise<{ success: boolean; detail: string }> => {
        const response = await api.post('creances/relancer/', payload, {
            headers: { 'Idempotency-Key': generateUUID() },
        });
        return response.data;
    },

    exportExcel: async (params: CreanceFilters = {}): Promise<Blob> => {
        const response = await api.get('creances/export_excel/', {
            params,
            responseType: 'blob'
        });
        return response.data;
    },

    exportRelevesExcel: async (params: { client_ids: number[]; date_debut?: string; date_fin?: string }): Promise<Blob> => {
        const response = await api.get('creances/releves_excel/', {
            params: {
                client_ids: params.client_ids.join(','),
                date_debut: params.date_debut,
                date_fin: params.date_fin,
            },
            responseType: 'blob'
        });
        return response.data;
    },

    transmettreReleves: async (payload: { client_ids: number[]; date_debut?: string; date_fin?: string }): Promise<TransmettreRelevesResponse> => {
        const response = await api.post('creances/transmettre_releves/', payload, {
            headers: { 'Idempotency-Key': generateUUID() },
        });
        return response.data;
    },

    getRelevesEmis: async (params: { statut?: ReleveStatut; client_id?: number } = {}): Promise<ReleveEmis[]> => {
        const response = await api.get('creances/releves_emis/', { params });
        return Array.isArray(response.data) ? response.data : [];
    }
};

export default creanceService;
