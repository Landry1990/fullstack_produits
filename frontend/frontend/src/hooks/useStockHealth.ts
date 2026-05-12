import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

export interface StockHealthData {
    health_score: number;
    availability_rate: number;
    rotation_rate: number;
    availability_weight: number;
    rotation_weight: number;
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
    };
    total_stock_value: number;
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
