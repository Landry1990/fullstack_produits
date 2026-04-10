import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import produitService, { type ProduitFilters, type ProduitsResponse } from '../services/produitService';
import type {
    ProduitModel,
    Rayon
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

// Sub-resources requiring product ID

export const useProduitAchats = (produitId: number | null) => {
    return useQuery({
        queryKey: ['produit-achats', produitId],
        queryFn: () => produitId ? produitService.getAchats(produitId) : Promise.resolve([]),
        enabled: !!produitId,
    });
};

export const useProduitLots = (produitId: number | null) => {
    return useQuery({
        queryKey: ['produit-lots', produitId],
        queryFn: () => produitId ? produitService.getLots(produitId) : Promise.resolve([]),
        enabled: !!produitId,
    });
};

export const useProduitAdjustments = (produitId: number | null) => {
    return useQuery({
        queryKey: ['produit-adjustments', produitId],
        queryFn: () => produitId ? produitService.getAdjustments(produitId) : Promise.resolve([]),
        enabled: !!produitId,
    });
};

export const useProduitStats = (produitId: number | null) => {
    return useQuery({
        queryKey: ['produit-stats', produitId],
        queryFn: () => produitId ? produitService.getStats(produitId) : Promise.resolve([]),
        enabled: !!produitId,
    });
};

export const useProduitHistory = (produitId: number | null, activeTab: string) => {
    return useQuery({
        queryKey: ['produit-history', produitId, activeTab],
        queryFn: () => produitId ? produitService.getHistory(produitId) : Promise.resolve([]),
        enabled: !!produitId && activeTab === 'mvmts',
    });
};

// Mutations

export const useUpdateProduit = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<ProduitModel> }) =>
            produitService.update(id, data),
        onSuccess: (updatedProduit) => {
            queryClient.setQueryData(['produit', updatedProduit.id], updatedProduit);
            queryClient.invalidateQueries({ queryKey: ['produits'] });
            queryClient.invalidateQueries({ queryKey: ['produit-lots', updatedProduit.id] });
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
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['produits'] });
        },
    });
};

export const useAdjustStock = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, quantity, reason, newReserveQuantity }: { id: number; quantity?: number; reason?: string; newReserveQuantity?: number }) =>
            produitService.adjustStock(id, quantity, reason, newReserveQuantity),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['produit', variables.id] });
            queryClient.invalidateQueries({ queryKey: ['produits'] });
            queryClient.invalidateQueries({ queryKey: ['produit-adjustments', variables.id] });
            queryClient.invalidateQueries({ queryKey: ['produit-lots', variables.id] });
            queryClient.invalidateQueries({ queryKey: ['produit-history', variables.id] });
        }
    });
};

export const useRecalculateRotation = () => {
    return useMutation({
        mutationFn: () => produitService.recalculateRotation(),
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
