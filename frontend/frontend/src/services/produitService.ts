import api from './api';
import type {
    ProduitModel,
    Rayon,
    Fournisseur,
    AchatProduit,
    StockLot,
    StockAdjustment,
    Forme
} from '../types';

export interface ProduitFilters {
    search?: string;
    page?: number;
    rayon?: string;
    fournisseur?: string;
    include_inactive?: boolean;
    page_size?: number;
    dormant_months?: number;
    needs_reappro?: boolean;
    has_reserve_storage?: boolean;
}

export interface ProduitsResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: ProduitModel[];
}

export interface MonthlyStat {
    year: number;
    month: number;
    month_name: string;
    qte_v: number;
    qte_c: number;
    nb_c: number;
}

const produitService = {
    getAll: async (filters: ProduitFilters): Promise<ProduitsResponse> => {
        const params = new URLSearchParams();
        if (filters.search) params.append('search', filters.search);
        if (filters.page) params.append('page', filters.page.toString());
        if (filters.rayon) params.append('rayon', filters.rayon);
        if (filters.fournisseur) params.append('fournisseur', filters.fournisseur);
        if (filters.include_inactive) params.append('include_inactive', 'true');
        if (filters.dormant_months) params.append('dormant_months', filters.dormant_months.toString());
        if (filters.needs_reappro) params.append('needs_reappro', 'true');
        if (filters.has_reserve_storage !== undefined) params.append('has_reserve_storage', filters.has_reserve_storage.toString());

        const response = await api.get<ProduitsResponse | ProduitModel[]>('produits/', { params });

        if (Array.isArray(response.data)) {
            return {
                count: response.data.length,
                next: null,
                previous: null,
                results: response.data
            };
        }
        return response.data;
    },

    getById: async (id: number): Promise<ProduitModel> => {
        const response = await api.get<ProduitModel>(`produits/${id}/`);
        return response.data;
    },

    getRayons: async (): Promise<Rayon[]> => {
        const response = await api.get<Rayon[] | { results: Rayon[] }>('categories/', { params: { page_size: 1000 } });
        return Array.isArray(response.data) ? response.data : response.data.results;
    },

    getFournisseurs: async (): Promise<Fournisseur[]> => {
        const response = await api.get<Fournisseur[] | { results: Fournisseur[] }>('fournisseurs/', { params: { page_size: 1000 } });
        return Array.isArray(response.data) ? response.data : response.data.results;
    },

    getFormes: async (): Promise<Forme[]> => {
        const response = await api.get<Forme[] | { results: Forme[] }>('formes/', { params: { page_size: 1000 } });
        return Array.isArray(response.data) ? response.data : response.data.results;
    },

    getGroupes: async (): Promise<Record<string, unknown>[]> => {
        const response = await api.get<{ results: Record<string, unknown>[] } | Record<string, unknown>[]>('groupes/', { params: { page_size: 1000 } });
        return Array.isArray(response.data) ? response.data : response.data.results || [];
    },

    getAchats: async (produitId: number): Promise<AchatProduit[]> => {
        const response = await api.get<AchatProduit[] | { results: AchatProduit[] }>(
            'commande-produits/',
            { params: { produit: produitId } }
        );
        return Array.isArray(response.data) ? response.data : (response.data.results || []);
    },

    getLots: async (produitId: number): Promise<StockLot[]> => {
        const response = await api.get<StockLot[] | { results: StockLot[] }>(
            'stock-lots/',
            { params: { produit: produitId, ordering: 'date_expiration', include_empty: 'true' } }
        );
        return Array.isArray(response.data) ? response.data : (response.data.results || []);
    },

    getAdjustments: async (produitId: number): Promise<StockAdjustment[]> => {
        const response = await api.get<StockAdjustment[] | { results: StockAdjustment[] }>(
            'stock-adjustments/',
            { params: { produit: produitId, ordering: '-created_at' } }
        );
        return Array.isArray(response.data) ? response.data : (response.data.results || []);
    },

    getStats: async (produitId: number): Promise<MonthlyStat[]> => {
        const response = await api.get<MonthlyStat[]>(`produits/${produitId}/monthly_stats/`);
        return response.data;
    },

    getHistory: async (produitId: number): Promise<unknown[]> => {
        const response = await api.get<unknown[]>(`produits/${produitId}/history/`);
        return response.data;
    },

    create: async (data: Partial<ProduitModel>): Promise<ProduitModel> => {
        const response = await api.post<ProduitModel>('produits/', data);
        return response.data;
    },

    update: async (id: number, data: Partial<ProduitModel>): Promise<ProduitModel> => {
        const response = await api.patch<ProduitModel>(`produits/${id}/`, data);
        return response.data;
    },

    delete: async (id: number): Promise<void> => {
        await api.delete(`produits/${id}/`);
    },

    adjustStock: async (id: number, quantity?: number, reason?: string, newReserveQuantity?: number): Promise<ProduitModel> => {
        const response = await api.post<ProduitModel>(`produits/${id}/adjust_stock/`, {
            new_quantity: quantity,
            new_reserve_quantity: newReserveQuantity,
            reason_type: reason
        });
        return response.data;
    },

    recalculateRotation: async (): Promise<{ message: string }> => {
        const response = await api.post<{ message: string }>('produits/recalculate_rotation/');
        return response.data;
    },

    importCsv: async (file: File): Promise<unknown> => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.post<unknown>('produits-import/import_csv/', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    bulkDelete: async (ids: number[]): Promise<{ message: string; count: number }> => {
        const response = await api.post<{ message: string; count: number }>('produits/bulk_delete/', { ids });
        return response.data;
    },

    bulkRefresh: async (ids: number[]): Promise<ProduitModel[]> => {
        const response = await api.post<ProduitModel[]>('produits/bulk_refresh/', { ids });
        return response.data;
    },

    getReapproSummary: async (): Promise<{ product_count: number; total_units_suggested: number }> => {
        const response = await api.get<{ product_count: number; total_units_suggested: number }>('produits/reappro_summary/');
        return response.data;
    },

    bulkTransferToShelf: async (productIds: number[], sudoCreds?: { validated_by_id: number; sudo_password: string }): Promise<any> => {
        const payload = {
            product_ids: productIds,
            ...(sudoCreds || {})
        };
        const response = await api.post('produits/bulk_transfer_to_shelf/', payload);
        return response.data;
    },

    getReapproHistory: async (): Promise<any[]> => {
        const response = await api.get('reappro-sessions/');
        return response.data;
    },

    getReapproSessionPdf: async (sessionId: number): Promise<Blob> => {
        const response = await api.get(`reappro-sessions/${sessionId}/generate_pdf/`, {
            responseType: 'blob'
        });
        return response.data;
    }
};

export default produitService;
