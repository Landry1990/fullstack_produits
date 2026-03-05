import { useState, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';
import type { Facture } from '../types';
import { safeStorage } from '../utils/storage';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

interface SalesStats {
    top_vendeur: {
        name: string;
        amount: number;
        count: number;
    } | null;
    top_produit: {
        name: string;
        quantity: number;
    } | null;
    total_ttc: string;
    total_regle: string;
    total_en_compte: string;
}

interface SimpleUser {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
}

export const useSalesData = () => {
    const { t } = useTranslation();
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

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

    // Helper to build filter params
    const buildParams = useCallback((page: number) => {
        const params: any = {
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
    const processFacturesData = useCallback((data: any) => {
        if (data.results) {
            setFactures(data.results);
            setTotalItems(data.count || 0);
            setTotalPages(Math.ceil((data.count || 0) / PAGE_SIZE));
        } else if (Array.isArray(data)) {
            setFactures(data);
            setTotalItems(data.length);
            setTotalPages(1);
        }
    }, []);

    // Initial load: use page_init endpoint (factures + stats + users in 1 request)
    const fetchPageInit = useCallback(async () => {
        setLoading(true);
        try {
            const token = safeStorage.getItem('authToken');
            if (!token) {
                setLoading(false);
                return;
            }

            setCurrentPage(1);
            const params = buildParams(1);

            const response = await axios.get(`${apiBaseUrl}/factures/page_init/`, {
                headers: { Authorization: `Token ${token}` },
                params
            });

            const { factures: facturesData, stats: statsData, users: usersData } = response.data;

            // Process factures
            processFacturesData(facturesData);

            // Set stats & users
            if (statsData) setStats(statsData);
            if (usersData) setUsers(usersData);

        } catch (error) {
            console.error('Erreur chargement page_init:', error);
            toast.error(t('sales.messages.load_error'));
            setFactures([]);
        } finally {
            setLoading(false);
        }
    }, [buildParams, processFacturesData, t, apiBaseUrl]);

    // Subsequent fetches (pagination, filter changes): use regular list endpoint
    const fetchFactures = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const token = safeStorage.getItem('authToken');
            if (!token) {
                setLoading(false);
                return;
            }

            if (page !== currentPage) setCurrentPage(page);
            const params = buildParams(page);

            const response = await axios.get(`${apiBaseUrl}/factures/`, {
                headers: { Authorization: `Token ${token}` },
                params
            });

            processFacturesData(response.data);
        } catch (error) {
            console.error('Erreur chargement factures:', error);
            toast.error(t('sales.messages.load_error'));
            setFactures([]);
        } finally {
            setLoading(false);
        }
    }, [buildParams, processFacturesData, t, apiBaseUrl]);

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
    }, [searchTerm]);

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
    }, [startDate, endDate, statusFilter, sellerFilter]);

    const handleDeleteBrouillons = async () => {
        if (!window.confirm(t('sales.confirm_delete_drafts'))) return;
        try {
            const token = safeStorage.getItem('authToken');
            await axios.delete(`${apiBaseUrl}/factures/delete_brouillons/`, {
                headers: { Authorization: `Token ${token}` }
            });
            toast.success(t('sales.messages.delete_drafts_success'));
            fetchFactures(currentPage);
        } catch (error) {
            console.error(error);
            toast.error(t('sales.messages.delete_drafts_error'));
        }
    };

    const deleteFacture = async (id: number) => {
        if (!window.confirm(t('sales.confirm_delete'))) return;
        try {
            const token = safeStorage.getItem('authToken');
            await axios.delete(`${apiBaseUrl}/factures/${id}/`, {
                headers: { Authorization: `Token ${token}` }
            });
            toast.success(t('sales.messages.delete_success'));
            fetchFactures(currentPage);
        } catch (error) {
            console.error(error);
            toast.error(t('sales.messages.delete_error'));
        }
    };

    const bulkDeleteFactures = async (ids: number[]) => {
        if (!window.confirm(t('sales.confirm_bulk_delete', { count: ids.length }))) return;
        try {
            const token = safeStorage.getItem('authToken');
            await axios.post(`${apiBaseUrl}/factures/bulk_delete/`, { ids }, {
                headers: { Authorization: `Token ${token}` }
            });
            toast.success(t('sales.messages.bulk_delete_success'));
            fetchFactures(currentPage);
        } catch (error) {
            console.error(error);
            toast.error(t('sales.messages.bulk_delete_error'));
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
