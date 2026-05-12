import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';

export interface InvoiceSettings {
    id: number;
    is_multi_caisse: boolean;
    centralized_cash_register: boolean;
    require_validator_password: boolean;
    show_profit_on_invoice: boolean;
    default_invoice_type: string;
}

export function useInvoiceSettings() {
    const [settings, setSettings] = useState<InvoiceSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSettings = useCallback(async (signal?: AbortSignal) => {
        try {
            setLoading(true);
            const { data } = await api.get<InvoiceSettings>('invoice-settings/', { signal });
            setSettings(data);
            setError(null);
        } catch (err) {
            if (err instanceof Error && err.name === 'CanceledError') return;
            console.error('Error fetching invoice settings:', err);
            setError('Erreur lors du chargement des paramètres de facturation');
        } finally {
            setLoading(false);
        }
    }, []);

    const updateSettings = useCallback(async (updates: Partial<InvoiceSettings>) => {
        try {
            const { data } = await api.put<InvoiceSettings>('invoice-settings/', updates);
            setSettings(data);
            toast.success('Paramètres de facturation mis à jour');
            return data;
        } catch (err) {
            console.error('Error updating invoice settings:', err);
            toast.error('Erreur lors de la mise à jour des paramètres');
            throw err;
        }
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        fetchSettings(controller.signal);
        return () => controller.abort();
    }, [fetchSettings]);

    return { settings, loading, error, updateSettings, refetch: fetchSettings };
}
