import { useState, useCallback, useEffect, useMemo } from 'react';
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

export interface PaginatedResponse<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}

export const useAccounting = () => {
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
        queryFn: async () => (await api.get('compta/comptes/')).data.results || (await api.get('compta/comptes/')).data
    });

    const { data: journaux } = useQuery({
        queryKey: ['accounting', 'journaux'],
        queryFn: async () => (await api.get('compta/journaux/')).data.results || (await api.get('compta/journaux/')).data
    });

    const { data: exercices } = useQuery<Exercice[]>({
        queryKey: ['accounting', 'exercices'],
        queryFn: async () => {
            const data = (await api.get('compta/exercices/')).data.results || (await api.get('compta/exercices/')).data;
            return data;
        }
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
        placeholderData: (previousData) => previousData
    });

    const { data: resultat, isLoading: loadingResultat, isFetching: fetchingResultat } = useQuery({
        queryKey: ['accounting', 'resultat', dateRange],
        queryFn: async () => (await api.get('compta/ecritures/compte_resultat/', { 
            params: { date_debut: dateRange.start, date_fin: dateRange.end } 
        })).data,
        placeholderData: (previousData) => previousData
    });

    const { data: bilan, isLoading: loadingBilan, isFetching: fetchingBilan } = useQuery({
        queryKey: ['accounting', 'bilan', dateRange],
        queryFn: async () => (await api.get('compta/ecritures/bilan/', { 
            params: { date_fin: dateRange.end } 
        })).data,
        placeholderData: (previousData) => previousData
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
        placeholderData: (previousData) => previousData
    });

    // Mutations
    const createEcriture = useMutation({
        mutationFn: (data: Partial<Ecriture>) => api.post('compta/ecritures/', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounting'] });
            toast.success('Écriture enregistrée avec succès');
        },
        onError: (error: any) => {
            const data = error.response?.data;
            if (data && typeof data === 'object') {
                // Si c'est une erreur de validation DRF (dictionnaire de champs)
                const firstError = Object.values(data)[0];
                const msg = Array.isArray(firstError) ? firstError[0] : (data.detail || data.message || 'Erreur de validation');
                toast.error(msg);
            } else {
                toast.error('Erreur lors de l\'enregistrement');
            }
        }
    });

    const initializeHistory = useMutation({
        mutationFn: () => api.post('compta/ecritures/initialiser_historique/'),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['accounting'] });
            toast.success(`${res.data.entries_processed} écritures générées !`);
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
            initializeHistory
        }), [createEcriture, initializeHistory])
    };
};
