import api from './api';
import type { Fournisseur } from '../types';

export interface SupplierFilters {
    search?: string;
    page?: number;
    page_size?: number;
}

const fournisseurService = {
    getAll: async (filters: SupplierFilters = {}): Promise<any> => {
        const response = await api.get('fournisseurs/', { params: filters });
        return response.data;
    },

    getById: async (id: number): Promise<Fournisseur> => {
        const response = await api.get<Fournisseur>(`fournisseurs/${id}/`);
        return response.data;
    },

    create: async (data: Partial<Fournisseur>): Promise<Fournisseur> => {
        const response = await api.post<Fournisseur>('fournisseurs/', data);
        return response.data;
    },

    update: async (id: number, data: Partial<Fournisseur>): Promise<Fournisseur> => {
        const response = await api.patch<Fournisseur>(`fournisseurs/${id}/`, data);
        return response.data;
    },

    delete: async (id: number): Promise<void> => {
        await api.delete(`fournisseurs/${id}/`);
    },

    getStats: async (id: number): Promise<any> => {
        const response = await api.get(`fournisseurs/${id}/stats/`);
        return response.data;
    },

    getEcheancesDetaillees: async (id: number): Promise<any> => {
        const response = await api.get(`fournisseurs/${id}/echeances_detaillees/`);
        return response.data;
    }
};

export default fournisseurService;
