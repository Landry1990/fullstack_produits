import { useState, useCallback } from 'react';
import financeService from '../services/financeService';
import fournisseurService from '../services/fournisseurService';
import type { PaiementFournisseur, Fournisseur } from '../types';
import toast from 'react-hot-toast';
import { useInvalidateSupplierDashboard } from './useSupplierDashboard';

export function useFinanceFournisseurs() {
    const [paiements, setPaiements] = useState<PaiementFournisseur[]>([]);
    const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
    const [loading, setLoading] = useState(false);
    const invalidateDashboard = useInvalidateSupplierDashboard();

    const fetchFournisseurs = useCallback(async () => {
        try {
            const data = await fournisseurService.getAll();
            setFournisseurs(Array.isArray(data) ? data : (data.results || []));
        } catch (error) {
            console.error('Erreur lors du chargement des fournisseurs:', error);
            toast.error('Erreur de chargement des fournisseurs');
        }
    }, []);

    const fetchPaiements = useCallback(async (fournisseurId?: number) => {
        setLoading(true);
        try {
            const data = await financeService.getPaiements(fournisseurId);
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
            const result = await financeService.createPaiement(data);
            toast.success('Paiement enregistré avec succès');
            fetchPaiements(data.fournisseur);
            fetchFournisseurs();
            invalidateDashboard();
            return result;
        } catch (error: unknown) {
            console.error('Erreur lors de l\'enregistrement du paiement:', error);
            const err = error as { response?: { data?: { detail?: string } } };
            const msg = err.response?.data?.detail || 'Erreur lors de l\'enregistrement';
            toast.error(msg);
            throw error;
        }
    };

    const deletePaiement = async (id: number) => {
        try {
            await financeService.deletePaiement(id);
            toast.success('Paiement supprimé');
            setPaiements(prev => prev.filter(p => p.id !== id));
            fetchFournisseurs();
            invalidateDashboard();
        } catch (error) {
            console.error('Erreur lors de la suppression du paiement:', error);
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
