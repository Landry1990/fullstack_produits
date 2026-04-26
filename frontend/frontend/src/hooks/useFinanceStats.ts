import { useQuery } from '@tanstack/react-query';
import financeService from '../services/financeService';

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
    return useQuery<CAEvolutionData>({
        queryKey: ['finance', 'ca-evolution'],
        queryFn: () => financeService.getCAEvolution(),
        staleTime: 1000 * 60 * 30, // 30 minutes
    });
};

export const useMargesEvolution = () => {
    return useQuery<MargesEvolutionData>({
        queryKey: ['finance', 'marges-evolution'],
        queryFn: () => financeService.getMargesEvolution(),
        staleTime: 1000 * 60 * 30,
    });
};

export const usePredictions = () => {
    return useQuery<PredictionsData>({
        queryKey: ['finance', 'predictions'],
        queryFn: () => financeService.getPredictions(),
        staleTime: 1000 * 60 * 30,
    });
};

export const useKPIs = () => {
    return useQuery<KPIsData>({
        queryKey: ['finance', 'kpis'],
        queryFn: () => financeService.getKPIs(),
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};

export const useTopProducts = (periode: string = 'mois', critere: string = 'ca') => {
    return useQuery<TopProductsData>({
        queryKey: ['finance', 'top-products', periode, critere],
        queryFn: () => financeService.getTopProducts(periode, critere),
        staleTime: 1000 * 60 * 15,
    });
};

export const useRepartitionCA = (by: string = 'categorie', periode: string = 'mois') => {
    return useQuery<RepartitionData>({
        queryKey: ['finance', 'repartition', by, periode],
        queryFn: () => financeService.getRepartitionCA(by, periode),
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
    return useQuery<CategoryAnalysisData>({
        queryKey: ['finance', 'analyse-categories', type, periode],
        queryFn: () => financeService.getAnalyseCategories(type, periode),
        staleTime: 1000 * 60 * 15,
    });
};

export const useEvolutionCategories = (type: 'rayon' | 'groupe' | 'forme' = 'rayon', top: number = 5) => {
    return useQuery<CategoryEvolutionData>({
        queryKey: ['finance', 'evolution-categories', type, top],
        queryFn: () => financeService.getEvolutionCategories(type, top),
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
    return useQuery<MarginAnalysisData>({
        queryKey: ['finance', 'analyse-marges'],
        queryFn: () => financeService.getAnalyseMarges(),
        staleTime: 1000 * 60 * 60, // 1 hour (heavy calculation)
    });
};

export interface MarginVarianceData {
    period1: { label: string; stats: any };
    period2: { label: string; stats: any };
    variance_pct: number;
    suspicious_products: any[];
    insights: { fr: string; en: string }[];
    labels: any;
}

export const useMarginVarianceAnalysis = (params?: any) => {
    return useQuery<MarginVarianceData>({
        queryKey: ['finance', 'margin-variance', params],
        queryFn: () => financeService.getMarginVarianceAnalysis(params),
        staleTime: 1000 * 60 * 5,
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
    return useQuery<SupplierAnalysisItem[]>({
        queryKey: ['finance', 'analyse-fournisseurs'],
        queryFn: () => financeService.getAnalyseFournisseurs(),
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
    [key: string]: string | number | boolean | null | undefined;
}

export interface RepartitionAchatsData {
    total_achats: number;
    data: RepartitionAchatsItem[];
}

// Advanced Analysis Hooks
export const useComparaisonPrix = () => {
    return useQuery<ProduitComparaison[]>({
        queryKey: ['finance', 'comparaison-prix'],
        queryFn: () => financeService.getComparaisonPrix(),
        staleTime: 1000 * 60 * 60 * 4, // 4 hours
    });
};

export const useRepartitionAchats = () => {
    return useQuery<RepartitionAchatsData>({
        queryKey: ['finance', 'repartition-achats'],
        queryFn: () => financeService.getRepartitionAchats(),
        staleTime: 1000 * 60 * 60 * 4, // 4 hours
    });
};
