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
                    className="absolute -top-2 -right-2 size-7 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors z-10 shadow-sm"
                    title={t('sales:actions.hide_report')}
                >
                    ✕
                </button>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {/* Totals Section */}
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                    {t('sales:stats.daily_revenue')}
                </div>
                <div className="text-2xl font-bold text-indigo-600">
                    {formatCurrency(Number(stats.total_regle) + Number(stats.total_en_compte))}
                </div>
            </div>

            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 shadow-sm flex flex-col justify-center">
                <div className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-1">
                    {t('sales:stats.total_collected')}
                </div>
                <div className="text-2xl font-bold text-emerald-600">
                    {formatCurrency(Number(stats.total_regle))}
                </div>
            </div>

            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 shadow-sm flex flex-col justify-center">
                <div className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-1">
                    {t('sales:stats.total_on_account')}
                </div>
                <div className="text-2xl font-bold text-amber-600">
                    {formatCurrency(Number(stats.total_en_compte))}
                </div>
            </div>

            {/* Top Vendeur Card */}
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex items-center justify-between">
                <div>
                    <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <UserCheck className="size-3" /> {t('sales:stats.best_seller')}
                    </div>
                    {stats.top_vendeur ? (
                        <div>
                            <div className="text-lg font-bold text-gray-900">{stats.top_vendeur.name}</div>
                            <div className="text-xs text-gray-500">
                                {t('sales:stats.sales_count', { count: stats.top_vendeur.count })} • {formatCurrency(stats.top_vendeur.amount || 0)}
                            </div>
                        </div>
                    ) : (
                        <div className="text-sm text-gray-400 italic">{t('sales:stats.no_sales_today')}</div>
                    )}
                </div>
            </div>

            {/* Top Produit Card */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-center justify-between">
                 <div>
                    <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <TrendingUp className="size-3" /> {t('sales:stats.best_product')}
                    </div>
                    {stats.top_produit ? (
                        <div>
                            <div className="text-lg font-bold text-gray-900">{stats.top_produit.name}</div>
                            <div className="text-xs text-gray-500">
                                {t('sales:stats.units_sold', { count: stats.top_produit.quantity })}
                            </div>
                        </div>
                    ) : (
                        <div className="text-sm text-gray-400 italic">{t('sales:stats.no_product_sold')}</div>
                    )}
                </div>
            </div>
            </div>
        </div>
    );
};
