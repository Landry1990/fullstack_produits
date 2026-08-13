import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
    ClipboardList, Database, Plus, 
    BarChart3 
} from 'lucide-react';
import { InventaireFilters } from '../InventaireFilters';
import { InventaireQuickStats } from '../InventaireQuickStats';
import { InventaireListTable } from '../InventaireListTable';
import Pagination from '../../ui/Pagination';
import { useInventaireList } from '../../../hooks/inventaire/useInventaireList';
import { useInventaireEditor } from '../../../hooks/inventaire/useInventaireEditor';
import { toast } from 'react-hot-toast';
import { usePharmacySettings } from '../../../hooks/usePharmacySettings';
import { generateInventorySummaryText, openWhatsApp } from '../../../utils/whatsapp';
import type { Inventaire } from '../../../types';

interface InventaireListProps {
    listLogic: ReturnType<typeof useInventaireList>;
    onEdit: (inventaire: Inventaire) => void;
    onCreate: () => void;
    onOpenMergeModal: () => void;
    canMerge: { canMerge: boolean; reason: string | null };
    editorLogic: ReturnType<typeof useInventaireEditor>;
    onOpenAudit: () => void;
}

export const InventaireList: React.FC<InventaireListProps> = ({
    listLogic,
    onEdit,
    onCreate,
    onOpenMergeModal,
    canMerge,
    editorLogic,
    onOpenAudit
}) => {
    const { t } = useTranslation(['stock', 'common']);
    const { settings: pharmSettings } = usePharmacySettings();
    const {
        inventaires, loading, totalCount, currentPage, totalPages,
        nextPage, prevPage, fetchInventaires, handleDelete,
        filterStartDate, setFilterStartDate,
        filterEndDate, setFilterEndDate,
        filterSearchTerm, setFilterSearchTerm,
        filterStatus, setFilterStatus,
        filterCreator, setFilterCreator,
        filterOrdering, setFilterOrdering,
        selectedInventaireIds, toggleSelectInventaire, toggleSelectAllInventaires,
        deleting
    } = listLogic;

    const [sharingId, setSharingId] = useState<number | null>(null);

    const handleShareWhatsApp = async (id: number) => {
        const inventaire = inventaires.find(inv => inv.id === id);
        if (!inventaire) return;

        if (!pharmSettings?.pharmacist_whatsapp_number) {
            toast.error(t('inventaire.whatsapp_not_configured'));
            return;
        }

        setSharingId(id);
        try {
            const text = generateInventorySummaryText(inventaire, pharmSettings.pharmacy_name || t('common:default_pharmacy_name'));
            const success = openWhatsApp(pharmSettings.pharmacist_whatsapp_number, text);
            
            if (success) {
                toast.success(t('inventaire.whatsapp_prepared'), { icon: <MessageCircle className="h-4 w-4 text-[#25D366]" /> });
            }
        } catch {
            toast.error(t('inventaire.whatsapp_share_error'));
        } finally {
            setSharingId(null);
        }
    };

    const isSaving = editorLogic.saving || deleting;

    return (
        <div className="flex flex-col gap-4 animate-in fade-in duration-500 flex-1 overflow-hidden">
            {/* Title & Filters & QuickStats */}
            <div className="w-full space-y-3 shrink-0">
                <div className="bg-white rounded-lg border border-slate-200 flex flex-col">
                    <div className="p-4 border-b border-slate-100">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h1 className="text-xl font-semibold text-slate-800 tracking-tight flex items-center gap-2">
                                    <ClipboardList className="h-5 w-5 text-emerald-600" />
                                    {t('inventaire.title')}
                                </h1>
                                <p className="text-slate-500 text-sm mt-1">
                                    {t('inventaire.subtitle')}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    className="inline-flex items-center justify-center h-9 px-4 rounded-md gap-2 text-sm font-medium border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50"
                                    onClick={onOpenMergeModal}
                                    disabled={!canMerge.canMerge}
                                    title={canMerge.reason || ''}
                                >
                                    <Database className="h-4 w-4" />
                                    {t('inventaire.merge_btn')}
                                </button>
                                <button
                                    type="button"
                                    className="inline-flex items-center justify-center h-9 px-4 rounded-md gap-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                                    onClick={onOpenAudit}
                                >
                                    <BarChart3 className="h-4 w-4" />
                                    {t('inventaire.audit_btn')}
                                </button>
                                <button
                                    type="button"
                                    className="inline-flex items-center justify-center h-9 px-5 rounded-md gap-2 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-60"
                                    onClick={onCreate}
                                    disabled={listLogic.loading || isSaving}
                                >
                                    {isSaving && editorLogic.saving ? <div className="animate-spin rounded-full size-4 border-b-2 border-white"></div> : <Plus className="h-4 w-4" />}
                                    {t('inventaire.create_btn')}
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <InventaireFilters 
                        filters={{
                            startDate: filterStartDate,
                            setStartDate: setFilterStartDate,
                            endDate: filterEndDate,
                            setEndDate: setFilterEndDate,
                            searchTerm: filterSearchTerm,
                            setSearchTerm: setFilterSearchTerm,
                            statusFilter: filterStatus,
                            setStatusFilter: setFilterStatus,
                            creatorFilter: filterCreator,
                            setCreatorFilter: setFilterCreator,
                            ordering: filterOrdering,
                            setOrdering: setFilterOrdering
                        }}
                        onRefresh={() => fetchInventaires()}
                    />
                </div>
            </div>
            
            {/* Quick Stats Dashboard */}
            <div className="shrink-0">
                <InventaireQuickStats inventaires={inventaires} />
            </div>

            {/* Main Content: Table — scrollable area */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="overflow-y-auto flex-1">
                <InventaireListTable
                    inventaires={inventaires}
                    loading={loading}
                    selectedIds={selectedInventaireIds}
                    onSelectAll={toggleSelectAllInventaires}
                    onSelect={toggleSelectInventaire}
                    onEdit={onEdit}
                    onDelete={handleDelete}
                    onShareWhatsApp={handleShareWhatsApp}
                    deleting={deleting}
                    sharingId={sharingId}
                />
                </div>

                {/* Pagination Controls */}
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalCount}
                    onPrev={() => prevPage && fetchInventaires(prevPage)}
                    onNext={() => nextPage && fetchInventaires(nextPage)}
                    hasNext={!!nextPage}
                    isLoading={loading}
                    label={t('inventaire.list.title_short')}
                />
            </div>
        </div>
    );
};
