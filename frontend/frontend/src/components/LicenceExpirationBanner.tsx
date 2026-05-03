import React from 'react';
import { useLicence } from '../context/LicenceContext';
import { AlertTriangle, Clock, ShieldAlert } from 'lucide-react';

export default function LicenceExpirationBanner() {
    const { daysRemaining, licence } = useLicence();

    if (daysRemaining === null || daysRemaining > 7) return null;

    const isExpired = daysRemaining <= 0;

    return (
        <div className={`
            sticky top-0 z-[100] w-full px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium
            animate-in slide-in-from-top duration-500
            ${isExpired 
                ? 'bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.5)]' 
                : 'bg-amber-500 text-slate-900 shadow-[0_0_15px_rgba(245,158,11,0.3)]'}
        `}>
            {isExpired ? <ShieldAlert className="w-5 h-5 animate-pulse" /> : <Clock className="w-5 h-5" />}
            
            <div className="flex items-center gap-1">
                {isExpired ? (
                    <span><strong>LICENCE EXPIRÉE :</strong> L'accès au système sera restreint. Contactez votre administrateur immédiatement.</span>
                ) : (
                    <span>
                        <strong>ALERTE LICENCE :</strong> Votre licence pour <strong>{licence?.pharmacie_nom}</strong> expire dans 
                        <span className="mx-1 px-1.5 py-0.5 bg-white/20 rounded font-bold underline decoration-2">
                            {daysRemaining} {daysRemaining > 1 ? 'jours' : 'jour'}
                        </span>
                    </span>
                )}
            </div>

            {!isExpired && (
                <button 
                    onClick={() => window.location.href = '/licence'}
                    className="ml-4 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg transition-colors border border-white/20 text-xs font-bold uppercase"
                >
                    Mettre à jour
                </button>
            )}
        </div>
    );
}
