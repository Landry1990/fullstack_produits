import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { toast } from 'react-hot-toast';

export interface Compte {
    id: number;
    numero: string;
    libelle: string;
    type: 'ACTIF' | 'PASSIF' | 'CHARGE' | 'PRODUIT';
    is_active: boolean;
}

export interface Exercice {
    id: number;
    nom: string;
    date_debut: string;
    date_fin: string;
    est_cloture: boolean;
}

export interface Ecriture {
    id: number;
    date: string;
    journal: number;
    journal_code: string;
    reference: string;
    libelle: string;
    total_debit: number;
    total_credit: number;
    lignes: LigneEcriture[];
}

export interface LigneEcriture {
    id?: number;
    compte: number;
    compte_numero?: string;
    compte_libelle?: string;
    libelle_ligne: string;
    debit: number;
    credit: number;
}

export interface Journal {
    id: number;
    code: string;
    nom: string;
}

export interface PaginatedResponse<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}

export const useAccounting = () => {
    const { t } = useTranslation('accounting');
    const queryClient = useQueryClient();
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [currentExercice, setCurrentExercice] = useState<Exercice | null>(null);
    const [ecrituresPage, setEcrituresPageState] = useState(1);
    const [ecrituresSearch, setEcrituresSearchState] = useState('');
    const [ecrituresJournal, setEcrituresJournalState] = useState('');
    const [ecrituresPageSize, setEcrituresPageSize] = useState(50);

    // Memoized setters to prevent infinite loops
    const setEcrituresPage = useCallback((page: number | ((prev: number) => number)) => {
        setEcrituresPageState(page);
    }, []);

    const setEcrituresJournal = useCallback((journal: string) => {
        setEcrituresJournalState(journal);
    }, []);

    const setEcrituresSearch = useCallback((search: string) => {
        setEcrituresSearchState(search);
    }, []);

    // Queries
    const { data: comptes, isLoading: loadingComptes } = useQuery<Compte[]>({
        queryKey: ['accounting', 'comptes'],
        queryFn: async () => (await api.get('compta/comptes/')).data.results || (await api.get('compta/comptes/')).data,
        staleTime: 1000 * 60 * 10, // 10 min
        gcTime: 1000 * 60 * 30,
    });

    const { data: journaux } = useQuery<Journal[]>({
        queryKey: ['accounting', 'journaux'],
        queryFn: async () => (await api.get('compta/journaux/')).data.results || (await api.get('compta/journaux/')).data,
        staleTime: 1000 * 60 * 10,
        gcTime: 1000 * 60 * 30,
    });

    const { data: exercices } = useQuery<Exercice[]>({
        queryKey: ['accounting', 'exercices'],
        queryFn: async () => {
            const data = (await api.get('compta/exercices/')).data.results || (await api.get('compta/exercices/')).data;
            return data;
        },
        staleTime: 1000 * 60 * 10,
        gcTime: 1000 * 60 * 30,
    });

    // Handle initialization of currentExercice safely in useEffect
    
    useEffect(() => {
        if (exercices && exercices.length > 0 && !currentExercice) {
            const today = new Date().toISOString().split('T')[0];
            const active = exercices.find((ex: Exercice) => today >= ex.date_debut && today <= ex.date_fin) || exercices[0];
            setCurrentExercice(active);
            setDateRange({ start: active.date_debut, end: active.date_fin });
        }
    }, [exercices, currentExercice]);

    const { data: balance, isLoading: loadingBalance, isFetching: fetchingBalance } = useQuery({
        queryKey: ['accounting', 'balance', dateRange],
        queryFn: async () => (await api.get('compta/ecritures/balance/', { 
            params: { date_debut: dateRange.start, date_fin: dateRange.end } 
        })).data,
        placeholderData: (previousData) => previousData,
        staleTime: 1000 * 60 * 2, // 2 min
        gcTime: 1000 * 60 * 5,
    });

    const { data: resultat, isLoading: loadingResultat, isFetching: fetchingResultat } = useQuery({
        queryKey: ['accounting', 'resultat', dateRange],
        queryFn: async () => (await api.get('compta/ecritures/compte_resultat/', { 
            params: { date_debut: dateRange.start, date_fin: dateRange.end } 
        })).data,
        placeholderData: (previousData) => previousData,
        staleTime: 1000 * 60 * 2,
        gcTime: 1000 * 60 * 5,
    });

    const { data: bilan, isLoading: loadingBilan, isFetching: fetchingBilan } = useQuery({
        queryKey: ['accounting', 'bilan', dateRange],
        queryFn: async () => (await api.get('compta/ecritures/bilan/', { 
            params: { date_fin: dateRange.end } 
        })).data,
        placeholderData: (previousData) => previousData,
        staleTime: 1000 * 60 * 2,
        gcTime: 1000 * 60 * 5,
    });

    const { data: ecrituresData, isLoading: loadingEcritures, isFetching: fetchingEcritures } = useQuery<PaginatedResponse<Ecriture>>({
        queryKey: ['accounting', 'ecritures', dateRange, ecrituresPage, ecrituresSearch, ecrituresJournal, ecrituresPageSize],
        queryFn: async () => (await api.get('compta/ecritures/', { 
            params: { 
                date_debut: dateRange.start, 
                date_fin: dateRange.end,
                page: ecrituresPage,
                search: ecrituresSearch,
                journal_code: ecrituresJournal,
                page_size: ecrituresPageSize
            } 
        })).data,
        placeholderData: (previousData) => previousData,
        staleTime: 1000 * 60 * 2,
        gcTime: 1000 * 60 * 5,
    });

    // Mutations
    const createEcriture = useMutation({
        mutationFn: (data: Partial<Ecriture>) => api.post('compta/ecritures/', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounting'] });
            toast.success(t('messages.entry_saved'));
        },
        onError: (error: unknown) => {
            const e = error as { response?: { data?: { detail?: string; message?: string; [key: string]: unknown } } };
            const data = e.response?.data;
            if (data && typeof data === 'object') {
                // Si c'est une erreur de validation DRF (dictionnaire de champs)
                const firstError = Object.values(data)[0];
                const msg = Array.isArray(firstError) ? firstError[0] : (data.detail || data.message || t('messages.entry_save_error'));
                toast.error(msg);
            } else {
                toast.error(t('messages.entry_save_error'));
            }
        }
    });

    const initializeHistory = useMutation({
        mutationFn: () => api.post('compta/ecritures/initialiser_historique/'),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['accounting'] });
            toast.success(t('messages.history_initialized', { count: res.data.entries_processed }));
        }
    });

    const createCompte = useMutation({
        mutationFn: (data: Omit<Compte, 'id'>) => api.post('compta/comptes/', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounting', 'comptes'] });
            toast.success(t('messages.account_created'));
        },
        onError: (error: unknown) => {
            const e = error as { response?: { data?: { numero?: string[]; detail?: string } } };
            const msg = e.response?.data?.numero?.[0] || e.response?.data?.detail || t('messages.account_create_error');
            toast.error(msg);
        }
    });

    const updateCompte = useMutation({
        mutationFn: ({ id, ...data }: Compte) => api.patch(`compta/comptes/${id}/`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounting', 'comptes'] });
            toast.success(t('messages.account_updated'));
        },
        onError: (error: unknown) => {
            const e = error as { response?: { data?: { numero?: string[]; detail?: string } } };
            const msg = e.response?.data?.numero?.[0] || e.response?.data?.detail || t('messages.account_update_error');
            toast.error(msg);
        }
    });

    const deleteCompte = useMutation({
        mutationFn: (id: number) => api.delete(`compta/comptes/${id}/`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounting', 'comptes'] });
            toast.success(t('messages.account_deleted'));
        },
        onError: (error: unknown) => {
            const e = error as { response?: { data?: { detail?: string } } };
            const msg = e.response?.data?.detail || t('messages.account_delete_error');
            toast.error(msg);
        }
    });

    return {
        comptes,
        journaux,
        balance,
        resultat,
        bilan,
        ecritures: ecrituresData?.results || [],
        ecrituresCount: ecrituresData?.count || 0,
        ecrituresPage,
        setEcrituresPage,
        ecrituresSearch,
        setEcrituresSearch,
        ecrituresJournal,
        setEcrituresJournal,
        ecrituresPageSize,
        setEcrituresPageSize,
        exercices,
        currentExercice,
        setCurrentExercice,
        isLoading: loadingComptes || loadingBalance || loadingResultat || loadingEcritures || loadingBilan,
        isFetching: fetchingBalance || fetchingResultat || fetchingEcritures || fetchingBilan,
        dateRange,
        setDateRange: useCallback((range: { start: string; end: string }) => setDateRange(range), []),
        actions: useMemo(() => ({
            createEcriture,
            initializeHistory,
            createCompte,
            updateCompte,
            deleteCompte
        }), [createEcriture, initializeHistory, createCompte, updateCompte, deleteCompte])
    };
};
