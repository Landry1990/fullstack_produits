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
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
                <div className="border-b border-slate-200 p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-50 p-2 rounded-lg">
                            <Printer className="size-5 text-emerald-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-800">
                                {t('modals.print_invoice')}
                            </h3>
                            <div className="text-xs text-slate-400 font-mono">
                                #{facture.numero_facture || facture.id}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600">
                        <X className="size-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            {t('messages.prompt_client_name')}
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={clientNameInput}
                                onChange={(e) => setClientNameInput(e.target.value)}
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
                            className="px-6 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm"
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

