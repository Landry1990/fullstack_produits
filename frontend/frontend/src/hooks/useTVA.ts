import { useState, useEffect } from 'react';
import axios from '../config/axios';
import type { TVA } from '../types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
const API_URL = `${apiBaseUrl}/api`;

export function useTVA() {
    const [tvaList, setTvaList] = useState<TVA[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTVAs = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_URL}/tva/`);
            // Gérer la pagination DRF (PageNumberPagination)
            const data = response.data.results !== undefined ? response.data.results : response.data;
            setTvaList(Array.isArray(data) ? data : []);
            setError(null);
        } catch (err: unknown) {
            console.error('Error fetching TVAs:', err);
            setError('Erreur lors du chargement des taux de TVA');
        } finally {
            setLoading(false);
        }
    };

    const addTVA = async (taux: string, libelle: string) => {
        try {
            await axios.post(`${API_URL}/tva/`, { taux, libelle });
            await fetchTVAs();
            return { success: true };
        } catch (err: unknown) {
            console.error('Error adding TVA:', err);
            let message = 'Erreur lors de l\'ajout de la TVA';

            const error = err as { response?: { data?: { taux?: unknown; detail?: string } | string } };
            if (error.response?.data) {
                const data = error.response.data;
                if (typeof data === 'object' && data.taux) {
                    message = `Ce taux de TVA existe déjà (${taux}%)`;
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
            await axios.patch(`${API_URL}/tva/${id}/`, data);
            await fetchTVAs();
            return true;
        } catch (err: unknown) {
            console.error('Error updating TVA:', err);
            setError('Erreur lors de la modification de la TVA');
            return false;
        }
    };

    const deleteTVA = async (id: number) => {
        try {
            await axios.delete(`${API_URL}/tva/${id}/`);
            await fetchTVAs();
            return true;
        } catch (err: unknown) {
            console.error('Error deleting TVA:', err);
            setError('Erreur lors de la suppression de la TVA');
            return false;
        }
    };

    useEffect(() => {
        fetchTVAs();
    }, []);

    return { tvaList, loading, error, addTVA, updateTVA, deleteTVA, refreshTVAs: fetchTVAs };
}
