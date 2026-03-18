/* eslint-disable react-hooks/exhaustive-deps */
import { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { PackageSearch, ShoppingBag, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStockAnalysis } from '../hooks/useStockAnalysis';
import { StockAnalysisStats } from './stock/StockAnalysisStats';
import { StockAnalysisFilters } from './stock/StockAnalysisFilters';
import { StockAnalysisTable } from './stock/StockAnalysisTable';

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
        <div className="min-h-screen bg-[#F8FAFC] p-4 lg:p-8">
            <Toaster position="top-right" />
            
            <div className="max-w-[1600px] mx-auto space-y-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                                <PackageSearch className="w-7 h-7" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black tracking-tight text-base-content">
                                    {t('stock:analyse.title')} <span className="text-primary italic">Stock</span>
                                </h1>
                                <p className="text-sm font-semibold text-base-content/40 uppercase tracking-widest mt-1">
                                    {t('stock:analyse.subtitle')}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Stats Dashboard */}
                {data && (
                    <StockAnalysisStats 
                        totalItems={data.total_items}
                        totalValue={data.total_value}
                        activeTab={activeTab}
                        criticalCount={data.critical_count}
                        warningCount={data.warning_count}
                        supplierName={data.fournisseur}
                    />
                )}

                {/* Filters & Tabs Section */}
                <div className="bg-white rounded-[32px] shadow-sm border border-base-200 overflow-hidden">
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

                {/* Table Section */}
                <div className="bg-white rounded-[32px] shadow-sm border border-base-200 overflow-hidden flex flex-col min-h-[600px] relative">
                    {error && (
                        <div className="m-6 alert alert-error shadow-sm rounded-2xl">
                            <X className="w-5 h-5" />
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
                                    className="join-item btn btn-sm bg-white hover:bg-base-200 border-base-200 text-base-content"
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                
                                <button className="join-item btn btn-sm px-6 bg-white border-base-200 text-base-content font-bold pointer-events-none">
                                    {page}
                                </button>

                                <button 
                                    className="join-item btn btn-sm bg-white hover:bg-base-200 border-base-200 text-base-content"
                                    onClick={() => setPage((p) => Math.min(data.total_pages || 1, p + 1))}
                                    disabled={page === data.total_pages}
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Floating Action Bar for Selection */}
                    {activeTab === 'shortage' && selectedItems.size > 0 && (
                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 w-full max-w-md px-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="bg-primary text-primary-content p-4 rounded-[24px] shadow-2xl flex items-center justify-between border border-white/10 backdrop-blur-md">
                                <div className="flex items-center gap-3 ml-2">
                                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-black">
                                        {selectedItems.size}
                                    </div>
                                    <span className="font-bold text-sm uppercase tracking-tighter">
                                        {t('stock:analyse.shortage.selected')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        className="btn btn-sm btn-accent gap-2 rounded-xl px-4 h-10 font-black border-none"
                                        onClick={actions.handleGenerateOrder}
                                    >
                                        <ShoppingBag className="w-4 h-4" />
                                        {t('stock:analyse.shortage.generate_order')}
                                    </button>
                                    <button
                                        className="btn btn-sm btn-ghost btn-circle text-primary-content/60 hover:text-white"
                                        onClick={() => actions.toggleSelectAll()}
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StockAnalysis;
