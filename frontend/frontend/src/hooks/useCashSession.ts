import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { CaisseParTranche } from '../types';
import { safeStorage } from '../utils/storage';

export const useCashSession = () => {
    const [caisseSession, setCaisseSession] = useState<CaisseParTranche | null>(null);
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

    const fetchCaisseParTranche = useCallback(async () => {
        try {
            const token = safeStorage.getItem('authToken');
            if (!token) return;

            // Déterminer la tranche actuelle (Matin: 6h-14h, Après-midi: 14h-22h)
            // Note: Ceci est une récupération "informative", le backend calcule la vraie somme
            const now = new Date();
            const hour = now.getHours();
            let dateDebutStr, dateFinStr;
            const todayStr = now.toISOString().split('T')[0];

            if (hour >= 6 && hour < 14) {
                dateDebutStr = `${todayStr}T06:00`;
                dateFinStr = `${todayStr}T14:00`;
            } else {
                dateDebutStr = `${todayStr}T14:00`;
                dateFinStr = `${todayStr}T22:00`; // Ou lendemain 06:00 selon règle métier
            }

            const response = await axios.get(`${apiBaseUrl}/factures/caisse_par_tranche_horaire/`, {
                headers: { Authorization: `Token ${token}` },
                params: {
                    date_debut: dateDebutStr,
                    date_fin: dateFinStr
                }
            });
            setCaisseSession(response.data);
        } catch (error) {
            console.error("Erreur chargement caisse session", error);
        }
    }, [apiBaseUrl]);

    useEffect(() => {
        fetchCaisseParTranche();
        // Optionnel: rafraichir toutes les X minutes
        const interval = setInterval(fetchCaisseParTranche, 60000);
        return () => clearInterval(interval);
    }, [fetchCaisseParTranche]);

    return { caisseSession, refreshSession: fetchCaisseParTranche };
};
