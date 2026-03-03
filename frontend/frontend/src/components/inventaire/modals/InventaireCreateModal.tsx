import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRayons, useFormes, useGroupes } from '../../../hooks/useProduits';

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
            <div className="modal-box max-w-2xl">
                <h3 className="font-bold text-lg mb-6">{t('stock.inventaire.create.title', 'Nouvel inventaire')}</h3>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Action Selection */}
                    <div className="bg-base-200 p-4 rounded-lg">
                        <span className="text-sm font-semibold mb-3 block opacity-70">SÉLECTIONNER UNE ACTION</span>
                        <div className="flex gap-4">
                            <label className={`flex-1 flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all ${action === 'VERIFY' ? 'border-primary bg-primary/10' : 'border-base-300'}`}>
                                <input 
                                    type="radio" 
                                    className="radio radio-primary mr-3" 
                                    checked={action === 'VERIFY'} 
                                    onChange={() => setAction('VERIFY')} 
                                />
                                <div>
                                    <div className="font-bold">Vérifier une liste de produits</div>
                                    <div className="text-xs opacity-60">Pré-remplir l'inventaire selon des critères</div>
                                </div>
                            </label>
                            <label className={`flex-1 flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all ${action === 'ENTRY' ? 'border-primary bg-primary/10' : 'border-base-300'}`}>
                                <input 
                                    type="radio" 
                                    className="radio radio-primary mr-3" 
                                    checked={action === 'ENTRY'} 
                                    onChange={() => setAction('ENTRY')} 
                                />
                                <div>
                                    <div className="font-bold">Saisir un inventaire</div>
                                    <div className="text-xs opacity-60">Démarrer avec un inventaire vide</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Stock Type Selection */}
                    <div className="bg-base-200 p-4 rounded-lg">
                        <span className="text-sm font-semibold mb-3 block opacity-70">TYPE DE STOCK</span>
                        <div className="flex gap-4">
                            <label className={`flex-1 flex items-center p-3 rounded-lg border cursor-pointer ${stockType === 'GLOBAL' ? 'bg-base-100 border-primary' : 'border-transparent'}`}>
                                <input type="radio" className="radio radio-sm mr-2" checked={stockType === 'GLOBAL'} onChange={() => setStockType('GLOBAL')} />
                                <span className="text-sm">Stock global</span>
                            </label>
                            <label className={`flex-1 flex items-center p-3 rounded-lg border cursor-pointer ${stockType === 'RAYON' ? 'bg-base-100 border-primary' : 'border-transparent'}`}>
                                <input type="radio" className="radio radio-sm mr-2" checked={stockType === 'RAYON'} onChange={() => setStockType('RAYON')} />
                                <span className="text-sm">Stock rayon</span>
                            </label>
                            <label className={`flex-1 flex items-center p-3 rounded-lg border cursor-pointer ${stockType === 'RESERVE' ? 'bg-base-100 border-primary' : 'border-transparent'}`}>
                                <input type="radio" className="radio radio-sm mr-2" checked={stockType === 'RESERVE'} onChange={() => setStockType('RESERVE')} />
                                <span className="text-sm">Stock réserve</span>
                            </label>
                        </div>
                    </div>

                    {/* Category Selection (Only for VERIFY) */}
                    {action === 'VERIFY' && (
                        <div className="bg-base-200 p-4 rounded-lg animate-in fade-in duration-300">
                             <span className="text-sm font-semibold mb-3 block opacity-70">PÉRIMÈTRE DE L'INVENTAIRE</span>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="form-control">
                                    <label className="label py-1"><span className="label-text text-xs">Rayon</span></label>
                                    <select 
                                        className="select select-bordered select-sm w-full"
                                        value={rayonId || ''}
                                        onChange={(e) => setRayonId(e.target.value ? parseInt(e.target.value) : undefined)}
                                    >
                                        <option value="">Tous les rayons</option>
                                        {rayons?.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-control">
                                    <label className="label py-1"><span className="label-text text-xs">Groupe</span></label>
                                    <select 
                                        className="select select-bordered select-sm w-full"
                                        value={groupeId || ''}
                                        onChange={(e) => setGroupeId(e.target.value ? parseInt(e.target.value) : undefined)}
                                    >
                                        <option value="">Tous les groupes</option>
                                        {groupes?.map((g: any) => <option key={g.id} value={g.id}>{g.nom}</option>)}
                                    </select>
                                </div>
                                <div className="form-control">
                                    <label className="label py-1"><span className="label-text text-xs">Forme</span></label>
                                    <select 
                                        className="select select-bordered select-sm w-full"
                                        value={formeId || ''}
                                        onChange={(e) => setFormeId(e.target.value ? parseInt(e.target.value) : undefined)}
                                    >
                                        <option value="">Toutes les formes</option>
                                        {formes?.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
                                    </select>
                                </div>
                             </div>
                        </div>
                    )}

                    <div className="modal-action mt-8">
                        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isSaving}>
                            {t('common.cancel')}
                        </button>
                        <button type="submit" className="btn btn-primary px-8" disabled={isSaving}>
                            {isSaving && <span className="loading loading-spinner"></span>}
                            {t('common.confirm', 'Valider')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default InventaireCreateModal;
