import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PremiumModal from '../common/PremiumModal';
import { safeStorage } from '../../utils/storage';

const DISMISS_KEY = 'display_alert_dismissed_session';

interface DisplayAlertModalProps {
    alerts: { id: string; title: string; message: string; type: 'product' | 'client'; is_blocking: boolean }[];
    onAcknowledge: () => void;
}

export default function DisplayAlertModal({ alerts, onAcknowledge }: DisplayAlertModalProps) {
    const { t } = useTranslation(['facturation', 'common']);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());
    const [dontShowAgain, setDontShowAgain] = useState(false);
    const onAcknowledgeRef = React.useRef<() => void>(() => {});
    const autoAckedRef = React.useRef<Set<string>>(new Set());

    useEffect(() => { onAcknowledgeRef.current = handleAcknowledge; });

    // Load dismissed ids from session storage
    useEffect(() => {
        try {
            const raw = safeStorage.getItem(DISMISS_KEY, 'session');
            const ids = raw ? JSON.parse(raw) : [];
            setDismissed(new Set(Array.isArray(ids) ? ids : []));
        } catch { /* ignore */ }
    }, []);

    // Persist dismissed ids
    useEffect(() => {
        safeStorage.setItem(DISMISS_KEY, JSON.stringify([...dismissed]), 'session');
    }, [dismissed]);

    // Auto-acknowledge alerts already marked as dismissed this session
    useEffect(() => {
        if (alerts.length === 0) return;
        const first = alerts[0];
        if (first && dismissed.has(first.id) && !autoAckedRef.current.has(first.id)) {
            autoAckedRef.current.add(first.id);
            setTimeout(() => onAcknowledgeRef.current(), 0);
        }
    }, [alerts, dismissed]);

    // Reset checkbox when current alert changes
    useEffect(() => {
        setDontShowAgain(false);
    }, [alerts[0]?.id]);

    const currentAlert = alerts[0];

    // Handle Enter to dismiss when open
    useEffect(() => {
        if (!currentAlert) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                onAcknowledgeRef.current();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentAlert]);

    if (!currentAlert) return null;

    const isBlocking = !!currentAlert?.is_blocking;

    const handleAcknowledge = () => {
        if (currentAlert && !isBlocking && dontShowAgain && currentAlert.type === 'product') {
            setDismissed(prev => new Set([...prev, currentAlert.id]));
        }
        onAcknowledge();
    };

    return (
        <PremiumModal
            isOpen={true}
            onClose={handleAcknowledge}
            title={
                isBlocking 
                    ? t('facturation:display_alert.critical_title', { title: currentAlert.title })
                    : (currentAlert.type === 'product' ? t('facturation:display_alert.product_title', { title: currentAlert.title }) : t('facturation:display_alert.client_title', { title: currentAlert.title }))
            }
            icon={isBlocking ? <span className="text-red-500 text-3xl animate-pulse">🚨</span> : <span className="text-amber-500 text-2xl">⚠️</span>}
            gradientFrom={isBlocking ? "red-200" : "red-100"}
            gradientTo={isBlocking ? "red-100" : "amber-50"}
        >
            <div className="p-8 space-y-6 flex flex-col items-center justify-center text-center">
                <div className={`${isBlocking ? 'bg-red-500 text-white border-4 border-white/20' : 'bg-red-50 border-2 border-red-200'} p-6 rounded-2xl w-full shadow-2xl`}>
                    <p className={`text-xl md:text-3xl font-black leading-relaxed ${!isBlocking ? 'text-red-600' : ''}`}>
                        {currentAlert.message}
                    </p>
                </div>

                <p className={`text-sm font-medium ${isBlocking ? 'text-red-600 font-bold uppercase tracking-widest animate-pulse' : 'text-slate-500'}`}>
                    {isBlocking
                        ? t('facturation:display_alert.blocking_warning')
                        : (currentAlert.type === 'product'
                            ? t('facturation:display_alert.product_check_message')
                            : t('facturation:display_alert.client_check_message'))
                    }
                </p>

                <div className="w-full pt-4 space-y-3">
                    {!isBlocking && currentAlert?.type === 'product' && (
                        <label className="flex items-center justify-center gap-2 text-sm text-slate-600 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={dontShowAgain}
                                onChange={(e) => setDontShowAgain(e.target.checked)}
                                className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            {t('facturation:display_alert.dont_show_again_session')}
                        </label>
                    )}
                    <button
                        className={`inline-flex items-center justify-center w-full h-12 rounded-xl text-white shadow-lg font-bold transition-all ${isBlocking ? 'bg-red-600 border-4 border-white/30 text-xl hover:bg-red-700' : 'bg-red-600 shadow-red-200 hover:bg-red-700'}`}
                        onClick={handleAcknowledge}
                        autoFocus
                    >
                        {isBlocking ? t('facturation:display_alert.understood_blocking') : t('facturation:display_alert.understood')}
                    </button>
                </div>
            </div>
        </PremiumModal>
    );
}
