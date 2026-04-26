import api from './api';
import type { PaiementFournisseur } from '../types';

const financeService = {
    // Financial Stats
    getCAEvolution: async (): Promise<any> => {
        const response = await api.get('finance-stats/ca_evolution/');
        return response.data;
    },

    getMargesEvolution: async (): Promise<any> => {
        const response = await api.get('finance-stats/marges_evolution/');
        return response.data;
    },

    getPredictions: async (): Promise<any> => {
        const response = await api.get('finance-stats/predictions/');
        return response.data;
    },

    getKPIs: async (): Promise<any> => {
        const response = await api.get('finance-stats/kpis/');
        return response.data;
    },

    getTopProducts: async (periode: string, critere: string): Promise<any> => {
        const response = await api.get('finance-stats/top_products/', {
            params: { periode, critere }
        });
        return response.data;
    },

    getRepartitionCA: async (by: string, periode: string): Promise<any> => {
        const response = await api.get('finance-stats/repartition_ca/', {
            params: { by, periode }
        });
        return response.data;
    },

    getAnalyseCategories: async (type: string, periode: string): Promise<any> => {
        const response = await api.get('finance-stats/analyse_categories/', {
            params: { type, periode }
        });
        return response.data;
    },

    getEvolutionCategories: async (type: string, top: number): Promise<any> => {
        const response = await api.get('finance-stats/evolution_categories/', {
            params: { type, top }
        });
        return response.data;
    },

    getAnalyseMarges: async (): Promise<any> => {
        const response = await api.get('finance-stats/analyse_marges/');
        return response.data;
    },

    getAnalyseFournisseurs: async (): Promise<any> => {
        const response = await api.get('finance-stats/analyse_fournisseurs/');
        return response.data;
    },

    getComparaisonPrix: async (): Promise<any> => {
        const response = await api.get('finance-stats/comparaison_prix_achat/');
        return response.data;
    },

    getRepartitionAchats: async (): Promise<any> => {
        const response = await api.get('finance-stats/repartition_achats/');
        return response.data;
    },

    getMarginVarianceAnalysis: async (params?: any): Promise<any> => {
        const response = await api.get('finance-stats/margin_variance_analysis/', { params });
        return response.data;
    },

    // Supplier Payments
    getPaiements: async (fournisseurId?: number): Promise<any> => {
        const params = fournisseurId ? { fournisseur: fournisseurId } : {};
        const response = await api.get('paiements-fournisseurs/', { params });
        return response.data;
    },

    createPaiement: async (data: Partial<PaiementFournisseur>): Promise<PaiementFournisseur> => {
        const response = await api.post<PaiementFournisseur>('paiements-fournisseurs/', data);
        return response.data;
    },

    deletePaiement: async (id: number): Promise<void> => {
        await api.delete(`paiements-fournisseurs/${id}//`); // Fix double slash if needed, but api.ts has / at end
    }
};

export default financeService;
