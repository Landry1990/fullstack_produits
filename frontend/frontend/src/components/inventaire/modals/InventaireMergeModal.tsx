import { useTranslation } from 'react-i18next';
import { ArrowUpDown, Database, AlertCircle } from 'lucide-react';
import type { Inventaire } from '../../../types';
import { formatDate } from '../../../utils/dateUtils';

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

    if (!showMergeModal) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowMergeModal(false)}>
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-4">
                    <div className="size-12 rounded-xl bg-blue-50 flex items-center justify-center">
                        <ArrowUpDown className="h-6 w-6 text-blue-500" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800">{t('inventaire.merge.modal_title')}</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            {viewMode === 'LIST'
                                ? t('inventaire.modals.merge_list_desc')
                                : t('inventaire.merge.modal_desc')}
                        </p>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    {/* Warning about list merging */}
                    {viewMode === 'LIST' && (
                        <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                            <div className="text-sm text-amber-800">
                                <span className="font-bold">{t('inventaire.modals.merge_warning')}</span><br/>
                                {t('inventaire.modals.merge_warning_desc')}
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600 flex items-center gap-2">
                            <Database className="h-4 w-4" />
                            {viewMode === 'LIST'
                                ? t('inventaire.modals.target_inventory')
                                : t('inventaire.merge.select_source')}
                        </label>

                        {viewMode === 'LIST' ? (
                            <select
                                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                value={selectedMergeSource || ''}
                                onChange={(e) => setSelectedMergeSource(Number(e.target.value))}
                            >
                                <option value="" disabled>{t('inventaire.modals.choose_target')}</option>
                                {Array.from(selectedInventaireIds).map(id => {
                                    const inv = inventaires.find(i => i.id === id);
                                    return (
                                        <option key={id} value={id}>
                                            Inventaire #{id} - {inv?.description || (inv?.date && formatDate(inv.date)) || 'Sans description'}
                                        </option>
                                    );
                                })}
                            </select>
                        ) : (
                            <select
                                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-60"
                                value={selectedMergeSource || ''}
                                onChange={(e) => setSelectedMergeSource(Number(e.target.value))}
                                disabled={loadingMergeCandidates}
                            >
                                <option value="" disabled>-- {t('inventaire.merge.choose_placeholder')} --</option>
                                {loadingMergeCandidates ? (
                                    <option disabled>{t('common:loading')}</option>
                                ) : (
                                    mergeCandidates.map(c => (
                                        <option key={c.id} value={c.id}>
                                            Inventaire #{c.id} - {c.description || formatDate(c.date)}
                                        </option>
                                    ))
                                )}
                            </select>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                    <button
                        className="inline-flex items-center justify-center h-9 px-5 rounded-xl text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                        onClick={() => { setShowMergeModal(false); setSelectedMergeSource(null); }}
                    >
                        {t('common:cancel')}
                    </button>
                    <button
                        className="inline-flex items-center justify-center h-9 px-6 rounded-xl text-sm font-black bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors gap-2 disabled:opacity-60"
                        onClick={handleMerge}
                        disabled={!selectedMergeSource || merging}
                    >
                        {merging ? <div className="animate-spin rounded-full size-4 border-b-2 border-white"></div> : <ArrowUpDown className="h-4 w-4" />}
                        {t('inventaire.merge.btn')}
                    </button>
                </div>
            </div>
        </div>
    );
}

