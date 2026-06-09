import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLicence } from '../context/LicenceContext';
import { Clock, ShieldAlert } from 'lucide-react';

export default function LicenceExpirationBanner() {
    const { t } = useTranslation('common');
    const { daysRemaining, licence } = useLicence();

    if (daysRemaining === null || daysRemaining > 7) return null;

    const isExpired = daysRemaining <= 0;

    return (
        <div className={`
            sticky top-0 z-[100] w-full px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium
            animate-in slide-in-from-top duration-500
            ${isExpired 
                ? 'bg-error text-white shadow-[0_0_20px_rgba(220,38,38,0.5)]' 
                : 'bg-amber-500 text-base-content shadow-[0_0_15px_rgba(245,158,11,0.3)]'}
        `}>
            {isExpired ? <ShieldAlert className="size-5 animate-pulse" /> : <Clock className="size-5" />}
            
            <div className="flex items-center gap-1">
                {isExpired ? (
                    <span>
                        <strong>{t('licence_banner.expired_title')}</strong>{' '}
                        {t('licence_banner.expired_message')}
                    </span>
                ) : (
                    <span>
                        <strong>{t('licence_banner.alert_title')}</strong>{' '}
                        {t('licence_banner.expires_in', { name: licence?.pharmacie_nom }).replace(/<1>/g, '').replace(/<\/1>/g, '')}
                        <span className="mx-1 px-1.5 py-0.5 bg-base-100/20 rounded font-bold underline decoration-2">
                            {daysRemaining} {t(daysRemaining > 1 ? 'licence_banner.days' : 'licence_banner.day')}
                        </span>
                    </span>
                )}
            </div>

            {!isExpired && (
                <button 
                    onClick={() => window.location.href = '/licence'}
                    className="ml-4 px-3 py-1 bg-base-100/20 hover:bg-base-100/30 rounded-lg transition-colors border border-white/20 text-xs font-bold uppercase"
                >
                    {t('licence_banner.update')}
                </button>
            )}
        </div>
    );
}
