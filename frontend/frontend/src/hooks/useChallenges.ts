import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from 'use-debounce';
import api from '../services/api';
import { challengesService } from '../services/challengesService';
import type { Challenge, ChallengeListParams, ChallengePayload, ChallengeListResponse } from '../types';

export const CHALLENGES_KEY = 'challenges';

export const useChallenges = (params?: ChallengeListParams) =>
    useQuery({
        queryKey: [CHALLENGES_KEY, 'list', params],
        queryFn: () => challengesService.list(params),
        placeholderData: (prev) => prev,
    });

export const useChallenge = (id: number | null) =>
    useQuery({
        queryKey: [CHALLENGES_KEY, 'detail', id],
        queryFn: () => challengesService.get(id as number),
        enabled: !!id,
    });

export const useChallengeClassement = (id: number | null) =>
    useQuery({
        queryKey: [CHALLENGES_KEY, 'classement', id],
        queryFn: () => challengesService.classement(id as number),
        enabled: !!id,
    });

interface SaveArgs {
    id?: number;
    data: ChallengePayload;
    sudoPassword?: string;
}

export const useSaveChallenge = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data, sudoPassword }: SaveArgs) =>
            id ? challengesService.update(id, data, sudoPassword) : challengesService.create(data, sudoPassword),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: [CHALLENGES_KEY] });
        },
    });
};

interface DeleteArgs {
    id: number;
    sudoPassword?: string;
}

export const useDeleteChallenge = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, sudoPassword }: DeleteArgs) => challengesService.delete(id, sudoPassword),
        onMutate: async ({ id }) => {
            await qc.cancelQueries({ queryKey: [CHALLENGES_KEY] });
            const previousLists = qc.getQueriesData<ChallengeListResponse>({ queryKey: [CHALLENGES_KEY, 'list'] });
            qc.setQueriesData<ChallengeListResponse>({ queryKey: [CHALLENGES_KEY, 'list'] }, (old) => {
                if (!old) return old;
                return {
                    ...old,
                    results: old.results.filter((c: Challenge) => c.id !== id),
                    count: Math.max(0, old.count - 1),
                };
            });
            qc.removeQueries({ queryKey: [CHALLENGES_KEY, 'detail', id] });
            return { previousLists };
        },
        onError: (_err, _vars, context) => {
            context?.previousLists.forEach(([key, data]) => {
                qc.setQueryData(key, data);
            });
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: [CHALLENGES_KEY] });
        },
    });
};

export const useChallengeProductSearch = (searchQuery: string) => {
    const [debounced] = useDebounce(searchQuery, 300);
    return useQuery({
        queryKey: [CHALLENGES_KEY, 'product-search', debounced],
        queryFn: async () => {
            const params: Record<string, unknown> = { page_size: 20 };
            if (debounced.trim()) params.search = debounced.trim();
            const res = await api.get('produits/', { params });
            const data = res.data;
            return (data?.results ?? data ?? []) as Array<{
                id: number;
                name: string;
                cip1?: string;
            }>;
        },
        staleTime: 1000 * 30,
        enabled: debounced.trim().length > 0,
    });
};

export const useChallengeUsers = () =>
    useQuery({
        queryKey: [CHALLENGES_KEY, 'users'],
        queryFn: async () => {
            const res = await api.get('users/', { params: { page_size: 100 } });
            const data = res.data;
            return (data?.results ?? data ?? []) as Array<{
                id: number;
                username: string;
                first_name: string;
                last_name: string;
            }>;
        },
        staleTime: 1000 * 60 * 5,
    });
