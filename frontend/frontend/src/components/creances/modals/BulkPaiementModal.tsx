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
            <div className="space-y-6">
                {/* Summary Section */}
                <div className="bg-primary/10/50 border border-indigo-200 p-6 rounded-xl flex flex-col items-center gap-4 text-center">
                    <div className="p-3 bg-base-100 rounded-xl shadow-sm">
                        <Layers className="size-8 text-primary" />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-primary uppercase tracking-widest mb-1">
                            {t('creances:bulk_modal.selected_invoices', { count })}
                        </div>
                        <div className="text-3xl font-black text-base-content italic tracking-tight">
                            {formatCurrency(Math.round(totalAmount))}
                        </div>
                        <div className="text-xs text-base-content/60">
                            {form.montantTotalBulk && parseFloat(form.montantTotalBulk) > 0 
                                ? `Règlement partiel: ${formatCurrency(parseFloat(form.montantTotalBulk))} / ${formatCurrency(totalAmount)}`
                                : 'Règlement total des factures sélectionnées'
                            }
                        </div>
                    </div>
                </div>

                {/* Warning Alert */}
                <div className="p-4 rounded-xl bg-warning/10 border border-amber-200 flex items-start gap-3 shadow-sm">
                    <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
                    <div className="text-[11px] font-medium leading-relaxed">
                        {t('creances:bulk_modal.warning_text')}
                        <br />
                        {t('creances:bulk_modal.warning_subtext')}
                    </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                    {/* Montant personnalisé - Paiement partiel */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-base-content/50 flex items-center gap-1.5 ml-1">
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
                            className="input input-bordered w-full focus:ring-2 focus:ring-primary/20 transition-all font-mono text-sm"
                        />
                        <p className="text-[10px] text-base-content/50 ml-1">
                            {form.montantTotalBulk 
                                ? `Restera à payer: ${formatCurrency(totalAmount - parseFloat(form.montantTotalBulk || '0'))}`
                                : 'Laisser vide pour régler le total des factures'
                            }
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-base-content/50 flex items-center gap-1.5 ml-1">
                            <CreditCard className="size-3" /> {t('creances:bulk_modal.payment_mode')}
                        </label>
                        <select
                            value={form.modePaiement}
                            onChange={(e) => form.setModePaiement(e.target.value)}
                            className="w-full rounded-xl border border-base-300 bg-base-100 h-10 px-3 text-sm font-bold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
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
                        <label className="text-[10px] font-black uppercase tracking-widest text-base-content/50 flex items-center gap-1.5 ml-1">
                            <Hash className="size-3" /> {t('creances:bulk_modal.bulk_reference')}
                        </label>
                        <input
                            type="text"
                            placeholder={t('creances:bulk_modal.reference_placeholder')}
                            value={form.referencePaiement}
                            onChange={(e) => form.setReferencePaiement(e.target.value)}
                            className="input input-bordered w-full focus:ring-2 focus:ring-primary/20 transition-all font-mono text-sm"
                        />
                    </div>
                </div>

                <div className="bg-base-50 p-3 rounded-xl flex items-center gap-3 border border-base-200">
                    <div className="p-2 bg-base-100 rounded-lg shadow-sm">
                        <Info className="size-3 text-base-content/50" />
                    </div>
                    <p className="text-[10px] text-base-content/60 font-medium">
                        {t('creances:bulk_modal.supervisor_hint')}
                    </p>
                </div>

                <div className="pt-4 flex gap-3">
                    <button onClick={onClose} className="btn btn-ghost flex-1 font-bold uppercase tracking-widest text-xs">
                        {t('creances:bulk_modal.cancel')}
                    </button>
                    <button 
                        onClick={onConfirm} 
                        className="btn btn-primary flex-1 font-black uppercase tracking-widest text-xs shadow-lg shadow-indigo-200 gap-2"
                    >
                        <CheckCircle2 className="size-4" />
                        {t('creances:bulk_modal.confirm_payment')}
                    </button>
                </div>
            </div>
        </PremiumModal>
    );
};
