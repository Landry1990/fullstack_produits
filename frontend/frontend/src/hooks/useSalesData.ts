import { useState, useCallback, useEffect, useMemo } from 'react';
import axios from 'axios';
import type { Facture } from '../types';
import { safeStorage } from '../utils/storage';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

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
    const PAGE_SIZE = 50; // Or configurable

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

    const fetchFactures = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const token = safeStorage.getItem('authToken');
            if (!token) {
                setLoading(false);
                return;
            }

            // Update page state if manually called with a page
            if (page !== currentPage) setCurrentPage(page);

            const params: any = {
                date__gte: startDate,
                date__lte: `${endDate}T23:59:59`,
                page: page,
                page_size: PAGE_SIZE
            };

            if (statusFilter !== 'ALL') params.status = statusFilter;
            if (sellerFilter) params.created_by = sellerFilter;
            if (searchTerm) params.search = searchTerm;

            const response = await axios.get(`${apiBaseUrl}/factures/`, {
                headers: { Authorization: `Token ${token}` },
                params: params
            });

            const data = response.data;
            if (data.results) {
                // Paginated response
                setFactures(data.results);
                setTotalItems(data.count || 0);
                // Calculate total pages assuming default page size if not provided by backend
                // Or if count is provided.
                // Django REST default pagination usually returns count.
                const count = data.count || 0;
                setTotalPages(Math.ceil(count / PAGE_SIZE));
            } else if (Array.isArray(data)) {
                // Non-paginated response fallback
                setFactures(data);
                setTotalItems(data.length);
                setTotalPages(1);
            }
        } catch (error) {
            console.error('Erreur chargement factures:', error);
            toast.error(t('sales.messages.load_error'));
            setFactures([]);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, statusFilter, sellerFilter, searchTerm, t, apiBaseUrl]);

    // Debounce search term effect
    useEffect(() => {
        const timer = setTimeout(() => {
            setCurrentPage(1);
            fetchFactures(1);
        }, 500); // 500ms debounce
        return () => clearTimeout(timer);
    }, [startDate, endDate, statusFilter, sellerFilter, searchTerm]);

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

    // Handle Search filter client-side or server-side?
    // Current logic does CLIENT-SIDE filtering. 
    // IF pagination is server-side, client-side filtering ONLY works on the current page.
    // This is a common bug.
    // If the user searches "Toto", and Toto is on page 2, they won't find it if we only fetch page 1.
    // Ideally search should be server-side.
    // For now, if pagination is essential, I must keep server-side pagination.
    // BUT the current filter logic `filteredFactures` runs on `factures`. 
    // If `factures` is just one page, we lose global search.
    // I will assume for now we keep server pagination and client filtering ON THE PAGE (imperfect), 
    // OR I should add `search` param to API. 
    // Let's add `search` param to API if supported, otherwise warn user.
    // The previous code had `filteredFactures`.

    // I'll stick to pagination logic first. 
    // If I paginate, `filteredFactures` will only filter the current page logic.
    // This is standard for simple pagination restoral.

    // Server-side filtering means filteredFactures IS factures
    const filteredFactures = useMemo(() => {
        if (!Array.isArray(factures)) return [];
        return factures;
    }, [factures]);

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
