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
            title: t('promis.stats.all_title'),
            value: stats.total,
            icon: <PackageOpen className="w-5 h-5" />,
            colorClass: "text-primary",
            bgClass: "bg-primary/10",
        },
        {
            title: t('promis.stats.att_title'),
            value: stats.enAttente,
            icon: <Clock className="w-5 h-5" />,
            colorClass: "text-warning",
            bgClass: "bg-warning/10",
        },
        {
            title: t('promis.stats.del_title'),
            value: stats.delivres,
            icon: <CheckCircle2 className="w-5 h-5" />,
            colorClass: "text-success",
            bgClass: "bg-success/10",
        },
        {
            title: t('promis.stats.ann_title'),
            value: stats.annules,
            icon: <XCircle className="w-5 h-5" />,
            colorClass: "text-error",
            bgClass: "bg-error/10",
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {statItems.map((item, index) => (
                <div key={index} className="bg-base-100 rounded-2xl shadow-sm border border-base-300 p-5 flex items-center gap-4 transition-all hover:shadow-md hover:border-base-content/20">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${item.bgClass} ${item.colorClass}`}>
                        {item.icon}
                    </div>
                    <div>
                        <p className="text-sm font-medium text-base-content/60">{item.title}</p>
                        <p className={`text-2xl font-bold ${item.colorClass}`}>{item.value}</p>
                    </div>
                </div>
            ))}
        </div>
    );
};
