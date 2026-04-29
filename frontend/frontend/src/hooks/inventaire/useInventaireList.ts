import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import type { Inventaire } from '../../types';

// Depending on how types are defined, you might need to adjust this import
// import { Inventaire } from '../components/inventaire/types';

export const useInventaireList = () => {
    const { t } = useTranslation();

    const [inventaires, setInventaires] = useState<Inventaire[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [nextPage, setNextPage] = useState<string | null>(null);
    const [prevPage, setPrevPage] = useState<string | null>(null);

    // Filters
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [filterSearchTerm, setFilterSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterCreator, setFilterCreator] = useState('');

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
                response = await api.get('inventaires/', { params, signal: controller.signal });
            }

            const data = response.data;
            if (data && data.results) {
                setInventaires(data.results);
                setTotalCount(data.count || 0);
                setNextPage(data.next);
                setPrevPage(data.previous);

                if (pageUrl && data.previous) {
                    try {
                        const urlObj = new URL(pageUrl);
                        const pageParam = urlObj.searchParams.get('page');
                        setCurrentPage(pageParam ? parseInt(pageParam) : 1);
                    } catch (e) {
                        setCurrentPage(1);
                    }
                } else if (!pageUrl) {
                    setCurrentPage(1);
                }
            } else if (Array.isArray(data)) {
                setInventaires(data);
                setTotalCount(data.length);
                setNextPage(null);
                setPrevPage(null);
                setCurrentPage(1);
            } else {
                setInventaires([]);
                setTotalCount(0);
            }
        } catch (error: any) {
            if (error?.code === 'ERR_CANCELED') return;
            console.error(error);
            toast.error(t('common:messages.error_loading', { defaultValue: 'Erreur lors du chargement' }));
        } finally {
            setLoading(false);
        }
    }, [filterStartDate, filterEndDate, filterSearchTerm, filterStatus, filterCreator, t]);

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

    const handleDelete = async (id: number) => {
        if (deleting) return;
        setDeleting(true);
        try {
            await api.delete(`inventaires/${id}/`);
            toast.success(t('common:messages.deleted'));
            fetchInventaires();
        } catch (error) {
            console.error(error);
            toast.error(t('common:messages.error_deleting'));
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
        // Selection
        selectedInventaireIds, setSelectedInventaireIds,
        toggleSelectInventaire, toggleSelectAllInventaires,
    };
};

