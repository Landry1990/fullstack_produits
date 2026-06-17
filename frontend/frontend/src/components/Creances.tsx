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

import { Wallet, DollarSign } from 'lucide-react';
import { normalizeNumberInput, formatCurrency } from '../utils/formatters';

export default function Creances() {
    const { t } = useTranslation(['creances', 'common']);
    const data = useCreancesData();
    const actions = useCreanceActions({
        refresh: data.refresh,
        selectedIds: data.selectedIds,
        setSelectedIds: data.setSelectedIds,
        filteredCreances: data.filteredCreances,
        updateLocalCreance: (data as any).updateLocalCreance,
        updateLocalSynthese: (data as any).updateLocalSynthese
    });

    const bulkTotalAmount = useMemo(() => {
        return data.selectedIds.reduce((sum, id) => {
            const f = data.creances.find(c => c.id === id);
            return sum + (f ? normalizeNumberInput(f.reste_a_payer) : 0);
        }, 0);
    }, [data.selectedIds, data.creances]);

    return (
        <div className="min-h-screen bg-slate-100 p-6 space-y-6 font-sans overflow-auto">
            <Toaster position="top-center" />

            {/* Header Area */}
            <div className="flex flex-col gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white/50">
                        <div>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                                    <Wallet className="size-6" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                                        {t('creances:title')}
                                    </h1>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                        {t('creances:subtitle')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Selection Bar inside Header if active */}
                        {data.filters.selectedClient && data.selectedIds.length > 0 && !data.filters.showHistory && (
                            <div className="flex items-center gap-4 animate-in fade-in zoom-in duration-300">
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('creances:selection')}</span>
                                    <span className="text-sm font-black text-emerald-600">{t('creances:invoices_count', { count: data.selectedIds.length })}</span>
                                </div>
                                <div className="h-8 w-px bg-slate-200"></div>
                                <div className="flex flex-col items-end mr-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('creances:total_due')}</span>
                                    <span className="text-sm font-black text-slate-800">{formatCurrency(Math.round(bulkTotalAmount))}</span>
                                </div>
                                <button
                                    onClick={actions.actions.handleBulkPayment}
                                    className="inline-flex items-center justify-center h-8 px-6 rounded-lg text-xs font-black uppercase tracking-widest bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors"
                                >
                                    <DollarSign className="size-4 mr-2" />
                                    {t('creances:pay_selection')}
                                </button>
                            </div>
                        )}
                    </div>

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
                </div>
            </div>

            {/* Stats Dashboard */}
            <CreancesQuickStats
                totalDue={data.totals.total}
                totalPaid={data.totals.paye}
                totalRemaining={data.totals.reste}
                debtorsCount={data.groupedClients.length}
            />

            {/* Main Content Table Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 relative min-h-[500px]">
                <CreancesTable
                    mode={data.filters.selectedClient ? 'invoices' : 'clients'}
                    groupedClients={data.groupedClients}
                    filteredCreances={data.filteredCreances}
                    loading={data.loading}
                    showHistory={data.filters.showHistory}
                    selectedIds={data.selectedIds}
                    onSelectAll={(e) => {
                        if (e.target.checked) {
                            const ids = data.filteredCreances.filter(c => normalizeNumberInput(c.reste_a_payer) > 0).map(c => c.id);
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
            {/* Error handling */}
            {data.error && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
                    <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-medium shadow-sm">
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
                saving={actions.modals.sudoState.isValidating}
                title={actions.modals.sudoState.title}
                message={actions.modals.sudoState.message}
            />

        </div>
    );
}
