import { TrendingUp, UserCheck } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { useTranslation } from 'react-i18next';

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
    total_ttc: string;
    total_regle: string;
    total_en_compte: string;
}

interface SalesQuickStatsProps {
    stats?: SalesStats | null;
    onClose?: () => void;
}

export const SalesQuickStats: React.FC<SalesQuickStatsProps> = ({ stats, onClose }) => {
    const { t } = useTranslation(['sales', 'common']);
    if (!stats) return null;

    // CA = valeur des factures (total_ttc). Dettes réelles = CA - encaissé :
    // total_en_compte ne couvre que les paiements tagués 'en_compte', pas les
    // restes à payer des ventes partiellement réglées.
    const totalTtc = Number(stats.total_ttc) || 0;
    const totalRegle = Number(stats.total_regle) || 0;
    const totalDettes = Math.max(0, totalTtc - totalRegle);

    return (
        <div className="relative group">
            {onClose && (
                <button
                    onClick={onClose}
                    className="absolute -top-2 -right-2 size-7 flex items-center justify-center rounded-full bg-base-100 border border-base-300 text-base-content/50 hover:bg-error/10 hover:text-error transition-colors z-10 shadow-sm"
                    title={t('sales:actions.hide_report')}
                    aria-label={t('sales:actions.hide_report')}
                >
                    ✕
                </button>
            )}
            {/* Une seule ligne, même sur petit écran : défilement horizontal si besoin */}
            <div className="mt-4 flex items-stretch divide-x divide-base-200 overflow-x-auto rounded-xl border border-base-200 bg-base-100 shadow-sm">
                <div className="min-w-[130px] flex-1 px-3 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-base-content/50 truncate">
                        {t('sales:stats.daily_revenue')}
                    </div>
                    <div className="text-base font-bold text-primary truncate">
                        {formatCurrency(totalTtc)}
                    </div>
                </div>

                <div className="min-w-[130px] flex-1 px-3 py-2 bg-success/5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 truncate">
                        {t('sales:stats.total_collected')}
                    </div>
                    <div className="text-base font-bold text-success truncate">
                        {formatCurrency(totalRegle)}
                    </div>
                </div>

                <div className="min-w-[130px] flex-1 px-3 py-2 bg-warning/5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-500 truncate">
                        {t('sales:stats.total_on_account')}
                    </div>
                    <div className="text-base font-bold text-warning truncate">
                        {formatCurrency(totalDettes)}
                    </div>
                </div>

                <div className="min-w-[160px] flex-1 px-3 py-2 bg-indigo-50/50">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 truncate flex items-center gap-1">
                        <UserCheck className="size-3 shrink-0" /> {t('sales:stats.best_seller')}
                    </div>
                    {stats.top_vendeur ? (
                        <>
                            <div className="text-sm font-bold text-base-content truncate">{stats.top_vendeur.name}</div>
                            <div className="text-[11px] text-base-content/60 truncate">
                                {t('sales:stats.sales_count', { count: stats.top_vendeur.count })} • {formatCurrency(stats.top_vendeur.amount || 0)}
                            </div>
                        </>
                    ) : (
                        <div className="text-xs text-base-content/50 italic truncate">{t('sales:stats.no_sales_today')}</div>
                    )}
                </div>

                <div className="min-w-[160px] flex-1 px-3 py-2 bg-blue-50/50">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-info truncate flex items-center gap-1">
                        <TrendingUp className="size-3 shrink-0" /> {t('sales:stats.best_product')}
                    </div>
                    {stats.top_produit ? (
                        <>
                            <div className="text-sm font-bold text-base-content truncate">{stats.top_produit.name}</div>
                            <div className="text-[11px] text-base-content/60 truncate">
                                {t('sales:stats.units_sold', { count: stats.top_produit.quantity })}
                            </div>
                        </>
                    ) : (
                        <div className="text-xs text-base-content/50 italic truncate">{t('sales:stats.no_product_sold')}</div>
                    )}
                </div>
            </div>
        </div>
    );
};
