import { Printer, History } from 'lucide-react';
import type { Creance } from '../../../types';
import PremiumModal from '../../common/PremiumModal';
import { formatCurrency } from '../../../utils/formatters';

interface CreanceDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    creance: Creance | null;
    onPrintReceipt: (creanceId: number, paiementId?: number) => void;
}

export const CreanceDetailsModal: React.FC<CreanceDetailsModalProps> = ({
    isOpen,
    onClose,
    creance,
    onPrintReceipt
}) => {
    if (!creance) return null;

    const paiements = creance.paiements || [];

    const getModeIcon = (mode: string) => {
        switch (mode) {
            case 'especes': return '💵';
            case 'cheque': return '📝';
            case 'carte': return '💳';
            case 'virement': return '🏦';
            case 'om': return '🟧';
            case 'momo': return '📱';
            case 'recouvrement': return '💸';
            default: return '💰';
        }
    };

    return (
        <PremiumModal
            isOpen={isOpen}
            onClose={onClose}
            title="👁️ Historique des Paiements"
            maxWidth="max-w-3xl"
        >
            <div className="space-y-6">
                {/* Facture Identity */}
                <div className="flex flex-col md:flex-row gap-4 p-4 bg-base-200/50 rounded-2xl border border-base-200 shadow-inner">
                    <div className="flex-1 space-y-1">
                        <div className="text-[10px] font-black uppercase text-base-content/40 tracking-widest">Facture</div>
                        <div className="text-xl font-black text-primary tracking-tighter">{creance.numero_facture}</div>
                        <div className="text-sm font-bold text-base-content/60">Émise le {new Date(creance.date).toLocaleDateString('fr-FR')}</div>
                    </div>
                    <div className="flex-1 space-y-1 md:border-l md:pl-4 border-base-300">
                        <div className="text-[10px] font-black uppercase text-base-content/40 tracking-widest">Client / Bénéficiaire</div>
                        <div className="text-base font-bold text-base-content">{creance.client_name}</div>
                        <div className="text-xs font-semibold text-base-content/50">{creance.ayant_droit_details?.nom || 'Pas d\'ayant droit'}</div>
                    </div>
                    <div className="flex-1 space-y-1 md:border-l md:pl-4 border-base-300">
                        <div className="text-[10px] font-black uppercase text-base-content/40 tracking-widest">Résumé Financier</div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold">Total:</span>
                            <span className="font-black">{formatCurrency(Math.round(parseFloat(creance.total_ttc)))} F</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-warning">Reste:</span>
                            <span className="font-black text-warning">{formatCurrency(Math.round(parseFloat(creance.reste_a_payer)))} F</span>
                        </div>
                    </div>
                </div>

                {/* Paiements Table */}
                <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2 px-1">
                        <History className="w-3.5 h-3.5" /> Liste des encaissements
                    </h4>
                    
                    {paiements.length === 0 ? (
                        <div className="bg-base-100 border border-dashed border-base-300 rounded-2xl p-10 text-center">
                            <p className="text-base-content/30 italic text-sm">Aucun paiement enregistré pour cette facture.</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-base-200 overflow-hidden shadow-sm">
                            <table className="table w-full">
                                <thead>
                                    <tr className="bg-base-100 border-b border-base-200">
                                        <th className="text-[9px] font-black uppercase text-base-content/40 tracking-widest">Date</th>
                                        <th className="text-[9px] font-black uppercase text-base-content/40 tracking-widest">Mode</th>
                                        <th className="text-[9px] font-black uppercase text-base-content/40 tracking-widest">Référence</th>
                                        <th className="text-[9px] font-black uppercase text-base-content/40 tracking-widest text-right">Montant</th>
                                        <th className="text-[9px] font-black uppercase text-base-content/40 tracking-widest text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {paiements.map((p: any) => (
                                        <tr key={p.id} className="hover:bg-base-50 transition-colors border-b border-base-100 last:border-none">
                                            <td className="font-mono text-base-content/60">{new Date(p.date_paiement || p.created_at).toLocaleString('fr-FR')}</td>
                                            <td className="font-bold">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg leading-none">{getModeIcon(p.mode_paiement)}</span>
                                                    <span className="capitalize">{p.mode_paiement}</span>
                                                </div>
                                            </td>
                                            <td className="font-mono text-xs text-base-content/50">{p.reference || '-'}</td>
                                            <td className="text-right font-black italic">{formatCurrency(Math.round(parseFloat(p.montant)))} F</td>
                                            <td className="text-center">
                                                <button 
                                                    onClick={() => onPrintReceipt(creance.id, p.id)}
                                                    className="btn btn-xs btn-circle btn-ghost hover:bg-primary/10 hover:text-primary transition-all shadow-sm"
                                                    title="Imprimer le reçu"
                                                >
                                                    <Printer className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-center bg-primary/5 p-4 rounded-2xl border border-primary/10">
                    <div className="text-xs font-bold text-primary/60 uppercase tracking-widest">Total encaissé sur cette facture</div>
                    <div className="text-2xl font-black text-primary italic tracking-tighter">
                        {formatCurrency(Math.round(parseFloat(creance.montant_paye)))} F
                    </div>
                </div>

                <div className="pt-2 flex justify-end gap-3">
                    <button onClick={onClose} className="btn btn-ghost px-8 font-bold uppercase tracking-widest text-xs">
                        Fermer
                    </button>
                    <button 
                        onClick={() => onPrintReceipt(creance.id)} 
                        className="btn btn-accent px-8 font-black uppercase tracking-widest text-xs gap-2 shadow-lg shadow-accent/20"
                    >
                        <Printer className="w-4 h-4" />
                        Imprimer Reçu Global
                    </button>
                </div>
            </div>
        </PremiumModal>
    );
};
