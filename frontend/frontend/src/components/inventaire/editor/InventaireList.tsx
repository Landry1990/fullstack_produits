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
                <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 flex flex-col">
                    <div className="p-6 border-b border-base-200">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-base-content tracking-tight flex items-center gap-2">
                                    <ClipboardList className="h-6 w-6 text-primary" />
                                    {t('inventaire.title')}
                                </h1>
                                <p className="text-base-content/60 text-sm mt-1">
                                    {t('inventaire.subtitle')}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    type="button"
                                    className="btn btn-secondary rounded-xl gap-2 shadow-lg shadow-secondary/20"
                                    onClick={onOpenMergeModal}
                                    disabled={!canMerge.canMerge}
                                    title={canMerge.reason || ''}
                                >
                                    <Database className="h-4 w-4" />
                                    {t('inventaire.merge_btn')}
                                </button>
                                <button 
                                    type="button"
                                    className="btn btn-info rounded-xl gap-2 shadow-lg shadow-info/20 text-white"
                                    onClick={onOpenAudit}
                                >
                                    <BarChart3 className="h-4 w-4" />
                                    {t('inventaire.audit_btn')}
                                </button>
                                <button 
                                    className="btn btn-primary rounded-xl px-6 shadow-lg shadow-primary/20 gap-2" 
                                    onClick={onCreate}
                                    disabled={listLogic.loading || isSaving}
                                >
                                    {isSaving && editorLogic.saving ? <span className="loading loading-spinner loading-sm"></span> : <Plus className="h-5 w-5" />}
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
                            setCreatorFilter: setFilterCreator
                        }}
                        onRefresh={() => fetchInventaires()}
                    />
                </div>
            </div>
            
            {/* Quick Stats Dashboard */}
            <InventaireQuickStats inventaires={inventaires} />

            {/* Main Content: Table */}
            <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden mt-6">
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
                <div className="p-4 border-t border-base-200 flex items-center justify-between">
                    <div className="text-sm text-base-content/60 font-medium">
                        {t('common:pagination.page_info', { current: currentPage, total: totalCount, label: t('inventaire.list.title_short', 'inventaires') })}
                    </div>
                    <div className="flex gap-2">
                        <button 
                            className="btn btn-sm btn-outline rounded-xl px-4 gap-1 transform active:scale-95 transition-all" 
                            onClick={() => prevPage && fetchInventaires(prevPage)}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            {t('common:pagination.prev', 'Précédent')}
                        </button>
                        <button 
                            className="btn btn-sm btn-outline rounded-xl px-4 gap-1 transform active:scale-95 transition-all" 
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
