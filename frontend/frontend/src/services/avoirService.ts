import api from './api';
import type { Avoir, LigneAvoir } from '../types';

const avoirService = {
    getAll: async (search: string = ''): Promise<Avoir[]> => {
        const url = search ? `avoirs/?search=${encodeURIComponent(search)}` : 'avoirs/';
        const response = await api.get<any>(url);
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

    valider: async (id: number, data: { validated_by_id: number; password: string }): Promise<void> => {
        await api.post(`avoirs/${id}/valider/`, data);
    },

    // LigneAvoir specific
    createLigne: async (data: any): Promise<LigneAvoir> => {
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
