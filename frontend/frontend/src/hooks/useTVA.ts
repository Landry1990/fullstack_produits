import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import type { TVA } from '../types';
import { logger } from '../utils/logger'

export function useTVA() {
    const { t } = useTranslation('pharmacy_settings');
    const [tvaList, setTvaList] = useState<TVA[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTVAs = async (signal?: AbortSignal) => {
        try {
            setLoading(true);
            const response = await api.get('tva/', { signal });
            // Gérer la pagination DRF (PageNumberPagination)
            const data = response.data.results !== undefined ? response.data.results : response.data;
            setTvaList(Array.isArray(data) ? data : []);
            setError(null);
        } catch (err: unknown) {
            if ((err as { name?: string })?.name === 'CanceledError') return;
            logger.error('Error fetching TVAs:', err);
            setError(t('tva.error_load'));
        } finally {
            setLoading(false);
        }
    };

    const addTVA = async (taux: string, libelle: string) => {
        try {
            await api.post('tva/', { taux, libelle });
            await fetchTVAs();
            return { success: true };
        } catch (err: unknown) {
            logger.error('Error adding TVA:', err);
            let message = t('tva.error_add');

            const error = err as { response?: { data?: { taux?: unknown; detail?: string } | string } };
            if (error.response?.data) {
                const data = error.response.data;
                if (typeof data === 'object' && data.taux) {
                    message = t('tva.error_duplicate', { rate: taux });
                } else if (typeof data === 'string') {
                    message = data;
                } else if (typeof data === 'object' && data.detail) {
                    message = data.detail;
                }
            }

            setError(message);
            return { success: false, message };
        }
    };

    const updateTVA = async (id: number, data: Partial<TVA>) => {
        try {
            await api.patch(`tva/${id}/`, data);
            await fetchTVAs();
            return true;
        } catch (err: unknown) {
            logger.error('Error updating TVA:', err);
            setError(t('tva.error_update'));
            return false;
        }
    };

    const deleteTVA = async (id: number) => {
        try {
            await api.delete(`tva/${id}/`);
            await fetchTVAs();
            return true;
        } catch (err: unknown) {
            logger.error('Error deleting TVA:', err);
            setError(t('tva.error_delete'));
            return false;
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        fetchTVAs(controller.signal);
        return () => controller.abort();
    }, []);

    return { tvaList, loading, error, addTVA, updateTVA, deleteTVA, refreshTVAs: fetchTVAs };
}
