import React from 'react';
import { useTranslation } from 'react-i18next';
import { PackageOpen, Clock, CheckCircle2, XCircle } from 'lucide-react';
import type { UsePromisDataReturn } from '../../hooks/usePromisData';
import { Card, CardContent } from '../shadcn/card';
import { cn } from '../../lib/utils';

interface PromisQuickStatsProps {
    stats: UsePromisDataReturn['stats'];
}

export const PromisQuickStats: React.FC<PromisQuickStatsProps> = ({ stats }) => {
    const { t } = useTranslation(['stock', 'common']);

    const statItems = [
        {
            title: t('stock:promis.stats.all_title'),
            value: stats.total,
            icon: <PackageOpen className="size-4" />,
            colorClass: "text-blue-600",
            bgClass: "bg-blue-50",
        },
        {
            title: t('stock:promis.stats.att_title'),
            value: stats.enAttente,
            icon: <Clock className="size-4" />,
            colorClass: "text-amber-600",
            bgClass: "bg-amber-50",
        },
        {
            title: t('stock:promis.stats.del_title'),
            value: stats.delivres,
            icon: <CheckCircle2 className="size-4" />,
            colorClass: "text-emerald-600",
            bgClass: "bg-emerald-50",
        },
        {
            title: t('stock:promis.stats.ann_title'),
            value: stats.annules,
            icon: <XCircle className="size-4" />,
            colorClass: "text-red-600",
            bgClass: "bg-red-50",
        }
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {statItems.map((item) => (
                <Card key={item.title}>
                    <CardContent className="p-3 flex items-center gap-3">
                        <div className={cn('size-9 rounded-lg flex items-center justify-center shrink-0', item.bgClass, item.colorClass)}>
                            {item.icon}
                        </div>
                        <div>
                            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                                {item.title}
                            </p>
                            <p className={cn('text-xl font-bold text-slate-900', item.colorClass)}>{item.value}</p>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};
