import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '../config/axios';
import type {
    ProduitModel,
    Rayon,
    Fournisseur,
    AchatProduit,
    StockLot,
    StockAdjustment,
    Forme
} from '../types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
const produitsEndpoint = `${apiBaseUrl}/api/produits/`;
const categoriesEndpoint = `${apiBaseUrl}/api/categories/`;
const fournisseursEndpoint = `${apiBaseUrl}/api/fournisseurs/`;
const formesEndpoint = `${apiBaseUrl}/api/formes/`;

// Types
interface ProduitFilters {
    search?: string;
    page?: number;
    rayon?: string;
    fournisseur?: string;
}

interface ProduitsResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: ProduitModel[];
}

interface MonthlyStat {
    year: number;
    month: number;
    month_name: string;
    qte_v: number;
    qte_c: number;
    nb_c: number;
}

// Queries

export const useProduits = (filters: ProduitFilters) => {
    return useQuery({
        queryKey: ['produits', filters],
        queryFn: async () => {
            // Return empty result if no search term (User requirement: empty by default)
            const params = new URLSearchParams();
            if (filters.search) params.append('search', filters.search);
            if (filters.page) params.append('page', filters.page.toString());
            // Note: rayon and fournisseur filtering currently happens client-side in the original component, 
            // but if the API supports it, we should add it here. 
            // For migration fidelity, we fetch the paginated list based on search/page first.

            const response = await axios.get<ProduitsResponse | ProduitModel[]>(produitsEndpoint, { params });

            // Normalize response
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
        placeholderData: (previousData) => previousData,
        // enabled: true // Fetch by default
    });
};

export const useProduit = (id: number | null) => {
    return useQuery({
        queryKey: ['produit', id],
        queryFn: async () => {
            if (!id) return null;
            const response = await axios.get<ProduitModel>(`${produitsEndpoint}${id}/`);
            return response.data;
        },
        enabled: !!id,
    });
};

export const useRayons = () => {
    return useQuery({
        queryKey: ['rayons', 'all'],
        queryFn: async () => {
            const response = await axios.get<Rayon[] | { results: Rayon[] }>(categoriesEndpoint, { params: { page_size: 1000 } });
            if (Array.isArray(response.data)) return response.data;
            return response.data.results;
        },
        staleTime: 1000 * 60 * 30, // 30 mins
    });
};

export const useFournisseurs = () => {
    return useQuery({
        queryKey: ['fournisseurs', 'all'],
        queryFn: async () => {
            const response = await axios.get<Fournisseur[] | { results: Fournisseur[] }>(fournisseursEndpoint, { params: { page_size: 1000 } });
            if (Array.isArray(response.data)) return response.data;
            return response.data.results;
        },
        staleTime: 1000 * 60 * 30, // 30 mins
    });
};

export const useFormes = () => {
    return useQuery({
        queryKey: ['formes', 'all'],
        queryFn: async () => {
            const response = await axios.get<Forme[] | { results: Forme[] }>(formesEndpoint, { params: { page_size: 1000 } });
            if (Array.isArray(response.data)) return response.data;
            return response.data.results;
        },
        staleTime: 1000 * 60 * 30, // 30 mins
    });
};

// Hooks pour les Groupes
export function useGroupes() {
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
    return useQuery({
        queryKey: ['groupes', 'all'],
        queryFn: async () => {
            const response = await axios.get(`${apiBaseUrl}/api/groupes/`, { params: { page_size: 1000 } })
            return response.data.results || response.data
        },
        staleTime: 5 * 60 * 1000,
    })
}

// Sub-resources requiring product ID

export const useProduitAchats = (produitId: number | null) => {
    return useQuery({
        queryKey: ['produit-achats', produitId],
        queryFn: async () => {
            if (!produitId) return [];
            const response = await axios.get<AchatProduit[] | { results: AchatProduit[] }>(
                `${apiBaseUrl}/api/commande-produits/`,
                { params: { produit: produitId } }
            );
            return Array.isArray(response.data) ? response.data : (response.data.results || []);
        },
        enabled: !!produitId,
    });
};

export const useProduitLots = (produitId: number | null) => {
    return useQuery({
        queryKey: ['produit-lots', produitId],
        queryFn: async () => {
            if (!produitId) return [];
            const response = await axios.get<StockLot[] | { results: StockLot[] }>(
                `${apiBaseUrl}/api/stock-lots/`,
                { params: { produit: produitId, ordering: 'date_expiration' } }
            );
            return Array.isArray(response.data) ? response.data : (response.data.results || []);
        },
        enabled: !!produitId,
    });
};

export const useProduitAdjustments = (produitId: number | null) => {
    return useQuery({
        queryKey: ['produit-adjustments', produitId],
        queryFn: async () => {
            if (!produitId) return [];
            const response = await axios.get<StockAdjustment[] | { results: StockAdjustment[] }>(
                `${apiBaseUrl}/api/stock-adjustments/`,
                { params: { produit: produitId, ordering: '-created_at' } }
            );
            return Array.isArray(response.data) ? response.data : (response.data.results || []);
        },
        enabled: !!produitId,
    });
};

export const useProduitStats = (produitId: number | null) => {
    return useQuery({
        queryKey: ['produit-stats', produitId],
        queryFn: async () => {
            if (!produitId) return [];
            const response = await axios.get<MonthlyStat[]>(`${produitsEndpoint}${produitId}/monthly_stats/`);
            return response.data;
        },
        enabled: !!produitId,
    });
};

export const useProduitHistory = (produitId: number | null, activeTab: string) => {
    return useQuery({
        queryKey: ['produit-history', produitId],
        queryFn: async () => {
            if (!produitId) return [];
            const response = await axios.get<any[]>(`${produitsEndpoint}${produitId}/history/`);
            return response.data;
        },
        enabled: !!produitId && activeTab === 'mouvements',
    });
};

// Mutations

export const useUpdateProduit = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, data }: { id: number; data: Partial<ProduitModel> }) => {
            const response = await axios.patch<ProduitModel>(`${produitsEndpoint}${id}/`, data);
            return response.data;
        },
        onSuccess: (updatedProduit) => {
            // Update specific product cache
            queryClient.setQueryData(['produit', updatedProduit.id], updatedProduit);
            // Invalidate list to refresh data
            queryClient.invalidateQueries({ queryKey: ['produits'] });
        },
    });
};

