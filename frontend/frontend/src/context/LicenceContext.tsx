import React, { createContext, use, useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';

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

export const LicenceProvider = ({ children }: { children: ReactNode }) => {
    const [licence, setLicence] = useState<LicenceInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

    const fetchLicence = useCallback(async () => {
        try {
            const res = await api.get('/licence/');
            if (res.data.is_valid && res.data.payload) {
                const data = res.data.payload;
                setLicence({ ...data, is_valid: true });

                // Calcul des jours restants
                const expTimestamp = data.exp * 1000;
                const now = Date.now();
                const diff = expTimestamp - now;
                const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                setDaysRemaining(days);

                // Alerte si < 7 jours
                if (days <= 7 && days > 0) {
                    toast.error(`Votre licence expire dans ${days} jour${days > 1 ? 's' : ''}. Veuillez contacter votre administrateur.`, {
                        duration: 8000,
                        id: 'licence-expiry-warning',
                        icon: '⚠️'
                    });
                } else if (days <= 0) {
                    toast.error(`Votre licence a expiré. Veuillez la renouveler immédiatement.`, {
                        duration: 10000,
                        id: 'licence-expired-error',
                        icon: '🚫'
                    });
                }
            } else {
                setLicence(null);
                setDaysRemaining(null);
            }
        } catch (err) {
            console.error("Erreur chargement licence globale", err);
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
