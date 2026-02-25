import { useTranslation } from 'react-i18next';
import { ArrowUpDown, Database, AlertCircle } from 'lucide-react';
import type { Inventaire } from '../../../types';

interface InventaireMergeModalProps {
    showMergeModal: boolean;
    setShowMergeModal: (show: boolean) => void;
    viewMode: 'LIST' | 'CREATE' | 'EDIT';
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
    const { t } = useTranslation();

    return (
        <dialog className={`modal ${showMergeModal ? 'modal-open' : ''}`}>
             <div className="modal-box max-w-md rounded-2xl shadow-2xl border border-base-300 p-0 overflow-hidden bg-base-100">
                <div className="p-6 border-b border-base-200 bg-base-50/50 flex items-center gap-4">
                     <div className="w-12 h-12 rounded-xl bg-info/10 flex items-center justify-center">
                        <ArrowUpDown className="h-6 w-6 text-info" />
                     </div>
                     <div>
                        <h3 className="font-bold text-lg text-base-content">{t('stock.inventaire.merge.modal_title')}</h3>
                        <p className="text-sm text-base-content/60 mt-1">
                            {viewMode === 'LIST' 
                                ? t('stock.inventaire.modals.merge_list_desc', { defaultValue: 'Fusionner plusieurs brouillons' }) 
                                : t('stock.inventaire.merge.modal_desc', { defaultValue: 'Fusionner un brouillon existant' })}
                        </p>
                     </div>
                </div>

                <div className="p-6 space-y-4">
                    {/* Warning about list merging */}
                    {viewMode === 'LIST' && (
                        <div className="alert alert-warning shadow-sm rounded-xl py-3 border border-warning/20">
                            <AlertCircle className="h-5 w-5" />
                            <div className="text-sm">
                                <span className="font-bold">{t('stock.inventaire.modals.merge_warning', { defaultValue: 'Attention' })}</span><br/>
                                {t('stock.inventaire.modals.merge_warning_desc', { defaultValue: 'Les inventaires sources seront fusionnés dans l\'inventaire cible. Seules les lignes valides seront récupérées.' })}
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-base-content/70 flex items-center gap-2">
                            <Database className="h-4 w-4" />
                            {viewMode === 'LIST' 
                                ? t('stock.inventaire.modals.target_inventory', { defaultValue: 'Inventaire cible' }) 
                                : t('stock.inventaire.merge.select_source', { defaultValue: 'Inventaire source' })}
                        </label>
                        
                        {viewMode === 'LIST' ? (
                            <select 
                                className="select select-bordered w-full rounded-xl focus:border-info focus:ring-1 focus:ring-info"
                                value={selectedMergeSource || ''}
                                onChange={(e) => setSelectedMergeSource(Number(e.target.value))}
                            >
                                <option value="" disabled>{t('stock.inventaire.modals.choose_target', { defaultValue: 'Choisir la cible' })}</option>
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
                                <option value="" disabled>-- {t('stock.inventaire.merge.choose_placeholder', { defaultValue: 'Sélectionner...' })} --</option>
                                {loadingMergeCandidates ? (
                                    <option disabled>{t('common.messages.loading', { defaultValue: 'Chargement...' })}</option>
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
                        {t('common.actions.cancel', { defaultValue: 'Annuler' })}
                    </button>
                    <button 
                        className="btn btn-info text-white rounded-xl shadow-lg shadow-info/20 px-6" 
                        onClick={handleMerge}
                        disabled={!selectedMergeSource || merging}
                    >
                        {merging ? <span className="loading loading-spinner"></span> : <ArrowUpDown className="h-5 w-5" />}
                        {t('stock.inventaire.merge.btn', { defaultValue: 'Fusionner' })}
                    </button>
                </div>
            </div>
            <form method="dialog" className="modal-backdrop">
                 <button onClick={() => setShowMergeModal(false)}>close</button>
            </form>
        </dialog>
    );
}
