import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSalesData } from '../hooks/useSalesData';
import { useInvoiceActions } from '../hooks/useInvoiceActions';
import { useCashSession } from '../hooks/useCashSession';

// Components
import { SalesFilters } from './sales/SalesFilters';
import { SalesTable } from './sales/SalesTable';
import { SalesSessionStats } from './sales/SalesSessionStats';
import { ClientNameModal } from './sales/modals/ClientNameModal';
import { ProductDetailsModal } from './sales/modals/ProductDetailsModal';
import { RefundModal } from './sales/modals/RefundModal';

// Styles (if any specific, otherwise rely on tailwind)

const Ventes: React.FC = () => {
    const { t } = useTranslation();
    
    // Hooks
    const { 
        factures, 
        setFactures,
        filteredFactures, 
        loading, 
        filters, 
        refresh, 
        handleDeleteBrouillons,
        deleteFacture 
    } = useSalesData();

    const { 
        caisseSession, 
        refreshSession 
    } = useCashSession();

    const {
        modals,
        actions
    } = useInvoiceActions({ 
        refreshFactures: () => {
             refresh(); 
             refreshSession();
        },
        setFacturesLocal: setFactures 
    });

    return (
        <div className="min-h-screen bg-gray-50/50 p-6 space-y-6">
            
            {/* Header Section */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* Title & Filters */}
                <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col">
                    <div className="p-6 border-b border-gray-100">
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                            {t('sales.title')}
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">
                            {t('sales.subtitle', {defaultValue: "Gérez vos ventes, factures et règlements"})}
                        </p>
                    </div>
                    
                    <SalesFilters 
                        startDate={filters.startDate}
                        setStartDate={filters.setStartDate}
                        endDate={filters.endDate}
                        setEndDate={filters.setEndDate}
                        searchTerm={filters.searchTerm}
                        setSearchTerm={filters.setSearchTerm}
                        statusFilter={filters.statusFilter}
                        setStatusFilter={filters.setStatusFilter}
                        onDeleteDrafts={handleDeleteBrouillons}
                        onRefresh={() => { refresh(); refreshSession(); }}
                    />
                </div>

                {/* Session Stats */}
                <div className="lg:col-span-1">
                    <SalesSessionStats session={caisseSession} />
                </div>
            </div>

            {/* Main Content: Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <SalesTable 
                    factures={filteredFactures}
                    loading={loading}
                    onView={actions.handleViewProducts}
                    onPrint={actions.handlePrintInvoice}
                    onRefund={actions.handleOpenRefundModal}
                    onDelete={deleteFacture}
                />
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

            <RefundModal 
                isOpen={modals.showRefundModal}
                onClose={() => modals.setShowRefundModal(false)}
                onConfirm={actions.handleConfirmRefund}
                facture={modals.selectedFacture}
            />

        </div>
    );
}

export default Ventes;
