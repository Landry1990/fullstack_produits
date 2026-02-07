import { useQuery } from '@tanstack/react-query';
import axios from '../config/axios';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';

const financeEndpoint = apiBaseUrl
    ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/finance-stats/`
    : '/api/finance-stats/';

// Types
export interface CAEvolutionData {
    labels: string[];
    data: number[];
    comparaison_n1: number[];
    total_current: number;
    total_n1: number;
    croissance_yoy: number;
}

export interface MargesEvolutionData {
    labels: string[];
    marge_brute: number[];
    taux_marge: number[];
    ca: number[];
    taux_moyen: number;
    total_marge: number;
}

export interface PredictionsData {
    labels: string[];
    historique: number[];
    prediction_labels: string[];
    predictions: number[];
    predictions_ma: number[];
    predictions_lr: number[];
    tendance: 'hausse' | 'baisse' | 'stable';
    confiance: 'haute' | 'moyenne' | 'faible';
}

export interface KPIsData {
    panier_moyen: {
        mois: number;
        annee: number;
    };
    taux_marge: number;
    dsi: number;
    ca_mois: number;
    nb_ventes_mois: number;
    ca_annee: number;
    nb_ventes_annee: number;
    stock_value: number;
    croissance_mensuelle: number;
}

export interface TopProduct {
    id: number;
    nom: string;
    cip: string;
    ca: number;
    marge: number;
    taux_marge: number;
    quantite: number;
}

export interface TopProductsData {
    periode: string;
    critere: string;
    data: TopProduct[];
}

export interface RepartitionItem {
    id: number;
    nom: string;
    ca: number;
    pourcentage: number;
}

export interface RepartitionData {
    by: string;
    periode: string;
    total: number;
    data: RepartitionItem[];
}

// Hooks
export const useCAEvolution = () => {
    return useQuery({
        queryKey: ['finance', 'ca-evolution'],
        queryFn: async () => {
            const response = await axios.get<CAEvolutionData>(`${financeEndpoint}ca_evolution/`);
            return response.data;
        },
        staleTime: 1000 * 60 * 30, // 30 minutes
    });
};

export const useMargesEvolution = () => {
    return useQuery({
        queryKey: ['finance', 'marges-evolution'],
        queryFn: async () => {
            const response = await axios.get<MargesEvolutionData>(`${financeEndpoint}marges_evolution/`);
            return response.data;
        },
        staleTime: 1000 * 60 * 30,
    });
};

export const usePredictions = () => {
    return useQuery({
        queryKey: ['finance', 'predictions'],
        queryFn: async () => {
            const response = await axios.get<PredictionsData>(`${financeEndpoint}predictions/`);
            return response.data;
        },
        staleTime: 1000 * 60 * 30,
    });
};

export const useKPIs = () => {
    return useQuery({
        queryKey: ['finance', 'kpis'],
        queryFn: async () => {
            const response = await axios.get<KPIsData>(`${financeEndpoint}kpis/`);
            return response.data;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};

export const useTopProducts = (periode: string = 'mois', critere: string = 'ca') => {
    return useQuery({
        queryKey: ['finance', 'top-products', periode, critere],
        queryFn: async () => {
            const response = await axios.get<TopProductsData>(
                `${financeEndpoint}top_products/?periode=${periode}&critere=${critere}`
            );
            return response.data;
        },
        staleTime: 1000 * 60 * 15,
    });
};

export const useRepartitionCA = (by: string = 'categorie', periode: string = 'mois') => {
    return useQuery({
        queryKey: ['finance', 'repartition', by, periode],
        queryFn: async () => {
            const response = await axios.get<RepartitionData>(
                `${financeEndpoint}repartition_ca/?by=${by}&periode=${periode}`
            );
            return response.data;
        },
        staleTime: 1000 * 60 * 15,
    });
};

// Category Analysis Types
export interface CategoryAnalysisItem {
    id: number;
    nom: string;
    ca: number;
    marge: number;
    taux_marge: number;
    pourcentage_ca: number;
    nb_ventes: number;
}

export interface CategoryAnalysisData {
    type: 'rayon' | 'groupe' | 'forme';
    periode: string;
    total_ca: number;
    total_marge: number;
    taux_marge_global: number;
    data: CategoryAnalysisItem[];
}

export interface CategoryEvolutionSeries {
    id: number;
    nom: string;
    data: number[];
}

export interface CategoryEvolutionData {
    type: 'rayon' | 'groupe' | 'forme';
    labels: string[];
    series: CategoryEvolutionSeries[];
}

// Category Analysis Hooks
export const useAnalyseCategories = (type: 'rayon' | 'groupe' | 'forme' = 'rayon', periode: string = 'mois') => {
    return useQuery({
        queryKey: ['finance', 'analyse-categories', type, periode],
        queryFn: async () => {
            const response = await axios.get<CategoryAnalysisData>(
                `${financeEndpoint}analyse_categories/?type=${type}&periode=${periode}`
            );
            return response.data;
        },
        staleTime: 1000 * 60 * 15,
    });
};

export const useEvolutionCategories = (type: 'rayon' | 'groupe' | 'forme' = 'rayon', top: number = 5) => {
    return useQuery({
        queryKey: ['finance', 'evolution-categories', type, top],
        queryFn: async () => {
            const response = await axios.get<CategoryEvolutionData>(
                `${financeEndpoint}evolution_categories/?type=${type}&top=${top}`
            );
            return response.data;
        },
        staleTime: 1000 * 60 * 15,
    });
};

// Margin Analysis Types
export interface OpportuniteItem {
    id: number;
    nom: string;
    taux_marge: number;
    volume: number;
    marge_perdue: number;
}

export interface StockDormantItem {
    id: number;
    nom: string;
    taux_marge: number;
    volume: number;
    prix_actuel: number;
}

export interface SuggestionPrixItem {
    id: number;
    nom: string;
    taux_actuel: number;
    prix_actuel: number;
    prix_suggere: number;
    impact_estime: number;
}

export interface MarginAnalysisData {
    opportunites_nego: OpportuniteItem[];
    stock_dormant: StockDormantItem[];
    suggestions_prix: SuggestionPrixItem[];
}

// Margin Analysis Hook
export const useAnalyseMarges = () => {
    return useQuery({
        queryKey: ['finance', 'analyse-marges'],
        queryFn: async () => {
            const response = await axios.get<MarginAnalysisData>(`${financeEndpoint}analyse_marges/`);
            return response.data;
        },
        staleTime: 1000 * 60 * 60, // 1 hour (heavy calculation)
    });
};

// Supplier Analysis Types
export interface SupplierScoreDetail {
    valeur?: number;
    incidents?: number;
    nb_livraisons?: number;
    score: number;
}

export interface SupplierAnalysisItem {
    id: number;
    nom: string;
    score_global: number;
    details: {
        volume: SupplierScoreDetail;
        qualite: SupplierScoreDetail;
        regularite: SupplierScoreDetail;
    };
}

// Supplier Analysis Hook
export const useAnalyseFournisseurs = () => {
    return useQuery({
        queryKey: ['finance', 'analyse-fournisseurs'],
        queryFn: async () => {
            const response = await axios.get<SupplierAnalysisItem[]>(`${financeEndpoint}analyse_fournisseurs/`);
            return response.data;
        },
        staleTime: 1000 * 60 * 60,
    });
};

// Price Comparison Types
export interface OffrePrix {
    fournisseur: string;
    prix_moyen: number;
}

export interface ProduitComparaison {
    id: number;
    produit: string;
    offres: OffrePrix[];
    ecart_pourcentage: number;
    meilleur_prix: number;
}

// Purchase Concentration Types
export interface RepartitionAchatsItem {
    id: number;
    nom: string;
    value: number;
    pourcentage: number;
    [key: string]: any;
}

export interface RepartitionAchatsData {
    total_achats: number;
    data: RepartitionAchatsItem[];
}

// Advanced Analysis Hooks
export const useComparaisonPrix = () => {
    return useQuery({
        queryKey: ['finance', 'comparaison-prix'],
        queryFn: async () => {
            const response = await axios.get<ProduitComparaison[]>(`${financeEndpoint}comparaison_prix_achat/`);
            return response.data;
        },
        staleTime: 1000 * 60 * 60 * 4, // 4 hours
    });
};

export const useRepartitionAchats = () => {
    return useQuery({
        queryKey: ['finance', 'repartition-achats'],
        queryFn: async () => {
            const response = await axios.get<RepartitionAchatsData>(`${financeEndpoint}repartition_achats/`);
            return response.data;
        },
        staleTime: 1000 * 60 * 60 * 4, // 4 hours
    });
};

