import api from './api';
import type { Client, AyantDroit } from '../types';

export interface ClientFilters {
    search?: string;
    page?: number;
    page_size?: number;
}

const clientService = {
    getAll: async (filters: ClientFilters = {}, skipCache: boolean = false): Promise<any> => {
        const params: any = { ...filters };
        if (skipCache) {
            params._t = Date.now(); // Timestamp pour éviter le cache
        }
        const response = await api.get('clients/', {
            params,
            headers: skipCache ? {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            } : undefined
        });
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
        console.log('[ClientService] DELETE request to:', `clients/${id}/`);
        const response = await api.delete(`clients/${id}/`);
        console.log('[ClientService] DELETE response:', response.status);
        return response.data;
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
        console.log('[ClientService] bulkDelete - IDs:', ids);
        const response = await api.post('clients/bulk_delete/', { ids });
        console.log('[ClientService] bulkDelete - Response:', response.status, response.data);
        return response.data;
    },

    checkUnpaidInvoices: async (id: number): Promise<{
        has_unpaid: boolean;
        count: number;
        total_due: number;
        invoices: Array<{
            id: number;
            numero: string;
            date: string;
            total_ttc: number;
            paid: number;
            remainder: number;
        }>;
    }> => {
        const response = await api.get(`clients/${id}/check_unpaid_invoices/`);
        return response.data;
    },

    bulkCheckUnpaid: async (ids: number[]): Promise<{
        has_unpaid: boolean;
        count: number;
        total_due: number;
        clients: Array<{
            id: number;
            name: string;
            invoice_count: number;
            total_due: number;
        }>;
    }> => {
        const response = await api.post('clients/bulk_check_unpaid/', { ids });
        return response.data;
    },
    
    getDepotHistory: async (id: number): Promise<any> => {
        const response = await api.get(`clients/${id}/depot_history/`);
        return response.data;
    },

    addDepot: async (id: number, data: { type: string, montant: number, mode_paiement?: string, notes?: string }): Promise<any> => {
        const response = await api.post(`clients/${id}/add_depot/`, data);
        return response.data;
    }
};

export default clientService;
