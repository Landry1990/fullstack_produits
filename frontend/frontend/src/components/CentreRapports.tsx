import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCentreRapports } from '../hooks/useCentreRapports';
import { ReportSidebar } from './dashboard/reports/ReportSidebar';
import { ReportFilters } from './dashboard/reports/ReportFilters';
import { ReportResults } from './dashboard/reports/ReportResults';
import { Menu, Printer, Download, LayoutPanelTop, Play } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import type { QueryDefinition } from '../hooks/useCentreRapports';

export default function CentreRapports() {
    const { t } = useTranslation(['reports', 'common']);
    const { state, actions } = useCentreRapports();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const { 
        selectedQuery, 
        params, 
        results, 
        pagination, 
        loading, 
        error,
        clientSearch,
        filteredClients,
        showClientDropdown,
        selectedClientName,
        supplierSearch,
        filteredSuppliers,
        showSupplierDropdown,
        selectedSupplierName,
        userSearch,
        filteredUsers,
        showUserDropdown,
        selectedUserName,
        familleSearch,
        filteredFamilles,
        showFamilleDropdown,
        selectedFamilleName,
        presets
    } = state;

    const handleSelectQuery = (query: QueryDefinition) => {
        actions.handleSelectQuery(query);
        setMobileMenuOpen(false);
    };

    // Si on repasse en desktop, on ferme le menu (évite un état "coincé")
    useEffect(() => {
        const onResize = () => {
            if (window.matchMedia('(min-width: 768px)').matches) {
                setMobileMenuOpen(false);
            }
        };
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    return (
        <div className="h-screen flex bg-slate-100 overflow-hidden">
            <Toaster position="top-right" />
            
            {/* Mobile drawer backdrop */}
            {mobileMenuOpen && (
                <button
                    type="button"
                    className="md:hidden fixed inset-0 z-40 bg-black/40"
                    aria-label="Fermer le menu"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar - desktop: visible; mobile: drawer */}
            <div
                className={[
                    'print:hidden',
                    'md:block',
                    mobileMenuOpen ? 'fixed inset-y-0 left-0 z-50 translate-x-0' : 'hidden',
                ].join(' ')}
            >
                <ReportSidebar
                    selectedQuery={selectedQuery}
                    onSelect={handleSelectQuery}
                    onClose={() => setMobileMenuOpen(false)}
                />
            </div>
            
            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Mobile top bar (menu) */}
                <div className="md:hidden border-b border-slate-200 bg-white/90 backdrop-blur-sm px-3 py-2 flex items-center justify-between print:hidden z-10">
                    <div className="min-w-0">
                        <div className="text-xs font-black uppercase tracking-widest text-slate-400">
                            {t('title', { defaultValue: 'Centre de Rapports' })}
                        </div>
                        <div className="text-xs font-bold text-slate-600 truncate">
                            {selectedQuery
                                ? t(`queries.${selectedQuery.id}.name`, { defaultValue: selectedQuery.name })
                                : t('select_query_prompt', { defaultValue: 'Sélectionnez un rapport' })
                            }
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setMobileMenuOpen(v => !v)}
                        className="size-8 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
                        aria-label="Ouvrir le menu"
                    >
                        <Menu className="size-5" />
                    </button>
                </div>

                {/* Dashboard Area */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 custom-scrollbar bg-slate-100">
                    <div className="max-w-7xl mx-auto space-y-6">
                        
                        {selectedQuery ? (
                            <>
                                {/* Unified Header & Filters Card */}
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col animate-in slide-in-from-top-4 duration-500">
                                    <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col gap-4 md:flex-row md:justify-between md:items-center md:gap-6">
                                        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                            <div className="size-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                                                <LayoutPanelTop className="size-6" />
                                            </div>
                                            <div>
                                                <h1 className="text-2xl font-bold text-slate-800 tracking-tight uppercase">
                                                    {t(`queries.${selectedQuery.id}.name`, { defaultValue: selectedQuery.name })}
                                                </h1>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                    {t(`queries.${selectedQuery.id}.description`, { defaultValue: selectedQuery.description || '' })}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto shrink-0 print:hidden">
                                            {/* Toggle vue par produit — uniquement pour detail_marges_lots */}
                                            {selectedQuery.id === 'detail_marges_lots' && (
                                                <div className="flex bg-slate-200 p-1 rounded-xl border border-slate-300 w-full sm:w-auto">
                                                    <button
                                                        onClick={() => actions.setParams({ ...params, grouper_par: '' })}
                                                        className={`h-10 rounded-lg flex-1 font-bold uppercase tracking-wider text-xs transition-all ${
                                                          !params.grouper_par ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-300'
                                                        }`}
                                                    >
                                                        Par lot
                                                    </button>
                                                    <button
                                                        onClick={() => actions.setParams({ ...params, grouper_par: 'produit' })}
                                                        className={`h-10 rounded-lg flex-1 font-bold uppercase tracking-wider text-xs transition-all ${
                                                          params.grouper_par === 'produit' ? 'bg-red-500 text-white shadow' : 'text-slate-500 hover:bg-slate-300'
                                                        }`}
                                                    >
                                                        ⚠ Par produit
                                                    </button>
                                                </div>
                                            )}
                                            <button
                                                onClick={() => actions.executeQuery()}
                                                disabled={loading}
                                                className="inline-flex items-center justify-center gap-3 h-12 px-6 bg-blue-600 text-white rounded-xl shadow-sm hover:bg-blue-700 transition-colors font-black uppercase tracking-widest text-xs w-full sm:w-auto disabled:opacity-60 group"
                                            >
                                                {loading ? (
                                                    <span className="size-4 border-2 border-blue-300 border-t-white rounded-full animate-spin"></span>
                                                ) : (
                                                    <Play className="size-4 fill-current group-hover:scale-110 transition-transform" />
                                                )}
                                                <span className="font-black uppercase tracking-widest text-xs">
                                                    {t('execute', 'Générer')}
                                                </span>
                                            </button>
                                            
                                            <div className="flex bg-slate-200 p-1 rounded-xl border border-slate-300 w-full sm:w-auto justify-stretch sm:justify-start">
                                                <button 
                                                    className="h-10 rounded-lg gap-2 text-slate-500 hover:text-blue-600 hover:bg-white transition-colors flex-1 flex items-center justify-center"
                                                    onClick={() => window.print()}
                                                    title={t('common:print')}
                                                >
                                                    <Printer className="size-4" />
                                                </button>
                                                <button 
                                                    className="h-10 rounded-lg gap-2 text-slate-500 hover:text-emerald-600 hover:bg-white transition-colors flex-1 flex items-center justify-center disabled:opacity-40"
                                                    onClick={actions.downloadExcel}
                                                    disabled={!results}
                                                    title="Exporter Excel"
                                                >
                                                    <Download className="size-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Filters Section (integrated in card) */}
                                    <div className="p-6 bg-slate-50/30">
                                        <ReportFilters 
                                            selectedQuery={selectedQuery}
                                            params={params}
                                            onParamsChange={actions.setParams}
                                            safeDate={actions.safeDate}
                                            clientSearch={{
                                                query: clientSearch,
                                                filtered: filteredClients,
                                                showDropdown: showClientDropdown,
                                                selectedName: selectedClientName
                                            }}
                                            clientActions={actions.clientActions}
                                            supplierSearch={{
                                                query: supplierSearch,
                                                filtered: filteredSuppliers,
                                                showDropdown: showSupplierDropdown,
                                                selectedName: selectedSupplierName
                                            }}
                                            supplierActions={actions.supplierActions}
                                            userSearch={{
                                                query: userSearch,
                                                filtered: filteredUsers,
                                                showDropdown: showUserDropdown,
                                                selectedName: selectedUserName
                                            }}
                                            userActions={actions.userActions}
                                            familleSearch={{
                                                query: familleSearch,
                                                filtered: filteredFamilles,
                                                showDropdown: showFamilleDropdown,
                                                selectedName: selectedFamilleName
                                            }}
                                            familleActions={actions.familleActions}
                                            presets={actions.presets}
                                            presetList={presets}
                                        />
                                    </div>
                                </div>

                                {/* Error Alert */}
                                {error && (
                                    <div className="flex items-center gap-3 bg-red-500 text-white rounded-2xl shadow-sm px-5 py-4 animate-in zoom-in duration-300">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span className="font-bold">{error}</span>
                                    </div>
                                )}

                                {/* Results Section */}
                                <div className="min-h-[400px] flex flex-col">
                                    {loading && !results ? (
                                        <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-sm border border-slate-200">
                                            <div className="flex gap-1 mb-4">
                                              {[0,1,2,3].map(i => (
                                                <div key={i} className="w-1.5 bg-blue-500 rounded-full animate-bounce" style={{height: '2rem', animationDelay: `${i * 0.1}s`}}></div>
                                              ))}
                                            </div>
                                            <p className="text-xs font-black uppercase tracking-[0.3em] text-blue-600 animate-pulse">
                                                Calcul des données en cours…
                                            </p>
                                        </div>
                                    ) : (
                                        <ReportResults 
                                            selectedQuery={selectedQuery}
                                            results={results}
                                            pagination={pagination}
                                            loading={loading}
                                            onPageChange={actions.handlePageChange}
                                            currentParams={params}
                                            onFilterChange={(key, value) => {
                                                const extra: Record<string, any> = { [key]: value || undefined, page: undefined };
                                                actions.setParams({ ...params, ...extra });
                                                actions.executeQuery(undefined, extra);
                                            }}
                                        />
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="h-[calc(100vh-100px)] flex flex-col items-center justify-center text-slate-300 animate-in fade-in duration-1000">
                                <div className="size-32 rounded-full bg-slate-200/50 flex items-center justify-center mb-6 border border-slate-200">
                                    <LayoutPanelTop className="size-16 text-slate-300" />
                                </div>
                                <h2 className="text-2xl font-black uppercase tracking-[0.2em]">
                                    {t('title', 'Centre de Rapports')}
                                </h2>
                                <p className="text-xs font-bold uppercase tracking-widest mt-2 text-slate-400">
                                    {t('select_query_prompt', 'Sélectionnez un rapport pour commencer')}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Print Styles */}
            <style>{`
                @media print {
                    .h-screen { height: auto !important; overflow: visible !important; }
                    .flex-1 { overflow: visible !important; }
                    .p-8 { padding: 0 !important; }
                    .bg-base-200 { background: white !important; }
                    .shadow-sm, .shadow-lg { shadow: none !important; }
                    .card, .rounded-2xl { border: 1px solid #eee !important; border-radius: 0 !important; }
                }
            `}</style>
        </div>
    );
}

