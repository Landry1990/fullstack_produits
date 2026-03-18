import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useConfirm } from './useConfirm';
import promisService from '../services/promisService';
import clientService from '../services/clientService';
import produitService from '../services/produitService';
import type { Promis, ProduitModel, Client, PaginatedResponse } from '../types';

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
    handleWhatsAppReminder: (id: number) => Promise<void>;

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
    const { t } = useTranslation(['stock', 'common']);
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

    // --- Data Fetching ---
    const fetchPromis = useCallback(async () => {
        setLoading(true);
        try {
            const results = await promisService.getAll();
            setPromisList(Array.isArray(results) ? results : (results as PaginatedResponse<Promis>).results || []);
            setError(null);
        } catch (err) {
            setError(t('stock:promis.messages.load_error', 'Erreur lors du chargement des promis'));
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchFormData = useCallback(async () => {
        try {
            const [clientsRes, produitsRes] = await Promise.all([
                clientService.getAll({ page_size: 1000 }),
                produitService.getAll({ page_size: 1000 })
            ]);
            setClients(Array.isArray(clientsRes) ? clientsRes : (clientsRes as PaginatedResponse<Client>).results || []);
            setProduits(Array.isArray(produitsRes) ? produitsRes : (produitsRes as PaginatedResponse<ProduitModel>).results || []);
        } catch (err) {
            console.error('Erreur chargement clients/produits (Promis)', err);
        }
    }, []);

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
            title: t('stock:promis.actions.deliver', 'Marquer comme délivré'),
            message: t('stock:promis.messages.deliver_confirm', 'Marquer ce promis comme délivré ?'),
            variant: 'success',
            confirmText: t('stock:promis.actions.deliver', 'Délivrer')
        });
        if (!confirmed) return;
        try {
            await promisService.delivrer(id);
            fetchPromis();
        } catch (err) {
            toast.error(t('stock:promis.messages.deliver_error', 'Erreur lors de la livraison'));
            console.error(err);
        }
    };

    const handleAnnuler = async (id: number) => {
        const confirmed = await confirm({
            title: t('stock:promis.actions.cancel', 'Annuler le promis'),
            message: t('stock:promis.messages.cancel_confirm', "Annuler ce promis et réintégrer le stock ?\n\nCette action créera une entrée dans l'historique du produit.\n\nUne confirmation par mot de passe sera requise."),
            variant: 'warning',
            confirmText: t('common:continue', 'Continuer')
        });
        if (!confirmed) return;
        setSudoModal({ isOpen: true, action: 'cancel', targetId: id });
    };

    const verifySudoAndCancel = async (id: number) => {
        try {
            const data = await promisService.annulerEtReintegrer(id);
            toast.success(data.detail);
            fetchPromis();
        } catch (err) {
            toast.error(t('stock:promis.messages.cancel_error', 'Erreur lors de l\'annulation'));
            console.error(err);
        }
    };

    const handlePrintTicket = async (id: number) => {
        try {
            const blob = await promisService.imprimerTicket(id);
            const url = window.URL.createObjectURL(blob);
            window.open(url, '_blank');
            setTimeout(() => window.URL.revokeObjectURL(url), 10000);
        } catch (err) {
            console.error('Erreur impression ticket:', err);
            toast.error(t('stock:promis.messages.print_ticket_error', 'Erreur lors de l\'impression'));
        }
    };

    const handleWhatsAppReminder = async (id: number) => {
        setLoading(true);
        try {
            const data = await promisService.sendWhatsAppReminder(id);
            toast.success(data.detail);
        } catch (err: unknown) {
            const error = err as { response?: { data?: { detail?: string } } };
            toast.error(error.response?.data?.detail || t('stock:promis.messages.whatsapp_error', "Erreur lors de l'envoi du rappel WhatsApp"));
            console.error(err);
        } finally {
            setLoading(false);
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
            title: t('stock:promis.modals.bulk_delivery_title', 'Livraison en masse'),
            message: t('stock:promis.modals.bulk_delivery_message', { count: selectedIds.size, defaultValue: `Confirmez la livraison de ${selectedIds.size} promis ?` }),
            variant: 'success',
            confirmText: t('stock:promis.modals.bulk_delivery_confirm', 'Livrer')
        });
        if (!confirmed) return;

        setBulkLoading(true);
        try {
            const data = await promisService.bulkDelivrer(Array.from(selectedIds));
            toast.success(data.detail);
            setSelectedIds(new Set());
            fetchPromis();
        } catch (err) {
            toast.error(t('stock:promis.messages.bulk_delivery_error', 'Erreur lors de la livraison multiple'));
            console.error(err);
        } finally {
            setBulkLoading(false);
        }
    };

    const handleBulkAnnuler = async () => {
        if (selectedIds.size === 0) return;
        const confirmed = await confirm({
            title: t('stock:promis.modals.bulk_cancel_title', 'Annulation en masse'),
            message: t('stock:promis.modals.bulk_cancel_message', { count: selectedIds.size, defaultValue: `Confirmer l'annulation de ${selectedIds.size} promis ?` }) + '\n\n' + t('stock:promis.messages.sudo_required_note', 'Une confirmation par mot de passe sera requise.'),
            variant: 'danger',
            confirmText: t('stock:promis.modals.bulk_cancel_confirm', 'Annuler')
        });
        if (!confirmed) return;
        setSudoModal({ isOpen: true, action: 'bulk_cancel', targetId: null });
    };

    const verifySudoAndBulkCancel = async () => {
        setBulkLoading(true);
        try {
            const data = await promisService.bulkAnnuler(Array.from(selectedIds));
            toast.success(data.detail);
            setSelectedIds(new Set());
            fetchPromis();
        } catch (err) {
            toast.error(t('stock:promis.messages.bulk_cancel_error', 'Erreur lors de l\'annulation multiple'));
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
        handleWhatsAppReminder,
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
