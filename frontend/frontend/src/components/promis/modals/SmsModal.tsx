import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../../services/api';
import { toast } from 'react-hot-toast';
import { Send, Phone } from 'lucide-react';
import type { Promis } from '../../../types';
import PremiumModal from '../../common/PremiumModal';

interface SmsModalProps {
    isOpen: boolean;
    onClose: () => void;
    promis: Promis | null;
}

export const SmsModal: React.FC<SmsModalProps> = ({
    isOpen,
    onClose,
    promis
}) => {
    const { t } = useTranslation(['stock', 'common']);
    
    const [message, setMessage] = useState('');
    const [sendingSms, setSendingSms] = useState(false);

    useEffect(() => {
        if (promis && isOpen) {
            setMessage(t('stock:promis.messages.sms_default_body', { 
                name: promis.client_display, 
                product: promis.produit_name,
                defaultValue: `Bonjour ${promis.client_display}, votre produit ${promis.produit_name} est disponible à la pharmacie.`
            }));
        } else if (!isOpen) {
            setMessage('');
        }
    }, [promis, isOpen]);

    const handleSendSms = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!promis || !message) return;
        
        setSendingSms(true);
        try {
            await api.post('sms/send/', {
                recipient: promis.client_phone_display,
                message: message,
                context_type: 'PROMIS',
                context_id: promis.id
            });
            toast.success(t('stock:promis.messages.sms_success'));
            onClose();
        } catch (err: any) {
            toast.error(t('stock:promis.messages.sms_error'));
            console.error(err);
        } finally {
            setSendingSms(false);
        }
    };

    return (
        <PremiumModal
            isOpen={isOpen}
            onClose={onClose}
            title={t('stock:promis.modal.title_sms', { name: promis?.client_display })}
        >
            <form onSubmit={handleSendSms} className="space-y-5">
                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                        <span className="flex items-center gap-2">
                            <Phone className="size-4" />
                            {t('stock:promis.modal.sms_number')}
                        </span>
                    </label>
                    <input 
                        type="text" 
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 transition-all bg-gray-50 font-mono text-gray-500"
                        value={promis?.client_phone_display || ''}
                        readOnly
                    />
                </div>
                
                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                        {t('stock:promis.modal.sms_message')}
                    </label>
                    <textarea 
                        className="w-full rounded-lg border border-gray-200 bg-white p-3 text-base font-medium text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 transition-all h-32"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        required
                    />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
                    <button 
                        type="button" 
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors btn-ghost" 
                        onClick={onClose}
                        disabled={sendingSms}
                    >
                        {t('common:cancel')}
                    </button>
                    <button 
                        type="submit" 
                        className="inline-flex items-center justify-center gap-2 h-9 px-6 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 hover:shadow-md transition-all shadow-sm"
                        disabled={sendingSms}
                    >
                        {sendingSms ? <span className="inline-block size-4 border-2 border-gray-200 border-t-indigo-600 rounded-full animate-spin"/> : <Send className="size-4" />}
                        {t('stock:promis.actions.sms_send')}
                    </button>
                </div>
            </form>
        </PremiumModal>
    );
};
