import React, { useMemo } from 'react';
import { PackageSearch, TrendingDown, ClipboardList } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Inventaire } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface InventaireQuickStatsProps {
    inventaires: Inventaire[];
}

export const InventaireQuickStats: React.FC<InventaireQuickStatsProps> = ({ inventaires }) => {
    const { t } = useTranslation(['stock', 'common']);

    const stats = useMemo(() => {
        return {
            en_cours_count: inventaires.filter((i: any) => i.status === 'EN_COURS').length,
            validees_count: inventaires.filter((i: any) => i.status === 'VALIDEE').length,
            valeur_physique_totale: inventaires.reduce((sum: number, i: any) => sum + (parseFloat(i.total_valeur_physique) || 0), 0),
            ecart_total: inventaires.reduce((sum: number, i: any) => sum + (parseFloat(i.total_ecart_valeur) || 0), 0),
        };
    }, [inventaires]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {/* Inventaires En Cours Card */}
            <div className="bg-gradient-to-br from-amber-50 to-amber-50/50 p-4 rounded-xl border border-amber-200 flex items-center justify-between">
                <div>
                    <div className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <ClipboardList className="size-3" /> {t('inventaire.stats.en_cours')}
                    </div>
                    <div>
                        <div className="text-lg font-bold text-slate-800">{stats.en_cours_count}</div>
                        <div className="text-xs text-slate-500">
                            {t('inventaire.stats.to_validate')}
                        </div>
                    </div>
                </div>
            </div>

            {/* Total Valeur Physique Card */}
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-50/50 p-4 rounded-xl border border-emerald-200 flex items-center justify-between">
                <div>
                    <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <PackageSearch className="size-3" /> {t('inventaire.stats.val_phys')}
                    </div>
                    <div>
                        <div className="text-lg font-mono font-bold text-slate-800">
                            {formatCurrency(stats.valeur_physique_totale)}
                        </div>
                        <div className="text-xs text-slate-500">
                            {stats.validees_count + stats.en_cours_count} {t('inventaire.list.title_short')}
                        </div>
                    </div>
                </div>
            </div>

            {/* Ecart Global Card */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-50/50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                 <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <TrendingDown className="size-3" /> {t('inventaire.stats.ecart_global')}
                    </div>
                    <div>
                        <div className={`text-lg font-mono font-bold ${stats.ecart_total < 0 ? 'text-red-500' : stats.ecart_total > 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                            {stats.ecart_total > 0 ? '+' : ''}{formatCurrency(stats.ecart_total)}
                        </div>
                        <div className="text-xs text-slate-500">
                            {t('inventaire.stats.all_inventories')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
