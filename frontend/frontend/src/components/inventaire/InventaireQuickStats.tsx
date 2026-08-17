import React, { useMemo } from 'react';
import { PackageSearch, TrendingDown, ClipboardList, HelpCircle, TrendingUp, Minus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Inventaire } from '../../types';
import { formatCurrency } from '../../utils/formatters';

const SIGNIFICANT_LOSS_THRESHOLD = 100000;

interface InventaireQuickStatsProps {
    inventaires: Inventaire[];
}

export const InventaireQuickStats: React.FC<InventaireQuickStatsProps> = ({ inventaires }) => {
    const { t } = useTranslation(['stock', 'common']);

    const stats = useMemo(() => {
        const en_cours_count = inventaires.filter((i) => i.status === 'EN_COURS').length;
        const validees_count = inventaires.filter((i) => i.status === 'VALIDEE').length;
        const valeur_physique_totale = inventaires.reduce((sum, i) => sum + (parseFloat(String(i.total_valeur_physique || 0)) || 0), 0);
        const ecart_total = inventaires.reduce((sum, i) => sum + (parseFloat(String(i.total_ecart_valeur || 0)) || 0), 0);

        const lastValidated = [...inventaires]
            .filter((i) => i.status === 'VALIDEE')
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

        const lastValidatedEcart = lastValidated
            ? parseFloat(String(lastValidated.total_ecart_valeur || 0))
            : 0;
        const variation = ecart_total - lastValidatedEcart;

        return {
            en_cours_count,
            validees_count,
            valeur_physique_totale,
            ecart_total,
            lastValidatedEcart,
            variation,
            hasLastValidated: !!lastValidated,
        };
    }, [inventaires]);

    return (
        <div className="grid grid-cols-3 md:grid-cols-3 gap-2 lg:gap-4 mt-2 lg:mt-4">
            {/* Inventaires En Cours Card */}
            <div className="bg-white p-2 lg:p-4 rounded-lg border border-slate-200 border-l-4 border-l-amber-500 flex items-center justify-between">
                <div>
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <ClipboardList className="size-3" /> {t('inventaire.stats.en_cours')}
                    </div>
                    <div>
                        <div className="text-lg font-semibold text-slate-800">{stats.en_cours_count}</div>
                        <div className="text-xs text-slate-500">
                            {t('inventaire.stats.to_validate')}
                        </div>
                    </div>
                </div>
            </div>

            {/* Total Valeur Physique Card */}
            <div className="bg-white p-2 lg:p-4 rounded-lg border border-slate-200 border-l-4 border-l-emerald-500 flex items-center justify-between">
                <div>
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <PackageSearch className="size-3" /> {t('inventaire.stats.val_phys')}
                    </div>
                    <div>
                        <div className="text-lg font-mono font-semibold text-slate-800">
                            {formatCurrency(stats.valeur_physique_totale)}
                        </div>
                        <div className="text-xs text-slate-500">
                            {stats.validees_count + stats.en_cours_count} {t('inventaire.list.title_short')}
                        </div>
                    </div>
                </div>
            </div>

            {/* Ecart Global Card */}
            <div className={`bg-white p-2 lg:p-4 rounded-lg border border-slate-200 border-l-4 flex items-center justify-between
                ${stats.ecart_total === 0 ? 'border-l-slate-300' : stats.ecart_total < -SIGNIFICANT_LOSS_THRESHOLD ? 'border-l-red-500' : 'border-l-amber-500'}`}>
                 <div>
                    <div
                        className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1 cursor-help"
                        title={t('inventaire.stats.ecart_tooltip')}
                    >
                        <TrendingDown className="size-3" /> {t('inventaire.stats.ecart_global')} <HelpCircle className="size-3 text-slate-400" />
                    </div>
                    <div>
                        <div className={`text-lg font-mono font-semibold
                            ${stats.ecart_total === 0 ? 'text-slate-700' : stats.ecart_total < -SIGNIFICANT_LOSS_THRESHOLD ? 'text-red-500' : 'text-amber-600'}`}>
                            {stats.ecart_total > 0 ? '+' : ''}{formatCurrency(stats.ecart_total)}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            {stats.hasLastValidated ? (
                                <>
                                    {stats.variation > 0 ? <TrendingUp className="size-3 text-emerald-500" /> :
                                     stats.variation < 0 ? <TrendingDown className="size-3 text-red-500" /> :
                                     <Minus className="size-3 text-slate-400" />}
                                    {t('inventaire.stats.vs_last_validated', {
                                        sign: stats.variation > 0 ? '+' : stats.variation < 0 ? '-' : '',
                                        amount: formatCurrency(Math.abs(stats.variation))
                                    })}
                                </>
                            ) : (
                                t('inventaire.stats.no_last_validated')
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
