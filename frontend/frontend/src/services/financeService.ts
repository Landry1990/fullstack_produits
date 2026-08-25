import api from './api';
import { generateUUID } from '../utils/uuid';
import type { PaiementFournisseur } from '../types';
import type {
    CAEvolutionData, MargesEvolutionData, PredictionsData, KPIsData,
    TopProductsData, RepartitionData, CategoryAnalysisData, CategoryEvolutionData,
    MarginAnalysisData, SupplierAnalysisItem, ProduitComparaison, RepartitionAchatsData,
    MarginVarianceData, MargeParProduitData, ImpactPromotionsData
} from '../hooks/useFinanceStats';

const financeService = {
    // Financial Stats
    getCAEvolution: async (): Promise<CAEvolutionData> => {
        const response = await api.get('finance-stats/ca_evolution/');
        return response.data as CAEvolutionData;
    },

    getMargesEvolution: async (): Promise<MargesEvolutionData> => {
        const response = await api.get('finance-stats/marges_evolution/');
        return response.data as MargesEvolutionData;
    },

    getPredictions: async (): Promise<PredictionsData> => {
        const response = await api.get('finance-stats/predictions/');
        return response.data as PredictionsData;
    },

    getKPIs: async (): Promise<KPIsData> => {
        const response = await api.get('finance-stats/kpis/');
        return response.data as KPIsData;
    },

    getTopProducts: async (periode: string, critere: string): Promise<TopProductsData> => {
        const response = await api.get('finance-stats/top_products/', {
            params: { periode, critere }
        });
        return response.data as TopProductsData;
    },

    getRepartitionCA: async (by: string, periode: string): Promise<RepartitionData> => {
        const response = await api.get('finance-stats/repartition_ca/', {
            params: { by, periode }
        });
        return response.data as RepartitionData;
    },

    getAnalyseCategories: async (type: string, periode: string): Promise<CategoryAnalysisData> => {
        const response = await api.get('finance-stats/analyse_categories/', {
            params: { type, periode }
        });
        return response.data as CategoryAnalysisData;
    },

    getEvolutionCategories: async (type: string, top: number): Promise<CategoryEvolutionData> => {
        const response = await api.get('finance-stats/evolution_categories/', {
            params: { type, top }
        });
        return response.data as CategoryEvolutionData;
    },

    getAnalyseMarges: async (): Promise<MarginAnalysisData> => {
        const response = await api.get('finance-stats/analyse_marges/');
        return response.data as MarginAnalysisData;
    },

    getAnalyseFournisseurs: async (): Promise<SupplierAnalysisItem[]> => {
        const response = await api.get('finance-stats/analyse_fournisseurs/');
        return response.data as SupplierAnalysisItem[];
    },

    getComparaisonPrix: async (): Promise<ProduitComparaison[]> => {
        const response = await api.get('finance-stats/comparaison_prix_achat/');
        return response.data as ProduitComparaison[];
    },

    getRepartitionAchats: async (): Promise<RepartitionAchatsData> => {
        const response = await api.get('finance-stats/repartition_achats/');
        return response.data as RepartitionAchatsData;
    },

    getMarginVarianceAnalysis: async (params?: unknown): Promise<MarginVarianceData> => {
        const response = await api.get('finance-stats/margin_variance_analysis/', { params });
        return response.data as MarginVarianceData;
    },

    getMargeParProduit: async (periode: string = 'mois'): Promise<MargeParProduitData> => {
        const response = await api.get('finance-stats/marge_par_produit/', {
            params: { periode }
        });
        return response.data as MargeParProduitData;
    },

    getImpactPromotions: async (periode: string = 'mois'): Promise<ImpactPromotionsData> => {
        const response = await api.get('finance-stats/impact_promotions/', {
            params: { periode }
        });
        return response.data as ImpactPromotionsData;
    },

    // Supplier Payments
    getPaiements: async (fournisseurId?: number): Promise<PaiementFournisseur[]> => {
        const params = fournisseurId ? { fournisseur: fournisseurId } : {};
        const response = await api.get('paiements-fournisseurs/', { params });
        return response.data as PaiementFournisseur[];
    },

    getPaiementsHistory: async (params: {
        fournisseur?: number;
        mode_paiement?: string;
        date_debut?: string;
        date_fin?: string;
        search?: string;
        ordering?: string;
        page?: number;
        page_size?: number;
    }): Promise<{ count: number; results: PaiementFournisseur[] }> => {
        const response = await api.get('paiements-fournisseurs/', { params });
        return response.data as { count: number; results: PaiementFournisseur[] };
    },

    getPaiementsHistoryAll: async (params: {
        fournisseur?: number;
        mode_paiement?: string;
        date_debut?: string;
        date_fin?: string;
        search?: string;
        ordering?: string;
    }): Promise<PaiementFournisseur[]> => {
        const PAGE_SIZE = 500;
        const first = await financeService.getPaiementsHistory({ ...params, page: 1, page_size: PAGE_SIZE });
        const totalPages = Math.max(1, Math.ceil(first.count / PAGE_SIZE));
        const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
        const rest = await Promise.all(
            remainingPages.map((page) =>
                financeService.getPaiementsHistory({ ...params, page, page_size: PAGE_SIZE }),
            ),
        );
        return [...first.results, ...rest.flatMap((r) => r.results)];
    },

    createPaiement: async (data: Partial<PaiementFournisseur>, idempotencyKey?: string): Promise<PaiementFournisseur> => {
        const key = idempotencyKey || generateUUID();
        const headers = { 'Idempotency-Key': key };
        const response = await api.post<PaiementFournisseur>('paiements-fournisseurs/', data, { headers });
        return response.data;
    },

    deletePaiement: async (id: number): Promise<void> => {
        await api.delete(`paiements-fournisseurs/${id}//`); // Fix double slash if needed, but api.ts has / at end
    }
};

export default financeService;
