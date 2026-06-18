import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { getApiErrorDetail } from '../utils/errorHandling';

export interface SupplierDashboardStats {
    total_dette: number;
    nb_fournisseurs_actifs: number;
    stats_echeances: {
        en_retard: number;
        aujourdhui: number;
        a_venir: number;
        count_retard: number;
    };
    repartition_dette: Array<{ name: string; value: number }>;
    prochaines_echeances: Array<{
        fournisseur_id: number;
        fournisseur_nom: string;
        numero_facture: string;
        montant_du: number;
        date_echeance: string;
        jours_restants: number;
        status: string;
    }>;
    evolution_dette: Array<{ month: string; dette: number }>;
}

const QUERY_KEY = ['supplier-dashboard'];

export function useSupplierDashboard() {
    const { data: stats, isLoading: loading, error: queryError, refetch } = useQuery<SupplierDashboardStats>({
        queryKey: QUERY_KEY,
        queryFn: async () => {
            const response = await api.get('fournisseurs/dashboard_stats/');
            return response.data;
        },
    });

    const error = queryError ? getApiErrorDetail(queryError, 'Erreur lors de la récupération des statistiques') : null;

    return { stats: stats || null, loading, error, refresh: refetch };
}

export function useInvalidateSupplierDashboard() {
    const queryClient = useQueryClient();
    return () => {
        queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    };
}
