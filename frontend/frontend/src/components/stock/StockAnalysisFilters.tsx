import React from 'react';
import { useTranslation } from 'react-i18next';
import { User, Calendar, RotateCcw, AlertTriangle, TrendingUp, Accessibility, Sparkles } from 'lucide-react';
import type { Fournisseur } from '../../hooks/useStockAnalysis';

interface StockAnalysisFiltersProps {
    activeTab: 'pilotage' | 'unsold' | 'overstock' | 'shortage';
    onTabChange: (tab: 'pilotage' | 'unsold' | 'overstock' | 'shortage') => void;
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
    onTabChange,
    fournisseurs,
    selectedFournisseur,
    onFournisseurChange,
    unsoldDays,
    onUnsoldDaysChange,
    onRefresh,
    loading
}) => {
    const { t } = useTranslation(['stock', 'common']);

    const tabs = [
        { id: 'pilotage', label: t('stock:analyse.tabs.pilotage'), icon: <Sparkles className="size-4" /> },
        { id: 'unsold', label: t('stock:analyse.tabs.unsold'), icon: <Accessibility className="size-4" /> },
        { id: 'overstock', label: t('stock:analyse.tabs.overstock'), icon: <TrendingUp className="size-4" /> },
        { id: 'shortage', label: t('stock:analyse.tabs.shortage'), icon: <AlertTriangle className="size-4" /> }
    ];

    return (
        <div className="flex flex-col gap-6 p-4 sm:p-6">
            {/* Tabs Header */}
            <div className="w-full max-w-full overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0 [scrollbar-gutter:stable]">
                <div className="inline-flex min-w-min items-center gap-2 bg-slate-100 p-1.5 rounded-[20px] shadow-inner">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id as any)}
                            className={`inline-flex items-center justify-center px-3 py-1.5 text-sm rounded-[14px] transition-all gap-2 shrink-0 font-bold ${
                                activeTab === tab.id
                                ? (tab.id === 'pilotage' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-white text-emerald-600 shadow-sm font-black')
                                : 'text-slate-400 hover:text-slate-700 hover:bg-white/50'
                            }`}
                        >
                            {tab.icon}
                            <span className="whitespace-nowrap">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {activeTab !== 'pilotage' && (
                <div className="bg-slate-50 p-4 rounded-[32px] border border-slate-200 flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Supplier Filter */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 ml-1">
                                <User className="size-3" /> {t('stock:analyse.filters.supplier')}
                            </label>
                            <select
                                className={`w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm font-bold focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all ${selectedFournisseur === '' ? 'text-slate-400' : 'text-slate-700'}`}
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
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 ml-1">
                                    <Calendar className="size-3" /> {t('stock:analyse.filters.days_threshold')}
                                </label>
                                <select
                                    className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
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

                    <div className="shrink-0">
                        <button
                            className="inline-flex items-center justify-center h-9 px-4 rounded-xl text-sm font-bold gap-2 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                            onClick={onRefresh}
                            disabled={loading}
                        >
                            {loading ? <span className="animate-spin rounded-full size-4 border-b-2 border-white"></span> : <RotateCcw className="size-4" />}
                            {t('stock:analyse.filters.refresh')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