export const useCreateProduit = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: Partial<ProduitModel>) => {
            const response = await axios.post<ProduitModel>(produitsEndpoint, data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['produits'] });
        },
    });
};

export const useDeleteProduit = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            await axios.delete(`${produitsEndpoint}${id}/`);
            return id;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['produits'] });
        },
    });
};

export const useAdjustStock = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, quantity, reason }: { id: number; quantity: number; reason: string }) => {
            const response = await axios.post(`${produitsEndpoint}${id}/adjust_stock/`, {
                new_quantity: quantity,
                reason_type: reason
            });
            return response.data;
        },
        onSuccess: (data, variables) => {
            // Invalidate product details and list
            queryClient.invalidateQueries({ queryKey: ['produit', variables.id] });
            queryClient.invalidateQueries({ queryKey: ['produits'] });
            queryClient.invalidateQueries({ queryKey: ['produit-adjustments', variables.id] });
        }
    });
};

export const useRecalculateRotation = () => {
    return useMutation({
        mutationFn: async () => {
            const response = await axios.post<{ message: string }>(`${produitsEndpoint}recalculate_rotation/`);
            return response.data;
        },
    });
};

export const useImportCsv = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            const importEndpoint = `${apiBaseUrl}/api/produits-import/import_csv/`;
            const response = await axios.post(importEndpoint, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['produits'] });
        }
    });
};

export const useBulkDelete = () => {
    const queryClient = useQueryClient();
    // This is a bit complex as it iterates. 
    // We might want to keep the iteration logic in the component or move it here.
    // For now, let's keep the iteration logic in the component but expose a single delete mutation helper if needed.
    // Actually, `useDeleteProduit` is sufficient if called in loop, or we can make a bulk mutation.
    return useMutation({
        mutationFn: async (ids: number[]) => {
            const results = [];
            for (const id of ids) {
                try {
                    await axios.delete(`${produitsEndpoint}${id}/`);
                    results.push({ id, status: 'success' });
                } catch (error) {
                    results.push({ id, status: 'error', error });
                }
            }
            return results;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['produits'] });
        }
    });
};
// Note: Bulk updates for Rayon/Fournisseur could also be added similarly.
