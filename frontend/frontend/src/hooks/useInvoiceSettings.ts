import { useState, useEffect, useCallback } from 'react';
import axios from '../config/axios';
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

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';
    const endpoint = apiBaseUrl ? `${apiBaseUrl}/api/invoice-settings/` : '/api/invoice-settings/';

    const fetchSettings = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await axios.get<InvoiceSettings>(endpoint);
            setSettings(data);
            setError(null);
        } catch (err) {
            console.error('Error fetching invoice settings:', err);
            setError('Erreur lors du chargement des paramètres de facturation');
        } finally {
            setLoading(false);
        }
    }, [endpoint]);

    const updateSettings = useCallback(async (updates: Partial<InvoiceSettings>) => {
        try {
            const { data } = await axios.put<InvoiceSettings>(endpoint, updates);
            setSettings(data);
            toast.success('Paramètres de facturation mis à jour');
            return data;
        } catch (err) {
            console.error('Error updating invoice settings:', err);
            toast.error('Erreur lors de la mise à jour des paramètres');
            throw err;
        }
    }, [endpoint]);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    return { settings, loading, error, updateSettings, refetch: fetchSettings };
}
