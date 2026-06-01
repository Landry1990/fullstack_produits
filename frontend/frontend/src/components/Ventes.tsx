import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
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
import Pagination from './ui/Pagination';
import { Receipt } from 'lucide-react';

const Ventes: React.FC = () => {
    const { t } = useTranslation(['sales', 'common']);
    const { settings } = usePharmacySettings();
    const location = useLocation();
    const navigate = useNavigate();
    
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
        setFacturesLocal: setFactures 
    });

    const [showQuickStats, setShowQuickStats] = React.useState(false);
    const [trancheStats, setTrancheStats] = React.useState<any>(null);

    // Handle incoming redirect from Omnisearch
    useEffect(() => {
        if (location.state?.selectedFactureId && filteredFactures.length > 0) {
            const fid = location.state.selectedFactureId;
            const found = filteredFactures.find((f: any) => f.id === fid);
            if (found) {
                actions.handleViewProducts(found);
                navigate(location.pathname, { replace: true, state: {} });
            }
        }
    }, [location.state, filteredFactures, actions, navigate]);
    
    return (
        <div className="min-h-screen bg-base-200 font-sans">

            {/* ── HEADER ── */}
            <div className="sticky top-0 z-30 bg-base-100 border-b border-base-200 px-4 sm:px-6 py-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-primary/10 text-primary rounded-lg shrink-0">
                        <Receipt className="size-5" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-base font-bold text-base-content tracking-tight leading-none truncate">
                            {t('title')}
                        </h1>
                        <p className="text-[10px] font-medium text-base-content/50 uppercase tracking-widest">
                            {t('subtitle')}
                        </p>
                    </div>
                </div>
            </div>

            <div className="p-4 sm:p-6 space-y-5">
                <SalesFilters
                    filters={filters}
                    onDeleteDrafts={handleDeleteBrouillons}
                    onRefresh={() => { refresh(); }}
                    users={users}
                />

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

                {showQuickStats && (
                    <SalesQuickStats
                        stats={trancheStats || stats}
                        onClose={() => setShowQuickStats(false)}
                    />
                )}

                {/* Main Content: Table */}
                <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 overflow-visible">
                    <SalesTable
                        factures={filteredFactures}
                        loading={loading}
                        onView={actions.handleViewProducts}
                        onPrint={actions.handlePrintInvoice}
                        onPrintBL={actions.handlePrintBL}
                        onPrintTicket={actions.handlePrintTicket}
                        onRefund={actions.handleEditInvoice}
                        onDuplicate={actions.handleDuplicateInvoice}
                        onGenerateAvoir={actions.handleGenerateAvoir}
                        onDelete={deleteFacture}
                        onBulkDelete={bulkDeleteFactures}
                    />

                    <Pagination
                        currentPage={pagination?.currentPage || 1}
                        totalPages={pagination?.totalPages || 1}
                        totalItems={pagination?.totalItems || 0}
                        onPrev={() => pagination?.prevPage && pagination.prevPage()}
                        onNext={() => pagination?.nextPage && pagination.nextPage()}
                        hasNext={pagination?.hasNext}
                        isLoading={loading}
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

                <TicketPreviewModal
                    isOpen={modals.showTicketModal}
                    onClose={() => modals.setShowTicketModal(false)}
                    ticket={modals.selectedTicket}
                    settings={settings}
                />
            </div>

        </div>
    );
}

export default Ventes;
