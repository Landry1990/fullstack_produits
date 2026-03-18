import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import type { UseAvoirsDataReturn } from '../../hooks/useAvoirsData';

interface AvoirsQuickStatsProps {
    avoirs: UseAvoirsDataReturn['avoirs'];
}

export const AvoirsQuickStats: React.FC<AvoirsQuickStatsProps> = ({ avoirs }) => {
    const { t } = useTranslation(['stock', 'common']);

    const stats = useMemo(() => {
        return {
            total: avoirs.length,
            valides: avoirs.filter(a => {
                const s = a.status?.toUpperCase();
                return s === 'VAL' || s === 'VALIDE' || s === 'VALIDÉ' || s === 'VALIDEE' || s === 'VALIDÉE';
            }).length,
            brouillons: avoirs.filter(a => a.status?.toUpperCase() === 'BROUILLON' || a.status?.toUpperCase() === 'BRO').length
        };
    }, [avoirs]);

    const statItems = [
        {
            title: t('stock:avoirs.stats.total'),
            value: stats.total,
            icon: <FileText className="w-5 h-5" />,
            colorClass: "text-primary",
            bgClass: "bg-primary/10",
        },
        {
            title: t('stock:avoirs.stats.valides'),
            value: stats.valides,
            icon: <CheckCircle2 className="w-5 h-5" />,
            colorClass: "text-success",
            bgClass: "bg-success/10",
        },
        {
            title: t('stock:avoirs.stats.brouillons'),
            value: stats.brouillons,
            icon: <AlertCircle className="w-5 h-5" />,
            colorClass: "text-warning",
            bgClass: "bg-warning/10",
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
