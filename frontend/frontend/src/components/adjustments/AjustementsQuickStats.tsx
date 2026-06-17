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
    const { t } = useTranslation(['stock', 'common']);

    const stats = [
        {
            label: t('ajustements.stats.total'),
            value: totalCount,
            icon: <Activity className="size-6" />,
            bg: 'bg-blue-50',
            text: 'text-blue-600',
            border: 'border-blue-100'
        },
        {
            label: t('ajustements.stats.positive'),
            value: `+${positiveSum}`,
            icon: <PlusCircle className="size-6" />,
            bg: 'bg-emerald-50',
            text: 'text-emerald-600',
            border: 'border-emerald-100'
        },
        {
            label: t('ajustements.stats.negative'),
            value: negativeSum,
            icon: <MinusCircle className="size-6" />,
            bg: 'bg-red-50',
            text: 'text-red-500',
            border: 'border-red-100'
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
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
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
