import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Printer, Loader2 } from 'lucide-react';
import PremiumModal from '../../common/PremiumModal';
import type { Facture } from '../../../types';

interface ClientNameModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (clientName: string) => void | Promise<void>;
    facture: Facture | null;
}

export const ClientNameModal: React.FC<ClientNameModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    facture
}) => {
    const { t } = useTranslation(['sales', 'common', 'clients']);
    const [clientNameInput, setClientNameInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && facture) {
            // Priority: client_name_override > client_name (if not default) > empty
            let initialName = '';
            if (facture.client_name_override) {
                initialName = facture.client_name_override;
            } else if (facture.client_name && facture.client_name !== t('common:passerby_client')) {
                initialName = facture.client_name;
            }
            setClientNameInput(initialName.toUpperCase());
        }
    }, [isOpen, facture, t]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await onConfirm(clientNameInput.trim());
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen || !facture) return null;

    return (
        <PremiumModal
            isOpen={isOpen && !!facture}
            onClose={onClose}
            title={t('modals.print_invoice')}
            subtitle={`#${facture.numero_facture || facture.id}`}
            icon={<Printer className="size-5 text-emerald-600" />}
            maxWidth="max-w-md"
        >
            <form onSubmit={handleSubmit} className="flex-1 min-h-0">
                <div className="mb-6">
                    <label htmlFor="client-name-input" className="block text-sm font-medium text-slate-700 mb-2">
                        {t('messages.prompt_client_name')}
                    </label>
                    <div className="relative">
                        <input
                            id="client-name-input"
                            type="text"
                            maxLength={100}
                            value={clientNameInput}
                            onChange={(e) => setClientNameInput(e.target.value.toUpperCase())}
                            className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                            placeholder={t('clients:sales_modal.print_placeholder')}
                            autoFocus
                        />
                    </div>
                    <p className="mt-2 text-xs text-slate-400 flex items-center gap-1">
                        <span className="inline-block size-1 bg-gray-300 rounded-full"></span>
                        {t('clients:sales_modal.print_hint')}
                    </p>
                </div>

                <div className="flex gap-3 justify-end pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 text-slate-700 font-medium bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        {t('common:cancel')}
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-6 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
                        {t('common:print')}
                    </button>
                </div>
            </form>
        </PremiumModal>
    );
};
