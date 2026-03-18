import { DollarSign, CreditCard, Hash, Info, UserCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatCurrency, normalizeNumberInput } from '../../../utils/formatters';
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
    const { t } = useTranslation(['creances', 'common']);
    if (!creance) return null;

    const remainingAmount = normalizeNumberInput(creance.reste_a_payer);

    return (
        <PremiumModal
            isOpen={isOpen}
            onClose={onClose}
            title={t('creances:payment_modal.title')}
            maxWidth="max-w-md"
        >
            <div className="space-y-6">
                {/* Info Card */}
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex gap-3 shadow-sm">
                    <div className="p-2 bg-white rounded-xl shadow-sm h-fit">
                        <Info className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="text-sm">
                        <div className="font-bold text-blue-900 tracking-tight">{t('creances:payment_modal.invoice_prefix')} {creance.numero_facture}</div>
                        <div className="text-blue-700/70 font-medium">{t('creances:payment_modal.by_client')} {creance.client_name}</div>
                        <div className="mt-2 flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase text-blue-400">{t('creances:payment_modal.remaining_balance')}</span>
                            <span className="text-blue-900 font-black">{formatCurrency(remainingAmount)} {t('common:currency')}</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Payment Mode */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-base-content/40 flex items-center gap-1.5 ml-1">
                            <CreditCard className="w-3 h-3" /> {t('creances:payment_modal.payment_mode')}
                        </label>
                        <select
                            value={form.modePaiement}
                            onChange={(e) => form.setModePaiement(e.target.value)}
                            className="select select-bordered w-full focus:ring-2 focus:ring-primary/20 transition-all font-bold"
                        >
                            <option value="especes">{t('creances:payment_modal.modes.cash')}</option>
                            <option value="om">{t('creances:payment_modal.modes.om')}</option>
                            <option value="momo">{t('creances:payment_modal.modes.momo')}</option>
                            <option value="cheque">{t('creances:payment_modal.modes.check')}</option>
                            <option value="carte">{t('creances:payment_modal.modes.card')}</option>
                            <option value="virement">{t('creances:payment_modal.modes.transfer')}</option>
                            <option value="recouvrement">{t('creances:payment_modal.modes.recouvrement')}</option>
                        </select>
                    </div>

                    {/* Amount */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-base-content/40 flex items-center gap-1.5 ml-1">
                            <DollarSign className="w-3 h-3" /> {t('creances:payment_modal.amount_to_pay')}
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
                                {t('creances:payment_modal.pay_full')}
                            </button>
                        </div>
                    </div>

                    {/* Reference */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-base-content/40 flex items-center gap-1.5 ml-1">
                            <Hash className="w-3 h-3" /> {t('creances:payment_modal.reference')}
                        </label>
                        <input
                            type="text"
                            placeholder={t('creances:payment_modal.reference_placeholder')}
                            value={form.referencePaiement}
                            onChange={(e) => form.setReferencePaiement(e.target.value)}
                            className="input input-bordered w-full focus:ring-2 focus:ring-primary/20 transition-all font-mono text-sm"
                        />
                    </div>
                </div>

                <div className="pt-4 flex gap-3">
                    <button onClick={onClose} className="btn btn-ghost flex-1 font-bold uppercase tracking-widest text-xs">
                        {t('creances:payment_modal.cancel')}
                    </button>
                    <button 
                        onClick={onConfirm} 
                        className="btn btn-primary flex-1 font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20 gap-2"
                        disabled={!form.montantPaiement || normalizeNumberInput(form.montantPaiement) <= 0}
                    >
                        <UserCheck className="w-4 h-4" />
                        {t('creances:payment_modal.validate_pay')}
                    </button>
                </div>
            </div>
        </PremiumModal>
    );
};
