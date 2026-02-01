import { useState, useCallback, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Facture } from '../types';
import { safeStorage } from '../utils/storage';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

export const useSalesData = () => {
    const { t } = useTranslation();
    const [factures, setFactures] = useState<Facture[]>([]);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

    const fetchFactures = useCallback(async () => {
        setLoading(true);
        try {
            const token = safeStorage.getItem('authToken');
            if (!token) return;

            const response = await axios.get(`${apiBaseUrl}/factures/`, {
                headers: { Authorization: `Token ${token}` },
                params: {
                    start_date: startDate,
                    end_date: endDate
                }
            });
            setFactures(response.data);
        } catch (error) {
            console.error('Erreur chargement factures:', error);
            toast.error(t('sales.messages.load_error'));
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, t, apiBaseUrl]);

    useEffect(() => {
        fetchFactures();
    }, [fetchFactures]);

    const handleDeleteBrouillons = async () => {
        if (!window.confirm(t('sales.confirm_delete_drafts'))) return;
        try {
            const token = safeStorage.getItem('authToken');
            await axios.delete(`${apiBaseUrl}/factures/delete_brouillons/`, {
                headers: { Authorization: `Token ${token}` }
            });
            toast.success(t('sales.messages.delete_drafts_success'));
            fetchFactures();
        } catch (error) {
            console.error(error);
            toast.error(t('sales.messages.delete_drafts_error'));
        }
    };

    const deleteFacture = async (id: number) => {
        if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette facture ?")) return;
        try {
            const token = safeStorage.getItem('authToken');
            await axios.delete(`${apiBaseUrl}/factures/${id}/`, {
                headers: { Authorization: `Token ${token}` }
            });
            toast.success("Facture supprimée.");
            // Optimistic update
            setFactures(prev => prev.filter(f => f.id !== id));
        } catch (error) {
            console.error(error);
            toast.error("Erreur lors de la suppression.");
        }
    };

    const filteredFactures = useMemo(() => {
        return factures.filter(f => {
            const matchesSearch =
                (f.client_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                (f.numero_facture?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                (f.id.toString()).includes(searchTerm);

            const matchesStatus = statusFilter === 'ALL' || f.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [factures, searchTerm, statusFilter]);

    return {
        factures,
        setFactures, // Exposed for optimistic updates from other hooks
        filteredFactures,
        loading,
        filters: {
            startDate, setStartDate,
            endDate, setEndDate,
            searchTerm, setSearchTerm,
            statusFilter, setStatusFilter
        },
        refresh: fetchFactures, // Alias for refetching
        handleDeleteBrouillons,
        deleteFacture
    };
};
