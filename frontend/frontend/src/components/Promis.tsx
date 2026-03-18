import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
    const [smsModalState, setSmsModalState] = useState<{isOpen: boolean, promis: any | null}>({ isOpen: false, promis: null });

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
        <div className="min-h-screen bg-base-200 p-6 space-y-6 font-sans">
            
            {/* Header Section */}
            <div className="flex flex-col gap-6">
                
                {/* Title & Filters */}
                <div className="w-full space-y-4">
                    <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 flex flex-col">
                        <div className="p-6 border-b border-base-200">
                            <h1 className="text-3xl font-black text-base-content tracking-tight">{t('stock:promis.title', 'Promised Products Management')}</h1>
                            <p className="text-base-content/50 font-medium text-sm mt-1">{t('stock:promis.subtitle', 'Manage promised products, deliveries and stock returns')}</p>
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

            {/* Main Content: Table */}
            <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden flex flex-col h-[calc(100vh-28rem)] min-h-[400px]">
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
