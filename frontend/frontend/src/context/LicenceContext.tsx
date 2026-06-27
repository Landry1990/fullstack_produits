import React, { createContext, use, useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import i18n from '../i18n';

interface LicenceInfo {
    pharmacie_nom: string;
    pharmacien_nom: string;
    plan: 'TRIAL' | 'BASIC' | 'PREMIUM';
    exp: number;
    is_valid: boolean;
}

interface LicenceContextType {
    licence: LicenceInfo | null;
    loading: boolean;
    daysRemaining: number | null;
    refreshLicence: () => Promise<void>;
}

const LicenceContext = createContext<LicenceContextType | undefined>(undefined);

const LICENCE_STORAGE_KEY = 'pharmacy_licence_cache';

function loadCachedLicence(): LicenceInfo | null {
    try {
        const cached = localStorage.getItem(LICENCE_STORAGE_KEY);
        if (!cached) return null;
        const data = JSON.parse(cached) as LicenceInfo;
        const expMs = (data.exp ?? 0) * 1000;
        if (!data.exp || expMs > Date.now()) return data;
        localStorage.removeItem(LICENCE_STORAGE_KEY);
    } catch {}
    return null;
}

export const LicenceProvider = ({ children }: { children: ReactNode }) => {
    const [licence, setLicence] = useState<LicenceInfo | null>(() => loadCachedLicence());
    const [loading, setLoading] = useState(true);
    const [daysRemaining, setDaysRemaining] = useState<number | null>(() => {
        const cached = loadCachedLicence();
        if (!cached?.exp) return null;
        return Math.ceil(((cached.exp * 1000) - Date.now()) / (1000 * 60 * 60 * 24));
    });

    const fetchLicence = useCallback(async () => {
        try {
            const res = await api.get('licence/');
            if (res.data.is_valid && res.data.payload) {
                const data = res.data.payload;
                const licenceInfo = { ...data, is_valid: true };
                setLicence(licenceInfo);
                // Persister la dernière licence valide pour survie aux redémarrages
                try { localStorage.setItem(LICENCE_STORAGE_KEY, JSON.stringify(licenceInfo)); } catch {}

                // Calcul des jours restants
                const expTimestamp = data.exp * 1000;
                const now = Date.now();
                const diff = expTimestamp - now;
                const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                setDaysRemaining(days);

                // Alerte si < 7 jours
                if (days <= 7 && days > 0) {
                    toast.error(i18n.t('licence_toast.expiry_warning', { days, plural: days > 1 ? 's' : '', ns: 'common' }), {
                        duration: 8000,
                        id: 'licence-expiry-warning',
                        icon: '⚠️'
                    });
                } else if (days <= 0) {
                    toast.error(i18n.t('licence_toast.expired', { ns: 'common' }), {
                        duration: 10000,
                        id: 'licence-expired-error',
                        icon: '🚫'
                    });
                }
            } else {
                // Licence invalide côté serveur — effacer le cache local
                try { localStorage.removeItem(LICENCE_STORAGE_KEY); } catch {}
                setLicence(null);
                setDaysRemaining(null);
            }
        } catch (err) {
            console.error("Erreur chargement licence globale", err);
            // En cas d'erreur réseau, utiliser la dernière licence valide connue
            try {
                const cached = localStorage.getItem(LICENCE_STORAGE_KEY);
                if (cached) {
                    const cachedLicence = JSON.parse(cached) as LicenceInfo;
                    // Vérifier que la licence en cache n'est pas expirée
                    const expMs = (cachedLicence.exp ?? 0) * 1000;
                    if (!cachedLicence.exp || expMs > Date.now()) {
                        setLicence(cachedLicence);
                        const days = cachedLicence.exp ? Math.ceil((expMs - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                        setDaysRemaining(days);
                        return;
                    }
                }
            } catch {}
            setLicence(null);
            setDaysRemaining(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLicence();
    }, []);

    // Mémoriser l'objet value pour éviter les re-renders inutiles
    const contextValue = useMemo(() => ({
        licence,
        loading,
        daysRemaining,
        refreshLicence: fetchLicence
    }), [licence, loading, daysRemaining, fetchLicence]);

    return (
        <LicenceContext.Provider value={contextValue}>
            {children}
        </LicenceContext.Provider>
    );
};

export const useLicence = () => {
    const context = use(LicenceContext);
    if (context === undefined) {
        throw new Error('useLicence must be used within a LicenceProvider');
    }
    return context;
};
