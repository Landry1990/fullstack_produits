import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { loyaltyService } from '../services/loyaltyService';
import type { LoyaltySettings } from '../types';

export const useLoyaltyHistory = (params?: { client?: number; type_transaction?: string; page?: number }) =>
    useQuery({
        queryKey: ['loyalty-history', params],
        queryFn: () => loyaltyService.getHistory(params),
    });

export const useLoyaltySettings = () =>
    useQuery({
        queryKey: ['loyalty-settings'],
        queryFn: () => loyaltyService.getSettings(),
    });

export const useSaveLoyaltySettings = () => {
    const qc = useQueryClient();
    return useMutation({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mutationFn: (settings: any) => loyaltyService.saveSettings(settings),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['loyalty-settings'] }),
    });
};

export const useLoyaltyClients = (searchQuery = '') =>
    useQuery({
        queryKey: ['loyalty-clients', searchQuery],
        queryFn: async () => {
            const params: Record<string, unknown> = { page_size: 20, client_type: 'PARTICULIER' };
            if (searchQuery.trim()) params.search = searchQuery.trim();
            const res = await api.get('clients/', { params });
            const data = res.data;
            return data?.results ?? data ?? [];
        },
        staleTime: 1000 * 30,
    });

export type { LoyaltySettings };
