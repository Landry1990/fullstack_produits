import { useTranslation } from 'react-i18next';
import { useCentreRapports } from '../hooks/useCentreRapports';
import { ReportSidebar } from './dashboard/reports/ReportSidebar';
import { ReportFilters } from './dashboard/reports/ReportFilters';
import { ReportResults } from './dashboard/reports/ReportResults';
import { Printer, Download, LayoutPanelTop, Play } from 'lucide-react';
import { Toaster } from 'react-hot-toast';

export default function CentreRapports() {
    const { t } = useTranslation(['reports', 'common']);
    const { state, actions } = useCentreRapports();
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
        selectedClientName
    } = state;

    return (
        <div className="h-screen flex bg-base-200 overflow-hidden">
            <Toaster position="top-right" />
            
            {/* Sidebar */}
            <ReportSidebar 
                selectedQuery={selectedQuery} 
                onSelect={actions.handleSelectQuery} 
            />
            
            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Dashboard Area */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar bg-base-200">
                    <div className="max-w-7xl mx-auto space-y-6">
                        
                        {selectedQuery ? (
                            <>
                                {/* Unified Header & Filters Card */}
                                <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 flex flex-col overflow-hidden animate-in slide-in-from-top-4 duration-500">
                                    <div className="p-6 border-b border-base-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                                                <LayoutPanelTop className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h1 className="text-2xl font-bold text-base-content tracking-tight uppercase">
                                                    {t(`queries.${selectedQuery.id}.name`, { defaultValue: selectedQuery.name })}
                                                </h1>
                                                <p className="text-xs font-bold text-base-content/40 uppercase tracking-widest mt-0.5">
                                                    {t(`queries.${selectedQuery.id}.description`, { defaultValue: selectedQuery.description || '' })}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 shrink-0 print:hidden">
                                            <button
                                                onClick={() => actions.executeQuery()}
                                                disabled={loading}
                                                className="btn btn-primary h-12 px-6 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all gap-3 border-none group"
                                            >
                                                {loading ? (
                                                    <span className="loading loading-spinner loading-xs"></span>
                                                ) : (
                                                    <Play className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
                                                )}
                                                <span className="font-black uppercase tracking-widest text-xs">
                                                    {t('execute', 'Générer')}
                                                </span>
                                            </button>
                                            
                                            <div className="flex bg-base-200 p-1 rounded-xl border border-base-300">
                                                <button 
                                                    className="btn btn-ghost btn-sm h-10 rounded-lg gap-2 text-base-content/60 hover:text-primary transition-colors"
                                                    onClick={() => window.print()}
                                                    title={t('common.print')}
                                                >
                                                    <Printer className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    className="btn btn-ghost btn-sm h-10 rounded-lg gap-2 text-base-content/60 hover:text-success transition-colors"
                                                    onClick={actions.downloadExcel}
                                                    disabled={!results}
                                                    title="Exporter Excel"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Filters Section (integrated in card) */}
                                    <div className="p-6 bg-base-50/30">
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
                                            clientActions={{
                                                setQuery: actions.setClientSearch,
                                                setShowDropdown: actions.setShowClientDropdown,
                                                setSelectedName: actions.setSelectedClientName
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Error Alert */}
                                {error && (
                                    <div className="alert alert-error rounded-2xl shadow-sm border-none text-white animate-in zoom-in duration-300">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span className="font-bold">{error}</span>
                                    </div>
                                )}

                                {/* Results Section */}
                                <div className="min-h-[400px] flex flex-col">
                                    {loading && !results ? (
                                        <div className="flex-1 flex flex-col items-center justify-center p-12 bg-base-100 rounded-2xl shadow-sm border border-base-300">
                                            <span className="loading loading-bars loading-lg text-primary mb-4"></span>
                                            <p className="text-xs font-black uppercase tracking-[0.3em] text-primary animate-pulse">
                                                Calcul des données en cours...
                                            </p>
                                        </div>
                                    ) : (
                                        <ReportResults 
                                            selectedQuery={selectedQuery}
                                            results={results}
                                            pagination={pagination}
                                            loading={loading}
                                            onPageChange={actions.handlePageChange}
                                        />
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="h-[calc(100vh-100px)] flex flex-col items-center justify-center text-base-content/20 animate-in fade-in duration-1000">
                                <div className="w-32 h-32 rounded-full bg-base-300/30 flex items-center justify-center mb-6 border border-base-300/50">
                                    <LayoutPanelTop className="w-16 h-16 opacity-20" />
                                </div>
                                <h2 className="text-2xl font-black uppercase tracking-[0.2em]">
                                    {t('title', 'Centre de Rapports')}
                                </h2>
                                <p className="text-xs font-bold uppercase tracking-widest mt-2 opacity-50">
                                    {t('select_query_prompt', 'Sélectionnez un rapport pour commencer')}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Print Styles */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    .h-screen { height: auto !important; overflow: visible !important; }
                    .flex-1 { overflow: visible !important; }
                    .p-8 { padding: 0 !important; }
                    .bg-base-200 { background: white !important; }
                    .shadow-sm, .shadow-lg { shadow: none !important; }
                    .card, .rounded-2xl { border: 1px solid #eee !important; border-radius: 0 !important; }
                }
            `}} />
        </div>
    );
}
