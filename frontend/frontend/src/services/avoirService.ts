import api from './api';
import type { Avoir, LigneAvoir, PaginatedResponse } from '../types';

export interface PromisDischargeConflict {
    produit_id: number;
    produit_nom: string;
    quantite_demandee: number;
    stock_vendable: number;
    promis_en_attente: number;
    unites_promises_consommees: number;
}

const avoirService = {
    getAll: async (search: string = ''): Promise<Avoir[]> => {
        const url = search ? `avoirs/?search=${encodeURIComponent(search)}` : 'avoirs/';
        const response = await api.get<Avoir[] | PaginatedResponse<Avoir>>(url);
        return Array.isArray(response.data) ? response.data : (response.data.results || []);
    },

    getById: async (id: number): Promise<Avoir> => {
        const response = await api.get<Avoir>(`avoirs/${id}/`);
        return response.data;
    },

    create: async (data: Partial<Avoir>): Promise<Avoir> => {
        const response = await api.post<Avoir>('avoirs/', data);
        return response.data;
    },

    update: async (id: number, data: Partial<Avoir>): Promise<Avoir> => {
        const response = await api.patch<Avoir>(`avoirs/${id}/`, data);
        return response.data;
    },

    delete: async (id: number): Promise<void> => {
        await api.delete(`avoirs/${id}/`);
    },

    valider: async (id: number): Promise<Avoir> => {
        const response = await api.post(`avoirs/${id}/valider/`);
        return response.data.avoir;
    },

    dechargerStock: async (id: number, data: { validated_by_id: number; password: string; force_discharge?: boolean }): Promise<Avoir> => {
        const response = await api.post(`avoirs/${id}/decharger_stock/`, data);
        return response.data.avoir;
    },

    getPromisConflicts: async (id: number): Promise<PromisDischargeConflict[]> => {
        const response = await api.get(`avoirs/${id}/promis_conflicts/`);
        return response.data.conflicts || [];
    },

    annulerDechargement: async (id: number, data: { validated_by_id: number; password: string }): Promise<Avoir> => {
        const response = await api.post(`avoirs/${id}/annuler_dechargement/`, data);
        return response.data.avoir;
    },

    // LigneAvoir specific
    createLigne: async (data: Partial<LigneAvoir>): Promise<LigneAvoir> => {
        const response = await api.post<LigneAvoir>('ligne-avoirs/', data);
        return response.data;
    },

    updateLigne: async (id: number, data: Partial<LigneAvoir>): Promise<LigneAvoir> => {
        const response = await api.patch<LigneAvoir>(`ligne-avoirs/${id}/`, data);
        return response.data;
    },

    deleteLigne: async (id: number): Promise<void> => {
        await api.delete(`ligne-avoirs/${id}/`);
    }
};

export default avoirService;
