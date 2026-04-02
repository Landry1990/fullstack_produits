import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

export interface StockAnalysisItem {
    id: number;
    cip?: string;
    name: string;
    stock: number;
    rotation?: number;
    threshold?: number;
    excess_qty?: number;
    avg_daily_sales?: number;
    days_until_stockout?: number;
    urgency?: 'critical' | 'warning' | 'caution';
    value: number;
    cost_price: number;
    selling_price: number;
    fournisseur_name: string;
    created_at?: string;
    dernier_achat?: string;
    derniere_vente?: string;
    days_since_sale?: number;
}

export interface StockAnalysisResponse {
    type: string;
    fournisseur: string;
    total_items: number;
    total_value: number;
    current_page?: number;
    total_pages?: number;
    page_size?: number;
    critical_count?: number;
    warning_count?: number;
    items: StockAnalysisItem[];
}

export interface Fournisseur {
    id: number;
    name: string;
}

export const useStockAnalysis = () => {
    const { t } = useTranslation(['stock', 'common']);
    const navigate = useNavigate();
    const location = useLocation();
    const { tabParam, daysParam } = useMemo(() => {
        const queryParams = new URLSearchParams(location.search);
        return {
            tabParam: queryParams.get('tab') as 'unsold' | 'overstock' | 'shortage' | null,
            daysParam: queryParams.get('days')
        };
    }, [location.search]);

    const apiBaseUrl = useMemo(() => {
        const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '';
        return baseUrl ? String(baseUrl).replace(/\/$/, '') : '';
    }, []);

    const [activeTab, setActiveTab] = useState<'unsold' | 'overstock' | 'shortage'>(
        (tabParam && ['unsold', 'overstock', 'shortage'].includes(tabParam)) ? tabParam : 'unsold'
    );
    const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
    const [selectedFournisseur, setSelectedFournisseur] = useState<string>('');
    const [data, setData] = useState<StockAnalysisResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
    const [unsoldDays, setUnsoldDays] = useState<number>(
        daysParam && !isNaN(Number(daysParam)) ? Number(daysParam) : 30
    );
    const [page, setPage] = useState<number>(1);
    const pageSize = 50; // Fixed page size for now

    // Fetch suppliers
    const fetchFournisseurs = useCallback(async () => {
        try {
            const response = await axios.get(`${apiBaseUrl}/api/fournisseurs/`);
            let suppliersData = [];
            if (Array.isArray(response.data)) {
                suppliersData = response.data;
            } else if (response.data.results && Array.isArray(response.data.results)) {
                suppliersData = response.data.results;
            }
            setFournisseurs(suppliersData);
        } catch (err) {
            console.error('Erreur chargement fournisseurs:', err);
            setFournisseurs([]);
        }
    }, [apiBaseUrl]);

    useEffect(() => {
        fetchFournisseurs();
    }, []); // Only on mount

    // Fetch analysis data
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params: Record<string, string | number> = {
                page,
                page_size: pageSize
            };
            if (selectedFournisseur) params.fournisseur = selectedFournisseur;
            if (activeTab === 'unsold') params.days = unsoldDays;

            const response = await axios.get<StockAnalysisResponse>(
                `${apiBaseUrl}/api/stock-analysis/${activeTab}/`,
                { params }
            );
            setData(response.data);
        } catch (err: unknown) {
            console.error(err);
            setError(t('stock:analyse.error'));
        } finally {
            setLoading(false);
        }
    }, [activeTab, selectedFournisseur, unsoldDays, page, apiBaseUrl, t]);

    useEffect(() => {
        fetchData();
    }, [fetchData]); // This is safe now because dependencies of fetchData are stable or correctly tracked

    // Reset pagination when tab or filters change
    useEffect(() => {
        setPage(1);
    }, [activeTab, selectedFournisseur, unsoldDays]);

    // Clear selection when tab changes
    useEffect(() => {
        setSelectedItems(new Set());
    }, [activeTab]);

    const toggleSelectItem = (id: number) => {
        setSelectedItems(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (!data) return;
        if (selectedItems.size === data.items.length && data.items.length > 0) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(data.items.map(i => i.id)));
        }
    };

    const handleGenerateOrder = () => {
        if (!data || selectedItems.size === 0) return;
        const products = data.items
            .filter(item => selectedItems.has(item.id))
            .map(item => ({
                id: item.id,
                name: item.name,
                stock: item.stock,
                avg_daily_sales: item.avg_daily_sales
            }));

        navigate('/app/commandes/locales', {
            state: {
                createFromStockAlert: { products }
            }
        });
    };

    return {
        activeTab,
        setActiveTab,
        fournisseurs,
        selectedFournisseur,
        setSelectedFournisseur,
        data,
        loading,
        error,
        selectedItems,
        unsoldDays,
        setUnsoldDays,
        page,
        setPage,
        actions: {
            fetchData,
            handleGenerateOrder,
            toggleSelectItem,
            toggleSelectAll
        }
    };
};
