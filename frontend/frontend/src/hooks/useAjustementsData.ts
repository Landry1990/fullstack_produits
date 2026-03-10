import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import type { StockAdjustment, PaginatedResponse, StockAdjustmentStats } from '../types';

export const useAjustementsData = () => {
    const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterReasonType, setFilterReasonType] = useState('');
    const [dateStart, setDateStart] = useState('');
    const [dateEnd, setDateEnd] = useState('');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    // Stats State
    const [stats, setStats] = useState({
        total_count: 0,
        positive_sum: 0,
        negative_sum: 0
    });

    const apiBaseUrl = useMemo(() => {
        const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '';
        return baseUrl ? String(baseUrl).replace(/\/$/, '') : '';
    }, []);
    const adjustmentsEndpoint = useMemo(() =>
        apiBaseUrl ? `${apiBaseUrl}/api/stock-adjustments/` : '/api/stock-adjustments/'
        , [apiBaseUrl]);

    const fetchAdjustments = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const params: Record<string, string | number> = {
                page: page,
                page_size: 20
            };

            if (searchQuery) params.search = searchQuery;
            if (filterReasonType) params.reason_type = filterReasonType;
            if (dateStart) params.created_at__gte = dateStart;
            if (dateEnd) params.created_at__lte = dateEnd + 'T23:59:59';

            // 1. Fetch List
            const response = await axios.get<PaginatedResponse<StockAdjustment> | StockAdjustment[]>(adjustmentsEndpoint, { params });

            if (response.data && 'results' in response.data && Array.isArray(response.data.results)) {
                setAdjustments(response.data.results);
                setTotalCount(response.data.count);
                setTotalPages(Math.ceil(response.data.count / 20));
            } else {
                const data = response.data as StockAdjustment[];
                setAdjustments(Array.isArray(data) ? data : []);
                setTotalCount(Array.isArray(data) ? data.length : 0);
                setTotalPages(1);
            }
            setCurrentPage(page);

            // 2. Fetch Stats
            const statsParams = { ...params };
            delete statsParams.page;
            delete statsParams.page_size;

            const statsResponse = await axios.get<StockAdjustmentStats>(`${adjustmentsEndpoint}stats/`, { params: statsParams });
            if (statsResponse.data) {
                setStats(statsResponse.data);
            }

        } catch (err) {
            toast.error('Erreur lors du chargement des ajustements');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [adjustmentsEndpoint, searchQuery, filterReasonType, dateStart, dateEnd]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchAdjustments(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [fetchAdjustments]);

    const handleExportExcel = useCallback(async () => {
        try {
            const params: Record<string, string> = {};
            if (searchQuery) params.search = searchQuery;
            if (filterReasonType) params.reason_type = filterReasonType;
            if (dateStart) params.created_at__gte = dateStart;
            if (dateEnd) params.created_at__lte = dateEnd + 'T23:59:59';

            const response = await axios.get(`${adjustmentsEndpoint}export_excel/`, {
                params,
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            link.setAttribute('download', `ajustements_stock_${timestamp}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            toast.success('Export réussi');
        } catch (err) {
            toast.error('Erreur lors de l\'export');
            console.error(err);
        }
    }, [adjustmentsEndpoint, searchQuery, filterReasonType, dateStart, dateEnd]);

    return {
        adjustments,
        loading,
        totalCount,
        totalPages,
        currentPage,
        stats,
        filters: {
            searchQuery,
            filterReasonType,
            dateStart,
            dateEnd
        },
        setFilters: {
            setSearchQuery,
            setFilterReasonType,
            setDateStart,
            setDateEnd
        },
        pagination: {
            setCurrentPage: fetchAdjustments
        },
        actions: {
            fetchAdjustments,
            handleExportExcel
        }
    };
};
