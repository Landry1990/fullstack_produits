import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { usePromisData } from '../hooks/usePromisData';

// Components
import { PromisQuickStats } from './promis/PromisQuickStats';
import { PromisFilters } from './promis/PromisFilters';
import { PromisTable } from './promis/PromisTable';
import { PromisFormModal } from './promis/modals/PromisFormModal';
import { SmsModal } from './promis/modals/SmsModal';
import PasswordConfirmModal from './PasswordConfirmModal';

const Promis: React.FC = () => {
    const { t } = useTranslation(['stock', 'common']);
    
    // UI State for Modals
    const [showForm, setShowForm] = useState(false);
    const [smsModalState, setSmsModalState] = useState<{isOpen: boolean, promis: unknown | null}>({ isOpen: false, promis: null });
    const [headerCollapsed, setHeaderCollapsed] = useState(false);

    // Business Logic Hook
    const {
        filteredPromis,
        loading,
        clients,
        produits,
        stats,
        filterStatus,
        setFilterStatus,
        searchQuery,
        setSearchQuery,
        refresh,
        handleDelivrer,
        handleAnnuler,
        handlePrintTicket,
        handleWhatsAppReminder,
        selectedIds,
        toggleSelection,
        toggleSelectAll,
        bulkLoading,
        handleBulkDelivrer,
        handleBulkAnnuler,
        clearSelection,
        sudoModal,
        setSudoModal,
        handleSudoConfirm
    } = usePromisData();

    return (
        <div className="h-full flex flex-col bg-slate-50 p-4 sm:p-6 gap-4 sm:gap-6 font-sans">
            
            {!headerCollapsed && (
            <div className="flex flex-col gap-6">
                
                {/* Title & Filters */}
                <div className="w-full space-y-4">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col">
                        <div className="p-6 border-b border-slate-100">
                            <h1 className="text-3xl font-black text-slate-800 tracking-tight">{t('stock:promis.title', 'Promised Products Management')}</h1>
                            <p className="text-slate-500 font-medium text-sm mt-1">{t('stock:promis.subtitle', 'Manage promised products, deliveries and stock returns')}</p>
                        </div>
                        
                        <PromisFilters 
                            filterStatus={filterStatus}
                            setFilterStatus={setFilterStatus}
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            onRefresh={refresh}
                            onNew={() => setShowForm(true)}
                        />
                    </div>
                    
                    {/* Quick Stats Dashboard */}
                    <PromisQuickStats stats={stats} />
                </div>
            </div>
            )}

            {/* Main Content: Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="px-4 py-2 border-b flex justify-between items-center bg-muted/30 shrink-0">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm">{t('stock:promis.title', 'Promis')}</h3>
                        <button
                            onClick={() => setHeaderCollapsed(!headerCollapsed)}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-emerald-600 transition-colors px-2 py-1 rounded hover:bg-emerald-50"
                            title={headerCollapsed ? t('common:show_header', 'Afficher') : t('common:hide_header', 'Masquer')}
                        >
                            {headerCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                            {headerCollapsed ? t('common:show_header', 'Afficher') : t('common:hide_header', 'Masquer')}
                        </button>
                    </div>
                </div>
                <PromisTable 
                    promisList={filteredPromis}
                    loading={loading}
                    selectedIds={selectedIds}
                    onToggleSelection={toggleSelection}
                    onToggleSelectAll={toggleSelectAll}
                    onDeliver={handleDelivrer}
                    onCancel={handleAnnuler}
                    onPrint={handlePrintTicket}
                    onSms={(promis) => setSmsModalState({ isOpen: true, promis })}
                    onWhatsApp={handleWhatsAppReminder}
                    onBulkDeliver={handleBulkDelivrer}
                    onBulkCancel={handleBulkAnnuler}
                    onClearSelection={clearSelection}
                    bulkLoading={bulkLoading}
                />
            </div>

            {/* Modals */}
            {showForm && (
                <PromisFormModal 
                    isOpen={showForm}
                    onClose={() => setShowForm(false)}
                    clients={clients}
                    produits={produits}
                    onSuccess={refresh}
                />
            )}

            <SmsModal 
                isOpen={smsModalState.isOpen}
                onClose={() => setSmsModalState({ isOpen: false, promis: null })}
                promis={smsModalState.promis}
            />

            <PasswordConfirmModal
                isOpen={sudoModal.isOpen}
                onClose={() => setSudoModal({ isOpen: false, action: null, targetId: null })}
                onConfirm={handleSudoConfirm}
                title={t('stock:promis.modals.sudo_confirm_title', 'Confirmation Requise (Zone Sensible)')}
                message={t('stock:promis.modals.sudo_confirm_message', 'Cette action va modifier le stock (réintégration). Veuillez confirmer votre mot de passe pour continuer.')}
            />

        </div>
    );
};

export default Promis;
