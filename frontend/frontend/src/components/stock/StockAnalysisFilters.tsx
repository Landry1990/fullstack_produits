import React from 'react';
import { useTranslation } from 'react-i18next';
import { User, Calendar, RotateCcw, AlertTriangle, TrendingUp, Accessibility } from 'lucide-react';
import type { Fournisseur } from '../../hooks/useStockAnalysis';

interface StockAnalysisFiltersProps {
    activeTab: 'unsold' | 'overstock' | 'shortage';
    onTabChange: (tab: 'unsold' | 'overstock' | 'shortage') => void;
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
    const { t } = useTranslation();

    const tabs = [
        { id: 'unsold', label: t('stock.analyse.tabs.unsold'), icon: <Accessibility className="w-4 h-4" /> },
        { id: 'overstock', label: t('stock.analyse.tabs.overstock'), icon: <TrendingUp className="w-4 h-4" /> },
        { id: 'shortage', label: t('stock.analyse.tabs.shortage'), icon: <AlertTriangle className="w-4 h-4" /> }
    ];

    return (
        <div className="flex flex-col gap-6 p-6">
            {/* Tabs Header */}
            <div className="flex items-center gap-2 bg-base-200 p-1.5 rounded-[20px] self-start shadow-inner">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id as any)}
                        className={`btn btn-sm px-6 rounded-[14px] border-none transition-all gap-2 ${
                            activeTab === tab.id 
                            ? 'bg-white text-primary shadow-sm font-black' 
                            : 'btn-ghost text-base-content/40 font-bold hover:bg-white/50'
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex flex-col lg:flex-row gap-6 items-end border-t border-base-200 pt-6">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Supplier Filter */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-base-content/40 flex items-center gap-1.5 ml-1">
                            <User className="w-3 h-3" /> {t('stock.analyse.filters.supplier')}
                        </label>
                        <select 
                            className="select select-sm select-bordered w-full font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                            value={selectedFournisseur}
                            onChange={(e) => onFournisseurChange(e.target.value)}
                        >
                            <option value="">{t('stock.analyse.filters.all_suppliers')}</option>
                            {fournisseurs.map(f => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Unsold Days Threshold */}
                    {activeTab === 'unsold' && (
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-base-content/40 flex items-center gap-1.5 ml-1">
                                <Calendar className="w-3 h-3" /> {t('stock.analyse.filters.days_threshold')}
                            </label>
                            <select 
                                className="select select-sm select-bordered w-full font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                                value={unsoldDays}
                                onChange={(e) => onUnsoldDaysChange(Number(e.target.value))}
                            >
                                <option value={30}>30 {t('stock.analyse.days')}</option>
                                <option value={60}>60 {t('stock.analyse.days')}</option>
                                <option value={90}>90 {t('stock.analyse.days')}</option>
                                <option value={180}>180 {t('stock.analyse.days')}</option>
                                <option value={365}>365 {t('stock.analyse.days')}</option>
                            </select>
                        </div>
                    )}
                </div>

                <div className="shrink-0">
                    <button 
                        className={`btn btn-sm ${loading ? 'btn-disabled' : 'btn-primary'} gap-2 shadow-sm rounded-xl px-6`}
                        onClick={onRefresh}
                        disabled={loading}
                    >
                        {loading ? <span className="loading loading-spinner loading-xs"></span> : <RotateCcw className="w-4 h-4" />}
                        {t('stock.analyse.filters.refresh')}
                    </button>
                </div>
            </div>
        </div>
    );
};
