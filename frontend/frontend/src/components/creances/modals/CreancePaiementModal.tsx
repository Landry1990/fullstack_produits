import React from 'react';
import { DollarSign, CreditCard, Hash, Info, UserCheck } from 'lucide-react';
import type { Creance } from '../../../types';
import PremiumModal from '../../common/PremiumModal';

interface CreancePaiementModalProps {
    isOpen: boolean;
    onClose: () => void;
    creance: Creance | null;
    form: {
        modePaiement: string;
        setModePaiement: (mode: string) => void;
        montantPaiement: string;
        setMontantPaiement: (montant: string) => void;
        referencePaiement: string;
        setReferencePaiement: (ref: string) => void;
    };
    onConfirm: () => void;
}

export const CreancePaiementModal: React.FC<CreancePaiementModalProps> = ({
    isOpen,
    onClose,
    creance,
    form,
    onConfirm
}) => {
    if (!creance) return null;

    const remainingAmount = parseFloat(creance.reste_a_payer);

    return (
        <PremiumModal
            isOpen={isOpen}
            onClose={onClose}
            title="💰 Nouveau Règlement"
            maxWidth="max-w-md"
        >
            <div className="space-y-6">
                {/* Info Card */}
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex gap-3 shadow-sm">
                    <div className="p-2 bg-white rounded-xl shadow-sm h-fit">
                        <Info className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="text-sm">
                        <div className="font-bold text-blue-900 tracking-tight">Facture {creance.numero_facture}</div>
                        <div className="text-blue-700/70 font-medium">Par {creance.client_name}</div>
                        <div className="mt-2 flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase text-blue-400">Solde restant:</span>
                            <span className="text-blue-900 font-black">{(Math.round(remainingAmount)).toLocaleString()} F</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Payment Mode */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-base-content/40 flex items-center gap-1.5 ml-1">
                            <CreditCard className="w-3 h-3" /> Mode de Paiement
                        </label>
                        <select
                            value={form.modePaiement}
                            onChange={(e) => form.setModePaiement(e.target.value)}
                            className="select select-bordered w-full focus:ring-2 focus:ring-primary/20 transition-all font-bold"
                        >
                            <option value="especes">💵 Espèces</option>
                            <option value="om">🟧 Orange Money</option>
                            <option value="momo">📱 Mobile Money</option>
                            <option value="cheque">📝 Chèque</option>
                            <option value="carte">💳 Carte</option>
                            <option value="virement">🏦 Virement</option>
                            <option value="recouvrement">💸 Tiers Payeur</option>
                        </select>
                    </div>

                    {/* Amount */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-base-content/40 flex items-center gap-1.5 ml-1">
                            <DollarSign className="w-3 h-3" /> Montant à verser (F)
                        </label>
                        <div className="relative group">
                            <input
                                type="number"
                                value={form.montantPaiement}
                                onChange={(e) => form.setMontantPaiement(e.target.value)}
                                className="input input-bordered w-full pl-9 focus:ring-2 focus:ring-primary/20 transition-all font-black text-lg"
                                max={remainingAmount}
                            />
                            <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30 group-focus-within:text-primary transition-colors" />
                        </div>
                        <div className="flex justify-end gap-2 mt-1">
                            <button 
                                onClick={() => form.setMontantPaiement(remainingAmount.toString())}
                                className="link link-primary text-[10px] font-black uppercase"
                            >
                                Régler la totalité
                            </button>
                        </div>
                    </div>

                    {/* Reference */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-base-content/40 flex items-center gap-1.5 ml-1">
                            <Hash className="w-3 h-3" /> Référence (optionnelle)
                        </label>
                        <input
                            type="text"
                            placeholder="N° chèque, transaction, ID..."
                            value={form.referencePaiement}
                            onChange={(e) => form.setReferencePaiement(e.target.value)}
                            className="input input-bordered w-full focus:ring-2 focus:ring-primary/20 transition-all font-mono text-sm"
                        />
                    </div>
                </div>

                <div className="pt-4 flex gap-3">
                    <button onClick={onClose} className="btn btn-ghost flex-1 font-bold uppercase tracking-widest text-xs">
                        Annuler
                    </button>
                    <button 
                        onClick={onConfirm} 
                        className="btn btn-primary flex-1 font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20 gap-2"
                        disabled={!form.montantPaiement || parseFloat(form.montantPaiement) <= 0}
                    >
                        <UserCheck className="w-4 h-4" />
                        Valider & Payer
                    </button>
                </div>
            </div>
        </PremiumModal>
    );
};
