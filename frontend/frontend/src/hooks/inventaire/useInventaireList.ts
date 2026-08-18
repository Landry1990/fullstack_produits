import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';
import { gooeyToast } from 'goey-toast';
import { useTranslation } from 'react-i18next';
import { useConfirm } from '../useConfirm';
import { getApiErrorDetail } from '../../utils/errorHandling';
import type { Inventaire } from '../../types';
import { logger } from '../../utils/logger'

export const useInventaireList = () => {
    const { t } = useTranslation();
    const confirm = useConfirm();

    const [inventaires, setInventaires] = useState<Inventaire[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [nextPage, setNextPage] = useState<string | null>(null);
    const [prevPage, setPrevPage] = useState<string | null>(null);

    const extractPageNumber = (url: string | null): number => {
        if (!url) return 1;
        try {
            const page = new URL(url).searchParams.get('page');
            return page ? parseInt(page, 10) : 1;
        } catch {
            return 1;
        }
    };

    const extractPageSize = (next: string | null, previous: string | null): number => {
        const url = next || previous;
        if (url) {
            try {
                const size = new URL(url).searchParams.get('page_size');
                if (size) return parseInt(size, 10) || 50;
            } catch {
                // fallback to default
            }
        }
        return 50;
    };

    // Filters
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [filterSearchTerm, setFilterSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterCreator, setFilterCreator] = useState('');
    const [filterOrdering, setFilterOrdering] = useState('-date');

    const [selectedInventaireIds, setSelectedInventaireIds] = useState<Set<number>>(new Set());

    const controllerRef = useRef<AbortController | null>(null);

    const fetchInventaires = useCallback(async (pageUrl?: string) => {
        controllerRef.current?.abort();
        const controller = new AbortController();
        controllerRef.current = controller;

        setLoading(true);
        try {
            let response;
            if (pageUrl) {
                response = await api.get(pageUrl, { signal: controller.signal });
            } else {
                const params: Record<string, string> = {};
                if (filterStartDate) params['date__gte'] = filterStartDate;
                if (filterEndDate) params['date__lte'] = filterEndDate;
                if (filterSearchTerm) params['search'] = filterSearchTerm;
                if (filterStatus) params['status'] = filterStatus;
                if (filterCreator) params['created_by'] = filterCreator;
                if (filterOrdering) params['ordering'] = filterOrdering;
                response = await api.get('inventaires/', { params, signal: controller.signal });
            }

            const data = response.data;
            if (data && data.results) {
                setInventaires(data.results);
                setTotalCount(data.count || 0);
                setNextPage(data.next);
                setPrevPage(data.previous);
                setCurrentPage(extractPageNumber(pageUrl ?? null));

                const pageSize = extractPageSize(data.next, data.previous);
                setTotalPages(pageSize > 0 ? Math.max(1, Math.ceil((data.count || 0) / pageSize)) : 1);
            } else if (Array.isArray(data)) {
                setInventaires(data);
                setTotalCount(data.length);
                setTotalPages(1);
                setNextPage(null);
                setPrevPage(null);
                setCurrentPage(1);
            } else {
                setInventaires([]);
                setTotalCount(0);
                setTotalPages(1);
                setCurrentPage(1);
            }
        } catch (error) {
            if (error instanceof Error && error.name === 'CanceledError') return;
            logger.error(error);
            gooeyToast.error(t('common:messages.error_loading', { defaultValue: 'Erreur lors du chargement' }));
        } finally {
            setLoading(false);
        }
    }, [filterStartDate, filterEndDate, filterSearchTerm, filterStatus, filterCreator, filterOrdering, t]);

    // Auto-fetch when filters change (debounced)
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchInventaires();
        }, 500);
        return () => { clearTimeout(timeoutId); controllerRef.current?.abort(); };
    }, [fetchInventaires]);

    const toggleSelectInventaire = (id: number) => {
        const newSet = new Set(selectedInventaireIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedInventaireIds(newSet);
    };

    const toggleSelectAllInventaires = () => {
        if (selectedInventaireIds.size === inventaires.length) {
            setSelectedInventaireIds(new Set());
        } else {
            setSelectedInventaireIds(new Set(inventaires.map(inv => inv.id)));
        }
    };

    const [deleting, setDeleting] = useState(false);

    const handleDelete = async (id: number, nom?: string) => {
        if (deleting) return;
        const confirmed = await confirm({
            title: t('common:confirmation', { defaultValue: 'Confirmer la suppression' }),
            message: t('inventory:messages.delete_confirm', { name: nom || '', defaultValue: `Voulez-vous vraiment supprimer l'inventaire ${nom || ''} ?` }),
            confirmText: t('common:delete', { defaultValue: 'Supprimer' }),
            cancelText: t('common:cancel', { defaultValue: 'Annuler' }),
        });
        if (!confirmed) return;
        setDeleting(true);
        try {
            await api.delete(`inventaires/${id}/`);
            gooeyToast.success(t('common:messages.success_delete'));
            setInventaires(prev => prev.filter(inv => inv.id !== id));
            setTotalCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            logger.error(error);
            gooeyToast.error(getApiErrorDetail(error, t('common:messages.error_deleting')));
        } finally {
            setDeleting(false);
        }
    };

    return {
        inventaires,
        loading,
        deleting,
        totalCount,
        currentPage,
        totalPages,
        nextPage,
        prevPage,
        fetchInventaires,
        handleDelete,
        // Filters
        filterStartDate, setFilterStartDate,
        filterEndDate, setFilterEndDate,
        filterSearchTerm, setFilterSearchTerm,
        filterStatus, setFilterStatus,
        filterCreator, setFilterCreator,
        filterOrdering, setFilterOrdering,
        // Selection
        selectedInventaireIds, setSelectedInventaireIds,
        toggleSelectInventaire, toggleSelectAllInventaires,
    };
};

