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
import { Receipt, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from './shadcn/button';

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
        <div className="min-h-screen bg-slate-50 font-sans p-6 space-y-6">

            {/* ── HEADER ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-4">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="bg-emerald-100 text-emerald-600 rounded-xl p-2.5 shrink-0">
                            <Receipt className="size-6" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-xl font-bold text-slate-900 tracking-tight truncate">
                                {t('title')}
                            </h1>
                            <p className="text-sm text-slate-500">
                                {t('subtitle')}
                            </p>
                        </div>
                    </div>
                    <Link to="/app/facturation">
                        <Button className="gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20">
                            <Plus className="size-4" />
                            <span className="hidden sm:inline">Nouvelle vente</span>
                            <span className="sm:hidden">Vente</span>
                        </Button>
                    </Link>
                </div>
            </div>

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
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-visible">
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

                    <div className="border-t border-slate-100">
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
