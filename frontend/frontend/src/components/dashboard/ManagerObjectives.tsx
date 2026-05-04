import React from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Target } from 'lucide-react';

import { formatCurrency } from '../../utils/formatters';
import { formatDate, getLocale } from '../../utils/dateUtils';

interface ManagerObjectivesProps {
    currentObj: any;
    onEdit: (periode: string, obj: any) => void;
    onRefresh: () => void;
}

export const ManagerObjectives: React.FC<ManagerObjectivesProps> = ({ currentObj, onEdit, onRefresh }) => {
    const { t } = useTranslation(['dashboard', 'common']);
    const currencySymbol = t('common:currency_symbol', { defaultValue: 'F' });

    const formatCurrencyLocal = (amount: number) => formatCurrency(amount, getLocale(), currencySymbol);

    const objectiveTypes = [
        { label: t('manager_dashboard.periods.daily', 'Journalier'), code: 'JOUR', color: 'text-primary' },
        { label: t('manager_dashboard.periods.weekly', 'Hebdomadaire'), code: 'SEMAINE', color: 'text-secondary' },
        { label: t('manager_dashboard.periods.monthly', 'Mensuel'), code: 'MOIS', color: 'text-accent' }
    ];

    return (
        <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-base-200 flex justify-between items-center">
                <h3 className="text-lg font-bold text-base-content flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" /> 
                    {t('manager_dashboard.active_objectives', 'Objectifs Actifs')}
                </h3>
                <button 
                    onClick={onRefresh} 
                    className="btn btn-ghost btn-sm btn-circle"
                    title={t('common:refresh')}
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>
            
            <div className="p-6 space-y-3">
                {objectiveTypes.map(p => {
                    const obj = currentObj ? (currentObj as any)[p.code.toLowerCase()] : null;
                    return (
                        <div key={p.code} className="flex items-center justify-between p-4 rounded-xl border border-base-200 hover:bg-base-200/50 transition-all group">
                            <div>
                                <span className={`text-[10px] font-bold uppercase tracking-widest ${p.color}`}>{p.label}</span>
                                <div className="font-black text-base-content text-lg">
                                    {obj ? formatCurrencyLocal(Number(obj.ca_objectif)) : t('manager_dashboard.not_defined', 'Non défini')}
                                </div>
                                {obj && obj.date_debut && (
                                    <div className="text-[10px] text-base-content/40 font-bold uppercase mt-0.5">
                                        {t('manager_dashboard.since_date', { 
                                            date: formatDate(obj.date_debut) 
                                        })}
                                    </div>
                                )}
                            </div>
                            <button 
                                className="btn btn-ghost btn-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity font-bold uppercase"
                                onClick={() => onEdit(p.code, obj)}
                            >
                                {t('manager_dashboard.modify', 'Modifier')}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

