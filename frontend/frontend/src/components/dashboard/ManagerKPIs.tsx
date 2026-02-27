import React from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, BarChart3, TrendingUp } from 'lucide-react';

interface ProgressBarProps {
    rate: number;
    colorClass?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ rate, colorClass = 'bg-primary' }) => {
    const displayRate = Math.min(rate, 100);
    return (
        <div className="w-full bg-base-200 rounded-full h-3 overflow-hidden shadow-inner border border-base-300">
            <div 
                className={`h-full transition-all duration-1000 ease-out fill-mode-forwards rounded-full ${colorClass}`}
                style={{ width: `${displayRate}%` }}
            />
        </div>
    );
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'XOF',
        maximumFractionDigits: 0
    }).format(amount).replace('XOF', 'F');
};

interface KPIData {
    actual: number;
    target: number;
    rate: number;
}

interface ManagerKPIsProps {
    kpis: {
        jour: KPIData;
        semaine: KPIData;
        mois: KPIData;
    };
}

export const ManagerKPIs: React.FC<ManagerKPIsProps> = ({ kpis }) => {
    const { t } = useTranslation();

    const items = [
        { 
            label: t('manager_dashboard.periods.today', "Aujourd'hui"), 
            key: 'jour', 
            color: 'bg-primary', 
            icon: <Calendar className="w-5 h-5" />,
            colorText: 'text-primary'
        },
        { 
            label: t('manager_dashboard.periods.week', 'Semaine'), 
            key: 'semaine', 
            color: 'bg-secondary', 
            icon: <BarChart3 className="w-5 h-5" />,
            colorText: 'text-secondary'
        },
        { 
            label: t('manager_dashboard.periods.month', 'Mois'), 
            key: 'mois', 
            color: 'bg-accent', 
            icon: <TrendingUp className="w-5 h-5" />,
            colorText: 'text-accent'
        }
    ];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {items.map((item) => {
                const data = kpis[item.key as keyof typeof kpis];
                return (
                    <div key={item.key} className="bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-4">
                                <div className={`flex items-center gap-2 font-bold ${item.colorText} uppercase tracking-tight`}>
                                    {item.icon}
                                    <span>{item.label}</span>
                                </div>
                                <span className={`badge ${item.key === 'jour' ? 'badge-primary' : item.key === 'semaine' ? 'badge-secondary' : 'badge-accent'} font-bold`}>
                                    {Math.round(data.rate)}%
                                </span>
                            </div>
                            
                            <div className="mb-4">
                                <span className="text-3xl font-black text-base-content">
                                    {formatCurrency(data.actual)}
                                </span>
                            </div>
                            
                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-bold uppercase tracking-tighter opacity-50">
                                    <span>{t('manager_dashboard.progression', 'Progression')}</span>
                                    <span>{t('manager_dashboard.target', 'Cible')}: {formatCurrency(data.target)}</span>
                                </div>
                                <ProgressBar 
                                    rate={data.rate} 
                                    colorClass={item.color} 
                                />
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
