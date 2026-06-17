/* eslint-disable react-hooks/exhaustive-deps */
import { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { PackageSearch, ShoppingBag, X, ChevronLeft, ChevronRight, TrendingUp, HelpCircle } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { useStockAnalysis } from '../hooks/useStockAnalysis';
import { StockAnalysisFilters } from './stock/StockAnalysisFilters';
import { StockAnalysisTable } from './stock/StockAnalysisTable';
import StockHealthDashboard from './stock/StockHealthDashboard';

const StockAnalysis = () => {
    const { t } = useTranslation(['stock', 'common']);
    const {
        activeTab,
        setActiveTab,
        fournisseurs,
        selectedFournisseur,
        setSelectedFournisseur,
        data,
        loading,
        error,
        selectedItems,
        unsoldDays,
        setUnsoldDays,
        page,
        setPage,
        actions
    } = useStockAnalysis();

    return (
        <div className="min-h-screen bg-slate-100 p-3 sm:p-4 lg:p-8">
            <Toaster position="top-right" />

            <div className="max-w-[1600px] mx-auto space-y-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="size-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                                <PackageSearch className="size-7" />
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800">
                                    {t('stock:analyse.title')} <span className="text-emerald-600 italic">Stock</span>
                                </h1>
                                <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest mt-1">
                                    {t('stock:analyse.subtitle')}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden">
                    <StockAnalysisFilters
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        fournisseurs={fournisseurs}
                        selectedFournisseur={selectedFournisseur}
                        onFournisseurChange={setSelectedFournisseur}
                        unsoldDays={unsoldDays}
                        onUnsoldDaysChange={setUnsoldDays}
                        onRefresh={actions.fetchData}
                        loading={loading}
                    />
                </div>

                {/* Summary Stats Bar */}
                {!loading && data && activeTab !== 'pilotage' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm flex items-center gap-4">
                            <div className="size-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <PackageSearch className="size-6" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('stock:analyse.total_items', 'Articles Détectés')}</p>
                                <p className="text-2xl font-black text-slate-800">{data.total_items}</p>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm flex items-center gap-4">
                            <div className="size-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center">
                                <TrendingUp className="size-6" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    {activeTab === 'unsold' ? t('stock:analyse.unsold_value', 'Valeur des Invendus') :
                                     activeTab === 'overstock' ? t('stock:analyse.excess_value', 'Valeur des Excédents') :
                                     t('stock:analyse.total_value', 'Valeur Totale')}
                                </p>
                                <p className="text-2xl font-black text-red-500">
                                    {formatCurrency(Math.round(data.total_value))}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Content Area */}
                <div className="space-y-8 animate-in fade-in duration-500">
                    {activeTab === 'pilotage' ? (
                        <StockHealthDashboard />
                    ) : (
                        <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-0 sm:min-h-[480px] lg:min-h-[600px]">
                            {error && (
                                <div className="m-6 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600">
                                    <X className="size-5 shrink-0" />
                                    <span className="font-bold text-sm">{error}</span>
                                </div>
                            )}

                            <StockAnalysisTable
                                items={data?.items || []}
                                loading={loading}
                                activeTab={activeTab}
                                selectedItems={selectedItems}
                                onToggleSelect={actions.toggleSelectItem}
                                onToggleSelectAll={actions.toggleSelectAll}
                            />

                            {/* Pagination Controls */}
                            {!loading && data && data.total_pages && data.total_pages > 1 && (
                                <div className="p-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                                        {t('common:pagination.page', { defaultValue: 'Page' })} <span className="font-black text-slate-700">{data.current_page}</span> {t('common:pagination.of', { defaultValue: 'sur' })} <span className="font-black text-slate-700">{data.total_pages}</span>
                                    </div>

                                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
                                        <button
                                            className="inline-flex items-center justify-center size-8 rounded-xl text-slate-500 hover:bg-white hover:text-emerald-600 transition-all disabled:opacity-30"
                                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                                            disabled={page === 1}
                                        >
                                            <ChevronLeft className="size-4" />
                                        </button>
                                        <div className="px-4 text-sm font-black text-emerald-600">{page}</div>
                                        <button
                                            className="inline-flex items-center justify-center size-8 rounded-xl text-slate-500 hover:bg-white hover:text-emerald-600 transition-all disabled:opacity-30"
                                            onClick={() => setPage((p) => Math.min(data.total_pages || 1, p + 1))}
                                            disabled={page === data.total_pages}
                                        >
                                            <ChevronRight className="size-4" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Floating Action Bar for Selection */}
                            {(activeTab === 'shortage' || activeTab === 'overstock') && selectedItems.size > 0 && (
                                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <div className="bg-emerald-700 text-white p-4 rounded-[24px] shadow-2xl flex items-center justify-between border border-white/10 backdrop-blur-md">
                                        <div className="flex items-center gap-3 ml-2">
                                            <div className="size-10 rounded-xl bg-white/20 flex items-center justify-center font-black">
                                                {selectedItems.size}
                                            </div>
                                            <span className="font-bold text-sm uppercase tracking-tighter">
                                                {t('stock:analyse.shortage.selected')}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <HelpCircle className="size-4 text-white/50 hover:text-white cursor-help transition-colors" />
                                            <button
                                                className="inline-flex items-center justify-center h-10 px-4 rounded-xl text-sm font-black bg-amber-400 text-white gap-2 hover:bg-amber-500 transition-colors"
                                                onClick={actions.handleGenerateOrder}
                                            >
                                                <ShoppingBag className="size-4" />
                                                {t('stock:analyse.shortage.generate_order')}
                                            </button>
                                            <button
                                                className="inline-flex items-center justify-center size-8 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                                                onClick={() => actions.toggleSelectAll()}
                                            >
                                                <X className="size-5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StockAnalysis;
