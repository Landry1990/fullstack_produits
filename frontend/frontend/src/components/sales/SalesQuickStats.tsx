import React, { useEffect, useState } from 'react';
import { TrendingUp, UserCheck, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { safeStorage } from '../../utils/storage';

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
}

export const SalesQuickStats: React.FC = () => {
    const [stats, setStats] = useState<SalesStats | null>(null);
    const [loading, setLoading] = useState(false);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const token = safeStorage.getItem('authToken');
            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
            const response = await axios.get(`${apiBaseUrl}/factures/stats_jour/`, {
                headers: { Authorization: `Token ${token}` }
            });
            setStats(response.data);
        } catch (error) {
            console.error("Failed to fetch quick stats", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    if (!stats) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {/* Top Vendeur Card */}
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-4 rounded-xl border border-primary/20 flex items-center justify-between">
                <div>
                    <div className="text-xs font-bold text-primary uppercase tracking-wider mb-1 flex items-center gap-1">
                        <UserCheck className="w-3 h-3" /> Meilleur Vendeur du Jour
                    </div>
                    {stats.top_vendeur ? (
                        <div>
                            <div className="text-lg font-bold text-base-content">{stats.top_vendeur.name}</div>
                            <div className="text-xs text-base-content/60">
                                {stats.top_vendeur.count} vente(s) • {stats.top_vendeur.amount.toLocaleString()} F
                            </div>
                        </div>
                    ) : (
                        <div className="text-sm text-base-content/50 italic">Aucune vente aujourd'hui</div>
                    )}
                </div>
            </div>

            {/* Top Produit Card */}
            <div className="bg-gradient-to-br from-secondary/10 to-secondary/5 p-4 rounded-xl border border-secondary/20 flex items-center justify-between">
                 <div>
                    <div className="text-xs font-bold text-secondary uppercase tracking-wider mb-1 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> Top Produit du Jour
                    </div>
                    {stats.top_produit ? (
                        <div>
                            <div className="text-lg font-bold text-base-content">{stats.top_produit.name}</div>
                            <div className="text-xs text-base-content/60">
                                {stats.top_produit.quantity} unité(s) vendue(s)
                            </div>
                        </div>
                    ) : (
                        <div className="text-sm text-base-content/50 italic">Aucun produit vendu</div>
                    )}
                </div>
            </div>
        </div>
    );
};
