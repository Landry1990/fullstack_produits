import { useTranslation } from 'react-i18next';
import { Package, TrendingUp, AlertTriangle, Info } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

interface StockAnalysisStatsProps {
    totalItems: number;
    totalValue: number;
    activeTab: 'unsold' | 'overstock' | 'shortage';
    criticalCount?: number;
    warningCount?: number;
    supplierName: string;
}

export const StockAnalysisStats: React.FC<StockAnalysisStatsProps> = ({
    totalItems,
    totalValue,
    activeTab,
    criticalCount = 0,
    warningCount = 0,
    supplierName
}) => {
    const { t } = useTranslation(['stock', 'common']);

    const getValueLabel = () => {
        switch (activeTab) {
            case 'shortage': return t('stock:analyse.stats.value_at_risk');
            case 'overstock': return t('stock:analyse.stats.overstock_value');
            default: return t('stock:analyse.stats.estimated_value');
        }
    };

    const stats = [
        {
            label: t('stock:analyse.stats.supplier'),
            value: supplierName || t('stock:analyse.filters.all_suppliers'),
            icon: <Info className="size-6" />,
            bg: 'bg-blue-50',
            text: 'text-blue-600',
            border: 'border-blue-100'
        },
        {
            label: t('stock:analyse.stats.item_count'),
            value: totalItems,
            icon: <Package className="size-6" />,
            bg: 'bg-amber-50',
            text: 'text-amber-600',
            border: 'border-amber-200'
        },
        {
            label: getValueLabel(),
            value: `${formatCurrency(Math.round(totalValue))}`,
            icon: <TrendingUp className="size-6" />,
            bg: 'bg-red-50',
            text: 'text-red-500',
            border: 'border-red-200'
        },
        ...(activeTab === 'shortage' ? [{
            label: t('stock:analyse.stats.critical_alerts'),
            value: criticalCount,
            subValue: `+ ${warningCount} ${t('stock:analyse.shortage.warnings')}`,
            icon: <AlertTriangle className="size-6" />,
            bg: 'bg-red-50',
            text: 'text-red-500',
            border: 'border-red-200'
        }] : [])
    ];

    return (
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${stats.length} gap-6`}>
            {stats.map((stat, idx) => (
                <div
                    key={idx}
                    className={`bg-white p-6 rounded-3xl border ${stat.border} shadow-sm flex items-center gap-5 transition-all hover:shadow-md group`}
                >
                    <div className={`p-4 ${stat.bg} ${stat.text} rounded-2xl transition-transform group-hover:scale-110 duration-300`}>
                        {stat.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 truncate">
                            {stat.label}
                        </div>
                        <div className={`text-xl font-black ${stat.text} tracking-tighter truncate`}>
                            {stat.value}
                        </div>
                        {stat.subValue && (
                            <div className="text-[10px] font-bold text-amber-500 uppercase mt-1 italic">
                                {stat.subValue}
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};
