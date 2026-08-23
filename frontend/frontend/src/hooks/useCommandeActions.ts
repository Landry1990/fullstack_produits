
import { useState } from 'react';
import { gooeyToast } from 'goey-toast';
import { useTranslation } from 'react-i18next';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { getApiErrorDetail } from '../utils/errorHandling';
import type { Commande, CommandeProduit, User, PaginatedResponse } from '../types';
import commandeService, { type SudoCredentials, type TransformationDisponible } from '../services/commandeService';
import { logger } from '../utils/logger';
interface UseCommandeActionsProps {
    fetchCommandes: () => Promise<void>;
    setSelectedCommande: (commande: Commande | null) => void;
    setViewMode: (mode: 'LIST' | 'CREATE' | 'DETAILS' | 'EDIT') => void;
    confirm: (options: { title?: string; message: string; variant?: 'success' | 'warning' | 'danger' | 'info'; confirmText?: string }) => Promise<boolean>;
    user: User | null;
}

function removeCommandeFromCache(queryClient: QueryClient, idToRemove: number) {
    queryClient.setQueriesData({ queryKey: ['commandes'] }, (old: unknown) => {
        if (!old || typeof old !== 'object') return old;
        const data = old as PaginatedResponse<Commande>;
        if (!data || !data.results) return old;
        return {
            ...data,
            results: data.results.filter((c: Commande) => c.id !== idToRemove),
            count: Math.max(0, (data.count || 0) - 1),
        };
    });
}

function removeCommandesFromCache(queryClient: QueryClient, idsToRemove: number[]) {
    const idSet = new Set(idsToRemove);
    queryClient.setQueriesData({ queryKey: ['commandes'] }, (old: unknown) => {
        if (!old || typeof old !== 'object') return old;
        const data = old as PaginatedResponse<Commande>;
        if (!data || !data.results) return old;
        return {
            ...data,
            results: data.results.filter((c: Commande) => !idSet.has(c.id)),
            count: Math.max(0, (data.count || 0) - idsToRemove.length),
        };
    });
}

// Met à jour une commande dans toutes les queries ['commandes', ...] du cache.
// Utilisé après une action (clôture, annulation, etc.) pour que la liste
// reflète immédiatement le nouveau statut sans attendre un refetch réseau.
function updateCommandeInCache(queryClient: QueryClient, updated: Commande) {
    queryClient.setQueriesData({ queryKey: ['commandes'] }, (old: unknown) => {
        if (!old || typeof old !== 'object') return old;
        const data = old as PaginatedResponse<Commande>;
        if (!data || !data.results) return old;
        return {
            ...data,
            results: data.results.map((c: Commande) => (c.id === updated.id ? updated : c)),
        };
    });
}

