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
            <div className="space-y-6 p-6">
                {/* Facture Identity */}
                <div className="flex flex-col md:flex-row gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-inner">
                    <div className="flex-1 space-y-1">
                        <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('creances:details_modal.invoice')}</div>
                        <div className="text-xl font-black text-emerald-600 tracking-tighter">{creance.numero_facture}</div>
                        <div className="text-sm font-bold text-slate-500">{t('creances:details_modal.issued_on')} {formatDate(creance.date)}</div>
                    </div>
                    <div className="flex-1 space-y-1 md:border-l md:pl-4 border-slate-200">
                        <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('creances:details_modal.client_beneficiary')}</div>
                        <div className="text-base font-bold text-slate-800">{creance.client_name}</div>
                        <div className="text-xs font-semibold text-slate-500">{creance.ayant_droit_details?.nom || t('creances:details_modal.no_beneficiary')}</div>
                    </div>
                    <div className="flex-1 space-y-1 md:border-l md:pl-4 border-slate-200">
                        <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('creances:details_modal.financial_summary')}</div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-700">{t('creances:details_modal.total')}</span>
                            <span className="font-black text-slate-800">{formatCurrency(Math.round(parseFloat(creance.total_ttc)))}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-amber-600">{t('creances:details_modal.remaining')}</span>
                            <span className="font-black text-amber-600">{formatCurrency(Math.round(parseFloat(creance.reste_a_payer)))}</span>
                        </div>
                    </div>
                </div>

                {/* Paiements Table */}
                <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2 px-1">
                        <History className="size-3.5" /> {t('creances:details_modal.payment_list')}
                    </h4>

                    {paiements.length === 0 ? (
                        <div className="bg-white border border-dashed border-slate-200 rounded-xl p-10 text-center">
                            <p className="text-slate-400 italic text-sm">{t('creances:details_modal.no_payments')}</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-4 py-3">{t('creances:details_modal.headers.date')}</th>
                                        <th className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-4 py-3">{t('creances:details_modal.headers.mode')}</th>
                                        <th className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-4 py-3">{t('creances:details_modal.headers.reference')}</th>
                                        <th className="text-[9px] font-black uppercase text-slate-400 tracking-widest text-right px-4 py-3">{t('creances:details_modal.headers.amount')}</th>
                                        <th className="text-[9px] font-black uppercase text-slate-400 tracking-widest text-center px-4 py-3">{t('creances:details_modal.headers.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {paiements.map((p: any) => (
                                        <tr key={p.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-none">
                                            <td className="px-4 py-3 font-mono text-slate-500">{formatDateTime(p.date_paiement || p.created_at)}</td>
                                            <td className="px-4 py-3 font-bold text-slate-700">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg leading-none">{getModeIcon(p.mode_paiement)}</span>
                                                    <span className="capitalize">{t(`common:payment_modes.${p.mode_paiement}`)}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.reference || '-'}</td>
                                            <td className="px-4 py-3 text-right font-black italic text-slate-800">{formatCurrency(Math.round(parseFloat(p.montant)))}</td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => onPrintReceipt(creance.id, p.id)}
                                                    className="inline-flex items-center justify-center size-7 rounded-full text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-all shadow-sm"
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

                <div className="flex justify-between items-center bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                    <div className="text-xs font-bold text-emerald-600/60 uppercase tracking-widest">{t('creances:details_modal.total_collected')}</div>
                    <div className="text-2xl font-black text-emerald-600 italic tracking-tighter">
                        {formatCurrency(Math.round(parseFloat(creance.montant_paye)))}
                    </div>
                </div>

                <div className="pt-2 flex justify-end gap-3">
                    <button onClick={onClose} className="inline-flex items-center justify-center h-9 px-8 rounded-lg text-xs font-bold uppercase tracking-widest text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                        {t('creances:details_modal.close')}
                    </button>
                    <button
                        onClick={() => onPrintReceipt(creance.id)}
                        className="inline-flex items-center justify-center h-9 px-8 rounded-lg text-xs font-black uppercase tracking-widest bg-emerald-600 text-white gap-2 shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors"
                    >
                        <Printer className="size-4" />
                        {t('creances:details_modal.print_global_receipt')}
                    </button>
                </div>
            </div>
        </PremiumModal>
    );
};
