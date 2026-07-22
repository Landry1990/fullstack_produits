import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import produitService, { type ProduitFilters, type ProduitsResponse, type MonthlyStat } from '../services/produitService';
import type {
    ProduitModel,
    Rayon,
    AchatProduit,
    StockLot,
    StockAdjustment
} from '../types';

// Queries

export const useProduits = (filters: ProduitFilters) => {
    return useQuery<ProduitsResponse>({
        queryKey: ['produits', filters],
        queryFn: () => produitService.getAll(filters),
        placeholderData: (previousData: ProduitsResponse | undefined) => previousData,
    });
};

export const useProduit = (id: number | null) => {
    return useQuery<ProduitModel | null>({
        queryKey: ['produit', id],
        queryFn: async () => {
            if (!id) return null;
            return produitService.getById(id);
        },
        enabled: !!id,
        staleTime: 0, // Stock temps réel — toujours refetch au montage
        gcTime: 1000 * 60 * 5,
    });
};

export const useRayons = () => {
    return useQuery<Rayon[]>({
        queryKey: ['rayons', 'all'],
        queryFn: () => produitService.getRayons(),
        staleTime: 1000 * 60 * 30, // 30 mins
    });
};

export const useFournisseurs = () => {
    return useQuery({
        queryKey: ['fournisseurs', 'all'],
        queryFn: () => produitService.getFournisseurs(),
        staleTime: 1000 * 60 * 30, // 30 mins
    });
};

export const useFormes = () => {
    return useQuery({
        queryKey: ['formes', 'all'],
        queryFn: () => produitService.getFormes(),
        staleTime: 1000 * 60 * 30, // 30 mins
    });
};

export function useGroupes() {
    return useQuery({
        queryKey: ['groupes', 'all'],
        queryFn: () => produitService.getGroupes(),
        staleTime: 5 * 60 * 1000,
    })
}

export interface StockMovement {
    id?: number;
    date: string;
    type: string;
    libelle: string;
    user?: string;
    user_nom?: string;
    stock_avant: number;
    quantity: number;
    stock_apres: number;
    facture?: number | null;
    commande?: number | null;
    commande_numero?: string;
}

// Sub-resources requiring product ID

export const useProduitAchats = (produitId: number | null) => {
    return useQuery<AchatProduit[]>({
        queryKey: ['produit-achats', produitId],
        queryFn: () => produitId ? produitService.getAchats(produitId) : Promise.resolve([]),
        enabled: !!produitId,
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 10,
    });
};

export const useProduitLots = (produitId: number | null) => {
    return useQuery({
        queryKey: ['produit-lots', produitId],
        queryFn: () => produitId ? produitService.getLots(produitId) : Promise.resolve([]),
        enabled: !!produitId,
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 10,
    });
};

export const useProduitAdjustments = (produitId: number | null) => {
    return useQuery({
        queryKey: ['produit-adjustments', produitId],
        queryFn: () => produitId ? produitService.getAdjustments(produitId) : Promise.resolve([]),
        enabled: !!produitId,
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 10,
    });
};

export const useProduitStats = (produitId: number | null) => {
    return useQuery<MonthlyStat[]>({
        queryKey: ['produit-stats', produitId],
        queryFn: () => produitId ? produitService.getStats(produitId) : Promise.resolve([]),
        enabled: !!produitId,
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 10,
    });
};

export const useProduitHistory = (produitId: number | null, activeTab: string) => {
    return useQuery<StockMovement[]>({
        queryKey: ['produit-history', produitId, activeTab],
        queryFn: () => produitId ? produitService.getHistory(produitId) as Promise<StockMovement[]> : Promise.resolve([]),
        enabled: !!produitId && activeTab === 'mvmts',
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 10,
    });
};

// Mutations

export const useUpdateProduit = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<ProduitModel> }) =>
            produitService.update(id, data),
        onMutate: async (newProduit) => {
            await queryClient.cancelQueries({ queryKey: ['produits'] });
            await queryClient.cancelQueries({ queryKey: ['produit', newProduit.id] });

            const previousProduit = queryClient.getQueryData(['produit', newProduit.id]);

            queryClient.setQueryData(['produit', newProduit.id], (old: unknown) => ({ ...old, ...newProduit.data }));
            
            queryClient.setQueriesData({ queryKey: ['produits'] }, (old: unknown) => {
                if (!old) return old;
                return {
                    ...old,
                    results: old.results?.map((p: unknown) => p.id === newProduit.id ? { ...p, ...newProduit.data } : p)
                };
            });

            return { previousProduit };
        },
        onError: (err, newProduit, context: unknown) => {
            queryClient.setQueryData(['produit', newProduit.id], context.previousProduit);
        },
        onSettled: (updatedProduit) => {
            queryClient.invalidateQueries({ queryKey: ['produits'] });
            if (updatedProduit) queryClient.invalidateQueries({ queryKey: ['produit', updatedProduit.id] });
            queryClient.invalidateQueries({ queryKey: ['produit-lots', updatedProduit?.id] });
        },
    });
};

export const useCreateProduit = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: Partial<ProduitModel>) => produitService.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['produits'] });
        },
    });
};

export const useDeleteProduit = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => produitService.delete(id).then(() => id),
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: ['produits'] });
            queryClient.setQueriesData({ queryKey: ['produits'] }, (old: unknown) => {
                if (!old) return old;
                return {
                    ...old,
                    results: old.results?.filter((p: unknown) => p.id !== id),
                    count: Math.max(0, (old.count || 0) - 1)
                };
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['produits'] });
        },
    });
};

export const useAdjustStock = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, quantity, reason, newReserveQuantity, stockLotId }: { id: number; quantity?: number; reason?: string; newReserveQuantity?: number; stockLotId?: number }) =>
            produitService.adjustStock(id, quantity, reason, newReserveQuantity, stockLotId),
        onMutate: async (vars) => {
            await queryClient.cancelQueries({ queryKey: ['produit', vars.id] });
            await queryClient.cancelQueries({ queryKey: ['produits'] });

            const previousProduit = queryClient.getQueryData(['produit', vars.id]);

            if (vars.quantity !== undefined) {
                queryClient.setQueryData(['produit', vars.id], (old: unknown) => ({ ...old, stock: (old?.stock || 0) + vars.quantity! }));
                queryClient.setQueriesData({ queryKey: ['produits'] }, (old: unknown) => {
                    if (!old) return old;
                    return {
                        ...old,
                        results: old.results?.map((p: unknown) => p.id === vars.id ? { ...p, stock: (p.stock || 0) + vars.quantity! } : p)
                    };
                });
            }

            return { previousProduit };
        },
        onError: (err, vars, context: unknown) => {
            queryClient.setQueryData(['produit', vars.id], context.previousProduit);
        },
        onSettled: (_, __, vars) => {
            queryClient.invalidateQueries({ queryKey: ['produit', vars.id] });
            queryClient.invalidateQueries({ queryKey: ['produits'] });
            queryClient.invalidateQueries({ queryKey: ['produit-adjustments', vars.id] });
            queryClient.invalidateQueries({ queryKey: ['produit-lots', vars.id] });
            queryClient.invalidateQueries({ queryKey: ['produit-history', vars.id] });
        }
    });
};

export const useRecalculateRotation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => produitService.recalculateRotation(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['produits'] });
        }
    });
};

export const useImportCsv = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (file: File) => produitService.importCsv(file),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['produits'] });
        }
    });
};

export const useBulkDelete = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (ids: number[]) => produitService.bulkDelete(ids),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['produits'] });
        }
    });
};
// Note: Bulk updates for Rayon/Fournisseur could also be added similarly.
