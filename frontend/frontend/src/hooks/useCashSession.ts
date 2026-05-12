import { useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import type { CaisseParTranche } from '../types';
import { getLocalDateString } from '../utils/dateUtils';

export const useCashSession = () => {
    const [caisseSession, setCaisseSession] = useState<CaisseParTranche | null>(null);

    const fetchCaisseParTranche = useCallback(async () => {
        try {
            // Déterminer la tranche actuelle (Matin: 6h-14h, Après-midi: 14h-22h)
            // Note: Ceci est une récupération "informative", le backend calcule la vraie somme
            const todayStr = getLocalDateString(new Date());
            const now = new Date();
            const hour = now.getHours();

            const dateDebutStr = (hour >= 6 && hour < 14)
                ? `${todayStr}T06:00`
                : `${todayStr}T14:00`;
            const dateFinStr = (hour >= 6 && hour < 14)
                ? `${todayStr}T14:00`
                : `${todayStr}T22:00`; // Ou lendemain 06:00 selon règle métier

            const response = await api.get('factures/caisse_par_tranche_horaire/', {
                params: { date_debut: dateDebutStr, date_fin: dateFinStr }
            });
            setCaisseSession(response.data);
        } catch (error) {
            console.error("Erreur chargement caisse session", error);
        }
    }, []);

    useEffect(() => {
        fetchCaisseParTranche();
        // Optionnel: rafraichir toutes les X minutes
        const interval = setInterval(fetchCaisseParTranche, 60000);
        return () => clearInterval(interval);
    }, [fetchCaisseParTranche]);

    return { caisseSession, refreshSession: fetchCaisseParTranche };
};
