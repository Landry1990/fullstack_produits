import React from 'react';
import { Activity, PlusCircle, MinusCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AjustementsQuickStatsProps {
    totalCount: number;
    positiveSum: number;
    negativeSum: number;
}

export const AjustementsQuickStats: React.FC<AjustementsQuickStatsProps> = ({
    totalCount,
    positiveSum,
    negativeSum
}) => {
    const { t } = useTranslation();

    const stats = [
        {
            label: t('stock.ajustements.stats.total'),
            value: totalCount,
            icon: <Activity className="w-6 h-6" />,
            color: 'primary',
            bg: 'bg-primary/10',
            text: 'text-primary',
            border: 'border-primary/20'
        },
        {
            label: t('stock.ajustements.stats.positive'),
            value: `+${positiveSum}`,
            icon: <PlusCircle className="w-6 h-6" />,
            color: 'success',
            bg: 'bg-success/10',
            text: 'text-success',
            border: 'border-success/20'
        },
        {
            label: t('stock.ajustements.stats.negative'),
            value: negativeSum,
            icon: <MinusCircle className="w-6 h-6" />,
            color: 'error',
            bg: 'bg-error/10',
            text: 'text-error',
            border: 'border-error/20'
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stats.map((stat, idx) => (
                <div 
                    key={idx}
                    className={`bg-white p-6 rounded-3xl border ${stat.border} shadow-sm flex items-center gap-5 transition-all hover:shadow-md group`}
                >
                    <div className={`p-4 ${stat.bg} ${stat.text} rounded-2xl transition-transform group-hover:scale-110 duration-300`}>
                        {stat.icon}
                    </div>
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-1">
                            {stat.label}
                        </div>
                        <div className={`text-2xl font-black ${stat.text} tracking-tighter`}>
                            {stat.value}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
