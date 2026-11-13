import React from 'react';
import { CreditCard, CheckCircle, Clock, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../utils/formatters';
import type { CreanceAging } from '../../services/creanceService';

interface CreancesQuickStatsProps {
    totalDue: number;
    totalPaid: number;
    totalRemaining: number;
    debtorsCount: number;
    aging?: CreanceAging | null;
}

export const CreancesQuickStats: React.FC<CreancesQuickStatsProps> = ({
    totalDue,
    totalPaid,
    totalRemaining,
    debtorsCount,
    aging
}) => {
    const { t } = useTranslation(['creances', 'common']);

    const stats = [
        {
            label: t('creances:stats.total_invoices'),
            value: `${formatCurrency(Math.round(totalDue))} ${t('common:currency')}`,
            icon: <CreditCard className="size-5 text-blue-500" />,
            bgColor: 'bg-blue-50',
            borderColor: 'border-blue-200'
        },
        {
            label: t('creances:stats.total_paid'),
            value: `${formatCurrency(Math.round(totalPaid))} ${t('common:currency')}`,
            icon: <CheckCircle className="size-5 text-emerald-600" />,
            bgColor: 'bg-emerald-50',
            borderColor: 'border-emerald-200'
        },
        {
            label: t('creances:stats.remaining'),
            value: `${formatCurrency(Math.round(totalRemaining))} ${t('common:currency')}`,
            icon: <Clock className="size-5 text-amber-600" />,
            bgColor: 'bg-amber-50',
            borderColor: 'border-amber-200'
        },
        {
            label: t('creances:stats.debtors'),
            value: debtorsCount,
            icon: <Users className="size-5 text-purple-500" />,
            bgColor: 'bg-purple-50',
            borderColor: 'border-purple-200'
        }
    ];

    const agingTotal = aging?.total?.montant ?? 0;
    const agingBuckets = aging ? [
        { key: 'b_0_30', label: t('creances:stats.aging_0_30'), color: 'bg-emerald-500', text: 'text-emerald-600', data: aging.b_0_30 },
        { key: 'b_30_60', label: t('creances:stats.aging_30_60'), color: 'bg-amber-400', text: 'text-amber-600', data: aging.b_30_60 },
        { key: 'b_60_90', label: t('creances:stats.aging_60_90'), color: 'bg-orange-500', text: 'text-orange-600', data: aging.b_60_90 },
        { key: 'b_90_plus', label: t('creances:stats.aging_90_plus'), color: 'bg-red-500', text: 'text-red-600', data: aging.b_90_plus },
    ] : [];

    return (
        <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat) => (
                    <div
                        key={stat.label}
                        className={`${stat.bgColor} ${stat.borderColor} border p-4 rounded-xl shadow-sm transition-all hover:shadow-md flex items-center gap-4`}
                    >
                        <div className="p-3 bg-white rounded-xl shadow-sm">
                            {stat.icon}
                        </div>
                        <div>
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                {stat.label}
                            </div>
                            <div className="text-xl font-bold text-slate-800 mt-0.5">
                                {stat.value}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {aging && agingTotal > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-caption font-bold uppercase tracking-widest text-slate-400">
                            {t('creances:stats.aging_title')}
                        </span>
                        <span className="text-caption font-bold text-slate-500">
                            {formatCurrency(Math.round(agingTotal))} {t('common:currency')}
                        </span>
                    </div>
                    <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
                        {agingBuckets.map(b => b.data.montant > 0 && (
                            <div
                                key={b.key}
                                className={`${b.color} transition-all`}
                                style={{ width: `${(b.data.montant / agingTotal) * 100}%` }}
                                title={`${b.label} : ${formatCurrency(Math.round(b.data.montant))}`}
                            />
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                        {agingBuckets.map(b => (
                            <div key={b.key} className="flex items-center gap-1.5">
                                <span className={`size-2 rounded-full ${b.color}`} />
                                <span className="text-caption font-bold text-slate-400 uppercase tracking-widest">{b.label}</span>
                                <span className={`text-xs font-bold ${b.text}`}>{formatCurrency(Math.round(b.data.montant))}</span>
                                <span className="text-caption text-slate-300">({b.data.nb})</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
