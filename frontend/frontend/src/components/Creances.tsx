import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Toaster } from 'react-hot-toast';

import { useCreancesData } from '../hooks/useCreancesData';
import { useCreanceActions } from '../hooks/useCreanceActions';
import { CreancesQuickStats } from './creances/CreancesQuickStats';
import { CreancesFilters } from './creances/CreancesFilters';
import { CreancesTable } from './creances/CreancesTable';
import { CreancePaiementModal } from './creances/modals/CreancePaiementModal';
import { CreanceDetailsModal } from './creances/modals/CreanceDetailsModal';
import { BulkPaiementModal } from './creances/modals/BulkPaiementModal';
import SudoValidationModal from './common/SudoValidationModal';

export default function Creances() {
    const { t } = useTranslation();
    const data = useCreancesData();
    
    const apiBaseUrl = useMemo(() => {
        const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '';
        return baseUrl ? String(baseUrl).replace(/\/$/, '') : '';
    }, []);
    const creancesEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/creances/` : '/api/creances/';

    const actions = useCreanceActions({
        creancesEndpoint,
        refresh: data.refresh,
        selectedIds: data.selectedIds,
        setSelectedIds: data.setSelectedIds,
        filteredCreances: data.filteredCreances
    });

    const bulkTotalAmount = useMemo(() => {
        return data.selectedIds.reduce((sum, id) => {
            const f = data.creances.find(c => c.id === id);
            return sum + (f ? parseFloat(f.reste_a_payer) : 0);
        }, 0);
    }, [data.selectedIds, data.creances]);

    return (
        <div className="h-full flex flex-col bg-base-100 overflow-hidden">
            <Toaster position="top-center" />

            {/* Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-base-200 bg-white shrink-0">
                <div>
                    <h1 className="text-3xl font-black text-base-content tracking-tighter">
                        💳 {t('creances.title')}
                    </h1>
                    <p className="text-xs font-bold text-base-content/40 uppercase tracking-widest mt-1">
                        {t('creances.subtitle')}
                    </p>
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col gap-8 pb-12">
                {/* Stats Section */}
                <div className="px-8 mt-8">
                    <CreancesQuickStats 
                        totalDue={data.totals.total}
                        totalPaid={data.totals.paye}
                        totalRemaining={data.totals.reste}
                        debtorsCount={data.groupedClients.length}
                    />
                </div>

                {/* Filters Section */}
                <div className="mx-8 bg-white rounded-3xl border border-base-200 shadow-sm overflow-hidden">
                    <CreancesFilters 
                        clients={data.clients}
                        selectedClient={data.filters.selectedClient}
                        onClientChange={data.setFilters.setSelectedClient}
                        dateDebut={data.filters.dateDebut}
                        onDateDebutChange={data.setFilters.setDateDebut}
                        dateFin={data.filters.dateFin}
                        onDateFinChange={data.setFilters.setDateFin}
                        showHistory={data.filters.showHistory}
                        onHistoryToggle={data.setFilters.setShowHistory}
                        onRefresh={data.refresh}
                        onPrintStatement={() => actions.actions.handleImprimerReleve(
                            data.filters.selectedClient,
                            data.filters.dateDebut,
                            data.filters.dateFin
                        )}
                        loading={data.loading}
                    />

                    {/* Bulk Action Bar */}
                    {data.filters.selectedClient && data.selectedIds.length > 0 && !data.filters.showHistory && (
                        <div className="px-6 py-4 bg-primary/5 border-t border-primary/10 flex items-center justify-between animate-in slide-in-from-top duration-300">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-xl shadow-sm">
                                    <span className="text-xs font-black text-primary uppercase">{data.selectedIds.length}</span>
                                </div>
                                <div className="text-xs font-bold text-primary uppercase tracking-widest">
                                    Factures sélectionnées pour règlement groupé
                                </div>
                            </div>
                            <button 
                                onClick={actions.actions.handleBulkPayment} 
                                className="btn btn-sm btn-primary px-6 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20"
                            >
                                💰 Payer la sélection ({(Math.round(bulkTotalAmount)).toLocaleString()} F)
                            </button>
                        </div>
                    )}
                </div>

                {/* Main Content Table */}
                <div className="mx-8 bg-white rounded-3xl border border-base-200 shadow-sm overflow-hidden flex-1 relative min-h-[400px]">
                    <CreancesTable 
                        mode={data.filters.selectedClient ? 'invoices' : 'clients'}
                        groupedClients={data.groupedClients}
                        filteredCreances={data.filteredCreances}
                        loading={data.loading}
                        showHistory={data.filters.showHistory}
                        selectedIds={data.selectedIds}
                        onSelectAll={(e) => {
                            if (e.target.checked) {
                                const ids = data.filteredCreances.filter(c => parseFloat(c.reste_a_payer) > 0).map(c => c.id);
                                data.setSelectedIds(ids);
                            } else {
                                data.setSelectedIds([]);
                            }
                        }}
                        onSelectOne={(id) => {
                            data.setSelectedIds(prev => 
                                prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
                            );
                        }}
                        onViewClient={data.setFilters.setSelectedClient}
                        onViewDetails={actions.actions.handleOpenDetailsModal}
                        onPay={actions.actions.handleOpenPaiementModal}
                        sortConfig={{
                            key: data.filters.sortConfig.key,
                            direction: data.filters.sortConfig.direction
                        }}
                        onSort={data.setFilters.handleSort}
                    />
                </div>
            </div>

            {/* Error handling */}
            {data.error && (
                <div className="toast toast-bottom toast-center">
                    <div className="alert alert-error shadow-lg">
                        <span>{data.error}</span>
                    </div>
                </div>
            )}

            {/* Modals */}
            <CreancePaiementModal 
                isOpen={actions.modals.isPaiementModalOpen}
                onClose={() => actions.modals.setIsPaiementModalOpen(false)}
                creance={actions.selectedCreance}
                form={actions.form}
                onConfirm={actions.actions.handleAjouterPaiement}
            />

            <CreanceDetailsModal 
                isOpen={actions.modals.isDetailsModalOpen}
                onClose={() => actions.modals.setIsDetailsModalOpen(false)}
                creance={actions.selectedCreance}
                onPrintReceipt={actions.actions.handlePrintDirectReceipt}
            />

            <BulkPaiementModal 
                isOpen={actions.modals.isBulkModalOpen}
                onClose={() => actions.modals.setIsBulkModalOpen(false)}
                count={data.selectedIds.length}
                totalAmount={bulkTotalAmount}
                form={actions.form}
                onConfirm={actions.actions.confirmBulkPayment}
            />

            <SudoValidationModal 
                isOpen={actions.modals.sudoState.isOpen}
                onClose={actions.modals.closeSudo}
                onValidate={actions.modals.sudoState.onValidate}
                saving={false}
                title={actions.modals.sudoState.title}
                message={actions.modals.sudoState.message}
            />
        </div>
    );
}
