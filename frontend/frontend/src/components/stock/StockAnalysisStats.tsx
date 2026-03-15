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
    const { t } = useTranslation();

    const getValueLabel = () => {
        switch (activeTab) {
            case 'shortage': return t('stock.analyse.stats.value_at_risk');
            case 'overstock': return t('stock.analyse.stats.overstock_value');
            default: return t('stock.analyse.stats.estimated_value');
        }
    };

    const stats = [
        {
            label: t('stock.analyse.stats.supplier'),
            value: supplierName || t('stock.analyse.filters.all_suppliers'),
            icon: <Info className="w-6 h-6" />,
            color: 'primary',
            bg: 'bg-primary/10',
            text: 'text-primary',
            border: 'border-primary/20'
        },
        {
            label: t('stock.analyse.stats.item_count'),
            value: totalItems,
            icon: <Package className="w-6 h-6" />,
            color: 'warning',
            bg: 'bg-warning/10',
            text: 'text-warning',
            border: 'border-warning/20'
        },
        {
            label: getValueLabel(),
            value: `${formatCurrency(Math.round(totalValue))} F`,
            icon: <TrendingUp className="w-6 h-6" />,
            color: 'error',
            bg: 'bg-error/10',
            text: 'text-error',
            border: 'border-error/20'
        },
        ...(activeTab === 'shortage' ? [{
            label: t('stock.analyse.stats.critical_alerts'),
            value: criticalCount,
            subValue: `+ ${warningCount} ${t('stock.analyse.shortage.warnings')}`,
            icon: <AlertTriangle className="w-6 h-6" />,
            color: 'error',
            bg: 'bg-error/10',
            text: 'text-error',
            border: 'border-error/20'
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
                        <div className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-1 truncate">
                            {stat.label}
                        </div>
                        <div className={`text-xl font-black ${stat.text} tracking-tighter truncate`}>
                            {stat.value}
                        </div>
                        {stat.subValue && (
                            <div className="text-[10px] font-bold text-warning uppercase mt-1 italic">
                                {stat.subValue}
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};
