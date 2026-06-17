import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
    ChevronLeft, ChevronRight, ClipboardList, Database, Plus, 
    BarChart3 
} from 'lucide-react';
import { InventaireFilters } from '../InventaireFilters';
import { InventaireQuickStats } from '../InventaireQuickStats';
import { InventaireListTable } from '../InventaireListTable';
import { useInventaireList } from '../../../hooks/inventaire/useInventaireList';
import { useInventaireEditor } from '../../../hooks/inventaire/useInventaireEditor';
import communicationService from '../../../services/communicationService';
import { toast } from 'react-hot-toast';
import { usePharmacySettings } from '../../../hooks/usePharmacySettings';
import { generateInventorySummaryText, openWhatsApp } from '../../../utils/whatsapp';

interface InventaireListProps {
    listLogic: ReturnType<typeof useInventaireList>;
    onEdit: (inventaire: any) => void;
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
        inventaires, loading, totalCount, currentPage,
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
            toast.error("Le numéro WhatsApp de la pharmacienne n'est pas configuré dans les paramètres.");
            return;
        }

        setSharingId(id);
        try {
            const text = generateInventorySummaryText(inventaire, pharmSettings.pharmacy_name || 'Ma Pharmacie');
            const success = openWhatsApp(pharmSettings.pharmacist_whatsapp_number, text);
            
            if (success) {
                toast.success(t('inventaire.whatsapp_prepared', { defaultValue: 'Rapport préparé pour WhatsApp !' }), { icon: '📱' });
            }
        } catch (err: any) {
            toast.error('Erreur lors de la préparation du partage');
        } finally {
            setSharingId(null);
        }
    };

    const isSaving = editorLogic.saving || deleting;

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Title & Filters & QuickStats */}
            <div className="w-full space-y-4">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col">
                    <div className="p-6 border-b border-slate-100">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                                    <ClipboardList className="h-6 w-6 text-emerald-600" />
                                    {t('inventaire.title')}
                                </h1>
                                <p className="text-slate-500 text-sm mt-1">
                                    {t('inventaire.subtitle')}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    className="inline-flex items-center justify-center h-9 px-4 rounded-xl gap-2 text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50"
                                    onClick={onOpenMergeModal}
                                    disabled={!canMerge.canMerge}
                                    title={canMerge.reason || ''}
                                >
                                    <Database className="h-4 w-4" />
                                    {t('inventaire.merge_btn')}
                                </button>
                                <button
                                    type="button"
                                    className="inline-flex items-center justify-center h-9 px-4 rounded-xl gap-2 text-sm font-bold bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors"
                                    onClick={onOpenAudit}
                                >
                                    <BarChart3 className="h-4 w-4" />
                                    {t('inventaire.audit_btn')}
                                </button>
                                <button
                                    className="inline-flex items-center justify-center h-9 px-6 rounded-xl gap-2 text-sm font-black bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors disabled:opacity-60"
                                    onClick={onCreate}
                                    disabled={listLogic.loading || isSaving}
                                >
                                    {isSaving && editorLogic.saving ? <div className="animate-spin rounded-full size-4 border-b-2 border-white"></div> : <Plus className="h-5 w-5" />}
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
            <InventaireQuickStats inventaires={inventaires} />

            {/* Main Content: Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-6">
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

                {/* Pagination Controls */}
                <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="text-sm text-slate-500 font-medium">
                        {t('common:pagination.page_info', { current: currentPage, total: totalCount, label: t('inventaire.list.title_short', 'inventaires') })}
                    </div>
                    <div className="flex gap-2">
                        <button
                            className="inline-flex items-center justify-center h-8 px-4 rounded-xl text-sm font-bold border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-all active:scale-95 gap-1"
                            onClick={() => prevPage && fetchInventaires(prevPage)}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            {t('common:pagination.prev', 'Précédent')}
                        </button>
                        <button
                            className="inline-flex items-center justify-center h-8 px-4 rounded-xl text-sm font-bold border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-all active:scale-95 gap-1 disabled:opacity-50"
                            disabled={!nextPage || loading}
                            onClick={() => nextPage && fetchInventaires(nextPage)}
                        >
                            {t('common:pagination.next', 'Suivant')}
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
