import React from 'react';
import { Layers, CreditCard, Hash, AlertTriangle, CheckCircle2, Info, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PremiumModal from '../../common/PremiumModal';
import { formatCurrency } from '../../../utils/formatters';

interface BulkPaiementModalProps {
    isOpen: boolean;
    onClose: () => void;
    count: number;
    totalAmount: number;
    form: {
        modePaiement: string;
        setModePaiement: (mode: string) => void;
        referencePaiement: string;
        setReferencePaiement: (ref: string) => void;
        montantTotalBulk: string;
        setMontantTotalBulk: (val: string) => void;
    };
    onConfirm: () => void;
}

export const BulkPaiementModal: React.FC<BulkPaiementModalProps> = ({
    isOpen,
    onClose,
    count,
    totalAmount,
    form,
    onConfirm
}) => {
    const { t } = useTranslation(['creances', 'common']);

    return (
        <PremiumModal
            isOpen={isOpen}
            onClose={onClose}
            title={t('creances:bulk_modal.title')}
            maxWidth="max-w-md"
        >
            <div className="space-y-6 p-6">
                {/* Summary Section */}
                <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-xl flex flex-col items-center gap-4 text-center">
                    <div className="p-3 bg-white rounded-xl shadow-sm">
                        <Layers className="size-8 text-emerald-600" />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-emerald-600 uppercase tracking-widest mb-1">
                            {t('creances:bulk_modal.selected_invoices', { count })}
                        </div>
                        <div className="text-3xl font-black text-slate-800 italic tracking-tight">
                            {formatCurrency(Math.round(totalAmount))}
                        </div>
                        <div className="text-xs text-slate-500">
                            {form.montantTotalBulk && parseFloat(form.montantTotalBulk) > 0
                                ? `Règlement partiel: ${formatCurrency(parseFloat(form.montantTotalBulk))} / ${formatCurrency(totalAmount)}`
                                : 'Règlement total des factures sélectionnées'
                            }
                        </div>
                    </div>
                </div>

                {/* Warning Alert */}
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 shadow-sm">
                    <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-[11px] font-medium leading-relaxed text-amber-800">
                        {t('creances:bulk_modal.warning_text')}
                        <br />
                        {t('creances:bulk_modal.warning_subtext')}
                    </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                    {/* Montant personnalisé - Paiement partiel */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 ml-1">
                            <Wallet className="size-3" /> Montant à régler (optionnel)
                        </label>
                        <input
                            type="number"
                            placeholder={`Max: ${formatCurrency(totalAmount)} - Laisser vide pour tout régler`}
                            value={form.montantTotalBulk}
                            onChange={(e) => {
                                const val = e.target.value;
                                const num = parseFloat(val);
                                if (!val || (num > 0 && num <= totalAmount)) {
                                    form.setMontantTotalBulk(val);
                                }
                            }}
                            className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all font-mono text-sm text-slate-700"
                        />
                        <p className="text-[10px] text-slate-400 ml-1">
                            {form.montantTotalBulk
                                ? `Restera à payer: ${formatCurrency(totalAmount - parseFloat(form.montantTotalBulk || '0'))}`
                                : 'Laisser vide pour régler le total des factures'
                            }
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 ml-1">
                            <CreditCard className="size-3" /> {t('creances:bulk_modal.payment_mode')}
                        </label>
                        <select
                            value={form.modePaiement}
                            onChange={(e) => form.setModePaiement(e.target.value)}
                            className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        >
                            <option value="especes">{t('creances:payment_modal.modes.cash')}</option>
                            <option value="om">{t('creances:payment_modal.modes.om')}</option>
                            <option value="momo">{t('creances:payment_modal.modes.momo')}</option>
                            <option value="cheque">{t('creances:payment_modal.modes.check')}</option>
                            <option value="carte">{t('creances:payment_modal.modes.card')}</option>
                            <option value="virement">{t('creances:payment_modal.modes.transfer')}</option>
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 ml-1">
                            <Hash className="size-3" /> {t('creances:bulk_modal.bulk_reference')}
                        </label>
                        <input
                            type="text"
                            placeholder={t('creances:bulk_modal.reference_placeholder')}
                            value={form.referencePaiement}
                            onChange={(e) => form.setReferencePaiement(e.target.value)}
                            className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all font-mono text-sm text-slate-700"
                        />
                    </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl flex items-center gap-3 border border-slate-200">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                        <Info className="size-3 text-slate-400" />
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium">
                        {t('creances:bulk_modal.supervisor_hint')}
                    </p>
                </div>

                <div className="pt-4 flex gap-3">
                    <button onClick={onClose} className="inline-flex items-center justify-center h-9 flex-1 rounded-lg text-xs font-bold uppercase tracking-widest text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                        {t('creances:bulk_modal.cancel')}
                    </button>
                    <button
                        onClick={onConfirm}
                        className="inline-flex items-center justify-center h-9 flex-1 rounded-lg text-xs font-black uppercase tracking-widest bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors gap-2"
                    >
                        <CheckCircle2 className="size-4" />
                        {t('creances:bulk_modal.confirm_payment')}
                    </button>
                </div>
            </div>
        </PremiumModal>
    );
};
