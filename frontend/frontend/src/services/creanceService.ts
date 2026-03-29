import api from './api';
import type { Creance } from '../types';

export interface CreanceFilters {
    client_id?: string;
    date_debut?: string;
    date_fin?: string;
    history?: boolean;
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
}

const creanceService = {
    getAll: async (params: CreanceFilters = {}): Promise<Creance[]> => {
        const response = await api.get<any>('creances/', { params });
        return Array.isArray(response.data) ? response.data : (response.data.results || []);
    },

    getReleve: async (params: { client_id: string; date_debut?: string; date_fin?: string }): Promise<any> => {
        const response = await api.get('creances/releve/', { params });
        return response.data;
    },

    ajouterPaiement: async (id: number, payload: AjouterPaiementPayload): Promise<{ detail: string; paiement_id: number }> => {
        const response = await api.post(`creances/${id}/ajouter_paiement/`, payload);
        return response.data;
    },

    bulkPaiement: async (payload: BulkPaiementPayload): Promise<{ detail: string; releve_id: number }> => {
        const response = await api.post('creances/bulk_paiement/', payload);
        return response.data;
    },

    imprimerRecu: async (creanceId: number, paiementId?: number): Promise<Blob> => {
        const url = `creances/${creanceId}/imprimer_recu/${paiementId ? `?paiement_id=${paiementId}` : ''}`;
        const response = await api.get(url, { responseType: 'blob' });
        return response.data;
    },

    imprimerRelevePaiement: async (releveId: number): Promise<Blob> => {
        const response = await api.get('creances/imprimer_releve_paiement/', {
            params: { releve_id: releveId },
            responseType: 'blob'
        });
        return response.data;
    },

    getSynthese: async (params: { date_debut?: string; date_fin?: string } = {}): Promise<any[]> => {
        const response = await api.get('creances/synthese_clients/', { params });
        return Array.isArray(response.data) ? response.data : [];
    }
};

export default creanceService;
