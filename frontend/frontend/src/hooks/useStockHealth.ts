import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

export interface ScoreComponent {
    score: number;
    rate: number;
    weight: number;
}

export interface StockHealthData {
    health_score: number;
    availability_rate: number;
    rotation_rate: number;
    rupture_rate: number;
    availability_weight: number;
    rotation_weight: number;
    score_details?: {
        disponibilite: ScoreComponent;
        fluidite: ScoreComponent;
        couverture: ScoreComponent;
        activite: ScoreComponent;
        immobilisation: ScoreComponent;
    };
    dead_stock: {
        value: number;
        count: number;
        days_threshold: number;
    };
    missed_sales: {
        monthly_revenue: number;
        monthly_margin: number;
        daily_revenue: number;
    };
    critical_alerts: {
        soon_out_of_stock_count: number;
        soon_out_of_stock_value: number;
        rupture_count?: number;
    };
    top_penalties?: MatrixProduct[];
    total_stock_value: number;
}

export interface MatrixProduct {
    id: number;
    name: string;
    cip: string;
    quadrant: 'MOTEUR' | 'HEMORRAGIE' | 'SOMNIFERE' | 'NEUTRE';
    days_since_sale: number;
    stock_value: number;
    impact_pts: number;
    rotation?: number;
    days_until_stockout?: number | null;
}

export const useStockHealth = () => {
    const [data, setData] = useState<StockHealthData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const controllerRef = useRef<AbortController | null>(null);

    const fetchHealth = useCallback(async () => {
        controllerRef.current?.abort();
        const controller = new AbortController();
        controllerRef.current = controller;

        setLoading(true);
        setError(null);
        try {
            const response = await api.get('statistiques/stock_health/', { signal: controller.signal });
            setData(response.data);
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') return;
            setError(err instanceof Error ? err.message : 'Error fetching stock health data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchHealth();
        return () => controllerRef.current?.abort();
    }, [fetchHealth]);

    return { data, loading, error, refresh: fetchHealth };
};
