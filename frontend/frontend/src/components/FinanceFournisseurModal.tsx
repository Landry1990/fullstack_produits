import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Fournisseur } from '../types';
import { useFinanceFournisseurs } from '../hooks/useFinanceFournisseurs';
import PremiumModal from './common/PremiumModal';

interface FinanceFournisseurModalProps {
    isOpen: boolean;
    onClose: () => void;
    fournisseur: Fournisseur;
    onSuccess?: () => void;
    prefilledMontant?: number;
    commandeIds?: number[];
}

export default function FinanceFournisseurModal({ isOpen, onClose, fournisseur, onSuccess, prefilledMontant, commandeIds }: FinanceFournisseurModalProps) {
    const { t } = useTranslation();
    const { 
        paiements, 
        loading, 
        fetchPaiements, 
        createPaiement, 
        deletePaiement 
    } = useFinanceFournisseurs();

    const [montant, setMontant] = useState('');
    const [modePaiement, setModePaiement] = useState('ESP');
    const [reference, setReference] = useState('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && fournisseur) {
            fetchPaiements(fournisseur.id);
            // Reset form or use prefilled
            setMontant(prefilledMontant ? prefilledMontant.toString() : '');
            setModePaiement('ESP');
            setReference('');
            setNotes(commandeIds && commandeIds.length > 0 ? `Règlement global du Pointage des factures (Qté: ${commandeIds.length})` : '');
        }
    }, [isOpen, fournisseur, fetchPaiements, prefilledMontant, commandeIds]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!montant || isNaN(Number(montant))) return;

        setIsSubmitting(true);
        try {
            const payload: any = {
                fournisseur: fournisseur.id,
                montant: parseFloat(montant).toFixed(2),
                mode_paiement: modePaiement as any,
                reference: reference,
                notes: notes
            };
            
            // Si on vient d'un pointage global, relier le paiement à ces factures
            if (commandeIds && commandeIds.length > 0) {
               payload.commande_ids = commandeIds;
            }

            await createPaiement(payload);
            setMontant('');
            setReference('');
            setNotes('');
            if (onSuccess) onSuccess();
        } catch (error) {
            // Error handling is done in hook
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (window.confirm(t('providers.finance.delete_confirm'))) {
             await deletePaiement(id);
             if (onSuccess) onSuccess();
        }
    };

    return (
        <PremiumModal
            isOpen={isOpen}
            onClose={onClose}
            title={t('providers.finance.title')}
            subtitle={fournisseur.name}
            icon={
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
            }
            gradientFrom="emerald-500/10"
            gradientVia="primary/5"
            gradientTo="success/10"
            maxWidth="max-w-4xl"
            disableClose={isSubmitting}
        >
            {/* Debt Balance Banner */}
            <div className="px-6 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex justify-end">
                <div className="text-right">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{t('providers.details.debt_balance')}</p>
                    <p className={`text-xl font-black font-mono ${ Number(fournisseur.solde_dette) > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                        {Number(fournisseur.solde_dette || 0).toLocaleString('fr-FR')} F
                    </p>
                </div>
            </div>

            <div className="flex" style={{ height: '60vh' }}>
                {/* Left Panel: New Payment Form */}
                <div className="w-1/3 border-r bg-white p-6 overflow-y-auto">
                    <h4 className="font-bold text-lg mb-6 flex items-center gap-2">
                         <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm">₹</span>
                         {t('providers.finance.new_payment')}
                    </h4>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{t('providers.finance.amount')}</label>
                            <div className="relative">
                                <input 
                                type="number" 
                                min="0" 
                                step="0.01" 
                                value={montant}
                                onChange={e => setMontant(e.target.value)}
                                className={`input input-bordered w-full font-mono font-bold text-lg rounded-xl focus:border-emerald-500 focus:ring-emerald-500/20 ${prefilledMontant ? 'bg-emerald-50 border-emerald-200' : ''}`}
                                placeholder="0.00"
                                required 
                            />    <span className="absolute left-3 top-3.5 text-slate-400 font-bold">F</span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{t('providers.finance.payment_mode')}</label>
                            <select 
                                className="select select-bordered w-full h-12 rounded-xl"
                                value={modePaiement}
                                onChange={(e) => setModePaiement(e.target.value)}
                            >
                                <option value="ESP">{t('providers.finance.modes.cash')}</option>
                                <option value="CHQ">{t('providers.finance.modes.check')}</option>
                                <option value="VIR">{t('providers.finance.modes.transfer')}</option>
                                <option value="AVOIR">{t('providers.finance.modes.credit')}</option>
                                <option value="AUTRE">{t('providers.finance.modes.other')}</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{t('providers.finance.reference')}</label>
                            <input 
                                type="text" 
                                className="input input-bordered w-full h-12 rounded-xl" 
                                placeholder={t('providers.finance.reference_placeholder')}
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{t('providers.finance.notes')}</label>
                            <textarea 
                                className="textarea textarea-bordered w-full h-24 rounded-xl resize-none"
                                placeholder={t('providers.finance.notes_placeholder')}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            ></textarea>
                        </div>

                        <button 
                            type="submit" 
                            className="btn btn-primary w-full mt-4 rounded-xl shadow-lg shadow-primary/20"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? <span className="loading loading-spinner"></span> : t('providers.finance.save_payment')}
                        </button>
                    </form>
                </div>

                {/* Right Panel: History */}
                <div className="flex-1 bg-slate-50/50 flex flex-col overflow-hidden">
                    <div className="p-4 border-b bg-white/50 backdrop-blur shrink-0">
                        <h4 className="font-bold text-slate-700">{t('providers.finance.history')}</h4>
                    </div>
                    <div className="flex-1 overflow-y-auto p-0 min-h-0">
                        {loading ? (
                            <div className="flex justify-center items-center h-full">
                                <span className="loading loading-spinner loading-lg text-primary"></span>
                            </div>
                        ) : paiements.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p>{t('providers.finance.no_payments')}</p>
                            </div>
                        ) : (
                            <table className="table table-pin-rows">
                                <thead className="text-xs uppercase bg-slate-100 text-slate-500">
                                    <tr>
                                        <th>{t('providers.finance.table.date')}</th>
                                        <th>{t('providers.finance.table.mode')}</th>
                                        <th>{t('providers.finance.table.reference')}</th>
                                        <th className="text-right">{t('providers.finance.table.amount')}</th>
                                        <th className="text-center">{t('providers.finance.table.action')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paiements.map((paiement) => (
                                        <tr key={paiement.id} className="hover:bg-white transition-colors border-b border-slate-100">
                                            <td className="font-mono text-sm">
                                                {new Date(paiement.date_paiement).toLocaleDateString('fr-FR')}
                                            </td>
                                            <td>
                                                <span className={`badge badge-sm font-semibold capitalize ${
                                                    paiement.mode_paiement === 'ESP' ? 'badge-warning bg-yellow-100 text-yellow-800 border-none' :
                                                    paiement.mode_paiement === 'CHQ' ? 'badge-info bg-blue-100 text-blue-800 border-none' :
                                                    'badge-ghost'
                                                }`}>
                                                    {paiement.mode_paiement === 'ESP' ? t('providers.finance.modes.cash') :
                                                     paiement.mode_paiement === 'CHQ' ? t('providers.finance.modes.check') :
                                                     paiement.mode_paiement === 'VIR' ? t('providers.finance.modes.transfer') : 
                                                     paiement.mode_paiement}
                                                </span>
                                            </td>
                                            <td className="text-sm text-slate-600">
                                                {paiement.reference || '-'}
                                                {paiement.notes && (
                                                    <div className="text-xs text-slate-400 truncate max-w-[150px]" title={paiement.notes}>
                                                        {paiement.notes}
                                                    </div>
                                                )}
                                                {paiement.commandes_liees && paiement.commandes_liees.length > 0 && (
                                                    <div className="mt-1 flex flex-wrap gap-1">
                                                       {paiement.commandes_liees.map(cmd => (
                                                          <span key={cmd} className="badge badge-xs badge-neutral font-mono text-[9px]">{cmd}</span>
                                                       ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="text-right font-bold font-mono">
                                                {Number(paiement.montant).toLocaleString('fr-FR')} F
                                            </td>
                                            <td className="text-center">
                                                <button 
                                                    className="btn btn-ghost btn-xs text-error tooltip tooltip-left" 
                                                    data-tip="Supprimer"
                                                    onClick={() => handleDelete(paiement.id)}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </PremiumModal>
    );
}
