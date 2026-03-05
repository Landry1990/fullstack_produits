import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSalesData } from '../hooks/useSalesData';
import { useInvoiceActions } from '../hooks/useInvoiceActions';

// Components
import { SalesFilters } from './sales/SalesFilters';
import { SalesTable } from './sales/SalesTable';
import { SalesQuickStats } from './sales/SalesQuickStats';
import { ClientNameModal } from './sales/modals/ClientNameModal';
import { ProductDetailsModal } from './sales/modals/ProductDetailsModal';
import TicketPreviewModal from './facturation/TicketPreviewModal';
import { usePharmacySettings } from '../hooks/usePharmacySettings';

import { TrancheHoraireStats } from './sales/TrancheHoraireStats';

// Styles (if any specific, otherwise rely on tailwind)

const Ventes: React.FC = () => {
    const { t } = useTranslation();
    const { settings } = usePharmacySettings();
    
    // Hooks
    const { 
        setFactures,
        filteredFactures, 
        loading, 
        stats,
        users,
        filters, 
        refresh, 
        handleDeleteBrouillons,
        deleteFacture,
        bulkDeleteFactures,
        pagination
    } = useSalesData();

    const {
        modals,
        actions
    } = useInvoiceActions({ 
        refreshFactures: () => {
             refresh(); 
        },
        setFacturesLocal: setFactures 
    });

    const [showQuickStats, setShowQuickStats] = React.useState(false);
    const [trancheStats, setTrancheStats] = React.useState<any>(null);
    
    return (
        <div className="min-h-screen bg-base-200 p-6 space-y-6 font-sans">
            
            {/* Header Section */}
            <div className="flex flex-col gap-6">
                
                {/* Title & Filters & QuickStats */}
                <div className="w-full space-y-4">
                    <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 flex flex-col">
                        <div className="p-6 border-b border-base-200">
                            <h1 className="text-2xl font-bold text-base-content tracking-tight">
                                {t('sales.title')}
                            </h1>
                            <p className="text-base-content/60 text-sm mt-1">
                                {t('sales.subtitle', {defaultValue: "Gérez vos ventes, factures et règlements"})}
                            </p>
                        </div>
                        
                        <SalesFilters 
                            filters={filters}
                            onDeleteDrafts={handleDeleteBrouillons}
                            onRefresh={() => { refresh(); }}
                            users={users}
                        />
                    </div>
                     <TrancheHoraireStats 
                        startDate={filters.startDate}
                        endDate={filters.endDate}
                        onVerify={(data) => {
                            setTrancheStats({
                                ...stats,
                                total_ttc: data.total_ttc,
                                total_regle: data.total_regle,
                                total_en_compte: data.total_en_compte,
                            });
                            setShowQuickStats(true);
                        }} 
                     />
                     {/* Quick Stats Dashboard */}
                     {showQuickStats && <SalesQuickStats stats={trancheStats || stats} />}
                </div>
            </div>

            {/* Main Content: Table */}
            <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden">
                <SalesTable 
                    factures={filteredFactures}
                    loading={loading}
                    onView={actions.handleViewProducts}
                    onPrint={actions.handlePrintInvoice}
                    onPrintTicket={actions.handlePrintTicket}
                    onRefund={actions.handleEditInvoice}
                    onDuplicate={actions.handleDuplicateInvoice}
                    onGenerateAvoir={actions.handleGenerateAvoir}
                    onDelete={deleteFacture}
                    onBulkDelete={bulkDeleteFactures}
                />
                
                {/* Pagination Controls */}
                <div className="p-4 border-t border-base-200 flex items-center justify-between">
                    <div className="text-sm text-base-content/60">
                        Page {pagination?.currentPage} sur {pagination?.totalPages} ({pagination?.totalItems} ventes)
                    </div>
                    <div className="flex gap-2">
                        <button 
                            className="btn btn-sm btn-outline"
                            onClick={pagination?.prevPage}
                            disabled={!pagination?.prevPage || loading}
                        >
                            Précédent
                        </button>
                        <button 
                            className="btn btn-sm btn-outline"
                            onClick={pagination?.nextPage}
                            disabled={!pagination?.hasNext || loading}
                        >
                            Suivant
                        </button>
                    </div>
                </div>
            </div>

            {/* Modals */}
            <ProductDetailsModal 
                isOpen={modals.showProductDetailsModal}
                onClose={() => modals.setShowProductDetailsModal(false)}
                facture={modals.selectedFacture}
                loading={modals.detailsLoading}
            />

            <ClientNameModal 
                isOpen={modals.showClientNameModal}
                onClose={() => {
                    modals.setShowClientNameModal(false);
                }}
                onConfirm={actions.handleConfirmPrintClientName}
                facture={modals.pendingPrintFacture}
            />

            <TicketPreviewModal
                isOpen={modals.showTicketModal}
                onClose={() => modals.setShowTicketModal(false)}
                ticket={modals.selectedTicket}
                settings={settings}
            />

        </div>
    );
}

export default Ventes;
