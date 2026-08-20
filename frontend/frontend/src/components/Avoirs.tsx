
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { useAvoirsData } from '../hooks/useAvoirsData';
import { Card, CardContent } from './shadcn/card';

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
    const [headerCollapsed, setHeaderCollapsed] = useState(false);

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
        <div className="h-screen overflow-hidden bg-slate-50 p-2 sm:p-3 lg:p-4">
            <div className="h-full max-w-[1600px] mx-auto space-y-3 overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-600/20">
                            <FileText className="size-5" />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                                {t('avoirs.title')}
                            </h1>
                            <p className="text-xs font-medium text-slate-500 mt-0.5">
                                {t('avoirs.subtitle')}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setHeaderCollapsed(!headerCollapsed)}
                        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-600 transition-colors px-2 py-1 rounded hover:bg-emerald-50 self-start sm:self-auto"
                        title={headerCollapsed ? t('common:show_header', 'Afficher') : t('common:hide_header', 'Masquer')}
                    >
                        {headerCollapsed ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
                        {headerCollapsed ? t('common:show_header', 'Afficher') : t('common:hide_header', 'Masquer')}
                    </button>
                </div>

                {!headerCollapsed && (
                    <>
                        {/* Filters Card */}
                        <Card className="py-3">
                            <CardContent className="pb-2">
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
                            </CardContent>
                        </Card>

                        {/* Stats Cards */}
                        <AvoirsQuickStats avoirs={avoirsData.avoirs} />
                    </>
                )}

                {/* Table Card */}
                <Card className="overflow-hidden flex flex-col flex-1 min-h-0">
                    <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
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
        </div>
    );
}
