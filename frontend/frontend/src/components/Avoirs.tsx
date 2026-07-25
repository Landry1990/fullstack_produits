
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAvoirsData } from '../hooks/useAvoirsData';
import { Card, CardHeader, CardTitle, CardDescription } from './shadcn/card';

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
        <div className="h-full flex flex-col bg-slate-50 p-4 md:p-6 gap-4 sm:gap-6 font-sans">
            {/* Header Section */}
            <div className="flex flex-col gap-6">
                <div className="w-full space-y-4">
                    <Card className="flex flex-col overflow-hidden">
                        <CardHeader className="border-b border-slate-100">
                            <CardTitle className="text-2xl text-slate-900 tracking-tight">
                                {t('avoirs.title')}
                            </CardTitle>
                            <CardDescription>
                                {t('avoirs.subtitle')}
                            </CardDescription>
                        </CardHeader>

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
                    </Card>

                    <AvoirsQuickStats avoirs={avoirsData.avoirs} />
                </div>
            </div>

            <Card className="overflow-hidden">
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
            </Card>

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
