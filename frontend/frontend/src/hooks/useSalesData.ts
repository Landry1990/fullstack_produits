import { useState, useCallback, useEffect, useRef } from 'react';
import venteService, { type SalesFilters, type SalesStats, type SimpleUser } from '../services/venteService';
import type { Facture, PaginatedResponse } from '../types';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

export const useSalesData = () => {
    const { t } = useTranslation(['sales', 'common']);
    const [factures, setFactures] = useState<Facture[]>([]);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [sellerFilter, setSellerFilter] = useState(''); // ID of the seller

    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const PAGE_SIZE = 50;

    // Stats & Users from page_init
    const [stats, setStats] = useState<SalesStats | null>(null);
    const [users, setUsers] = useState<SimpleUser[]>([]);

    // Helper to build filter params
    const buildParams = useCallback((page: number): SalesFilters => {
        const params: SalesFilters = {
            date__gte: startDate,
            date__lte: `${endDate}T23:59:59`,
            page: page,
            page_size: PAGE_SIZE
        };
        if (statusFilter !== 'ALL') params.status = statusFilter;
        if (sellerFilter) params.created_by = sellerFilter;
        if (searchTerm) params.search = searchTerm;
        return params;
    }, [startDate, endDate, statusFilter, sellerFilter, searchTerm]);

    // Process paginated factures response data
    const processFacturesData = useCallback((data: PaginatedResponse<Facture> | Facture[]) => {
        if ('results' in data && Array.isArray(data.results)) {
            setFactures(data.results);
            setTotalItems(data.count || 0);
            setTotalPages(Math.ceil((data.count || 0) / PAGE_SIZE));
        } else if (Array.isArray(data)) {
            setFactures(data);
            setTotalItems(data.length);
            setTotalPages(1);
        }
    }, []);

    // Initial load: use page_init service (factures + stats + users in 1 request)
    const fetchPageInit = useCallback(async () => {
        setLoading(true);
        try {
            setCurrentPage(1);
            const params = buildParams(1);
            const data = await venteService.getPageInit(params);

            // Process factures
            processFacturesData(data.factures);

            // Set stats & users
            if (data.stats) setStats(data.stats);
            if (data.users) setUsers(data.users);

        } catch (error) {
            console.error('Erreur chargement page_init:', error);
            toast.error(t('messages.load_error'));
            setFactures([]);
        } finally {
            setLoading(false);
        }
    }, [buildParams, processFacturesData, t]);

    // Subsequent fetches (pagination, filter changes): use regular list endpoint
    const fetchFactures = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            if (page !== currentPage) setCurrentPage(page);
            const params = buildParams(page);
            const data = await venteService.getFactures(params);
            processFacturesData(data);
        } catch (error) {
            console.error('Erreur chargement factures:', error);
            toast.error(t('messages.load_error'));
            setFactures([]);
        } finally {
            setLoading(false);
        }
    }, [buildParams, processFacturesData, t, currentPage]);

    // Track mount state
    const isInitialMount = useRef(true);
    const hasLoadedOnce = useRef(false);

    // Debounced effect for search term only
    useEffect(() => {
        if (isInitialMount.current) return;
        const timer = setTimeout(() => {
            setCurrentPage(1);
            fetchFactures(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm, fetchFactures]);

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            if (!hasLoadedOnce.current) {
                hasLoadedOnce.current = true;
                fetchPageInit();
            }
            return;
        }
        // Subsequent filter changes: fetch full page init to get updated stats for selected dates
        setCurrentPage(1);
        fetchPageInit();
    }, [startDate, endDate, statusFilter, sellerFilter, fetchPageInit]);

    const handleDeleteBrouillons = async () => {
        if (!window.confirm(t('messages.delete_drafts_confirm'))) return;
        try {
            await venteService.deleteBrouillons();
            toast.success(t('messages.delete_drafts_success'));
            fetchFactures(currentPage);
        } catch (error) {
            console.error(error);
            toast.error(t('messages.delete_drafts_error'));
        }
    };

    const deleteFacture = async (id: number) => {
        if (!window.confirm(t('confirm_delete'))) return;
        try {
            await venteService.deleteFacture(id);
            toast.success(t('messages.delete_success'));
            fetchFactures(currentPage);
        } catch (error) {
            console.error(error);
            toast.error(t('messages.delete_error'));
        }
    };

    const bulkDeleteFactures = async (ids: number[]) => {
        if (!window.confirm(t('confirm_bulk_delete', { count: ids.length }))) return;
        try {
            await venteService.bulkDelete(ids);
            toast.success(t('messages.bulk_delete_success'));
            fetchFactures(currentPage);
        } catch (error) {
            console.error(error);
            toast.error(t('messages.bulk_delete_error'));
        }
    };

    // Server-side filtering: filteredFactures is simply factures
    const filteredFactures = !Array.isArray(factures) ? [] : factures;

    // Handlers for pagination
    const goToPage = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
            fetchFactures(page);
        }
    };

    return {
        factures,
        setFactures,
        filteredFactures,
        loading,
        stats,
        users,
        filters: {
            startDate, setStartDate,
            endDate, setEndDate,
            searchTerm, setSearchTerm,
            statusFilter, setStatusFilter,
            sellerFilter, setSellerFilter
        },
        pagination: {
            currentPage,
            totalPages,
            totalItems,
            goToPage,
            nextPage: () => goToPage(currentPage + 1),
            prevPage: () => goToPage(currentPage - 1),
            hasNext: currentPage < totalPages,
            hasPrev: currentPage > 1
        },
        refresh: () => fetchFactures(currentPage),
        handleDeleteBrouillons,
        deleteFacture,
        bulkDeleteFactures
    };
};
