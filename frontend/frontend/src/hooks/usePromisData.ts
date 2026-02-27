import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useConfirm } from './useConfirm';
import type { Promis, ProduitModel, Client } from '../types';

export interface UsePromisDataReturn {
    // Data
    promisList: Promis[];
    filteredPromis: Promis[];
    loading: boolean;
    error: string | null;
    clients: Client[];
    produits: ProduitModel[];

    // Statistics
    stats: {
        total: number;
        enAttente: number;
        delivres: number;
        annules: number;
    };

    // Filters & Search
    filterStatus: 'ALL' | 'ATT' | 'DEL' | 'ANN';
    setFilterStatus: (status: 'ALL' | 'ATT' | 'DEL' | 'ANN') => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;

    // Actions
    refresh: () => Promise<void>;
    handleDelivrer: (id: number) => Promise<void>;
    handleAnnuler: (id: number) => Promise<void>; // opens Sudo Modal
    handlePrintTicket: (id: number) => Promise<void>;

    // Bulk Actions
    selectedIds: Set<number>;
    toggleSelection: (id: number) => void;
    toggleSelectAll: () => void;
    bulkLoading: boolean;
    handleBulkDelivrer: () => Promise<void>;
    handleBulkAnnuler: () => Promise<void>; // opens Sudo Modal
    clearSelection: () => void;

    // Sudo Modal State (Managed here or passed up)
    sudoModal: { isOpen: boolean, action: 'cancel' | 'bulk_cancel' | null, targetId: number | null };
    setSudoModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean, action: 'cancel' | 'bulk_cancel' | null, targetId: number | null }>>;
    handleSudoConfirm: () => void;
}

