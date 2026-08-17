import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRayons, useFormes, useGroupes } from '../../../hooks/useProduits';
import { CheckCircle2, ClipboardIcon, Settings2, Warehouse, Store, Archive, Loader2, ArrowLeft, ArrowRight } from 'lucide-react';

interface InventaireCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (options: {
        action: 'VERIFY' | 'ENTRY';
        stockType: 'GLOBAL' | 'RAYON' | 'RESERVE';
        rayonId?: number;
        groupeId?: number;
        formeId?: number;
    }) => void;
    isSaving?: boolean;
}

const InventaireCreateModal: React.FC<InventaireCreateModalProps> = ({ 
    isOpen, 
    onClose, 
    onConfirm,
    isSaving 
}) => {
    const { t } = useTranslation(['stock', 'common', 'sidebar']);
    const [action, setAction] = useState<'VERIFY' | 'ENTRY'>('VERIFY');
    const [stockType, setStockType] = useState<'GLOBAL' | 'RAYON' | 'RESERVE'>('RAYON');
    const [step, setStep] = useState<1 | 2>(1);
    
    // Filters for "Vérifier"
    const [rayonId, setRayonId] = useState<number | undefined>(undefined);
    const [groupeId, setGroupeId] = useState<number | undefined>(undefined);
    const [formeId, setFormeId] = useState<number | undefined>(undefined);

    const { data: rayons, isPending: loadingRayons } = useRayons();
    const { data: formes, isPending: loadingFormes } = useFormes();
    const { data: groupes, isPending: loadingGroupes } = useGroupes();

    if (!isOpen) return null;

    const handleNext = () => setStep(2);
    const handleBack = () => setStep(1);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (step !== 2) return;
        onConfirm({
            action,
            stockType,
            rayonId: action === 'VERIFY' ? rayonId : undefined,
            groupeId: action === 'VERIFY' ? groupeId : undefined,
            formeId: action === 'VERIFY' ? formeId : undefined,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="create-inventory-title">
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-4">
                    <div className="size-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                        <ClipboardIcon className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                        <h3 id="create-inventory-title" className="font-bold text-xl text-slate-800">{t('inventaire.create.title')}</h3>
                        <p className="text-sm text-slate-500 mt-0.5">{t('inventaire.subtitle')}</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Stepper */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`flex-1 h-2 rounded-full transition-colors ${step >= 1 ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                            <div className={`flex-1 h-2 rounded-full transition-colors ${step >= 2 ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                        </div>
                        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-slate-400">
                            <span className={step === 1 ? 'text-emerald-600' : ''}>{t('inventaire.create.step1_title')}</span>
                            <span className={step === 2 ? 'text-emerald-600' : ''}>{t('inventaire.create.step2_title')}</span>
                        </div>
                    </div>

                    {step === 1 && (
                        <div className="space-y-3">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                                {t('inventaire.create.action_title')}
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <label className={`flex items-start p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 group ${action === 'VERIFY' ? 'border-emerald-500 bg-emerald-50 shadow-inner' : 'border-slate-200 hover:border-slate-300 bg-slate-50'}`}>
                                    <div className="flex items-center h-5 mr-3 mt-1">
                                        <input
                                            type="radio"
                                            name="action"
                                            className="w-4 h-4 text-emerald-600 border-slate-300 focus:ring-emerald-500"
                                            checked={action === 'VERIFY'}
                                            onChange={() => setAction('VERIFY')}
                                        />
                                    </div>
                                    <div>
                                        <div className={`font-bold text-sm ${action === 'VERIFY' ? 'text-emerald-600' : 'text-slate-700'}`}>{t('inventaire.create.action_partial')}</div>
                                        <div className="text-[11px] text-slate-400 leading-tight mt-1">{t('inventaire.create.action_partial_desc')}</div>
                                    </div>
                                    <Settings2 className={`h-5 w-5 ml-auto opacity-20 transition-opacity ${action === 'VERIFY' ? 'text-emerald-600 opacity-40' : ''}`} />
                                </label>

                                <label className={`flex items-start p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 group ${action === 'ENTRY' ? 'border-emerald-500 bg-emerald-50 shadow-inner' : 'border-slate-200 hover:border-slate-300 bg-slate-50'}`}>
                                    <div className="flex items-center h-5 mr-3 mt-1">
                                        <input
                                            type="radio"
                                            name="action"
                                            className="w-4 h-4 text-emerald-600 border-slate-300 focus:ring-emerald-500"
                                            checked={action === 'ENTRY'}
                                            onChange={() => setAction('ENTRY')}
                                        />
                                    </div>
                                    <div>
                                        <div className={`font-bold text-sm ${action === 'ENTRY' ? 'text-emerald-600' : 'text-slate-700'}`}>{t('inventaire.create.action_full')}</div>
                                        <div className="text-[11px] text-slate-400 leading-tight mt-1">{t('inventaire.create.action_full_desc')}</div>
                                    </div>
                                    <Warehouse className={`h-5 w-5 ml-auto opacity-20 transition-opacity ${action === 'ENTRY' ? 'text-emerald-600 opacity-40' : ''}`} />
                                </label>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            {/* Stock Type Selection */}
                            <div className="space-y-3">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                                    {t('inventaire.create.stock_type_title')}
                                </span>
                                <div className="grid grid-cols-3 gap-3">
                                    <label className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${stockType === 'GLOBAL' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                                        <Archive className={`h-5 w-5 mb-2 ${stockType === 'GLOBAL' ? 'text-emerald-600' : 'text-slate-300'}`} />
                                        <input type="radio" name="stockType" className="hidden" checked={stockType === 'GLOBAL'} onChange={() => setStockType('GLOBAL')} />
                                        <span className={`text-xs font-bold text-center ${stockType === 'GLOBAL' ? 'text-emerald-700' : 'text-slate-500'}`}>{t('inventaire.create.stock_global')}</span>
                                    </label>

                                    <label className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${stockType === 'RAYON' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                                        <Store className={`h-5 w-5 mb-2 ${stockType === 'RAYON' ? 'text-emerald-600' : 'text-slate-300'}`} />
                                        <input type="radio" name="stockType" className="hidden" checked={stockType === 'RAYON'} onChange={() => setStockType('RAYON')} />
                                        <span className={`text-xs font-bold text-center ${stockType === 'RAYON' ? 'text-emerald-700' : 'text-slate-500'}`}>{t('inventaire.create.stock_rayon')}</span>
                                    </label>

                                    <label className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${stockType === 'RESERVE' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                                        <Warehouse className={`h-5 w-5 mb-2 ${stockType === 'RESERVE' ? 'text-emerald-600' : 'text-slate-300'}`} />
                                        <input type="radio" name="stockType" className="hidden" checked={stockType === 'RESERVE'} onChange={() => setStockType('RESERVE')} />
                                        <span className={`text-xs font-bold text-center ${stockType === 'RESERVE' ? 'text-emerald-700' : 'text-slate-500'}`}>{t('inventaire.create.stock_reserve')}</span>
                                    </label>
                                </div>
                            </div>

                            {/* Category Selection (Only for VERIFY) */}
                            {action === 'VERIFY' && (
                                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 animate-in slide-in-from-top-2 duration-300">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                                        {t('inventaire.create.perimeter_title')}
                                    </span>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                                        <div className="space-y-1">
                                            <label className="flex items-center gap-2 text-[10px] uppercase font-bold text-slate-400">
                                                {t('sidebar.stock.organisation.tabs.rayons', 'Rayon')}
                                                {loadingRayons && <Loader2 className="size-3 animate-spin" />}
                                            </label>
                                            <select
                                                className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all disabled:opacity-50"
                                                value={rayonId || ''}
                                                onChange={(e) => setRayonId(e.target.value ? parseInt(e.target.value) : undefined)}
                                                disabled={loadingRayons}
                                            >
                                                <option value="">{t('inventaire.create.rayon_all')}</option>
                                                {rayons?.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="flex items-center gap-2 text-[10px] uppercase font-bold text-slate-400">
                                                {t('sidebar.stock.organisation.tabs.groupes', 'Groupe')}
                                                {loadingGroupes && <Loader2 className="size-3 animate-spin" />}
                                            </label>
                                            <select
                                                className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all disabled:opacity-50"
                                                value={groupeId || ''}
                                                onChange={(e) => setGroupeId(e.target.value ? parseInt(e.target.value) : undefined)}
                                                disabled={loadingGroupes}
                                            >
                                                <option value="">{t('inventaire.create.groupe_all')}</option>
                                                {groupes?.map((g) => <option key={g.id} value={g.id}>{g.nom}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="flex items-center gap-2 text-[10px] uppercase font-bold text-slate-400">
                                                {t('sidebar.stock.organisation.tabs.formes', 'Forme')}
                                                {loadingFormes && <Loader2 className="size-3 animate-spin" />}
                                            </label>
                                            <select
                                                className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all disabled:opacity-50"
                                                value={formeId || ''}
                                                onChange={(e) => setFormeId(e.target.value ? parseInt(e.target.value) : undefined)}
                                                disabled={loadingFormes}
                                            >
                                                <option value="">{t('inventaire.create.forme_all')}</option>
                                                {formes?.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Recap */}
                            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
                                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block mb-1">
                                    {t('inventaire.create.recap_title')}
                                </span>
                                <p className="text-sm text-slate-700 leading-relaxed">
                                    <span className="font-medium">{t('inventaire.create.recap_mode')} :</span> {action === 'VERIFY' ? t('inventaire.create.action_partial') : t('inventaire.create.action_full')}<br />
                                    <span className="font-medium">{t('inventaire.create.recap_stock')} :</span> {stockType === 'GLOBAL' ? t('inventaire.create.stock_global') : stockType === 'RAYON' ? t('inventaire.create.stock_rayon') : t('inventaire.create.stock_reserve')}
                                    {action === 'VERIFY' && (
                                        <>
                                            <br />
                                            <span className="font-medium">{t('inventaire.create.recap_perimeter')} :</span>{' '}
                                            {[
                                                loadingRayons ? t('common:loading') : (rayonId ? rayons?.find(r => r.id === rayonId)?.name : t('inventaire.create.rayon_all')),
                                                loadingGroupes ? t('common:loading') : (groupeId ? groupes?.find((g) => g.id === groupeId)?.nom : t('inventaire.create.groupe_all')),
                                                loadingFormes ? t('common:loading') : (formeId ? formes?.find(f => f.id === formeId)?.nom : t('inventaire.create.forme_all'))
                                            ].filter(Boolean).join(' · ')}
                                        </>
                                    )}
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3 pt-4 border-t border-slate-100">
                        {step === 2 ? (
                            <>
                                <button
                                    type="button"
                                    className="inline-flex items-center justify-center h-10 rounded-xl text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors px-5 gap-2"
                                    onClick={handleBack}
                                    disabled={isSaving}
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    {t('common:back', 'Retour')}
                                </button>
                                <div className="flex-1" />
                                <button
                                    type="button"
                                    className="inline-flex items-center justify-center h-10 rounded-xl text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors px-5"
                                    onClick={onClose}
                                    disabled={isSaving}
                                >
                                    {t('common:cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="inline-flex items-center justify-center h-10 rounded-xl text-sm font-black bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors gap-2 disabled:opacity-60 px-5"
                                    disabled={isSaving}
                                >
                                    {isSaving ? <Loader2 className="size-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                                    {t('common:confirm')}
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    className="inline-flex items-center justify-center h-10 flex-1 rounded-xl text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                                    onClick={onClose}
                                    disabled={isSaving}
                                >
                                    {t('common:cancel')}
                                </button>
                                <button
                                    type="button"
                                    className="inline-flex items-center justify-center h-10 flex-[2] rounded-xl text-sm font-black bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors gap-2 disabled:opacity-60"
                                    onClick={handleNext}
                                    disabled={isSaving}
                                >
                                    {t('common:next', 'Suivant')}
                                    <ArrowRight className="h-5 w-5" />
                                </button>
                            </>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};

export default InventaireCreateModal;
