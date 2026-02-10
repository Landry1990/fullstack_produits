import { useQuery } from '@tanstack/react-query';
import axios from '../config/axios';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';

const temporalAnalysisEndpoint = apiBaseUrl
    ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/temporal-analysis/`
    : '/api/temporal-analysis/';

// ===== Types =====

export interface PeakHourData {
    hour: string;
    sales_count: number;
    revenue: number;
    avg_basket: number;
    is_peak: boolean;
}

export interface PeakHoursResponse {
    data: PeakHourData[];
    peak_hour: string;
    peak_revenue: number;
    analysis_days: number;
}

export interface DailyComparisonData {
    day: string;
    day_number: number;
    sales_count: number;
    revenue: number;
    avg_basket: number;
    is_best: boolean;
}

export interface DailyComparisonResponse {
    data: DailyComparisonData[];
    best_day: string;
    best_revenue: number;
    analysis_weeks: number;
}

export interface MonthlyTrend {
    month: string;
    month_number: number;
    year: number;
    revenue: number;
    sales_count: number;
}

export interface SeasonalProduct {
    id: number;
    name: string;
    peak_month: string;
    peak_quantity: number;
    avg_monthly: number;
    variation_pct: number;
    total_quantity: number;
}

export interface SeasonalityResponse {
    monthly_trends: MonthlyTrend[];
    seasonal_products: SeasonalProduct[];
    analysis_months: number;
    total_products_analyzed: number;
}

// ===== Hooks =====

export const usePeakHours = (days: number = 30) => {
    return useQuery({
        queryKey: ['temporalAnalysis', 'peakHours', days],
        queryFn: async () => {
            const response = await axios.get<PeakHoursResponse>(
                `${temporalAnalysisEndpoint}peak_hours/`,
                { params: { days } }
            );
            return response.data;
        },
        staleTime: 1000 * 60 * 15, // 15 minutes
    });
};

export const useDailyComparison = (weeks: number = 12) => {
    return useQuery({
        queryKey: ['temporalAnalysis', 'dailyComparison', weeks],
        queryFn: async () => {
            const response = await axios.get<DailyComparisonResponse>(
                `${temporalAnalysisEndpoint}daily_comparison/`,
                { params: { weeks } }
            );
            return response.data;
        },
        staleTime: 1000 * 60 * 15, // 15 minutes
    });
};

export const useSeasonality = (months: number = 12, topN: number = 20) => {
    return useQuery({
        queryKey: ['temporalAnalysis', 'seasonality', months, topN],
        queryFn: async () => {
            const response = await axios.get<SeasonalityResponse>(
                `${temporalAnalysisEndpoint}seasonality/`,
                { params: { months, top_n: topN } }
            );
            return response.data;
        },
        staleTime: 1000 * 60 * 30, // 30 minutes
    });
};
