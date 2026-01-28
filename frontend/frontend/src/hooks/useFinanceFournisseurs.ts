
import { useState, useCallback } from 'react';
import axios from 'axios';
import type { PaiementFournisseur, Fournisseur } from '../types';
import toast from 'react-hot-toast';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

export function useFinanceFournisseurs() {
    const [paiements, setPaiements] = useState<PaiementFournisseur[]>([]);
    const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchFournisseurs = useCallback(async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/fournisseurs/`);
            setFournisseurs(response.data);
        } catch (error) {
            console.error('Erreur lors du chargement des fournisseurs:', error);
            toast.error('Erreur de chargement des fournisseurs');
        }
    }, []);

    const fetchPaiements = useCallback(async (fournisseurId?: number) => {
        setLoading(true);
        try {
            const url = fournisseurId
                ? `${API_BASE_URL}/paiements-fournisseurs/?fournisseur=${fournisseurId}`
                : `${API_BASE_URL}/paiements-fournisseurs/`;
            const response = await axios.get(url);
            const data = response.data;
            // Handle pagination (DRF returns { count, next, previous, results })
            setPaiements(Array.isArray(data) ? data : (data.results || []));
        } catch (error) {
            console.error('Erreur lors du chargement des paiements:', error);
            toast.error('Erreur de chargement des paiements');
        } finally {
            setLoading(false);
        }
    }, []);

    const createPaiement = async (data: Partial<PaiementFournisseur>) => {
        try {
            const response = await axios.post(`${API_BASE_URL}/paiements-fournisseurs/`, data);
            toast.success('Paiement enregistré avec succès');
            // Rafraîchir les données
            fetchPaiements(data.fournisseur);
            fetchFournisseurs();
            return response.data;
        } catch (error: any) {
            console.error('Erreur lors de l\'enregistrement du paiement:', error);
            const msg = error.response?.data?.detail || 'Erreur lors de l\'enregistrement';
            toast.error(msg);
            throw error;
        }
    };

    const deletePaiement = async (id: number) => {
        try {
            await axios.delete(`${API_BASE_URL}/paiements-fournisseurs/${id}/`);
            toast.success('Paiement supprimé');
            setPaiements(prev => prev.filter(p => p.id !== id));
            fetchFournisseurs();
        } catch (error) {
            toast.error('Erreur lors de la suppression');
        }
    };

    return {
        paiements,
        fournisseurs,
        loading,
        fetchFournisseurs,
        fetchPaiements,
        createPaiement,
        deletePaiement
    };
}
