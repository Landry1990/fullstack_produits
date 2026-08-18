import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import financeService from '../services/financeService';
import fournisseurService from '../services/fournisseurService';
import type { PaiementFournisseur, Fournisseur } from '../types';
import { gooeyToast } from 'goey-toast';
import { useInvalidateSupplierDashboard } from './useSupplierDashboard';
import { logger } from '../utils/logger'

export function useFinanceFournisseurs() {
    const { t } = useTranslation(['suppliers', 'common']);
    const [paiements, setPaiements] = useState<PaiementFournisseur[]>([]);
    const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
    const [loading, setLoading] = useState(false);
    const invalidateDashboard = useInvalidateSupplierDashboard();

    const fetchFournisseurs = useCallback(async () => {
        try {
            const data = await fournisseurService.getAll() as unknown as Fournisseur[] | { results?: Fournisseur[] };
            setFournisseurs(Array.isArray(data) ? data : (data.results || []));
        } catch (error) {
            logger.error('Erreur lors du chargement des fournisseurs:', error);
            gooeyToast.error(t('suppliers:messages.load_suppliers_error'));
        }
    }, [t]);

    const fetchPaiements = useCallback(async (fournisseurId?: number) => {
        setLoading(true);
        try {
            const data = await financeService.getPaiements(fournisseurId) as unknown as PaiementFournisseur[] | { results?: PaiementFournisseur[] };
            setPaiements(Array.isArray(data) ? data : (data.results || []));
        } catch (error) {
            logger.error('Erreur lors du chargement des paiements:', error);
            gooeyToast.error(t('suppliers:messages.load_payments_error'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    const createPaiement = async (data: Partial<PaiementFournisseur>) => {
        try {
            const result = await financeService.createPaiement(data);
            gooeyToast.success(t('suppliers:messages.payment_saved'));
            fetchPaiements(data.fournisseur);
            fetchFournisseurs();
            invalidateDashboard();
            return result;
        } catch (error: unknown) {
            logger.error('Erreur lors de l\'enregistrement du paiement:', error);
            const err = error as { response?: { data?: { detail?: string } } };
            const msg = err.response?.data?.detail || t('suppliers:messages.payment_save_error');
            gooeyToast.error(msg);
            throw error;
        }
    };

    const deletePaiement = async (id: number) => {
        try {
            await financeService.deletePaiement(id);
            gooeyToast.success(t('suppliers:messages.payment_deleted'));
            setPaiements(prev => prev.filter(p => p.id !== id));
            fetchFournisseurs();
            invalidateDashboard();
        } catch (error) {
            logger.error('Erreur lors de la suppression du paiement:', error);
            gooeyToast.error(t('suppliers:messages.payment_delete_error'));
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
