import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

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

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

    const fetchHealth = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get(`${apiBaseUrl.replace(/\/$/, '')}/api/statistiques/stock_health/`);
            setData(response.data);
        } catch (err: any) {
            setError(err.message || 'Error fetching stock health data');
        } finally {
            setLoading(false);
        }
    }, [apiBaseUrl]);

    useEffect(() => {
        fetchHealth();
    }, [fetchHealth]);

    return { data, loading, error, refresh: fetchHealth };
};