export function usePromisData(): UsePromisDataReturn {
    const { t } = useTranslation();
    const confirm = useConfirm();

    const [promisList, setPromisList] = useState<Promis[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'ATT' | 'DEL' | 'ANN'>('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    // Form Data (Clients & Products)
    const [clients, setClients] = useState<Client[]>([]);
    const [produits, setProduits] = useState<ProduitModel[]>([]);

    // Selection state
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [bulkLoading, setBulkLoading] = useState(false);

    // Sudo Actions
    const [sudoModal, setSudoModal] = useState<{
        isOpen: boolean;
        action: 'cancel' | 'bulk_cancel' | null;
        targetId: number | null;
    }>({ isOpen: false, action: null, targetId: null });

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
    const promisEndpoint = `${apiBaseUrl}/api/promis/`;

    // --- Data Fetching ---
    const fetchPromis = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axios.get(promisEndpoint);
            // Depending on pagination
            const results = Array.isArray(data) ? data : (data.results || []);
            setPromisList(results);
            setError(null);
        } catch (err) {
            setError('Erreur lors du chargement des promis');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [promisEndpoint]);

    const fetchFormData = useCallback(async () => {
        try {
            const [clientsRes, produitsRes] = await Promise.all([
                axios.get(`${apiBaseUrl}/api/clients/`),
                axios.get(`${apiBaseUrl}/api/produits/`)
            ]);
            setClients(Array.isArray(clientsRes.data) ? clientsRes.data : (clientsRes.data.results || []));
            setProduits(Array.isArray(produitsRes.data) ? produitsRes.data : (produitsRes.data.results || []));
        } catch (err) {
            console.error('Erreur chargement clients/produits (Promis)', err);
        }
    }, [apiBaseUrl]);

    useEffect(() => {
        fetchPromis();
        fetchFormData();
    }, [fetchPromis, fetchFormData]);

    // --- Computations ---
    const filteredPromis = useMemo(() => {
        let filtered = [...promisList];
        if (filterStatus !== 'ALL') {
            filtered = filtered.filter(p => p.status === filterStatus);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(p =>
                (p.client_display || '').toLowerCase().includes(q) ||
                (p.client_phone_display || '').toLowerCase().includes(q) ||
                (p.produit_name || '').toLowerCase().includes(q) ||
                (p.produit_cip || '').toLowerCase().includes(q)
            );
        }
        return filtered;
    }, [promisList, filterStatus, searchQuery]);

    const stats = useMemo(() => ({
        total: promisList.length,
        enAttente: promisList.filter(p => p.status === 'ATT').length,
        delivres: promisList.filter(p => p.status === 'DEL').length,
        annules: promisList.filter(p => p.status === 'ANN').length
    }), [promisList]);

    // --- Actions ---
    const handleDelivrer = async (id: number) => {
        const confirmed = await confirm({
            title: 'Marquer comme délivré',
            message: 'Marquer ce promis comme délivré ?',
            variant: 'success',
            confirmText: 'Délivrer'
        });
        if (!confirmed) return;
        try {
            await axios.post(`${promisEndpoint}${id}/delivrer/`);
            fetchPromis();
        } catch (err) {
            toast.error('Erreur lors de la livraison');
            console.error(err);
        }
    };

    const handleAnnuler = async (id: number) => {
        const confirmed = await confirm({
            title: 'Annuler le promis',
            message: "Annuler ce promis et réintégrer le stock ?\n\nCette action créera une entrée dans l'historique du produit.\n\nUne confirmation par mot de passe sera requise.",
            variant: 'warning',
            confirmText: 'Continuer'
        });
        if (!confirmed) return;
        setSudoModal({ isOpen: true, action: 'cancel', targetId: id });
    };

    const verifySudoAndCancel = async (id: number) => {
        try {
            const { data } = await axios.post(`${promisEndpoint}${id}/annuler_et_reintegrer/`);
            toast.success(data.detail);
            fetchPromis();
        } catch (err) {
            toast.error("Erreur lors de l'annulation");
            console.error(err);
        }
    };

    const handlePrintTicket = async (id: number) => {
        try {
            const response = await axios.get(`${promisEndpoint}${id}/imprimer_ticket/`, {
                responseType: 'blob'
            });
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            window.open(url, '_blank');
            setTimeout(() => window.URL.revokeObjectURL(url), 10000);
        } catch (err) {
            console.error('Erreur impression ticket:', err);
            toast.error(t('promis.messages.print_ticket_error', 'Erreur lors de l\'impression'));
        }
    };

    // --- Bulk Actions ---
    const toggleSelection = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        const attPromis = filteredPromis.filter(p => p.status === 'ATT');
        if (selectedIds.size === attPromis.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(attPromis.map(p => p.id)));
        }
    };

    const handleBulkDelivrer = async () => {
        if (selectedIds.size === 0) return;
        const confirmed = await confirm({
            title: t('promis.modals.bulk_delivery_title', 'Livraison en masse'),
            message: t('promis.modals.bulk_delivery_message', { count: selectedIds.size, defaultValue: `Confirmez la livraison de ${selectedIds.size} promis ?` }),
            variant: 'success',
            confirmText: t('promis.modals.bulk_delivery_confirm', 'Livrer')
        });
        if (!confirmed) return;

        setBulkLoading(true);
        try {
            const { data } = await axios.post(`${promisEndpoint}bulk_delivrer/`, {
                ids: Array.from(selectedIds)
            });
            toast.success(data.detail);
            setSelectedIds(new Set());
            fetchPromis();
        } catch (err) {
            toast.error(t('promis.messages.bulk_delivery_error', 'Erreur lors de la livraison multiple'));
            console.error(err);
        } finally {
            setBulkLoading(false);
        }
    };

    const handleBulkAnnuler = async () => {
        if (selectedIds.size === 0) return;
        const confirmed = await confirm({
            title: t('promis.modals.bulk_cancel_title', 'Annulation en masse'),
            message: t('promis.modals.bulk_cancel_message', { count: selectedIds.size, defaultValue: `Confirmer l'annulation de ${selectedIds.size} promis ?` }) + '\n\nUne confirmation par mot de passe sera requise.',
            variant: 'warning',
            confirmText: t('promis.modals.bulk_cancel_confirm', 'Annuler')
        });
        if (!confirmed) return;
        setSudoModal({ isOpen: true, action: 'bulk_cancel', targetId: null });
    };

    const verifySudoAndBulkCancel = async () => {
        setBulkLoading(true);
        try {
            const { data } = await axios.post(`${promisEndpoint}bulk_annuler/`, {
                ids: Array.from(selectedIds)
            });
            toast.success(data.detail);
            setSelectedIds(new Set());
            fetchPromis();
        } catch (err) {
            toast.error(t('promis.messages.bulk_cancel_error', 'Erreur lors de l\'annulation multiple'));
            console.error(err);
        } finally {
            setBulkLoading(false);
        }
    };

    const handleSudoConfirm = () => {
        if (sudoModal.action === 'cancel' && sudoModal.targetId) {
            verifySudoAndCancel(sudoModal.targetId);
        } else if (sudoModal.action === 'bulk_cancel') {
            verifySudoAndBulkCancel();
        }
        setSudoModal({ isOpen: false, action: null, targetId: null });
    };

    return {
        promisList,
        filteredPromis,
        loading,
        error,
        clients,
        produits,
        stats,
        filterStatus,
        setFilterStatus,
        searchQuery,
        setSearchQuery,
        refresh: fetchPromis,
        handleDelivrer,
        handleAnnuler,
        handlePrintTicket,
        selectedIds,
        toggleSelection,
        toggleSelectAll,
        bulkLoading,
        handleBulkDelivrer,
        handleBulkAnnuler,
        clearSelection: () => setSelectedIds(new Set()),
        sudoModal,
        setSudoModal,
        handleSudoConfirm
    };
}
