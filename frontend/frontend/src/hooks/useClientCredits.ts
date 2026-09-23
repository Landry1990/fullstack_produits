import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gooeyToast } from 'goey-toast';
import { useTranslation } from 'react-i18next';
import clientCreditService, { type ClientCreditsListResponse } from '../services/clientCreditService';
import { getApiErrorDetail } from '../utils/errorHandling';
import type {
    ClientCredit,
    ClientCreditCreatePayload,
    ClientCreditFilters,
    ClientCreditValidatePayload,
    InvoiceForCreditData,
} from '../types';

const QUERY_KEY = 'client-credits';

export const useClientCredits = (filters: ClientCreditFilters = {}) => {
    return useQuery<ClientCreditsListResponse>({
        queryKey: [QUERY_KEY, filters],
        queryFn: () => clientCreditService.getAll(filters),
        staleTime: 1000 * 60 * 2,
    });
};

export const useClientCredit = (id: number | null) => {
    return useQuery<ClientCredit | null>({
        queryKey: [QUERY_KEY, id],
        queryFn: async () => {
            if (!id) return null;
            return clientCreditService.getById(id);
        },
        enabled: !!id,
        staleTime: 1000 * 60 * 2,
    });
};

export const useInvoiceForCredit = (factureId: number | null) => {
    return useQuery<InvoiceForCreditData | null>({
        queryKey: [QUERY_KEY, 'from-invoice', factureId],
        queryFn: async () => {
            if (!factureId) return null;
            return clientCreditService.fromInvoice(factureId);
        },
        enabled: !!factureId,
        staleTime: 1000 * 60 * 5,
    });
};

export const useCreateClientCredit = () => {
    const queryClient = useQueryClient();
    const { t } = useTranslation('avoirs_client');

    return useMutation({
        mutationFn: (data: ClientCreditCreatePayload) => clientCreditService.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
            gooeyToast.success(t('messages.created'));
        },
        onError: (err: unknown) => {
            gooeyToast.error(getApiErrorDetail(err, t('messages.create_error')));
        },
    });
};

export const useUpdateClientCredit = () => {
    const queryClient = useQueryClient();
    const { t } = useTranslation('avoirs_client');

    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<ClientCreditCreatePayload> }) =>
            clientCreditService.update(id, data),
        onMutate: async ({ id, data }) => {
            await queryClient.cancelQueries({ queryKey: [QUERY_KEY] });
            const previous = snapshotCreditLists(queryClient);
            updateCreditInLists(queryClient, id, data as Partial<ClientCredit>);
            return { previous };
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
            queryClient.invalidateQueries({ queryKey: [QUERY_KEY, variables.id] });
            gooeyToast.success(t('messages.updated'));
        },
        onError: (err: unknown, _variables, context) => {
            if (context?.previous) restoreCreditLists(queryClient, context.previous);
            gooeyToast.error(getApiErrorDetail(err, t('messages.update_error')));
        },
    });
};

type CreditsListData = ClientCreditsListResponse | undefined;

const snapshotCreditLists = (queryClient: ReturnType<typeof useQueryClient>): [readonly unknown[][], CreditsListData][] => {
    return queryClient.getQueriesData<CreditsListData>({ queryKey: [QUERY_KEY] })
        .filter((entry): entry is [readonly unknown[], CreditsListData] => Array.isArray(entry) && entry.length === 2)
        .map(([key, data]) => [key as readonly unknown[], data]);
};

const restoreCreditLists = (
    queryClient: ReturnType<typeof useQueryClient>,
    snapshot: [readonly unknown[][], CreditsListData][]
) => {
    snapshot.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
    });
};

const removeCreditFromLists = (
    queryClient: ReturnType<typeof useQueryClient>,
    id: number
) => {
    queryClient.setQueriesData<ClientCreditsListResponse>({ queryKey: [QUERY_KEY] }, (old) => {
        if (!old) return old;
        return {
            ...old,
            results: old.results.filter((c: ClientCredit) => c.id !== id),
            count: Math.max(0, (old.count || 0) - 1),
        };
    });
};

const updateCreditInLists = (
    queryClient: ReturnType<typeof useQueryClient>,
    id: number,
    patch: Partial<ClientCredit>
) => {
    queryClient.setQueriesData<ClientCreditsListResponse>({ queryKey: [QUERY_KEY] }, (old) => {
        if (!old) return old;
        return {
            ...old,
            results: old.results.map((c: ClientCredit) => c.id === id ? { ...c, ...patch } : c),
        };
    });
};

export const useDeleteClientCredit = () => {
    const queryClient = useQueryClient();
    const { t } = useTranslation('avoirs_client');

    return useMutation({
        mutationFn: (id: number) => clientCreditService.delete(id),
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: [QUERY_KEY] });
            const previous = snapshotCreditLists(queryClient);
            removeCreditFromLists(queryClient, id);
            return { previous };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
            gooeyToast.success(t('messages.deleted'));
        },
        onError: (err: unknown, _id, context) => {
            if (context?.previous) restoreCreditLists(queryClient, context.previous);
            gooeyToast.error(getApiErrorDetail(err, t('messages.delete_error')));
        },
    });
};

export const useValidateClientCredit = () => {
    const queryClient = useQueryClient();
    const { t } = useTranslation('avoirs_client');

    return useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: ClientCreditValidatePayload }) =>
            clientCreditService.validate(id, payload),
        onMutate: async ({ id }) => {
            await queryClient.cancelQueries({ queryKey: [QUERY_KEY] });
            const previous = snapshotCreditLists(queryClient);
            updateCreditInLists(queryClient, id, { status: 'VALIDATED', is_validated: true } as Partial<ClientCredit>);
            return { previous };
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
            queryClient.invalidateQueries({ queryKey: [QUERY_KEY, variables.id] });
            gooeyToast.success(t('messages.validated'));
        },
        onError: (err: unknown, _variables, context) => {
            if (context?.previous) restoreCreditLists(queryClient, context.previous);
            gooeyToast.error(getApiErrorDetail(err, t('messages.validate_error')));
        },
    });
};

export const useExportClientCredits = () => {
    const { t } = useTranslation('avoirs_client');

    return useMutation({
        mutationFn: async (filters: ClientCreditFilters) => {
            const blob = await clientCreditService.exportExcel(filters);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'avoirs_clients.xlsx';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        },
        onSuccess: () => {
            gooeyToast.success(t('messages.export_success'));
        },
        onError: (err: unknown) => {
            gooeyToast.error(getApiErrorDetail(err, t('messages.export_error')));
        },
    });
};
