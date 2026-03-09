import api from './api';
import type { Client, AyantDroit } from '../types';

export interface ClientFilters {
    search?: string;
    page?: number;
    page_size?: number;
}

const clientService = {
    getAll: async (filters: ClientFilters = {}): Promise<any> => {
        const response = await api.get('clients/', { params: filters });
        return response.data;
    },

    getById: async (id: number): Promise<Client> => {
        const response = await api.get<Client>(`clients/${id}/`);
        return response.data;
    },

    create: async (data: Partial<Client>): Promise<Client> => {
        const response = await api.post<Client>('clients/', data);
        return response.data;
    },

    update: async (id: number, data: Partial<Client>): Promise<Client> => {
        const response = await api.patch<Client>(`clients/${id}/`, data);
        return response.data;
    },

    delete: async (id: number): Promise<void> => {
        await api.delete(`clients/${id}/`);
    },

    getAyantsDroit: async (clientId: number): Promise<AyantDroit[]> => {
        const response = await api.get<AyantDroit[] | { results: AyantDroit[] }>('ayants-droit/', {
            params: { client: clientId }
        });
        return Array.isArray(response.data) ? response.data : (response.data.results || []);
    },

    createAyantDroit: async (data: Partial<AyantDroit>): Promise<AyantDroit> => {
        const response = await api.post<AyantDroit>('ayants-droit/', data);
        return response.data;
    },

    getPurchaseHistory: async (id: number): Promise<any> => {
        const response = await api.get(`clients/${id}/purchase_history/`);
        return response.data;
    },

    toggleActive: async (id: number): Promise<{ is_active: boolean }> => {
        const response = await api.post<{ is_active: boolean }>(`clients/${id}/toggle_active/`);
        return response.data;
    },

    bulkDelete: async (ids: number[]): Promise<void> => {
        await api.post('clients/bulk_delete/', { ids });
    }
};

export default clientService;