export function useCommandeActions({
    fetchCommandes,
    setSelectedCommande,
    setViewMode,
}: UseCommandeActionsProps) {
    const { t } = useTranslation(['orders', 'common']);
    const [executingAction, setExecutingAction] = useState(false);

    const handleSaveCommande = async (
        commandeData: Partial<Commande>,
        commandeProduits: CommandeProduit[],
        viewMode: 'CREATE' | 'EDIT',
        selectedCommande: Commande | null,
        isAutoSave: boolean = false
    ) => {
        if (executingAction && !isAutoSave) return;
        if (!isAutoSave) setExecutingAction(true);

        if (!commandeData.fournisseur) {
            if (!isAutoSave) gooeyToast.error(t('orders:messages.provider_required'));
            if (!isAutoSave) setExecutingAction(false);
            return;
        }

        if (viewMode === 'EDIT' && !selectedCommande?.id) {
            if (!isAutoSave) gooeyToast.error(t('orders:messages.no_selection'));
            if (!isAutoSave) setExecutingAction(false);
            return;
        }

        try {
            let commandeId = selectedCommande?.id;

            // 1. Créer ou mettre à jour la commande
            if (viewMode === 'CREATE') {
                const newCmd = await commandeService.create(commandeData);
                commandeId = newCmd.id;
                if (!isAutoSave) gooeyToast.success(t('orders:messages.create_success', { id: commandeId }));

                if (isAutoSave) {
                    const createdCmd = await commandeService.getById(commandeId);
                    setSelectedCommande(createdCmd);
                    setViewMode('EDIT');
                }
            } else if (viewMode === 'EDIT' && commandeId) {
                await commandeService.update(commandeId, commandeData);
                if (!isAutoSave) gooeyToast.success(t('orders:messages.update_success'));
            }

            if (!commandeId) {
                if (isAutoSave) return;
                throw new Error(t('orders:messages.missing_id'));
            }

            // 2. Gérer les produits via bulk_sync
            const produitsPayload = commandeProduits.map(p => {
                const parseAndFormat = (val: string | number | undefined, defaultValue: string = '0'): string => {
                    const parsed = parseFloat(String(val || 0));
                    return isNaN(parsed) ? defaultValue : Math.round(parsed).toString();
                };

                const parseEuro = (val: string | number | undefined): string | null => {
                    if (!val) return null;
                    const parsed = parseFloat(String(val));
                    return isNaN(parsed) ? null : Math.round(parsed).toString();
                };

                return {
                    id: p.id && typeof p.id === 'number' && p.id < 1000000000 ? p.id : undefined,
                    produit: typeof p.produit === 'object' ? p.produit.id : p.produit,
                    quantity: parseInt(String(p.quantity || 0)) || 0,
                    unites_gratuites: parseInt(String(p.unites_gratuites || 0)) || 0,
                    price: parseAndFormat(p.price),
                    price_cost: parseAndFormat(p.price_cost || p.price),
                    selling_price: parseAndFormat(p.selling_price),
                    prix_euro: parseEuro(p.prix_euro),
                    tva: p.tva !== undefined && p.tva !== null ? String(p.tva) : undefined,
                    taux_marge: parseFloat(String(p.marge || p.taux_marge || 1.3)).toFixed(4),
                    lot: p.lot || null,
                    date_expiration: p.date_expiration || null
                };
            });

            await commandeService.bulkSyncProduits(commandeId, produitsPayload);

            if (!isAutoSave) {
                fetchCommandes();
                setViewMode('LIST');
            }

        } catch (err) {
            gooeyToast.error(getApiErrorDetail(err, t('orders:messages.save_error')));
        } finally {
            if (!isAutoSave) setExecutingAction(false);
        }
    }

    const queryClient = useQueryClient();

    const handleDeleteCommande = async (commande: Commande, sudoCredentials?: SudoCredentials) => {
        if (executingAction) return;
        setExecutingAction(true);
        try {
            await commandeService.delete(commande.id, sudoCredentials);
            gooeyToast.success(t('orders:messages.delete_success'));
            removeCommandeFromCache(queryClient, commande.id);
            fetchCommandes();
            setSelectedCommande(null);
            setViewMode('LIST');
        } catch (err) {
            gooeyToast.error(getApiErrorDetail(err, t('orders:messages.delete_error')));
            throw err;
        } finally {
            setExecutingAction(false);
        }
    };

    const handleCloturerCommande = async (commande: Commande, sudoCredentials?: SudoCredentials) => {
        if (executingAction) return;
        setExecutingAction(true);
        try {
            const res = await commandeService.cloturer(commande.id, sudoCredentials);
            gooeyToast.success(res.message || t('orders:messages.close_success'));

            // Récupérer la commande mise à jour AVANT d'invalider le cache
            // pour éviter toute race condition avec le refetch de la liste
            const updated = await commandeService.getById(commande.id);
            setSelectedCommande(updated);
            // Mettre à jour le cache de la liste immédiatement pour que le
            // statut (badge "US TITLE") se rafraîchisse sans attendre un refetch.
            updateCommandeInCache(queryClient, updated);
            setViewMode('DETAILS');

            // Après clôture réussie, vérifier si des produits peuvent être reconditionnés
            try {
                const transformations = await commandeService.getTransformationsDisponibles(commande.id);
                if (transformations.length > 0) {
                    setReconditionnementModal({
                        open: true,
                        commandeId: commande.id,
                        commandeNumero: commande.numero_facture || String(commande.id),
                        transformations,
                    });
                }
            } catch {
                // Silencieux : le reconditionnement est une commodité, pas un blocage
            }

            // Invalider le cache de la liste en dernier (refetch async)
            fetchCommandes();
        } catch (err) {
            gooeyToast.error(getApiErrorDetail(err, t('orders:messages.close_error')));
            throw err;
        } finally {
            setExecutingAction(false);
        }
    };

    // --- Reconditionnement automatique après clôture ---
    // Le hook gère uniquement l'état du modal ; la logique de transformation
    // (appels à l'endpoint existant relations-transformation/{id}/transformer/)
    // est dans le composant ReconditionnementModal.
    const [reconditionnementModal, setReconditionnementModal] = useState<{
        open: boolean;
        commandeId: number;
        commandeNumero: string;
        transformations: TransformationDisponible[];
    }>({ open: false, commandeId: 0, commandeNumero: '', transformations: [] });

    const handleReconditionnementDone = () => {
        setReconditionnementModal((prev) => ({ ...prev, open: false }));
        fetchCommandes();
    };

    const handleMettreEnAttente = async (commande: Commande) => {
        if (executingAction) return;
        setExecutingAction(true);
        try {
            const newStatus = commande.status === 'ATT' ? 'PREP' : 'ATT';
            await commandeService.update(commande.id, { status: newStatus });
            const statusDisplay = newStatus === 'ATT' ? t('status.pending') : t('status.prep');
            gooeyToast.success(t('orders:messages.status_update_success', { status: statusDisplay }));
            const updated = await commandeService.getById(commande.id);
            setSelectedCommande(updated);
            fetchCommandes();
        } catch (err) {
            gooeyToast.error(getApiErrorDetail(err, t('orders:messages.status_change_error')));
        } finally {
            setExecutingAction(false);
        }
    };

    const handleAnnulerReception = async (commande: Commande, sudoCredentials?: SudoCredentials) => {
        if (executingAction) return;
        setExecutingAction(true);
        try {
            await commandeService.annulerReception(commande.id, sudoCredentials);
            gooeyToast.success(t('orders:messages.cancel_reception_success'));
            fetchCommandes();
            const updated = await commandeService.getById(commande.id);
            setSelectedCommande(updated);
        } catch (err) {
            gooeyToast.error(getApiErrorDetail(err, t('orders:messages.cancel_reception_error')));
            throw err;
        } finally {
            setExecutingAction(false);
        }
    };

    const handleImprimerReception = async (commande: Commande, _fournisseurName: string) => {
        if (executingAction) return;
        setExecutingAction(true);

        try {
            const blob = await commandeService.imprimerReception(commande.id);
            const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));

            const printWindow = window.open(url, '_blank', 'noopener,noreferrer');
            if (!printWindow) {
                window.URL.revokeObjectURL(url);
                gooeyToast.error(t('orders:messages.popup_blocked'));
                return;
            }

            // Libérer l'URL blob après un délai (le navigateur a eu le temps de l'afficher)
            setTimeout(() => window.URL.revokeObjectURL(url), 30000);
            gooeyToast.success(t('orders:messages.print_ready'));
        } catch (err) {
            logger.error('Erreur impression bon de réception:', err);
            gooeyToast.error(getApiErrorDetail(err, t('orders:messages.print_error')));
        } finally {
            setExecutingAction(false);
        }
    };

    const handleBulkDelete = async (ids: number[], sudoCredentials?: SudoCredentials) => {
        if (executingAction || ids.length === 0) return;
        setExecutingAction(true);
        try {
            await commandeService.bulkDelete(ids, sudoCredentials);
            gooeyToast.success(t('orders:messages.bulk_delete_success', { count: ids.length }));
            removeCommandesFromCache(queryClient, ids);
            fetchCommandes();
            setSelectedCommande(null);
            setViewMode('LIST');
        } catch (err) {
            gooeyToast.error(t('orders:messages.bulk_delete_error'));
            throw err;
        } finally {
            setExecutingAction(false);
        }
    };

    return {
        handleSaveCommande,
        handleDeleteCommande,
        handleBulkDelete,
        handleCloturerCommande,
        handleMettreEnAttente,
        handleAnnulerReception,
        handleImprimerReception,
        executingAction,
        reconditionnement: {
            modal: reconditionnementModal,
            setModal: setReconditionnementModal,
            onDone: handleReconditionnementDone,
        },
    };
}


