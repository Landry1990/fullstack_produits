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
            return sum + (f ? normalizeNumberInput(f.reste_a_payer) : 0);
        }, 0);
    }, [data.selectedIds, data.creances]);

    return (
        <div className="min-h-screen bg-base-200 p-6 space-y-6 font-sans overflow-auto">
            <Toaster position="top-center" />

            {/* Header Area */}
            <div className="flex flex-col gap-6">
                <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 flex flex-col">
                    <div className="p-6 border-b border-base-200 flex justify-between items-center bg-white/50">
                        <div>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 text-primary rounded-xl">
                                    <Wallet className="w-6 h-6" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black text-base-content tracking-tight">
                                        {t('creances:title')}
                                    </h1>
                                    <p className="text-xs font-bold text-base-content/40 uppercase tracking-widest mt-0.5">
                                        {t('creances:subtitle')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Selection Bar inside Header if active */}
                        {data.filters.selectedClient && data.selectedIds.length > 0 && !data.filters.showHistory && (
                            <div className="flex items-center gap-4 animate-in fade-in zoom-in duration-300">
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40">{t('creances:selection')}</span>
                                    <span className="text-sm font-black text-primary">{t('creances:invoices_count', { count: data.selectedIds.length })}</span>
                                </div>
                                <div className="h-8 w-px bg-base-200"></div>
                                <div className="flex flex-col items-end mr-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40">{t('creances:total_due')}</span>
                                    <span className="text-sm font-black text-base-content">{formatCurrency(Math.round(bulkTotalAmount))} F</span>
                                </div>
                                <button 
                                    onClick={actions.actions.handleBulkPayment} 
                                    className="btn btn-primary btn-sm px-6 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20"
                                >
                                    <DollarSign className="w-4 h-4 mr-2" />
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
            <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden flex-1 relative min-h-[500px]">
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
