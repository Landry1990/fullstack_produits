import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import type { StockLot } from '../types';

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
    payment_mix?: Array<{ mode: string; label: string; value: number }>;
    top_products?: Array<{ id: number; name: string; qty: number; revenue: number }>;
    margin_today?: number;
    dormant_stock?: {
        total_value: number;
        top_products: Array<{
            id: number;
            name: string;
            stock: number;
            last_sale: string | null;
            value: number;
        }>;
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
    return useQuery<DashboardStats>({
        queryKey: ['dashboard', 'stats'],
        queryFn: async () => {
            const response = await api.get<DashboardStats>('dashboard/stats/');
            return response.data;
        },
        staleTime: 1000 * 60, // 1 minute
        refetchInterval: 1000 * 60, // Auto-update every 1 minute
        refetchIntervalInBackground: false,
    });
};

export const useRevenueChart = () => {
    return useQuery<RevenueChartData>({
        queryKey: ['dashboard', 'revenueChart'],
        queryFn: async () => {
            const response = await api.get<RevenueChartData>('dashboard/revenue_chart/');
            return response.data;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchInterval: 1000 * 60 * 5, // Auto-update every 5 minutes
        refetchIntervalInBackground: false,
    });
};

export const useLowStock = (enabled: boolean = true) => {
    return useQuery<LowStockItem[]>({
        queryKey: ['dashboard', 'lowStock'],
        queryFn: async () => {
            const response = await api.get<LowStockItem[]>('dashboard/low_stock/');
            return response.data;
        },
        enabled,
        staleTime: 1000 * 60 * 5,
        refetchInterval: enabled ? 1000 * 60 * 10 : false,
        refetchIntervalInBackground: false,
    });
};

export const useUgStats = (enabled: boolean = true) => {
    return useQuery({
        queryKey: ['dashboard', 'ugStats'],
        queryFn: async () => {
            try {
                const response = await api.get('stats-ug/par_fournisseur/');
                return response.data;
            } catch (err) {
                console.warn('Failed to fetch UG stats', err);
                return null;
            }
        },
        enabled,
        staleTime: 1000 * 60 * 60, // 1 hour
    });
};

export const usePromisDisponibles = (enabled: boolean = true) => {
    return useQuery({
        queryKey: ['dashboard', 'promis'],
        queryFn: async () => {
            try {
                const response = await api.get<{ promis_disponibles: PromisItem[] }>('promis/disponibles/');
                return response.data.promis_disponibles;
            } catch (err) {
                console.warn('Failed to fetch promis', err);
                return [];
            }
        },
        enabled,
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchInterval: enabled ? 1000 * 60 * 5 : false, // 5 minutes (was 1 min)
        refetchIntervalInBackground: false,
    });
};

export const useExpiringLots = (months: number, enabled: boolean = true) => {
    return useQuery<StockLot[]>({
        queryKey: ['dashboard', 'expiringLots', months],
        queryFn: async () => {
            const today = new Date();
            const futureDate = new Date();
            futureDate.setMonth(today.getMonth() + months);

            const params = new URLSearchParams({
                date_expiration_lte: futureDate.toISOString().split('T')[0],
                ordering: 'date_expiration'
            });

            const response = await api.get('stock-lots/', { params: Object.fromEntries(params) });
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
        enabled,
        staleTime: 1000 * 60 * 60, // 1 hour
    });
};

export interface HourlyTrafficData {
    hour: string;
    sales_count: number;
    today_sales_count?: number;
    revenue: number;
}

export const useHourlyTraffic = () => {
    return useQuery({
        queryKey: ['dashboard', 'hourlyTraffic'],
        queryFn: async () => {
            const response = await api.get<HourlyTrafficData[]>('dashboard/hourly_traffic/');
            return response.data;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchInterval: 1000 * 60 * 5, // Auto-update every 5 minutes
        refetchIntervalInBackground: false,
    });
};

export const useSupplierDebts = (enabled: boolean = true) => {
    return useQuery<SupplierDebtsResponse>({
        queryKey: ['dashboard', 'supplierDebts'],
        queryFn: async () => {
            const response = await api.get<SupplierDebtsResponse>('dashboard/supplier_debts/');
            return response.data;
        },
        enabled,
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
            const response = await api.get<ManagerStats>('dashboard/manager_stats/');
            return response.data;
        },
        staleTime: 1000 * 60, // 1 minute
        refetchInterval: 1000 * 60 * 2, // Auto-update every 2 minutes
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

export const useObjectifs = () => {
    return useQuery({
        queryKey: ['objectifs'],
        queryFn: async () => {
            const response = await api.get<ObjectifCommercial[]>('objectifs-commerciaux/');
            return response.data;
        }
    });
};

export const useCurrentObjectifs = () => {
    return useQuery({
        queryKey: ['objectifs', 'courants'],
        queryFn: async () => {
            const response = await api.get<{
                jour: ObjectifCommercial | null;
                semaine: ObjectifCommercial | null;
                mois: ObjectifCommercial | null;
            }>('objectifs-commerciaux/courants/');
            return response.data;
        },
        staleTime: 1000 * 60,
        refetchInterval: 1000 * 60 * 5, // Auto-update every 5 minutes
    });
};

export interface SupplierDebtItem {
    id: number | string;
    type: 'FACTURE' | 'RELEVE';
    label: string;
    amount: number;
    due_date: string;
    is_overdue: boolean;
    days_overdue: number | null;
    days_remaining: number | null;
    order_ids?: number[];
}

export interface SupplierDebt {
    id: number;
    name: string;
    phone: string;
    type_reglement: 'FACTURE' | 'RELEVE';
    delai_paiement_jours: number;
    periode_releve_jours: number;
    debt_total: number;
    items: SupplierDebtItem[];
    overdue_count: number;
    overdue_amount: number;
}

export interface SupplierDebtsResponse {
    total_debt: number;
    suppliers: SupplierDebt[];
}

export interface Echeance {
    fournisseur_id: number;
    fournisseur_nom: string;
    type_reglement: 'FACTURE' | 'RELEVE';
    commande_id: number | null;
    numero_facture: string;
    montant_du: number;
    date_echeance: string;
    jours_restants: number;
    status: 'EN RETARD' | "AUJOURD'HUI" | 'À VENIR';
}

export const useEcheances = (enabled: boolean = true) => {
    return useQuery<Echeance[]>({
        queryKey: ['dashboard', 'echeances'],
        queryFn: async () => {
            const response = await api.get<Echeance[]>('fournisseurs/echeancier/');
            return response.data;
        },
        enabled,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};

export interface VendeurRanking {
    vendeur_id: number;
    vendeur: string;
    rang: number;
    nbre_ventes: number;
    chiffre_affaires: number;
    panier_moyen: number;
    evolution?: number | null;
}

export interface VendeursRankingResponse {
    data: VendeurRanking[];
    periode: { debut: string; fin: string; type: string };
}

export const useVendeursRanking = (mois: string, enabled: boolean = true) => {
    return useQuery<VendeursRankingResponse>({
        queryKey: ['dashboard', 'vendeursRanking', mois],
        queryFn: async () => {
            const response = await api.get<VendeursRankingResponse>(
                'rapports/classement_vendeurs_mensuel/',
                { params: { mois, periode: 'mois' } }
            );
            return response.data;
        },
        enabled,
        staleTime: 1000 * 60 * 5,
        refetchInterval: enabled ? 1000 * 60 * 5 : false,
        refetchIntervalInBackground: false,
    });
};

export const useReapproStats = (enabled: boolean = true) => {
    return useQuery({
        queryKey: ['dashboard', 'reappro_stats'],
        queryFn: async () => {
            const response = await api.get<{ product_count: number; total_units_suggested: number }>('produits/reappro_summary/');
            return response.data;
        },
        enabled,
        staleTime: 1000 * 60 * 2, // 2 minutes
        refetchInterval: enabled ? 1000 * 60 * 2 : false,
    });
};
