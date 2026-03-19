import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import type { Commande, CommandeProduit, User } from '../types';
import commandeService from '../services/commandeService';

interface UseCommandeActionsProps {
    fetchCommandes: () => Promise<void>;
    setSelectedCommande: (commande: Commande | null) => void;
    setViewMode: (mode: 'LIST' | 'CREATE' | 'DETAILS' | 'EDIT') => void;
    confirm: (options: { title?: string; message: string; variant?: 'success' | 'warning' | 'danger' | 'info'; confirmText?: string }) => Promise<boolean>;
    user: User | null;
}

// Helper function for Date format MM/YY
function parseMMYYToDate(mmyy: string | null | undefined): string | null {
    if (!mmyy) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(mmyy)) return mmyy; // Already ISO

    const parts = mmyy.split('/');
    if (parts.length === 2 && parts[1].length === 2) {
        const month = parseInt(parts[0], 10);
        const year = parseInt('20' + parts[1], 10);
        if (month >= 1 && month <= 12) {
            const lastDay = new Date(year, month, 0).getDate();
            return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        }
    }
    return null;
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
            if (!isAutoSave) toast.error(t('messages.provider_required'));
            if (!isAutoSave) setExecutingAction(false);
            return;
        }

        if (viewMode === 'EDIT' && !selectedCommande?.id) {
            if (!isAutoSave) toast.error(t('messages.no_selection'));
            if (!isAutoSave) setExecutingAction(false);
            return;
        }

        try {
            let commandeId = selectedCommande?.id;

            // 1. Créer ou mettre à jour la commande
            if (viewMode === 'CREATE') {
                const newCmd = await commandeService.create(commandeData);
                commandeId = newCmd.id;
                if (!isAutoSave) toast.success(t('messages.create_success', { id: commandeId }));

                if (isAutoSave) {
                    const createdCmd = await commandeService.getById(commandeId);
                    setSelectedCommande(createdCmd);
                    setViewMode('EDIT');
                }
            } else if (viewMode === 'EDIT' && commandeId) {
                await commandeService.update(commandeId, commandeData);
                if (!isAutoSave) toast.success(t('messages.update_success'));
            }

            if (!commandeId) {
                if (isAutoSave) return;
                throw new Error("ID de commande manquant");
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
                    price_cost: parseAndFormat(p.price),
                    selling_price: parseAndFormat(p.selling_price),
                    prix_euro: parseEuro(p.prix_euro),
                    tva: parseAndFormat(p.tva, '18'),
                    marge: parseFloat(String(p.marge || 1.3)).toFixed(4),
                    lot: p.lot || null,
                    date_expiration: parseMMYYToDate(p.date_expiration)
                };
            });

            await commandeService.bulkSyncProduits(commandeId, produitsPayload);

            if (!isAutoSave) {
                fetchCommandes();
                setViewMode('LIST');
            }

        } catch (err: any) {
            toast.error(err.response?.data?.message || "Erreur de sauvegarde");
        } finally {
            if (!isAutoSave) setExecutingAction(false);
        }
    }

    const handleDeleteCommande = async (commande: Commande, sudoCredentials?: any) => {
        if (executingAction) return;
        setExecutingAction(true);
        try {
            await commandeService.delete(commande.id, sudoCredentials);
            toast.success(t('messages.delete_success'));
            fetchCommandes();
            setSelectedCommande(null);
            setViewMode('LIST');
        } catch (err: any) {
            toast.error(err.response?.data?.message || t('messages.delete_error'));
        } finally {
            setExecutingAction(false);
        }
    };

    const handleCloturerCommande = async (commande: Commande, sudoCredentials?: any) => {
        if (executingAction) return;
        setExecutingAction(true);
        try {
            const res = await commandeService.cloturer(commande.id, sudoCredentials);
            toast.success(res.message || t('messages.close_success'));
            fetchCommandes();
            const updated = await commandeService.getById(commande.id);
            setSelectedCommande(updated);
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Erreur de clôture");
        } finally {
            setExecutingAction(false);
        }
    };

    const handleMettreEnAttente = async (commande: Commande) => {
        if (executingAction) return;
        setExecutingAction(true);
        try {
            const newStatus = commande.status === 'ATT' ? 'PREP' : 'ATT';
            await commandeService.update(commande.id, { status: newStatus });
            const statusDisplay = newStatus === 'ATT' ? t('status.pending') : t('status.prep');
            toast.success(t('messages.status_update_success', { status: statusDisplay }));
            const updated = await commandeService.getById(commande.id);
            setSelectedCommande(updated);
            fetchCommandes();
        } catch (err: any) {
            toast.error("Erreur lors du changement de statut");
        } finally {
            setExecutingAction(false);
        }
    };

    const handleAnnulerReception = async (commande: Commande, sudoCredentials?: any) => {
        if (executingAction) return;
        setExecutingAction(true);
        try {
            await commandeService.annulerReception(commande.id, sudoCredentials);
            toast.success(t('messages.cancel_reception_success'));
            fetchCommandes();
            const updated = await commandeService.getById(commande.id);
            setSelectedCommande(updated);
        } catch (err: any) {
            toast.error("Erreur lors de l'annulation");
        } finally {
            setExecutingAction(false);
        }
    };

    const handleImprimerReception = async (commande: Commande) => {
        if (executingAction) return;
        setExecutingAction(true);
        try {
            const blob = await commandeService.imprimerReception(commande.id);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `reception_commande_${commande.id}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
        } catch (err) {
            toast.error(t('messages.print_error'));
        } finally {
            setExecutingAction(false);
        }
    };

    const handleBulkDelete = async (ids: number[], sudoCredentials?: any) => {
        if (executingAction || ids.length === 0) return;
        setExecutingAction(true);
        try {
            await commandeService.bulkDelete(ids, sudoCredentials);
            toast.success(t('messages.bulk_delete_success', { count: ids.length }));
            fetchCommandes();
            setSelectedCommande(null);
            setViewMode('LIST');
        } catch (err) {
            toast.error(t('messages.bulk_delete_error'));
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
        executingAction
    };
}

