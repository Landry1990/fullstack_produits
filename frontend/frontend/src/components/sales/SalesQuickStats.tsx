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

    return (
        <div className="relative group">
            {onClose && (
                <button 
                    onClick={onClose}
                    className="absolute -top-2 -right-2 btn btn-circle btn-xs btn-ghost hover:bg-error hover:text-white transition-colors z-10 shadow-lg border border-base-300 bg-base-100"
                    title={t('sales:actions.hide_report')}
                >
                    ✕
                </button>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {/* Totals Section */}
            <div className="bg-base-100 p-4 rounded-xl border border-base-300 shadow-sm flex flex-col justify-center">
                <div className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-1">
                    {t('sales:stats.daily_revenue')}
                </div>
                <div className="text-2xl font-black text-primary">
                    {formatCurrency(Number(stats.total_regle) + Number(stats.total_en_compte))}
                </div>
            </div>

            <div className="bg-success/5 p-4 rounded-xl border border-success/20 shadow-sm flex flex-col justify-center">
                <div className="text-xs font-bold text-success/70 uppercase tracking-wider mb-1">
                    {t('sales:stats.total_collected')}
                </div>
                <div className="text-2xl font-black text-success">
                    {formatCurrency(Number(stats.total_regle))}
                </div>
            </div>

            <div className="bg-warning/5 p-4 rounded-xl border border-warning/20 shadow-sm flex flex-col justify-center">
                <div className="text-xs font-bold text-warning/70 uppercase tracking-wider mb-1">
                    {t('sales:stats.total_on_account')}
                </div>
                <div className="text-2xl font-black text-warning">
                    {formatCurrency(Number(stats.total_en_compte))}
                </div>
            </div>

            {/* Top Vendeur Card */}
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-4 rounded-xl border border-primary/20 flex items-center justify-between">
                <div>
                    <div className="text-xs font-bold text-primary uppercase tracking-wider mb-1 flex items-center gap-1">
                        <UserCheck className="w-3 h-3" /> {t('sales:stats.best_seller')}
                    </div>
                    {stats.top_vendeur ? (
                        <div>
                            <div className="text-lg font-bold text-base-content">{stats.top_vendeur.name}</div>
                            <div className="text-xs text-base-content/60">
                                {t('sales:stats.sales_count', { count: stats.top_vendeur.count })} • {formatCurrency(stats.top_vendeur.amount || 0)}
                            </div>
                        </div>
                    ) : (
                        <div className="text-sm text-base-content/50 italic">{t('sales:stats.no_sales_today')}</div>
                    )}
                </div>
            </div>

            {/* Top Produit Card */}
            <div className="bg-gradient-to-br from-secondary/10 to-secondary/5 p-4 rounded-xl border border-secondary/20 flex items-center justify-between">
                 <div>
                    <div className="text-xs font-bold text-secondary uppercase tracking-wider mb-1 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> {t('sales:stats.best_product')}
                    </div>
                    {stats.top_produit ? (
                        <div>
                            <div className="text-lg font-bold text-base-content">{stats.top_produit.name}</div>
                            <div className="text-xs text-base-content/60">
                                {t('sales:stats.units_sold', { count: stats.top_produit.quantity })}
                            </div>
                        </div>
                    ) : (
                        <div className="text-sm text-base-content/50 italic">{t('sales:stats.no_product_sold')}</div>
                    )}
                </div>
            </div>
            </div>
        </div>
    );
};
