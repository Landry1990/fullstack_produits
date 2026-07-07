import React from 'react';
import { useTranslation } from 'react-i18next';
import { User, Calendar, RotateCcw } from 'lucide-react';
import { Button } from '../shadcn/button';
import type { Fournisseur } from '../../hooks/useStockAnalysis';

interface StockAnalysisFiltersProps {
    activeTab: 'unsold' | 'overstock' | 'shortage';
    fournisseurs: Fournisseur[];
    selectedFournisseur: string;
    onFournisseurChange: (id: string) => void;
    unsoldDays: number;
    onUnsoldDaysChange: (days: number) => void;
    onRefresh: () => void;
    loading: boolean;
}

export const StockAnalysisFilters: React.FC<StockAnalysisFiltersProps> = ({
    activeTab,
    fournisseurs,
    selectedFournisseur,
    onFournisseurChange,
    unsoldDays,
    onUnsoldDaysChange,
    onRefresh,
    loading
}) => {
    const { t } = useTranslation(['stock', 'common']);

    return (
        <div className="flex flex-col lg:flex-row gap-4 items-end">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                {/* Supplier Filter */}
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                        <User className="size-3.5" />
                        {t('stock:analyse.filters.supplier')}
                    </label>
                    <select
                        className={`
                            w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm
                            focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20
                            transition-all appearance-none cursor-pointer
                            ${selectedFournisseur === '' ? 'text-slate-400' : 'text-slate-900'}
                        `}
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center' }}
                        value={selectedFournisseur}
                        onChange={(e) => onFournisseurChange(e.target.value)}
                    >
                        <option value="">{t('stock:analyse.filters.all_suppliers')}</option>
                        {fournisseurs.map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                    </select>
                </div>

                {/* Unsold Days Threshold */}
                {activeTab === 'unsold' && (
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                            <Calendar className="size-3.5" />
                            {t('stock:analyse.filters.days_threshold')}
                        </label>
                        <select
                            className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900
                                       focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20
                                       transition-all appearance-none cursor-pointer"
                            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center' }}
                            value={unsoldDays}
                            onChange={(e) => onUnsoldDaysChange(Number(e.target.value))}
                        >
                            <option value={30}>30 {t('stock:analyse.days')}</option>
                            <option value={60}>60 {t('stock:analyse.days')}</option>
                            <option value={90}>90 {t('stock:analyse.days')}</option>
                            <option value={180}>180 {t('stock:analyse.days')}</option>
                            <option value={365}>365 {t('stock:analyse.days')}</option>
                        </select>
                    </div>
                )}
            </div>

            <Button
                onClick={onRefresh}
                disabled={loading}
                className="w-full lg:w-auto shrink-0"
            >
                {loading ? (
                    <span className="animate-spin rounded-full size-4 border-b-2 border-white" />
                ) : (
                    <RotateCcw className="size-4" />
                )}
                {t('stock:analyse.filters.refresh')}
            </Button>
        </div>
    );
};
