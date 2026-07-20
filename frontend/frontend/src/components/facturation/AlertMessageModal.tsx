import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import PremiumModal from '../common/PremiumModal';
import api from '../../services/api';
import { toast } from 'react-hot-toast';

export type AlertTarget = {
    type: 'product' | 'client';
    id: number;
    name: string;
    currentMessage: string;
} | null;

interface AlertMessageModalProps {
    isOpen: boolean;
    onClose: () => void;
    target: AlertTarget;
    onSuccess: (updatedTarget: AlertTarget) => void;
}

export default function AlertMessageModal({ isOpen, onClose, target, onSuccess }: AlertMessageModalProps) {
    const { t } = useTranslation(['facturation', 'common']);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && target) {
            setMessage(target.currentMessage || '');
        }
    }, [isOpen, target]);

    const handleSave = async () => {
        if (!target) return;
        setLoading(true);
        try {
            const endpoint = target.type === 'product' ? `produits/${target.id}/` : `clients/${target.id}/`;
            await api.patch(endpoint, { message_alerte: message.trim() || null });
            toast.success(t('facturation:alert_message.save_success', { name: target.name }));
            onSuccess({ ...target, currentMessage: message.trim() });
            onClose();
        } catch {
            toast.error(t('facturation:alert_message.save_error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <PremiumModal
            isOpen={isOpen}
            onClose={onClose}
            title={t('facturation:alert_message.title', { name: target?.name })}
            icon={<span className="text-amber-500">⚠️</span>}
            gradientFrom="amber-100"
            gradientTo="red-50"
        >
            <div className="p-6 space-y-4">
                <p className="text-sm text-slate-500">
                    {target?.type === 'product' ? t('facturation:alert_message.description_product') : t('facturation:alert_message.description_client')}
                </p>
                <div>
                    <textarea
                        className="w-full h-32 rounded-xl border border-amber-300 bg-white px-3 py-2 text-base text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
                        placeholder={t('facturation:alert_message.placeholder')}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        autoFocus
                    />
                </div>
                <div className="flex justify-end gap-3 mt-4">
                    <button className="inline-flex items-center justify-center h-9 px-4 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors" onClick={onClose} disabled={loading}>
                        {t('facturation:alert_message.cancel')}
                    </button>
                    <button className="inline-flex items-center justify-center h-9 px-4 rounded-lg text-sm font-semibold bg-amber-500 text-white shadow-sm hover:bg-amber-600 transition-colors" onClick={handleSave} disabled={loading}>
                        {loading ? <div className="animate-spin rounded-full size-4 border-b-2 border-white"></div> : t('facturation:alert_message.save')}
                    </button>
                </div>
            </div>
        </PremiumModal>
    );
}
