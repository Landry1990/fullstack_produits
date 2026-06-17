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
                    <label className="block text-sm font-medium text-slate-500 mb-1">
                        <span className="flex items-center gap-2">
                            <Phone className="size-4" />
                            {t('stock:promis.modal.sms_number')}
                        </span>
                    </label>
                    <input
                        type="text"
                        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm font-mono text-slate-400 cursor-default"
                        value={promis?.client_phone_display || ''}
                        readOnly
                    />
                </div>
                
                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-500 mb-1">
                        {t('stock:promis.modal.sms_message')}
                    </label>
                    <textarea
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-700 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all h-32 resize-none"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        required
                    />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                    <button
                        type="button"
                        className="inline-flex items-center gap-1.5 h-9 px-4 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-medium transition-colors"
                        onClick={onClose}
                        disabled={sendingSms}
                    >
                        {t('common:cancel')}
                    </button>
                    <button
                        type="submit"
                        className="inline-flex items-center justify-center gap-2 h-9 px-6 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-sm hover:shadow-md transition-all disabled:opacity-60"
                        disabled={sendingSms}
                    >
                        {sendingSms ? <span className="size-4 border-2 border-blue-400 border-t-white rounded-full animate-spin" /> : <Send className="size-4" />}
                        {t('stock:promis.actions.sms_send')}
                    </button>
                </div>
            </form>
        </PremiumModal>
    );
};
