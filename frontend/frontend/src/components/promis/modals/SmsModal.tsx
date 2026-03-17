import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
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

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';

    useEffect(() => {
        if (promis && isOpen) {
            setMessage(`Bonjour ${promis.client_display}, votre produit ${promis.produit_name} est disponible à la pharmacie.`);
        } else if (!isOpen) {
            setMessage('');
        }
    }, [promis, isOpen]);

    const handleSendSms = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!promis || !message) return;
        
        setSendingSms(true);
        try {
            await axios.post(`${apiBaseUrl}/api/sms/send/`, {
                recipient: promis.client_phone_display,
                message: message,
                context_type: 'PROMIS',
                context_id: promis.id
            });
            toast.success(t('promis.messages.sms_success'));
            onClose();
        } catch (err: any) {
            toast.error(t('promis.messages.sms_error'));
            console.error(err);
        } finally {
            setSendingSms(false);
        }
    };

    return (
        <PremiumModal
            isOpen={isOpen}
            onClose={onClose}
            title={t('promis.modal.title_sms', { name: promis?.client_display })}
        >
            <form onSubmit={handleSendSms} className="space-y-5">
                <div className="form-control">
                    <label className="label font-medium text-sm text-base-content/70">
                        <span className="flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            {t('promis.modal.sms_number')}
                        </span>
                    </label>
                    <input 
                        type="text" 
                        className="input input-bordered w-full bg-base-200/50 font-mono text-base-content/80"
                        value={promis?.client_phone_display || ''}
                        readOnly
                    />
                </div>
                
                <div className="form-control">
                    <label className="label font-medium text-sm text-base-content/70">
                        {t('promis.modal.sms_message')}
                    </label>
                    <textarea 
                        className="textarea textarea-bordered h-32 focus:border-primary transition-colors text-base"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        required
                    />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-base-200 mt-6">
                    <button 
                        type="button" 
                        className="btn btn-ghost" 
                        onClick={onClose}
                        disabled={sendingSms}
                    >
                        {t('common:cancel')}
                    </button>
                    <button 
                        type="submit" 
                        className="btn btn-info text-white shadow-sm hover:shadow-md transition-all gap-2 px-6"
                        disabled={sendingSms}
                    >
                        {sendingSms ? <span className="loading loading-spinner loading-sm"/> : <Send className="w-4 h-4" />}
                        {t('promis.actions.sms_send')}
                    </button>
                </div>
            </form>
        </PremiumModal>
    );
};
