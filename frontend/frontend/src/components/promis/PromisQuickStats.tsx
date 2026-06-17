import React from 'react';
import { useTranslation } from 'react-i18next';
import { PackageOpen, Clock, CheckCircle2, XCircle } from 'lucide-react';
import type { UsePromisDataReturn } from '../../hooks/usePromisData';

interface PromisQuickStatsProps {
    stats: UsePromisDataReturn['stats'];
}

export const PromisQuickStats: React.FC<PromisQuickStatsProps> = ({ stats }) => {
    const { t } = useTranslation(['stock', 'common']);

    const statItems = [
         {
            title: t('stock:promis.stats.all_title'),
            value: stats.total,
            icon: <PackageOpen className="size-5" />,
            colorClass: "text-blue-600",
            bgClass: "bg-blue-50",
        },
        {
            title: t('stock:promis.stats.att_title'),
            value: stats.enAttente,
            icon: <Clock className="size-5" />,
            colorClass: "text-amber-600",
            bgClass: "bg-amber-50",
        },
        {
            title: t('stock:promis.stats.del_title'),
            value: stats.delivres,
            icon: <CheckCircle2 className="size-5" />,
            colorClass: "text-emerald-600",
            bgClass: "bg-emerald-50",
        },
        {
            title: t('stock:promis.stats.ann_title'),
            value: stats.annules,
            icon: <XCircle className="size-5" />,
            colorClass: "text-red-500",
            bgClass: "bg-red-50",
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {statItems.map((item, index) => (
                <div key={index} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-center gap-4 transition-all hover:shadow-md hover:border-slate-300">
                    <div className={`size-12 rounded-xl flex items-center justify-center ${item.bgClass} ${item.colorClass}`}>
                        {item.icon}
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">{item.title}</p>
                        <p className={`text-2xl font-bold ${item.colorClass}`}>{item.value}</p>
                    </div>
                </div>
            ))}
        </div>
    );
};
