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
        <div className="min-h-screen bg-base-200 p-3 sm:p-4 lg:p-8">
            <Toaster position="top-right" />
            
            <div className="max-w-[1600px] mx-auto space-y-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="size-12 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                                <PackageSearch className="size-7" />
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-base-content">
                                    {t('stock:analyse.title')} <span className="text-primary italic">Stock</span>
                                </h1>
                                <p className="text-sm font-semibold text-base-content/40 uppercase tracking-widest mt-1">
                                    {t('stock:analyse.subtitle')}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="bg-base-100 rounded-[32px] shadow-sm border border-base-200 overflow-hidden">
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
                        <div className="bg-base-100 p-6 rounded-[24px] border border-base-200 shadow-sm flex items-center gap-4">
                            <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                                <PackageSearch className="size-6" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-base-content/30 uppercase tracking-widest">{t('stock:analyse.total_items', 'Articles Détectés')}</p>
                                <p className="text-2xl font-black text-base-content">{data.total_items}</p>
                            </div>
                        </div>
                        
                        <div className="bg-base-100 p-6 rounded-[24px] border border-base-200 shadow-sm flex items-center gap-4">
                            <div className="size-12 rounded-2xl bg-error/10 text-error flex items-center justify-center">
                                <TrendingUp className="size-6" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-base-content/30 uppercase tracking-widest">
                                    {activeTab === 'unsold' ? t('stock:analyse.unsold_value', 'Valeur des Invendus') : 
                                     activeTab === 'overstock' ? t('stock:analyse.excess_value', 'Valeur des Excédents') : 
                                     t('stock:analyse.total_value', 'Valeur Totale')}
                                </p>
                                <p className="text-2xl font-black text-error">
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
                        <div className="bg-base-100 rounded-[32px] shadow-sm border border-base-200 overflow-hidden flex flex-col min-h-0 sm:min-h-[480px] lg:min-h-[600px]">
                            {error && (
                                <div className="m-6 alert alert-error shadow-sm rounded-2xl">
                                    <X className="size-5" />
                                    <span className="font-bold">{error}</span>
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
                                <div className="p-6 border-t border-base-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div className="text-sm font-medium text-base-content/50 uppercase tracking-wider">
                                        {t('common:pagination.page', { defaultValue: 'Page' })} <span className="font-black text-base-content">{data.current_page}</span> {t('common:pagination.of', { defaultValue: 'sur' })} <span className="font-black text-base-content">{data.total_pages}</span>
                                    </div>
                                    
                                    <div className="join join-horizontal shadow-sm">
                                        <button 
                                            className="join-item btn btn-sm bg-base-100 hover:bg-base-200 border-base-200 text-base-content"
                                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                                            disabled={page === 1}
                                        >
                                            <ChevronLeft className="size-4" />
                                        </button>
                                        
                                        <button className="join-item btn btn-sm px-6 bg-base-100 border-base-200 text-base-content font-bold pointer-events-none">
                                            {page}
                                        </button>

                                        <button 
                                            className="join-item btn btn-sm bg-base-100 hover:bg-base-200 border-base-200 text-base-content"
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
                                    <div className="bg-primary text-primary-content p-4 rounded-[24px] shadow-2xl flex items-center justify-between border border-white/10 backdrop-blur-md">
                                        <div className="flex items-center gap-3 ml-2">
                                            <div className="size-10 rounded-xl bg-base-100/20 flex items-center justify-center font-black">
                                                {selectedItems.size}
                                            </div>
                                            <span className="font-bold text-sm uppercase tracking-tighter">
                                                {t('stock:analyse.shortage.selected')}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="tooltip tooltip-top tooltip-accent before:max-w-[260px] before:text-left before:text-[11px] before:leading-relaxed before:font-normal before:normal-case before:tracking-normal"
                                                data-tip={activeTab === 'shortage'
                                                    ? "Qté suggérée = ARRONDI_SUP(vente_moy/jour × 30j) − stock actuel\n\nSi ventes inconnues : stock_minimum − stock actuel\n\nObjectif : couvrir 30 jours de stock."
                                                    : "En surstock, les quantités affichées sont à titre indicatif.\n\nFormule : ARRONDI_SUP(vente_moy/jour × 30j) − stock actuel\n\nVérifiez avant de valider la commande."}
                                            >
                                                <HelpCircle className="size-4 text-primary-content/50 hover:text-primary-content cursor-help transition-colors" />
                                            </div>
                                            <button
                                                className="btn btn-sm btn-accent gap-2 rounded-xl px-4 h-10 font-black border-none"
                                                onClick={actions.handleGenerateOrder}
                                            >
                                                <ShoppingBag className="size-4" />
                                                {t('stock:analyse.shortage.generate_order')}
                                            </button>
                                            <button
                                                className="btn btn-sm btn-ghost btn-circle text-primary-content/60 hover:text-white"
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
