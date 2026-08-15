import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { logger } from '../utils/logger'

export interface InvoiceSettings {
    id: number;
    is_multi_caisse: boolean;
    centralized_cash_register: boolean;
    require_validator_password: boolean;
    show_profit_on_invoice: boolean;
    default_invoice_type: string;
}

export function useInvoiceSettings() {
    const { t } = useTranslation(['facturation', 'common']);
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
            logger.error('Error fetching invoice settings:', err);
            setError('Erreur lors du chargement des paramètres de facturation');
        } finally {
            setLoading(false);
        }
    }, []);

    const updateSettings = useCallback(async (updates: Partial<InvoiceSettings>) => {
        try {
            const { data } = await api.put<InvoiceSettings>('invoice-settings/', updates);
            setSettings(data);
            toast.success(t('facturation:messages.invoice_settings_updated'));
            return data;
        } catch (err) {
            logger.error('Error updating invoice settings:', err);
            toast.error(t('facturation:messages.invoice_settings_update_error'));
            throw err;
        }
    }, [t]);

    useEffect(() => {
        const controller = new AbortController();
        fetchSettings(controller.signal);
        return () => controller.abort();
    }, [fetchSettings]);

    return { settings, loading, error, updateSettings, refetch: fetchSettings };
}
