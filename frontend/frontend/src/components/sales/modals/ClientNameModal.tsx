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
    const { t } = useTranslation();
    const [clientNameInput, setClientNameInput] = useState('');

    useEffect(() => {
        if (isOpen && facture) {
            // Priority: client_name_override > client_name (if not default) > empty
            let initialName = '';
            if (facture.client_name_override) {
                initialName = facture.client_name_override;
            } else if (facture.client_name && facture.client_name !== 'Client de passage') {
                initialName = facture.client_name;
            }
            setClientNameInput(initialName);
        }
    }, [isOpen, facture]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(clientNameInput);
    };

    if (!isOpen || !facture) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="border-b border-gray-100 p-4 flex justify-between items-center bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                            <Printer className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">
                                {t('sales.modals.print_invoice')}
                            </h3>
                            <div className="text-xs text-gray-500 font-mono">
                                #{facture.numero_facture || facture.id}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Nom du client (optionnel)
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={clientNameInput}
                                onChange={(e) => setClientNameInput(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                                placeholder="Entrez le nom pour l'impression..."
                                autoFocus
                            />
                        </div>
                        <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                            <span className="inline-block w-1 h-1 bg-gray-400 rounded-full"></span>
                            Ce nom apparaîtra uniquement sur la facture imprimée
                        </p>
                    </div>

                    <div className="flex gap-3 justify-end pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20"
                        >
                            <Printer className="w-4 h-4" />
                            {t('common.print')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
