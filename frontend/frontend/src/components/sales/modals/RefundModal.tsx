import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, AlertTriangle } from 'lucide-react';
import type { Facture } from '../../../types';

interface RefundModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    facture: Facture | null;
}

export const RefundModal: React.FC<RefundModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    facture
}) => {
    const { t } = useTranslation();
    const [refundReason, setRefundReason] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(refundReason);
        setRefundReason(''); // Reset after submit
    };

    if (!isOpen || !facture) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in scale-95 duration-200">
                <div className="border-b border-gray-100 p-4 flex justify-between items-center bg-red-50/50">
                    <div className="flex items-center gap-3">
                        <div className="bg-red-100 p-2 rounded-lg">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                        </div>
                        <h3 className="font-bold text-gray-900">
                            {t('sales.modals.refund_confirm_title')}
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    <div className="mb-6">
                        <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg border border-red-100 mb-4">
                            Cette action générera un avoir et annulera la facture <strong>#{facture.numero_facture || facture.id}</strong>.
                        </div>

                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('sales.modals.refund_reason')} <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={refundReason}
                            onChange={(e) => setRefundReason(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all outline-none resize-none"
                            placeholder="Erreur de saisie, retour client, etc."
                            rows={3}
                            required
                        />
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
                            className="px-6 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 focus:ring-4 focus:ring-red-200 transition-all shadow-lg shadow-red-600/20"
                        >
                            {t('common.confirm')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
