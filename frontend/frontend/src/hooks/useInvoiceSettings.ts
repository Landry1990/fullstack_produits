import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { gooeyToast } from 'goey-toast';
import { logger } from '../utils/logger'

export interface InvoiceSettings {
    id: number;
    is_multi_caisse: boolean;
    centralized_cash_register: boolean;
    require_validator_password: boolean;
    auto_print_ticket: boolean;
    ticket_copies?: 1 | 2;
    sudo_session_minutes?: number;
    show_profit_on_invoice: boolean;
    default_invoice_type: string;
}

export function useInvoiceSettings() {
    const { t } = useTranslation(['facturation', 'common']);
    const [settings, setSettings] = useState<InvoiceSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const requestVersion = useRef(0);

    const fetchSettings = useCallback(async (signal?: AbortSignal) => {
        const version = ++requestVersion.current;
        try {
            setLoading(true);
            const { data } = await api.get<InvoiceSettings>('invoice-settings/', {
                signal, params: { _fresh: Date.now() },
            });
            if (signal?.aborted || version !== requestVersion.current) return;
            setSettings(data);
            setError(null);
        } catch (err) {
            if (signal?.aborted || version !== requestVersion.current) return;
            if (err instanceof Error && err.name === 'CanceledError') return;
            logger.error('Error fetching invoice settings:', err);
            setError(t('facturation:messages.invoice_settings_load_error'));
        } finally {
            if (version === requestVersion.current && !signal?.aborted) setLoading(false);
        }
    }, [t]);

    const updateSettings = useCallback(async (updates: Partial<InvoiceSettings>) => {
        try {
            const { data } = await api.put<InvoiceSettings>('invoice-settings/', updates);
            window.dispatchEvent(new CustomEvent<InvoiceSettings>('invoice-settings-updated', { detail: data }));
            gooeyToast.success(t('facturation:messages.invoice_settings_updated'));
            return data;
        } catch (err) {
            logger.error('Error updating invoice settings:', err);
            gooeyToast.error(t('facturation:messages.invoice_settings_update_error'));
            throw err;
        }
    }, [t]);

    useEffect(() => {
        const controller = new AbortController();
        const onUpdated = (event: Event) => {
            ++requestVersion.current;
            setSettings((event as CustomEvent<InvoiceSettings>).detail);
            setError(null);
            setLoading(false);
        };
        const onFocus = () => { void fetchSettings(controller.signal); };
        window.addEventListener('invoice-settings-updated', onUpdated);
        window.addEventListener('focus', onFocus);
        void fetchSettings(controller.signal);
        return () => {
            controller.abort();
            window.removeEventListener('invoice-settings-updated', onUpdated);
            window.removeEventListener('focus', onFocus);
        };
    }, [fetchSettings]);

    return { settings, loading, error, updateSettings, refetch: fetchSettings };
}
