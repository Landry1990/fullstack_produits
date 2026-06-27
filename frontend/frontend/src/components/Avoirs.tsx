
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAvoirsData } from '../hooks/useAvoirsData';

// Components
import { AvoirsQuickStats } from './avoirs/AvoirsQuickStats';
import { AvoirsFilters } from './avoirs/AvoirsFilters';
import { AvoirsTable } from './avoirs/AvoirsTable';
import { AvoirsForm } from './avoirs/AvoirsForm';
import { AvoirsDetails } from './avoirs/AvoirsDetails';
import { AvoirsLotModal } from './avoirs/modals/AvoirsLotModal';
import SudoValidationModal from './common/SudoValidationModal';

export default function Avoirs() {
    const { t } = useTranslation(['stock', 'common']);
    const avoirsData = useAvoirsData();
    const { sudoState, closeSudo } = avoirsData;

    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');

    const filteredAvoirs = useMemo(() => {
        return avoirsData.avoirs.filter(a => {
            if (statusFilter) {
                const s = a.status?.toUpperCase();
                const match = statusFilter === 'VAL'
                    ? ['VAL', 'VALIDE', 'VALIDÉ', 'VALIDEE', 'VALIDÉE'].includes(s)
                    : ['BROUILLON', 'BRO'].includes(s);
                if (!match) return false;
            }
            if (typeFilter && a.type_avoir?.toUpperCase() !== typeFilter.toUpperCase()) return false;
            return true;
        });
    }, [avoirsData.avoirs, statusFilter, typeFilter]);

    // View routing
    if (avoirsData.viewMode === 'CREATE' || avoirsData.viewMode === 'EDIT') {
        return (
            <>
                <AvoirsForm data={avoirsData} />
                <AvoirsLotModal 
                    isOpen={avoirsData.lotModal.open}
                    onClose={() => avoirsData.setLotModal(prev => ({ ...prev, open: false }))}
                    availableLots={avoirsData.availableLots}
                    loadingLots={avoirsData.loadingLots}
                    onSelectLot={avoirsData.handleSelectLot}
                />
            </>
        );
    }

    if (avoirsData.viewMode === 'DETAILS') {
        return (
            <>
                <AvoirsDetails data={avoirsData} />
                <SudoValidationModal
                    isOpen={sudoState.isOpen}
                    onClose={closeSudo}
                    onValidate={sudoState.onValidate}
                    saving={sudoState.isValidating}
                    title={sudoState.title}
                    message={sudoState.message}
                />
            </>
        );
    }

    // Default 'LIST' view
    return (
        <div className="min-h-screen bg-base-200 p-6 space-y-6 font-sans">
            
            {/* Header Section */}
            <div className="flex flex-col gap-6">
                
                {/* Title & Filters */}
                <div className="w-full space-y-4">
                    <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 flex flex-col">
                        <div className="p-6 border-b border-base-200">
                            <h1 className="text-2xl font-bold text-base-content tracking-tight">
                                {t('avoirs.title')}
                            </h1>
                            <p className="text-base-content/60 text-sm mt-1">
                                {t('avoirs.subtitle')}
                            </p>
                        </div>
                        
                        <AvoirsFilters
                            searchQuery={avoirsData.listSearchQuery}
                            setSearchQuery={avoirsData.setListSearchQuery}
                            statusFilter={statusFilter}
                            setStatusFilter={setStatusFilter}
                            typeFilter={typeFilter}
                            setTypeFilter={setTypeFilter}
                            onRefresh={() => avoirsData.fetchAvoirs(avoirsData.listSearchQuery)}
                            onNew={avoirsData.handleCreateNew}
                        />
                    </div>
                    
                    {/* Quick Stats Dashboard */}
                    <AvoirsQuickStats avoirs={avoirsData.avoirs} />
                </div>
            </div>

            {/* Main Content: Table */}
            <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden">
                <AvoirsTable
                    avoirs={filteredAvoirs}
                    loading={avoirsData.loading}
                    selectedIds={avoirsData.selectedIds}
                    onToggleSelection={avoirsData.onToggleSelection}
                    onToggleSelectAll={avoirsData.onToggleSelectAll}
                    onView={(avoir) => {
                        avoirsData.setSelectedAvoir(avoir);
                        avoirsData.setViewMode('DETAILS');
                    }}
                    onEdit={avoirsData.handleEdit}
                    onValidate={(avoir) => avoirsData.handleValidate(avoir)}
                    onDelete={(avoir) => avoirsData.handleDelete(avoir)}
                    onBulkValidate={avoirsData.handleBulkValidate}
                    onBulkDelete={avoirsData.handleBulkDelete}
                    onClearSelection={avoirsData.onClearSelection}
                    bulkLoading={avoirsData.bulkLoading}
                />
            </div>

            {/* Validate Modal accessible from list view */}
            <SudoValidationModal
                isOpen={sudoState.isOpen}
                onClose={closeSudo}
                onValidate={sudoState.onValidate}
                saving={sudoState.isValidating}
                title={sudoState.title || t('stock:avoirs.modals.sudo_validate_title')}
                message={sudoState.message || t('stock:avoirs.modals.sudo_validate_message')}
            />

        </div>
    );
}
