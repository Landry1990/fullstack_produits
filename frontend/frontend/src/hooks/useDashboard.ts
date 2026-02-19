import { useQuery } from '@tanstack/react-query';
import axios from '../config/axios';
import type { StockLot } from '../types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';

const dashboardEndpoint = apiBaseUrl
    ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/dashboard/`
    : '/api/dashboard/';
const stockLotsEndpoint = apiBaseUrl
    ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/stock-lots/`
    : '/api/stock-lots/';
const ugStatsEndpoint = apiBaseUrl
    ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/stats-ug/par_fournisseur/`
    : '/api/stats-ug/par_fournisseur/';
const promisEndpoint = apiBaseUrl
    ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/promis/disponibles/`
    : '/api/promis/disponibles/';

interface DashboardStats {
    role?: 'PHARMACIEN' | 'VENDEUR' | 'CAISSIER';
    revenue?: { value: number; change: number };
    sales?: { value: number; change: number };
    clients?: { value: number; change: number };
    low_stock?: { value: number; change: number };
    receivables?: { value: number; count: number };
    discount?: { value: number; change: number };
    stock_value?: { value: number; count: number };
    user_stats?: {
        sales: number;
        count: number;
        avg_basket: number;
    };
}

interface RevenueChartData {
    labels: string[];
    data: number[];
}

interface LowStockItem {
    id: number;
    name: string;
    stock: number;
}

interface PromisItem {
    id: number;
    client: string;
    produit_nom: string;
    quantite: number;
    jours_attente: number;
}

export const useDashboardStats = () => {
    return useQuery({
        queryKey: ['dashboard', 'stats'],
        queryFn: async () => {
            const response = await axios.get<DashboardStats>(`${dashboardEndpoint}stats/`);
            return response.data;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};

export const useRevenueChart = () => {
    return useQuery({
        queryKey: ['dashboard', 'revenueChart'],
        queryFn: async () => {
            const response = await axios.get<RevenueChartData>(`${dashboardEndpoint}revenue_chart/`);
            return response.data;
        },
        staleTime: 1000 * 60 * 15, // 15 minutes
    });
};

export const useLowStock = () => {
    return useQuery({
        queryKey: ['dashboard', 'lowStock'],
        queryFn: async () => {
            const response = await axios.get<LowStockItem[]>(`${dashboardEndpoint}low_stock/`);
            return response.data;
        },
        staleTime: 1000 * 60 * 5,
    });
};

export const useUgStats = () => {
    return useQuery({
        queryKey: ['dashboard', 'ugStats'],
        queryFn: async () => {
            try {
                const response = await axios.get(ugStatsEndpoint);
                return response.data;
            } catch (err) {
                console.warn('Failed to fetch UG stats', err);
                return null;
            }
        },
        staleTime: 1000 * 60 * 60, // 1 hour
    });
};

export const usePromisDisponibles = () => {
    return useQuery({
        queryKey: ['dashboard', 'promis'],
        queryFn: async () => {
            try {
                const response = await axios.get<{ promis_disponibles: PromisItem[] }>(promisEndpoint);
                return response.data.promis_disponibles;
            } catch (err) {
                console.warn('Failed to fetch promis', err);
                return [];
            }
        },
        staleTime: 1000 * 60 * 2,
    });
};

export const useExpiringLots = (months: number) => {
    return useQuery({
        queryKey: ['dashboard', 'expiringLots', months],
        queryFn: async () => {
            const today = new Date();
            const futureDate = new Date();
            futureDate.setMonth(today.getMonth() + months);

            const params = new URLSearchParams({
                date_expiration_lte: futureDate.toISOString().split('T')[0],
                ordering: 'date_expiration'
            });

            const response = await axios.get(`${stockLotsEndpoint}?${params}`);
            const lots: StockLot[] = Array.isArray(response.data) ? response.data : (response.data.results || []);

            // Client-side filtering as per original logic, though backend filtering is preferred
            // We keep exact logic from original component for safety
            const validLots = lots.filter(lot => {
                if (!lot.date_expiration) return false;
                const expDate = new Date(lot.date_expiration);
                return expDate > today;
            }).slice(0, 10);

            return validLots;
        },
        staleTime: 1000 * 60 * 60, // 1 hour
    });
};

export interface HourlyTrafficData {
    hour: string;
    sales_count: number;
    revenue: number;
}

export const useHourlyTraffic = () => {
    return useQuery({
        queryKey: ['dashboard', 'hourlyTraffic'],
        queryFn: async () => {
            const response = await axios.get<HourlyTrafficData[]>(`${dashboardEndpoint}hourly_traffic/`);
            return response.data;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};

export const useSupplierDebts = () => {
    return useQuery({
        queryKey: ['dashboard', 'supplierDebts'],
        queryFn: async () => {
            const response = await axios.get(`${dashboardEndpoint}supplier_debts/`);
            return response.data;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};

export interface ManagerStats {
    kpis: {
        jour: { actual: number; target: number; rate: number };
        semaine: { actual: number; target: number; rate: number };
        mois: { actual: number; target: number; rate: number };
    };
    alerts: Array<{
        type: 'danger' | 'warning' | 'info';
        title_key: string;
        message_key: string;
        params?: Record<string, any>;
    }>;
}

export const useManagerStats = () => {
    return useQuery({
        queryKey: ['dashboard', 'managerStats'],
        queryFn: async () => {
            const response = await axios.get<ManagerStats>(`${dashboardEndpoint}manager_stats/`);
            return response.data;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};

export interface ObjectifCommercial {
    id: number;
    periode: 'JOUR' | 'SEMAINE' | 'MOIS';
    periode_display: string;
    date_debut: string;
    ca_objectif: string;
    nb_ventes_objectif?: number;
    panier_moyen_objectif?: string;
    notes?: string;
    created_by_name: string;
}

const objectifsEndpoint = apiBaseUrl
    ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/objectifs-commerciaux/`
    : '/api/objectifs-commerciaux/';

export const useObjectifs = () => {
    return useQuery({
        queryKey: ['objectifs'],
        queryFn: async () => {
            const response = await axios.get<ObjectifCommercial[]>(objectifsEndpoint);
            return response.data;
        }
    });
};

export const useCurrentObjectifs = () => {
    return useQuery({
        queryKey: ['objectifs', 'courants'],
        queryFn: async () => {
            const response = await axios.get<{
                jour: ObjectifCommercial | null;
                semaine: ObjectifCommercial | null;
                mois: ObjectifCommercial | null;
            }>(`${objectifsEndpoint}courants/`);
            return response.data;
        }
    });
};
