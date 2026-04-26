import api from './api';
import type { Facture } from '../types';

export interface SalesStats {
    top_vendeur: {
        name: string;
        amount: number;
        count: number;
    } | null;
    top_produit: {
        name: string;
        quantity: number;
    } | null;
    total_ttc: string;
    total_regle: string;
    total_en_compte: string;
}

export interface SimpleUser {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
}

export interface PageInitResponse {
    factures: {
        count: number;
        next: string | null;
        previous: string | null;
        results: Facture[];
    } | Facture[];
    stats: SalesStats | null;
    users: SimpleUser[];
}

export interface SalesFilters {
    date__gte: string;
    date__lte: string;
    page: number;
    page_size: number;
    status?: string;
    created_by?: string;
    search?: string;
}

const venteService = {
    getPageInit: async (params: SalesFilters): Promise<PageInitResponse> => {
        const response = await api.get<PageInitResponse>('factures/page_init/', { params });
        return response.data;
    },

    getFactures: async (params: SalesFilters): Promise<any> => {
        const response = await api.get('factures/', { params });
        return response.data;
    },

    deleteFacture: async (id: number): Promise<void> => {
        await api.delete(`factures/${id}/`);
    },

    getById: async (id: number): Promise<Facture> => {
        const response = await api.get<Facture>(`factures/${id}/`);
        return response.data;
    },

    update: async (id: number, data: Partial<Facture>): Promise<Facture> => {
        const response = await api.patch<Facture>(`factures/${id}/`, data);
        return response.data;
    },

    deleteBrouillons: async (): Promise<void> => {
        await api.delete('factures/delete_brouillons/');
    },

    bulkDelete: async (ids: number[]): Promise<any> => {
        const response = await api.post('factures/bulk_delete/', { ids });
        return response.data;
    },

    finaliser: async (data: any): Promise<Facture> => {
        // Handle images/files using FormData
        if (data.image_ordonnance instanceof File) {
            const formData = new FormData();
            const { image_ordonnance, ...jsonData } = data;
            formData.append('image_ordonnance', image_ordonnance);
            formData.append('json_data', JSON.stringify(jsonData));
            const response = await api.post<Facture>('factures/finaliser/', formData);
            return response.data;
        }

        const response = await api.post<Facture>('factures/finaliser/', data);
        return response.data;
    },

    modifier: async (id: number, data: any): Promise<any> => {
        const response = await api.post(`factures/${id}/modifier/`, data);
        return response.data;
    }
};

export default venteService;
