import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '../config/axios';
import type { Commande, Fournisseur, Rayon, CommandeProduit } from '../types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
const commandesEndpoint = `${apiBaseUrl}/api/commandes/`;
const fournisseursEndpoint = `${apiBaseUrl}/api/fournisseurs/`;
const rayonsEndpoint = `${apiBaseUrl}/api/rayons/`;

// Types
interface CommandesFilters {
    page: number;
    type?: 'LOC' | 'DIR';
    status?: string;
}

interface CommandesResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: Commande[];
}

// ==================== QUERIES ====================

export const useCommandes = (filters: CommandesFilters) => {
    return useQuery({
        queryKey: ['commandes', filters],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.append('page', filters.page.toString());
            if (filters.type) params.append('type', filters.type);
            if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);

            const response = await axios.get<CommandesResponse | Commande[]>(commandesEndpoint, { params });

            // Normalize response (handle both paginated and array responses)
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
    });
};

export const useCommande = (id: number | null) => {
    return useQuery({
        queryKey: ['commande', id],
        queryFn: async () => {
            if (!id) return null;
            const response = await axios.get<Commande>(`${commandesEndpoint}${id}/`);
            return response.data;
        },
        enabled: !!id,
    });
};

export const useCommandeFournisseurs = () => {
    return useQuery({
        queryKey: ['fournisseurs'],
        queryFn: async () => {
            const response = await axios.get<Fournisseur[] | { results: Fournisseur[] }>(fournisseursEndpoint);
            if (Array.isArray(response.data)) return response.data;
            return response.data.results || [];
        },
        staleTime: 1000 * 60 * 30, // 30 mins - reference data rarely changes
    });
};

export const useCommandeRayons = () => {
    return useQuery({
        queryKey: ['rayons'],
        queryFn: async () => {
            const response = await axios.get<Rayon[] | { results: Rayon[] }>(rayonsEndpoint);
            if (Array.isArray(response.data)) return response.data;
            return response.data.results || [];
        },
        staleTime: 1000 * 60 * 30, // 30 mins
    });
};

// ==================== MUTATIONS ====================

// Helper function for Date format MM/YY
function parseMMYYToDate(mmyy: string | null | undefined): string | null {
    if (!mmyy) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(mmyy)) return mmyy; // Already ISO

    const parts = mmyy.split('/');
    if (parts.length === 2 && parts[1].length === 2) {
        const month = parseInt(parts[0], 10);
        const year = parseInt('20' + parts[1], 10);
        if (month >= 1 && month <= 12) {
            const lastDay = new Date(year, month, 0).getDate();
            return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        }
    }
    return null;
}

// Clean payload to avoid circular references
const cleanPayload = (data: unknown): unknown => {
    try {
        return JSON.parse(JSON.stringify(data));
    } catch {
        return data;
    }
};

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
            const cleanedCommandeData = cleanPayload(commandeData);
            let commandeId = selectedCommandeId;

            // 1. Create or update the commande
            if (mode === 'CREATE') {
                const response = await axios.post<Commande>(commandesEndpoint, cleanedCommandeData);
                commandeId = response.data.id;
            } else if (mode === 'EDIT' && commandeId) {
                await axios.patch<Commande>(`${commandesEndpoint}${commandeId}/`, cleanedCommandeData);
            }

            if (!commandeId) throw new Error("ID de commande manquant");

            // 2. Handle products with bulk_sync
            const productsPayload = commandeProduits.map(p => ({
                id: p.id && !String(p.id).startsWith('temp-') ? p.id : null,
                produit: typeof p.produit === 'object' ? p.produit.id : p.produit,
                quantity: parseInt(String(p.quantity)),
                unites_gratuites: parseInt(String(p.unites_gratuites || 0)),
                price: parseFloat(String(p.price)).toFixed(2),
                price_cost: parseFloat(String(p.price)).toFixed(2),
                selling_price: p.selling_price ? parseFloat(String(p.selling_price)).toFixed(2) : '0.00',
                prix_euro: p.prix_euro ? parseFloat(String(p.prix_euro)).toFixed(2) : null,
                tva: parseFloat(String(p.tva || 18)).toFixed(2),
                marge: parseFloat(String(p.marge || 1.3)).toFixed(4),
                lot: p.lot || null,
                date_expiration: parseMMYYToDate(p.date_expiration)
            }));

            await axios.post(`${commandesEndpoint}${commandeId}/bulk_sync/`, { produits: productsPayload });

            // Return the created/updated commande
            const { data: updatedCommande } = await axios.get<Commande>(`${commandesEndpoint}${commandeId}/`);
            return { commande: updatedCommande, isAutoSave, mode };
        },
        onSuccess: (result) => {
            if (!result.isAutoSave) {
                queryClient.invalidateQueries({ queryKey: ['commandes'] });
            }
            // Update specific commande cache
            queryClient.setQueryData(['commande', result.commande.id], result.commande);
        },
    });
};

export const useDeleteCommande = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (commandeId: number) => {
            await axios.delete(`${commandesEndpoint}${commandeId}/`);
            return commandeId;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['commandes'] });
        },
    });
};

export const useClotureCommande = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (commandeId: number) => {
            const response = await axios.post(`${commandesEndpoint}${commandeId}/cloturer/`);
            const { data: updated } = await axios.get<Commande>(`${commandesEndpoint}${commandeId}/`);
            return { message: response.data.message, commande: updated };
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
            await axios.patch(`${commandesEndpoint}${commandeId}/`, { status });
            const { data: updated } = await axios.get<Commande>(`${commandesEndpoint}${commandeId}/`);
            return updated;
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
            const response = await axios.post(`${commandesEndpoint}${commandeId}/annuler_reception/`);
            const { data: updated } = await axios.get<Commande>(`${commandesEndpoint}${commandeId}/`);
            return { details: response.data.details, commande: updated };
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['commandes'] });
            queryClient.setQueryData(['commande', result.commande.id], result.commande);
        },
    });
};

export const useImprimerReception = () => {
    return useMutation({
        mutationFn: async (commandeId: number) => {
            const response = await axios.get(`${commandesEndpoint}${commandeId}/imprimer_reception/`, {
                responseType: 'blob'
            });
            return { blob: response.data, commandeId };
        },
        onSuccess: (result) => {
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
