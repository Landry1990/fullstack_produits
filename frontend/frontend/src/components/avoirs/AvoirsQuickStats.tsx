import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import type { UseAvoirsDataReturn } from '../../hooks/useAvoirsData';
import { Card, CardContent } from '../shadcn/card';
import { isDraftStatus, isValidStatus } from './utils';

interface AvoirsQuickStatsProps {
    avoirs: UseAvoirsDataReturn['avoirs'];
}

export const AvoirsQuickStats: React.FC<AvoirsQuickStatsProps> = ({ avoirs }) => {
    const { t } = useTranslation(['stock', 'common']);

    const stats = useMemo(() => {
        return {
            total: avoirs.length,
            valides: avoirs.filter(a => isValidStatus(a.status)).length,
            brouillons: avoirs.filter(a => isDraftStatus(a.status)).length
        };
    }, [avoirs]);

    const statItems = [
        {
            title: t('stock:avoirs.stats.total'),
            value: stats.total,
            icon: <FileText className="size-5" />,
            colorClass: 'text-slate-700',
            bgClass: 'bg-slate-100',
        },
        {
            title: t('stock:avoirs.stats.valides'),
            value: stats.valides,
            icon: <CheckCircle2 className="size-5" />,
            colorClass: 'text-emerald-600',
            bgClass: 'bg-emerald-50',
        },
        {
            title: t('stock:avoirs.stats.brouillons'),
            value: stats.brouillons,
            icon: <AlertCircle className="size-5" />,
            colorClass: 'text-amber-600',
            bgClass: 'bg-amber-50',
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {statItems.map((item) => (
                <Card key={item.title} className="flex items-center gap-4 p-5 transition-all hover:shadow-md hover:border-slate-300">
                    <div className={`size-12 rounded-xl flex items-center justify-center ${item.bgClass} ${item.colorClass}`}>
                        {item.icon}
                    </div>
                    <CardContent className="p-0">
                        <p className="text-sm font-medium text-slate-500">{item.title}</p>
                        <p className={`text-2xl font-bold ${item.colorClass}`}>{item.value}</p>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};
