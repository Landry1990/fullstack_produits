import { useState, useEffect, useCallback } from 'react';
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

export function useSupplierDashboard() {
    const [stats, setStats] = useState<SupplierDashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStats = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get('fournisseurs/dashboard_stats/');
            setStats(response.data);
        } catch (err) {
            console.error('Error fetching supplier dashboard stats:', err);
            setError(getApiErrorDetail(err, 'Erreur lors de la récupération des statistiques'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    return { stats, loading, error, refresh: fetchStats };
}
