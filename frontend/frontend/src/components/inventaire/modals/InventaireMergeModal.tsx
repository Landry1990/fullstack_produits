import { useTranslation } from 'react-i18next';
import { ArrowUpDown, Database, AlertCircle } from 'lucide-react';
import type { Inventaire } from '../../../types';

interface InventaireMergeModalProps {
    showMergeModal: boolean;
    setShowMergeModal: (show: boolean) => void;
    viewMode: 'LIST' | 'CREATE' | 'EDIT' | 'AUDIT';
    selectedMergeSource: number | null;
    setSelectedMergeSource: (id: number | null) => void;
    mergeCandidates: Inventaire[];
    loadingMergeCandidates: boolean;
    merging: boolean;
    handleMerge: () => void;
    selectedInventaireIds: Set<number>;
    inventaires: Inventaire[];
}

export function InventaireMergeModal({
    showMergeModal,
    setShowMergeModal,
    viewMode,
    selectedMergeSource,
    setSelectedMergeSource,
    mergeCandidates,
    loadingMergeCandidates,
    merging,
    handleMerge,
    selectedInventaireIds,
    inventaires
}: InventaireMergeModalProps) {
    const { t } = useTranslation(['stock', 'common']);

    return (
        <dialog className={`modal ${showMergeModal ? 'modal-open' : ''}`}>
             <div className="modal-box max-w-md rounded-2xl shadow-2xl border border-base-300 p-0 overflow-hidden bg-base-100">
                <div className="p-6 border-b border-base-200 bg-base-50/50 flex items-center gap-4">
                     <div className="w-12 h-12 rounded-xl bg-info/10 flex items-center justify-center">
                        <ArrowUpDown className="h-6 w-6 text-info" />
                     </div>
                     <div>
                        <h3 className="font-bold text-lg text-base-content">{t('inventaire.merge.modal_title')}</h3>
                        <p className="text-sm text-base-content/60 mt-1">
                            {viewMode === 'LIST' 
                                ? t('inventaire.modals.merge_list_desc') 
                                : t('inventaire.merge.modal_desc')}
                        </p>
                     </div>
                </div>

                <div className="p-6 space-y-4">
                    {/* Warning about list merging */}
                    {viewMode === 'LIST' && (
                        <div className="alert alert-warning shadow-sm rounded-xl py-3 border border-warning/20">
                            <AlertCircle className="h-5 w-5" />
                            <div className="text-sm">
                                <span className="font-bold">{t('inventaire.modals.merge_warning')}</span><br/>
                                {t('inventaire.modals.merge_warning_desc')}
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-base-content/70 flex items-center gap-2">
                            <Database className="h-4 w-4" />
                            {viewMode === 'LIST' 
                                ? t('inventaire.modals.target_inventory') 
                                : t('inventaire.merge.select_source')}
                        </label>
                        
                        {viewMode === 'LIST' ? (
                            <select 
                                className="select select-bordered w-full rounded-xl focus:border-info focus:ring-1 focus:ring-info"
                                value={selectedMergeSource || ''}
                                onChange={(e) => setSelectedMergeSource(Number(e.target.value))}
                            >
                                <option value="" disabled>{t('inventaire.modals.choose_target')}</option>
                                {Array.from(selectedInventaireIds).map(id => {
                                    const inv = inventaires.find(i => i.id === id);
                                    return (
                                        <option key={id} value={id}>
                                            Inventaire #{id} - {inv?.description || (inv?.date && new Date(inv.date).toLocaleDateString()) || 'Sans description'}
                                        </option>
                                    );
                                })}
                            </select>
                        ) : (
                            <select 
                                className="select select-bordered w-full rounded-xl focus:border-info focus:ring-1 focus:ring-info"
                                value={selectedMergeSource || ''}
                                onChange={(e) => setSelectedMergeSource(Number(e.target.value))}
                                disabled={loadingMergeCandidates}
                            >
                                <option value="" disabled>-- {t('inventaire.merge.choose_placeholder')} --</option>
                                {loadingMergeCandidates ? (
                                    <option disabled>{t('common.loading')}</option>
                                ) : (
                                    mergeCandidates.map(c => (
                                        <option key={c.id} value={c.id}>
                                            Inventaire #{c.id} - {c.description || new Date(c.date).toLocaleDateString()}
                                        </option>
                                    ))
                                )}
                            </select>
                        )}
                        
                    </div>
                </div>

                <div className="p-4 border-t border-base-200 bg-base-50/50 flex justify-end gap-3">
                    <button 
                        className="btn btn-ghost rounded-xl" 
                        onClick={() => {
                            setShowMergeModal(false);
                            setSelectedMergeSource(null);
                        }}
                    >
                        {t('common.cancel')}
                    </button>
                    <button 
                        className="btn btn-info text-white rounded-xl shadow-lg shadow-info/20 px-6" 
                        onClick={handleMerge}
                        disabled={!selectedMergeSource || merging}
                    >
                        {merging ? <span className="loading loading-spinner"></span> : <ArrowUpDown className="h-5 w-5" />}
                        {t('inventaire.merge.btn')}
                    </button>
                </div>
            </div>
            <form method="dialog" className="modal-backdrop">
                 <button onClick={() => setShowMergeModal(false)}>close</button>
            </form>
        </dialog>
    );
}
