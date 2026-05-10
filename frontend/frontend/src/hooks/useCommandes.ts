import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Commande, Fournisseur, Rayon, CommandeProduit, PaginatedResponse } from '../types';
import commandeService from '../services/commandeService';
import api from '../services/api';

// Types
interface CommandesFilters {
    page: number;
    type?: 'LOC' | 'DIR' | 'DIV';
    status?: string;
}

// ==================== QUERIES ====================

export const useCommandes = (filters: CommandesFilters) => {
    return useQuery({
        queryKey: ['commandes', filters],
        queryFn: () => commandeService.getAll({
            page: filters.page,
            type: filters.type,
            status: filters.status
        }),
        placeholderData: (previousData) => previousData,
        staleTime: 1000 * 60 * 2, // 2 min — évite un refetch à chaque navigation
    });
};

export const useCommande = (id: number | null) => {
    return useQuery({
        queryKey: ['commande', id],
        queryFn: () => id ? commandeService.getById(id) : null,
        enabled: !!id,
    });
};

export const useCommandeFournisseurs = () => {
    return useQuery({
        queryKey: ['fournisseurs'],
        queryFn: async () => {
            const response = await api.get<Fournisseur[] | PaginatedResponse<Fournisseur>>('fournisseurs/');
            if (Array.isArray(response.data)) return response.data;
            return response.data.results || [];
        },
        staleTime: 1000 * 60 * 30, // 30 mins
    });
};

export const useCommandeRayons = () => {
    return useQuery({
        queryKey: ['rayons'],
        queryFn: async () => {
            const response = await api.get<Rayon[] | PaginatedResponse<Rayon>>('rayons/');
            if (Array.isArray(response.data)) return response.data;
            return response.data.results || [];
        },
        staleTime: 1000 * 60 * 30, // 30 mins
    });
};

// ==================== MUTATIONS ====================

interface SaveCommandeParams {
    commandeData: Partial<Commande>;
    commandeProduits: CommandeProduit[];
    mode: 'CREATE' | 'EDIT';
    selectedCommandeId?: number | null;
    isAutoSave?: boolean;
}

export const useSaveCommande = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ commandeData, commandeProduits, mode, selectedCommandeId, isAutoSave }: SaveCommandeParams) => {
            let commandeId = selectedCommandeId;

            if (mode === 'CREATE') {
                const response = await commandeService.create(commandeData);
                commandeId = response.id;
            } else if (mode === 'EDIT' && commandeId) {
                await commandeService.update(commandeId, commandeData);
            }

            if (!commandeId) throw new Error("ID de commande manquant");

            const productsPayload = commandeProduits.map(p => ({
                id: p.id && !String(p.id).startsWith('temp-') && typeof p.id === 'number' && p.id < 1000000000 ? p.id : null,
                produit: typeof p.produit === 'object' ? p.produit.id : p.produit,
                quantity: parseInt(String(p.quantity)),
                unites_gratuites: parseInt(String(p.unites_gratuites || 0)),
                price: parseFloat(String(p.price)).toFixed(0),
                price_cost: parseFloat(String(p.price)).toFixed(0),
                selling_price: p.selling_price ? parseFloat(String(p.selling_price)).toFixed(0) : '0',
                prix_euro: p.prix_euro ? parseFloat(String(p.prix_euro)).toFixed(0) : null,
                tva: parseFloat(String(p.tva || 18)).toFixed(0),
                marge: parseFloat(String(p.marge || 1.3)).toFixed(4),
                lot: p.lot || null,
                date_expiration: p.date_expiration || null
            }));

            await commandeService.bulkSyncProduits(commandeId, productsPayload);

            const updatedCommande = await commandeService.getById(commandeId);
            return { commande: updatedCommande, isAutoSave, mode };
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['commandes'] });
            queryClient.setQueryData(['commande', result.commande.id], result.commande);
        },
    });
};

export const useDeleteCommande = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (commandeId: number) => commandeService.delete(commandeId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['commandes'] });
        },
    });
};

export const useClotureCommande = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (commandeId: number) => {
            const res = await commandeService.cloturer(commandeId);
            const updated = await commandeService.getById(commandeId);
            return { message: res.message, commande: updated };
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['commandes'] });
            queryClient.setQueryData(['commande', result.commande.id], result.commande);
        },
    });
};

export const useUpdateCommandeStatus = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ commandeId, status }: { commandeId: number; status: string }) => {
            return await commandeService.update(commandeId, { status });
        },
        onSuccess: (updated) => {
            queryClient.invalidateQueries({ queryKey: ['commandes'] });
            queryClient.setQueryData(['commande', updated.id], updated);
        },
    });
};

export const useAnnulerReception = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (commandeId: number) => {
            const res = await commandeService.annulerReception(commandeId);
            const updated = await commandeService.getById(commandeId);
            return { details: res.details, commande: updated };
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['commandes'] });
            queryClient.setQueryData(['commande', result.commande.id], result.commande);
        },
    });
};

export const useImprimerReception = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (commandeId: number) => {
            const blob = await commandeService.imprimerReception(commandeId);
            return { blob, commandeId };
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['commandes'] });
            queryClient.invalidateQueries({ queryKey: ['commande', result.commandeId] });
            
            const url = window.URL.createObjectURL(new Blob([result.blob]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `reception_commande_${result.commandeId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
        },
    });
};
