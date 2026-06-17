import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import PremiumModal from '../common/PremiumModal';

interface DisplayAlertModalProps {
    alerts: { id: string; title: string; message: string; type: 'product' | 'client'; is_blocking: boolean }[];
    onAcknowledge: () => void;
}

export default function DisplayAlertModal({ alerts, onAcknowledge }: DisplayAlertModalProps) {
    const { t } = useTranslation(['common']);
    const currentAlert = alerts[0];

    const onAcknowledgeRef = React.useRef(onAcknowledge);
    useEffect(() => { onAcknowledgeRef.current = onAcknowledge; });

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

    const isBlocking = !!currentAlert.is_blocking;

    return (
        <PremiumModal
            isOpen={true}
            onClose={onAcknowledge}
            title={
                isBlocking 
                    ? `🚨 ALERTE CRITIQUE : ${currentAlert.title}` 
                    : (currentAlert.type === 'product' ? `⚠️ Alerte Produit : ${currentAlert.title}` : `⚠️ Alerte Client : ${currentAlert.title}`)
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
                        ? "⚠️ BLOCAGE : CETTE ALERTE EST CRITIQUE ET BLOQUANTE"
                        : (currentAlert.type === 'product'
                            ? "Veuillez vérifier ce produit avant de continuer."
                            : "Veuillez prendre en compte cette information pour ce client.")
                    }
                </p>

                <div className="w-full pt-4">
                    <button
                        className={`inline-flex items-center justify-center w-full h-12 rounded-xl text-white shadow-lg font-bold transition-all ${isBlocking ? 'bg-red-600 border-4 border-white/30 text-xl hover:bg-red-700' : 'bg-red-600 shadow-red-200 hover:bg-red-700'}`}
                        onClick={onAcknowledge}
                        autoFocus
                    >
                        {isBlocking ? "⚠️ J'AI COMPRIS LA RESTRICTION (Entrée)" : `✓ ${t('common:understood', { defaultValue: 'Compris (Entrée)' })}`}
                    </button>
                </div>
            </div>
        </PremiumModal>
    );
}
