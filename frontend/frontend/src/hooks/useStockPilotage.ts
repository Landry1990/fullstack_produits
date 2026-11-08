import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

export interface PilotageOrderItem {
    produit_id: number;
    produit_nom: string;
    produit_ref: string;
    fournisseur_id: number | null;
    fournisseur_nom: string;
    stock: number;
    vmd: number;
    rotation_mois?: number;
    stock_minimum?: number;
    stock_maximum?: number;
    jours_base?: number;
    tendance: number;
    couverture_jours: number;
    quantite_suggeree: number;
    prix_achat: number;
    montant_ht: number;
    urgence: 'rupture' | 'critique' | 'alerte';
    date_limite: string;
    date_rupture: string;
    delai_livraison: number;
    raison: string;
}

export interface PilotageNoOrderItem {
    produit_id: number;
    produit_nom: string;
    produit_ref: string;
    fournisseur_id: number | null;
    fournisseur_nom: string;
    stock: number;
    valeur_stock: number;
    jours_sans_vente: number;
    derniere_vente: string | null;
    en_rupture: boolean;
}

export interface StockPilotageData {
    periode: number;
    dormant_days: number;
    jours_donnees?: number;
    summary: {
        commander_count: number;
        commander_montant_ht: number;
        bientot_count: number;
        bientot_montant_ht: number;
        ne_pas_commander_count: number;
        ne_pas_commander_valeur: number;
    };
    commander: PilotageOrderItem[];
    bientot: PilotageOrderItem[];
    ne_pas_commander: PilotageNoOrderItem[];
}

export const useStockPilotage = (periode = 30) => {
    const [data, setData] = useState<StockPilotageData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const controllerRef = useRef<AbortController | null>(null);

    const fetchPilotage = useCallback(async () => {
        controllerRef.current?.abort();
        const controller = new AbortController();
        controllerRef.current = controller;

        setLoading(true);
        setError(null);
        try {
            const response = await api.get('statistiques/stock_pilotage/', {
                params: { periode },
                signal: controller.signal,
            });
            setData(response.data);
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') return;
            setError(err instanceof Error ? err.message : 'Error fetching stock pilotage data');
        } finally {
            setLoading(false);
        }
    }, [periode]);

    useEffect(() => {
        fetchPilotage();
        return () => controllerRef.current?.abort();
    }, [fetchPilotage]);

    return { data, loading, error, refresh: fetchPilotage };
};
