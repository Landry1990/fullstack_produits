import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRayons, useFormes, useGroupes } from '../../../hooks/useProduits';
import { CheckCircle2, ClipboardIcon, Edit3, Settings2, Warehouse, Store, Archive } from 'lucide-react';

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
    const { t } = useTranslation();
    const [action, setAction] = useState<'VERIFY' | 'ENTRY'>('VERIFY');
    const [stockType, setStockType] = useState<'GLOBAL' | 'RAYON' | 'RESERVE'>('RAYON');
    
    // Filters for "Vérifier"
    const [rayonId, setRayonId] = useState<number | undefined>(undefined);
    const [groupeId, setGroupeId] = useState<number | undefined>(undefined);
    const [formeId, setFormeId] = useState<number | undefined>(undefined);

    const { data: rayons } = useRayons();
    const { data: formes } = useFormes();
    const { data: groupes } = useGroupes();

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm({
            action,
            stockType,
            rayonId: action === 'VERIFY' ? rayonId : undefined,
            groupeId: action === 'VERIFY' ? groupeId : undefined,
            formeId: action === 'VERIFY' ? formeId : undefined,
        });
    };

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-2xl p-0 overflow-hidden rounded-2xl border border-base-300 shadow-2xl">
                <div className="p-6 border-b border-base-200 bg-base-50 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <ClipboardIcon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-bold text-xl text-base-content">{t('stock.inventaire.create.title')}</h3>
                        <p className="text-sm text-base-content/60 mt-0.5">{t('stock.inventaire.subtitle')}</p>
                    </div>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Action Selection */}
                    <div className="space-y-3">
                        <span className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest pl-1">
                            {t('stock.inventaire.create.action_title')}
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <label className={`flex items-start p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 group ${action === 'VERIFY' ? 'border-primary bg-primary/5 shadow-inner' : 'border-base-200 hover:border-base-300 bg-base-50'}`}>
                                <div className="flex items-center h-5 mr-3 mt-1">
                                    <input 
                                        type="radio" 
                                        className="radio radio-primary radio-sm" 
                                        checked={action === 'VERIFY'} 
                                        onChange={() => setAction('VERIFY')} 
                                    />
                                </div>
                                <div>
                                    <div className={`font-bold text-sm ${action === 'VERIFY' ? 'text-primary' : 'text-base-content'}`}>{t('stock.inventaire.create.action_verify')}</div>
                                    <div className="text-[11px] opacity-60 leading-tight mt-1">{t('stock.inventaire.create.action_verify_desc')}</div>
                                </div>
                                <Settings2 className={`h-5 w-5 ml-auto opacity-10 group-hover:opacity-20 transition-opacity ${action === 'VERIFY' ? 'text-primary opacity-20' : ''}`} />
                            </label>
                            
                            <label className={`flex items-start p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 group ${action === 'ENTRY' ? 'border-primary bg-primary/5 shadow-inner' : 'border-base-200 hover:border-base-300 bg-base-50'}`}>
                                <div className="flex items-center h-5 mr-3 mt-1">
                                    <input 
                                        type="radio" 
                                        className="radio radio-primary radio-sm" 
                                        checked={action === 'ENTRY'} 
                                        onChange={() => setAction('ENTRY')} 
                                    />
                                </div>
                                <div>
                                    <div className={`font-bold text-sm ${action === 'ENTRY' ? 'text-primary' : 'text-base-content'}`}>{t('stock.inventaire.create.action_entry')}</div>
                                    <div className="text-[11px] opacity-60 leading-tight mt-1">{t('stock.inventaire.create.action_entry_desc')}</div>
                                </div>
                                <Edit3 className={`h-5 w-5 ml-auto opacity-10 group-hover:opacity-20 transition-opacity ${action === 'ENTRY' ? 'text-primary opacity-20' : ''}`} />
                            </label>
                        </div>
                    </div>

                    {/* Stock Type Selection */}
                    <div className="space-y-3">
                        <span className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest pl-1">
                            {t('stock.inventaire.create.stock_type_title')}
                        </span>
                        <div className="grid grid-cols-3 gap-3">
                            <label className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${stockType === 'GLOBAL' ? 'border-primary bg-primary/5' : 'border-base-200 bg-base-50 opacity-70 hover:opacity-100'}`}>
                                <Archive className={`h-5 w-5 mb-2 ${stockType === 'GLOBAL' ? 'text-primary' : 'text-base-content/40'}`} />
                                <input type="radio" className="hidden" checked={stockType === 'GLOBAL'} onChange={() => setStockType('GLOBAL')} />
                                <span className="text-xs font-bold text-center">{t('stock.inventaire.create.stock_global')}</span>
                            </label>
                            
                            <label className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${stockType === 'RAYON' ? 'border-primary bg-primary/5' : 'border-base-200 bg-base-50 opacity-70 hover:opacity-100'}`}>
                                <Store className={`h-5 w-5 mb-2 ${stockType === 'RAYON' ? 'text-primary' : 'text-base-content/40'}`} />
                                <input type="radio" className="hidden" checked={stockType === 'RAYON'} onChange={() => setStockType('RAYON')} />
                                <span className="text-xs font-bold text-center">{t('stock.inventaire.create.stock_rayon')}</span>
                            </label>
                            
                            <label className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${stockType === 'RESERVE' ? 'border-primary bg-primary/5' : 'border-base-200 bg-base-50 opacity-70 hover:opacity-100'}`}>
                                <Warehouse className={`h-5 w-5 mb-2 ${stockType === 'RESERVE' ? 'text-primary' : 'text-base-content/40'}`} />
                                <input type="radio" className="hidden" checked={stockType === 'RESERVE'} onChange={() => setStockType('RESERVE')} />
                                <span className="text-xs font-bold text-center">{t('stock.inventaire.create.stock_reserve')}</span>
                            </label>
                        </div>
                    </div>

                    {/* Category Selection (Only for VERIFY) */}
                    {action === 'VERIFY' && (
                        <div className="space-y-3 bg-base-50 p-4 rounded-xl border border-base-200 animate-in slide-in-from-top-2 duration-300">
                             <span className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest block">
                                {t('stock.inventaire.create.perimeter_title')}
                             </span>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                                <div className="form-control w-full">
                                    <label className="label py-1"><span className="label-text text-[10px] uppercase font-bold text-base-content/50">{t('sidebar.stock.organisation.tabs.rayons', 'Rayon')}</span></label>
                                    <select 
                                        className="select select-bordered select-sm w-full rounded-lg bg-base-100"
                                        value={rayonId || ''}
                                        onChange={(e) => setRayonId(e.target.value ? parseInt(e.target.value) : undefined)}
                                    >
                                        <option value="">{t('stock.inventaire.create.rayon_all')}</option>
                                        {rayons?.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-control w-full">
                                    <label className="label py-1"><span className="label-text text-[10px] uppercase font-bold text-base-content/50">{t('sidebar.stock.organisation.tabs.groupes', 'Groupe')}</span></label>
                                    <select 
                                        className="select select-bordered select-sm w-full rounded-lg bg-base-100"
                                        value={groupeId || ''}
                                        onChange={(e) => setGroupeId(e.target.value ? parseInt(e.target.value) : undefined)}
                                    >
                                        <option value="">{t('stock.inventaire.create.groupe_all')}</option>
                                        {groupes?.map((g: any) => <option key={g.id} value={g.id}>{g.nom}</option>)}
                                    </select>
                                </div>
                                <div className="form-control w-full">
                                    <label className="label py-1"><span className="label-text text-[10px] uppercase font-bold text-base-content/50">{t('sidebar.stock.organisation.tabs.formes', 'Forme')}</span></label>
                                    <select 
                                        className="select select-bordered select-sm w-full rounded-lg bg-base-100"
                                        value={formeId || ''}
                                        onChange={(e) => setFormeId(e.target.value ? parseInt(e.target.value) : undefined)}
                                    >
                                        <option value="">{t('stock.inventaire.create.forme_all')}</option>
                                        {formes?.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
                                    </select>
                                </div>
                             </div>
                        </div>
                    )}

                    <div className="flex gap-3 pt-4 border-t border-base-200">
                        <button type="button" className="btn btn-ghost rounded-xl flex-1" onClick={onClose} disabled={isSaving}>
                            {t('common.cancel')}
                        </button>
                        <button type="submit" className="btn btn-primary rounded-xl flex-[2] shadow-lg shadow-primary/20 gap-2" disabled={isSaving}>
                            {isSaving ? <span className="loading loading-spinner loading-sm"></span> : <CheckCircle2 className="h-5 w-5" />}
                            {t('common.confirm')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default InventaireCreateModal;
