import React, { useEffect, useState } from 'react';
import { PackageSearch, TrendingDown, ClipboardList } from 'lucide-react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

interface InventaireStats {
    en_cours_count: number;
    validees_count: number;
    valeur_physique_totale: number;
    ecart_total: number;
}

export const InventaireQuickStats: React.FC = () => {
    const { t } = useTranslation();
    const [stats, setStats] = useState<InventaireStats | null>(null);

    const fetchStats = async () => {
        try {
            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';
            // Placeholder for an actual endpoint if one exists, otherwise we'll fetch list and calculate
            const response = await axios.get(`${String(apiBaseUrl).replace(/\/$/, '')}/api/inventaires/`);
            
            // Temporary calculation on frontend until backend endpoint is available
            const inventaires = Array.isArray(response.data) ? response.data : response.data.results || [];
            
            const calcStats: InventaireStats = {
                en_cours_count: inventaires.filter((i: any) => i.status === 'EN_COURS').length,
                validees_count: inventaires.filter((i: any) => i.status === 'VALIDEE').length,
                valeur_physique_totale: inventaires.reduce((sum: number, i: any) => sum + (parseFloat(i.total_valeur_physique) || 0), 0),
                ecart_total: inventaires.reduce((sum: number, i: any) => sum + (parseFloat(i.total_ecart_valeur) || 0), 0),
            };
            
            setStats(calcStats);
        } catch (error) {
            console.error("Failed to fetch inventaire quick stats", error);
            setStats(null);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    if (!stats) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {/* Inventaires En Cours Card */}
            <div className="bg-gradient-to-br from-warning/10 to-warning/5 p-4 rounded-xl border border-warning/20 flex items-center justify-between">
                <div>
                    <div className="text-xs font-bold text-warning uppercase tracking-wider mb-1 flex items-center gap-1">
                        <ClipboardList className="w-3 h-3" /> {t('stock.inventaire.stats.en_cours', { defaultValue: 'Inventaires En Cours' })}
                    </div>
                    <div>
                        <div className="text-lg font-bold text-base-content">{stats.en_cours_count}</div>
                        <div className="text-xs text-base-content/60">
                            {t('stock.inventaire.stats.to_validate', { defaultValue: 'À valider' })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Total Valeur Physique Card */}
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-4 rounded-xl border border-primary/20 flex items-center justify-between">
                <div>
                    <div className="text-xs font-bold text-primary uppercase tracking-wider mb-1 flex items-center gap-1">
                        <PackageSearch className="w-3 h-3" /> {t('stock.inventaire.stats.val_phys', { defaultValue: 'Valeur Physique (Tous)' })}
                    </div>
                    <div>
                        <div className="text-lg font-mono font-bold text-base-content">
                            {stats.valeur_physique_totale.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} F
                        </div>
                        <div className="text-xs text-base-content/60">
                            {stats.validees_count + stats.en_cours_count} {t('stock.inventaire.list.title_short', { defaultValue: 'inventaires' })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Ecart Global Card */}
            <div className="bg-gradient-to-br from-secondary/10 to-secondary/5 p-4 rounded-xl border border-secondary/20 flex items-center justify-between">
                 <div>
                    <div className="text-xs font-bold text-secondary uppercase tracking-wider mb-1 flex items-center gap-1">
                        <TrendingDown className="w-3 h-3" /> {t('stock.inventaire.stats.ecart_global', { defaultValue: 'Écart Global' })}
                    </div>
                    <div>
                        <div className={`text-lg font-mono font-bold ${stats.ecart_total < 0 ? 'text-error' : stats.ecart_total > 0 ? 'text-success' : 'text-base-content'}`}>
                            {stats.ecart_total > 0 ? '+' : ''}{stats.ecart_total.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} F
                        </div>
                        <div className="text-xs text-base-content/60">
                            Sur tous les inventaires
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
