import React from 'react';
import { CreditCard, CheckCircle, Clock, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../utils/formatters';

interface CreancesQuickStatsProps {
    totalDue: number;
    totalPaid: number;
    totalRemaining: number;
    debtorsCount: number;
}

export const CreancesQuickStats: React.FC<CreancesQuickStatsProps> = ({
    totalDue,
    totalPaid,
    totalRemaining,
    debtorsCount
}) => {
    const { t } = useTranslation(['creances', 'common']);

    const stats = [
        {
            label: t('creances:stats.total_invoices'),
            value: `${formatCurrency(Math.round(totalDue))} F`,
            icon: <CreditCard className="w-5 h-5 text-blue-500" />,
            bgColor: 'bg-blue-50',
            borderColor: 'border-blue-100'
        },
        {
            label: t('creances:stats.total_paid'),
            value: `${formatCurrency(Math.round(totalPaid))} F`,
            icon: <CheckCircle className="w-5 h-5 text-success" />,
            bgColor: 'bg-success/10',
            borderColor: 'border-success/20'
        },
        {
            label: t('creances:stats.remaining'),
            value: `${formatCurrency(Math.round(totalRemaining))} F`,
            icon: <Clock className="w-5 h-5 text-warning" />,
            bgColor: 'bg-warning/10',
            borderColor: 'border-warning/20'
        },
        {
            label: t('creances:stats.debtors'),
            value: debtorsCount,
            icon: <Users className="w-5 h-5 text-purple-500" />,
            bgColor: 'bg-purple-50',
            borderColor: 'border-purple-100'
        }
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, idx) => (
                <div 
                    key={idx}
                    className={`${stat.bgColor} ${stat.borderColor} border p-4 rounded-2xl shadow-sm transition-all hover:shadow-md flex items-center gap-4`}
                >
                    <div className="p-3 bg-white rounded-xl shadow-sm">
                        {stat.icon}
                    </div>
                    <div>
                        <div className="text-xs font-bold text-base-content/50 uppercase tracking-wider">
                            {stat.label}
                        </div>
                        <div className="text-xl font-black text-base-content mt-0.5">
                            {stat.value}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
