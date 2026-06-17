import api from './api';
import type { Commande, PaginatedResponse } from '../types';

export interface SudoCredentials {
    validated_by_id?: number;
    sudo_password?: string;
}

export interface CommandeProduitPayload {
    id?: number | null;
    produit: number;
    quantity: number;
    unites_gratuites: number;
    price: string;
    price_cost: string;
    selling_price: string;
    prix_euro: string | null;
    tva?: string;
    taux_marge: string;
    lot?: number | string | null;
    date_expiration?: string | null;
}

export interface SuggestionFilters {
    fournisseur_id?: number;
    rayon_id?: number;
    days?: number;
}

export interface CommandeFilters {
    page?: number;
    type?: 'LOC' | 'DIR' | 'DIV';
    status?: string;
    search?: string;
}

const commandeService = {
    getAll: async (filters: CommandeFilters = {}): Promise<PaginatedResponse<Commande>> => {
        // Sanitize filters: remove 'ALL' values which the backend doesn't like
        const sanitizedFilters = Object.entries(filters).reduce((acc, [key, value]) => {
            if (value && String(value).toUpperCase() !== 'ALL') {
                acc[key] = value;
            }
            return acc;
        }, {} as any);

        const response = await api.get<PaginatedResponse<Commande>>('commandes/', { params: sanitizedFilters });
        return response.data;
    },

    getById: async (id: number): Promise<Commande> => {
        const response = await api.get<Commande>(`commandes/${id}/`);
        return response.data;
    },

    create: async (data: Partial<Commande>): Promise<Commande> => {
        const response = await api.post<Commande>('commandes/', data);
        return response.data;
    },

    update: async (id: number, data: Partial<Commande>): Promise<Commande> => {
        const response = await api.patch<Commande>(`commandes/${id}/`, data);
        return response.data;
    },

    delete: async (id: number, sudoData: SudoCredentials = {}): Promise<void> => {
        await api.delete(`commandes/${id}/`, { data: sudoData });
    },

    cloturer: async (id: number, sudoData: SudoCredentials = {}): Promise<{ message: string }> => {
        const idempotencyKey = crypto.randomUUID();
        const response = await api.post<{ message: string }>(
            `commandes/${id}/cloturer/`,
            sudoData,
            { headers: { 'Idempotency-Key': idempotencyKey } }
        );
        return response.data;
    },

    toggleStatus: async (id: number): Promise<Commande> => {
        const response = await api.post<Commande>(`commandes/${id}/toggle_status/`);
        return response.data;
    },

    annulerReception: async (id: number, sudoData: SudoCredentials = {}): Promise<{ details?: string }> => {
        const response = await api.post<{ details?: string }>(`commandes/${id}/annuler_reception/`, sudoData);
        return response.data;
    },

    bulkDelete: async (ids: number[], sudoData: SudoCredentials = {}): Promise<void> => {
        await api.post('commandes/bulk_delete/', { ids, ...sudoData });
    },

    bulkSyncProduits: async (commandeId: number, produits: CommandeProduitPayload[]): Promise<{ synced: number }> => {
        const response = await api.post<{ synced: number }>('commande-produits/bulk_sync/', {
            commande_id: commandeId,
            produits
        });
        return response.data;
    },

    imprimerReception: async (id: number): Promise<Blob> => {
        const response = await api.get(`commandes/${id}/imprimer_reception/`, { responseType: 'blob' });
        return response.data;
    },

    merge: async (targetId: number, sourceIds: number[]): Promise<Commande> => {
        const response = await api.post<Commande>(`commandes/${targetId}/merge/`, { source_ids: sourceIds });
        return response.data;
    },

    transfer: async (id: number, newFournisseurId: number): Promise<Commande> => {
        const response = await api.post<Commande>(`commandes/${id}/transfer/`, { new_fournisseur_id: newFournisseurId });
        return response.data;
    },

    getSuggestions: async (filters: SuggestionFilters = {}): Promise<Commande[]> => {
        const response = await api.get<Commande[]>('commandes/suggestions/', { params: filters });
        return response.data;
    }
};

export default commandeService;
