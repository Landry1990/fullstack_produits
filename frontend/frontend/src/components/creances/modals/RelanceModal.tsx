import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle, Phone, Send, ExternalLink, AlertTriangle, Loader2, Mail } from 'lucide-react';
import { gooeyToast } from 'goey-toast';
import PremiumModal from '../../common/PremiumModal';
import creanceService, { type RelancePreview } from '../../../services/creanceService';
import { formatCurrency } from '../../../utils/formatters';
import { extractErrorMessage } from '../../../utils/errorHandling';
import { logger } from '../../../utils/logger';

type RelanceChannel = 'email' | 'sms' | 'whatsapp' | 'whatsapp_link';

interface RelanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    clientId: number | null;
    onSent: () => void;
}

export const RelanceModal: React.FC<RelanceModalProps> = ({ isOpen, onClose, clientId, onSent }) => {
    const { t } = useTranslation(['creances', 'common']);
    const [preview, setPreview] = useState<RelancePreview | null>(null);
    const [message, setMessage] = useState('');
    const [channel, setChannel] = useState<RelanceChannel>('whatsapp_link');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (!isOpen || !clientId) return;
        setPreview(null);
        setLoading(true);
        creanceService.getRelancePreview(clientId)
            .then(p => {
                setPreview(p);
                setMessage(p.message);
                setChannel(p.email ? 'email' : 'whatsapp_link');
            })
            .catch(err => {
                logger.error('Erreur relance preview:', err);
                gooeyToast.error(extractErrorMessage(err));
                onClose();
            })
            .finally(() => setLoading(false));
    }, [isOpen, clientId, onClose]);

    const handleSend = async () => {
        if (!preview || !message.trim()) return;
        setSending(true);
        try {
            const res = await creanceService.relancer({
                client_id: preview.client_id,
                channel,
                message: message.trim()
            });
            if (channel === 'whatsapp_link' && preview.phone_wa) {
                window.open(`https://wa.me/${preview.phone_wa}?text=${encodeURIComponent(message.trim())}`, '_blank');
            }
            if (res.success) {
                gooeyToast.success(t('creances:toasts.relance_sent', { client: preview.client_name }));
                onSent();
                onClose();
            } else {
                gooeyToast.error(res.detail || t('creances:toasts.relance_failed'));
            }
        } catch (err) {
            logger.error('Erreur relance:', err);
            gooeyToast.error(extractErrorMessage(err));
        } finally {
            setSending(false);
        }
    };

    const channels: { key: RelanceChannel; label: string; hint?: string; hidden?: boolean }[] = [
        { key: 'email', label: t('creances:relance_modal.channels.email'), hidden: !preview?.email },
        { key: 'whatsapp_link', label: t('creances:relance_modal.channels.whatsapp_link'), hint: t('creances:relance_modal.whatsapp_link_hint') },
        { key: 'whatsapp', label: t('creances:relance_modal.channels.whatsapp'), hidden: !preview?.whatsapp_configured },
        { key: 'sms', label: t('creances:relance_modal.channels.sms') },
    ];

    const contactMissing = channel === 'email' ? !preview?.email : !preview?.phone;

    return (
        <PremiumModal
            isOpen={isOpen}
            onClose={onClose}
            title={t('creances:relance_modal.title')}
            maxWidth="max-w-md"
        >
            <div className="space-y-5 p-6">
                {loading ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="size-6 animate-spin text-emerald-600" />
                    </div>
                ) : preview && (
                    <>
                        {/* Info Card */}
                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-3 shadow-sm">
                            <div className="p-2 bg-white rounded-xl shadow-sm h-fit">
                                <MessageCircle className="size-4 text-blue-500" />
                            </div>
                            <div className="text-sm space-y-1">
                                <div className="font-bold text-blue-900 tracking-tight">{preview.client_name}</div>
                                <div className="text-blue-600/70 font-medium flex items-center gap-1.5">
                                    <Phone className="size-3" /> {preview.phone || t('creances:relance_modal.no_phone')}
                                </div>
                                {preview.email && (
                                    <div className="text-blue-600/70 font-medium flex items-center gap-1.5">
                                        <Mail className="size-3" /> {preview.email}
                                    </div>
                                )}
                                <div className="flex items-center gap-2 pt-1">
                                    <span className="text-caption font-bold uppercase text-blue-400">{t('creances:relance_modal.balance_due')}</span>
                                    <span className="text-blue-900 font-bold">{formatCurrency(preview.solde_du)}</span>
                                    <span className="text-caption font-bold text-blue-400">· {t('creances:relance_modal.invoices', { count: preview.nb_factures })}</span>
                                </div>
                            </div>
                        </div>

                        {contactMissing && (
                            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs font-bold text-amber-700">
                                <AlertTriangle className="size-4 shrink-0" />
                                {channel === 'email' ? t('creances:relance_modal.no_email') : t('creances:relance_modal.no_phone')}
                            </div>
                        )}

                        {/* Channel */}
                        <div className="space-y-1.5">
                            <label className="text-caption font-bold uppercase tracking-widest text-slate-400 ml-1">
                                {t('creances:relance_modal.channel')}
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                                {channels.filter(c => !c.hidden).map(c => (
                                    <button
                                        key={c.key}
                                        onClick={() => setChannel(c.key)}
                                        className={`h-9 rounded-xl border text-caption font-bold uppercase tracking-widest transition-all ${
                                            channel === c.key
                                                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm'
                                                : 'bg-white border-slate-200 text-slate-400 hover:text-slate-500'
                                        }`}
                                        title={c.hint}
                                    >
                                        {c.label}
                                    </button>
                                ))}
                            </div>
                            {channel === 'whatsapp_link' && (
                                <p className="text-caption text-slate-400 ml-1">{t('creances:relance_modal.whatsapp_link_hint')}</p>
                            )}
                        </div>

                        {/* Message */}
                        <div className="space-y-1.5">
                            <label htmlFor="relance-message" className="text-caption font-bold uppercase tracking-widest text-slate-400 ml-1">
                                {t('creances:relance_modal.message')}
                            </label>
                            <textarea
                                id="relance-message"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                rows={4}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-sm text-slate-700"
                            />
                        </div>

                        <div className="pt-2 flex gap-3">
                            <button onClick={onClose} className="inline-flex items-center justify-center h-9 flex-1 rounded-lg text-xs font-bold uppercase tracking-widest text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                                {t('creances:payment_modal.cancel')}
                            </button>
                            <button
                                onClick={handleSend}
                                disabled={sending || !message.trim() || contactMissing}
                                className="inline-flex items-center justify-center h-9 flex-1 rounded-lg text-xs font-bold uppercase tracking-widest bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {sending ? <Loader2 className="size-4 animate-spin" /> : channel === 'whatsapp_link' ? <ExternalLink className="size-4" /> : <Send className="size-4" />}
                                {t('creances:relance_modal.send')}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </PremiumModal>
    );
};
