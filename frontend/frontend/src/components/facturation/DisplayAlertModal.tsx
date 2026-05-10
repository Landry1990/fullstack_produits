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
            icon={isBlocking ? <span className="text-error text-3xl animate-pulse">🚨</span> : <span className="text-warning text-2xl">⚠️</span>}
            gradientFrom={isBlocking ? "error/40" : "error/20"}
            gradientTo={isBlocking ? "error/30" : "warning/10"}
        >
            <div className="p-8 space-y-6 flex flex-col items-center justify-center text-center">
                <div className={`${isBlocking ? 'bg-error text-error-content border-4 border-white/20' : 'bg-error/10 border-2 border-error/20'} p-6 rounded-2xl w-full shadow-2xl`}>
                    <p className={`text-xl md:text-3xl font-black leading-relaxed ${!isBlocking ? 'text-error' : ''}`}>
                        {currentAlert.message}
                    </p>
                </div>
                
                <p className={`text-sm font-medium ${isBlocking ? 'text-error font-bold uppercase tracking-widest animate-pulse' : 'text-base-content/60'}`}>
                    {isBlocking 
                        ? "⚠️ BLOCAGE : CETTE ALERTE EST CRITIQUE ET BLOQUANTE"
                        : (currentAlert.type === 'product' 
                            ? "Veuillez vérifier ce produit avant de continuer." 
                            : "Veuillez prendre en compte cette information pour ce client.")
                    }
                </p>

                <div className="w-full pt-4">
                    <button 
                        className={`btn btn-lg w-full text-white shadow-lg animate-pulse-soft font-bold ${isBlocking ? 'btn-error border-4 border-white/30 text-xl' : 'btn-error shadow-error/20'}`}
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
