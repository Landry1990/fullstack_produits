import { Printer, History } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Creance } from '../../../types';
import PremiumModal from '../../common/PremiumModal';
import { formatCurrency } from '../../../utils/formatters';
import { formatDate, formatDateTime } from '../../../utils/dateUtils';

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
    const { t } = useTranslation(['creances', 'common']);
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
            title={t('creances:details_modal.title')}
            maxWidth="max-w-3xl"
        >
            <div className="space-y-6">
                {/* Facture Identity */}
                <div className="flex flex-col md:flex-row gap-4 p-4 bg-gray-50/50 rounded-xl border border-gray-100 shadow-inner">
                    <div className="flex-1 space-y-1">
                        <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{t('creances:details_modal.invoice')}</div>
                        <div className="text-xl font-black text-indigo-600 tracking-tighter">{creance.numero_facture}</div>
                        <div className="text-sm font-bold text-gray-500">{t('creances:details_modal.issued_on')} {formatDate(creance.date)}</div>
                    </div>
                    <div className="flex-1 space-y-1 md:border-l md:pl-4 border-gray-200">
                        <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{t('creances:details_modal.client_beneficiary')}</div>
                        <div className="text-base font-bold text-gray-900">{creance.client_name}</div>
                        <div className="text-xs font-semibold text-gray-500">{creance.ayant_droit_details?.nom || t('creances:details_modal.no_beneficiary')}</div>
                    </div>
                    <div className="flex-1 space-y-1 md:border-l md:pl-4 border-gray-200">
                        <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{t('creances:details_modal.financial_summary')}</div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold">{t('creances:details_modal.total')}</span>
                            <span className="font-black">{formatCurrency(Math.round(parseFloat(creance.total_ttc)))}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-amber-600">{t('creances:details_modal.remaining')}</span>
                            <span className="font-black text-amber-600">{formatCurrency(Math.round(parseFloat(creance.reste_a_payer)))}</span>
                        </div>
                    </div>
                </div>

                {/* Paiements Table */}
                <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2 px-1">
                        <History className="size-3.5" /> {t('creances:details_modal.payment_list')}
                    </h4>
                    
                    {paiements.length === 0 ? (
                        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-10 text-center">
                            <p className="text-gray-400 italic text-sm">{t('creances:details_modal.no_payments')}</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                            <table className="table w-full">
                                <thead>
                                    <tr className="bg-white border-b border-gray-100">
                                        <th className="text-[9px] font-black uppercase text-gray-400 tracking-widest">{t('creances:details_modal.headers.date')}</th>
                                        <th className="text-[9px] font-black uppercase text-gray-400 tracking-widest">{t('creances:details_modal.headers.mode')}</th>
                                        <th className="text-[9px] font-black uppercase text-gray-400 tracking-widest">{t('creances:details_modal.headers.reference')}</th>
                                        <th className="text-[9px] font-black uppercase text-gray-400 tracking-widest text-right">{t('creances:details_modal.headers.amount')}</th>
                                        <th className="text-[9px] font-black uppercase text-gray-400 tracking-widest text-center">{t('creances:details_modal.headers.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {paiements.map((p: any) => (
                                        <tr key={p.id} className="hover:bg-base-50 transition-colors border-b border-base-100 last:border-none">
                                            <td className="font-mono text-gray-500">{formatDateTime(p.date_paiement || p.created_at)}</td>
                                            <td className="font-bold">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg leading-none">{getModeIcon(p.mode_paiement)}</span>
                                                    <span className="capitalize">{t(`common:payment_modes.${p.mode_paiement}`)}</span>
                                                </div>
                                            </td>
                                            <td className="font-mono text-xs text-gray-500">{p.reference || '-'}</td>
                                            <td className="text-right font-black italic">{formatCurrency(Math.round(parseFloat(p.montant)))}</td>
                                            <td className="text-center">
                                                <button 
                                                    onClick={() => onPrintReceipt(creance.id, p.id)}
                                                    className="btn btn-xs btn-circle btn-ghost hover:bg-indigo-50 hover:text-indigo-600 transition-all shadow-sm"
                                                    title={t('creances:details_modal.print_receipt')}
                                                >
                                                    <Printer className="size-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-center bg-indigo-50/50 p-4 rounded-xl border border-indigo-500/10">
                    <div className="text-xs font-bold text-indigo-600/60 uppercase tracking-widest">{t('creances:details_modal.total_collected')}</div>
                    <div className="text-2xl font-black text-indigo-600 italic tracking-tighter">
                        {formatCurrency(Math.round(parseFloat(creance.montant_paye)))}
                    </div>
                </div>

                <div className="pt-2 flex justify-end gap-3">
                    <button onClick={onClose} className="btn btn-ghost px-8 font-bold uppercase tracking-widest text-xs">
                        {t('creances:details_modal.close')}
                    </button>
                    <button 
                        onClick={() => onPrintReceipt(creance.id)} 
                        className="btn btn-accent px-8 font-black uppercase tracking-widest text-xs gap-2 shadow-lg shadow-accent/20"
                    >
                        <Printer className="size-4" />
                        {t('creances:details_modal.print_global_receipt')}
                    </button>
                </div>
            </div>
        </PremiumModal>
    );
};
