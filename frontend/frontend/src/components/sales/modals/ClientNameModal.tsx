import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Printer } from 'lucide-react';
import type { Facture } from '../../../types';

interface ClientNameModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (clientName: string) => void;
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

    useEffect(() => {
        if (isOpen && facture) {
            // Priority: client_name_override > client_name (if not default) > empty
            let initialName = '';
            if (facture.client_name_override) {
                initialName = facture.client_name_override;
            } else if (facture.client_name && facture.client_name !== t('common:passerby_client')) {
                initialName = facture.client_name;
            }
            setClientNameInput(initialName);
        }
    }, [isOpen, facture, t]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(clientNameInput);
    };

    if (!isOpen || !facture) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-base-100 rounded-xl shadow-2xl border border-base-200 w-full max-w-md overflow-hidden">
                <div className="border-b border-base-200 p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-lg">
                            <Printer className="size-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-base-content">
                                {t('modals.print_invoice')}
                            </h3>
                            <div className="text-xs text-base-content/50 font-mono">
                                #{facture.numero_facture || facture.id}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-base-200 rounded-lg transition-colors text-base-content/50 hover:text-base-content/70">
                        <X className="size-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-base-content mb-2">
                            {t('messages.prompt_client_name')}
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={clientNameInput}
                                onChange={(e) => setClientNameInput(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg border border-base-300 bg-base-100 text-base-content focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                placeholder={t('clients:sales_modal.print_placeholder')}
                                autoFocus
                            />
                        </div>
                        <p className="mt-2 text-xs text-base-content/50 flex items-center gap-1">
                            <span className="inline-block size-1 bg-gray-300 rounded-full"></span>
                            {t('clients:sales_modal.print_hint')}
                        </p>
                    </div>

                    <div className="flex gap-3 justify-end pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2 text-base-content font-medium bg-base-100 border border-base-300 rounded-lg hover:bg-base-200 transition-colors"
                        >
                            {t('common:cancel')}
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-focus transition-colors flex items-center gap-2 shadow-sm"
                        >
                            <Printer className="size-4" />
                            {t('common:print')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

