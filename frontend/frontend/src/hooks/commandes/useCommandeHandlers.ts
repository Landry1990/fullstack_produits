import { gooeyToast } from 'goey-toast';
import type { Commande, CommandeProduit } from '../../types';
import { getProduitId, getProduitObject, getProduitName } from '../../types/inventory';
import type { AnnulerReceptionPayload } from '../../services/commandeService';
import type { ReceptionGroupBy } from '../../utils/print/printHelpers';
import { normalizeNumberInput } from '../../utils/formatters';

interface SudoOpts {
    validated_by_id: number;
    sudo_password: string;
}

interface ConfirmOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info' | 'success';
}

interface UseCommandeHandlersParams {
    selectedCommande: Commande | null;
    commandeProduits: CommandeProduit[];
    selectedRows: Set<number>;
    viewMode: string;
    newCommandeFournisseurId: string;
    numeroFacture: string;
    commandeType: string;
    tauxChange: string;
    fraisCoefficient: string;
    commandes: Commande[];
    selectedOrderIds: Set<number>;
    setSelectedOrderIds: (ids: Set<number>) => void;
    setSelectedRows: (rows: Set<number>) => void;
    setCommandeProduits: (updater: (prev: CommandeProduit[]) => CommandeProduit[]) => void;
    handleSaveCommande: (cmd: Partial<Commande>, produits: CommandeProduit[], mode: 'CREATE' | 'EDIT', selected: Commande | null, skipInvalidate?: boolean) => Promise<void>;
    handleCloturerCommande: (cmd: Commande, opts: { validated_by_id: number; sudo_password: string }) => Promise<void>;
    handleDeleteCommande: (cmd: Commande, opts: { validated_by_id: number; sudo_password: string }) => Promise<void>;
    handleMettreEnAttente: (cmd: Commande) => void;
    handleAnnulerReception: (cmd: Commande, opts: SudoOpts & AnnulerReceptionPayload) => Promise<void>;
    handleImprimerReception: (cmd: Commande, fournisseurName: string, groupBy?: ReceptionGroupBy) => void;
    handleBulkDelete: (ids: number[], opts: { validated_by_id: number; sudo_password: string }) => Promise<void>;
    queryClient: { invalidateQueries: (opts: { queryKey: string[] }) => void };
    confirm: (opts: ConfirmOptions) => Promise<boolean>;
    requireSudo: (cb: (validatorId: number, password: string) => void, opts: { permission: string; title: string; message: string }) => void;
    navigate: (path: string, opts?: { state?: unknown }) => void;
    t: (key: string, options?: unknown) => string;
}

export function useCommandeHandlers(params: UseCommandeHandlersParams) {
    const {
        selectedCommande,
        commandeProduits,
        selectedRows,
        viewMode,
        newCommandeFournisseurId,
        numeroFacture,
        commandeType,
        tauxChange,
        fraisCoefficient,
        commandes,
        selectedOrderIds,
        setSelectedOrderIds,
        handleSaveCommande,
        handleCloturerCommande,
        handleDeleteCommande,
        handleMettreEnAttente,
        handleAnnulerReception,
        handleImprimerReception,
        handleBulkDelete,
        queryClient,
        confirm,
        requireSudo,
        navigate,
        t,
    } = params;

    const onCloture = async () => {
        if (!selectedCommande) return;

        // Vérifier les produits sans date de péremption
        const produits = (commandeProduits.length > 0 ? commandeProduits : (selectedCommande?.produits || [])) as CommandeProduit[];
        const sansPeremption = produits.filter((p) => !p.date_expiration);
        const warnings: string[] = [];

        if (sansPeremption.length > 0) {
            const noms = sansPeremption.map((p) => {
                const nom = getProduitName(p.produit, p.produit_nom ?? '');
                return `   • ${nom || t('orders:messages.product_reference', { id: String(p.id || t('common:unknown')) })}`;
            });
            warnings.push(`${t('orders:messages.section_missing_expiration')}\n${noms.join('\n')}`);
        }

        // Vérifier les produits vendus à perte (prix de vente HT < prix d'achat)
        const produitsEnPerte = produits.filter((p) => {
            const price = Number(p.price || 0);
            const selling = Number(p.selling_price || 0);
            const tva = Number(p.tva || 0);
            return price > 0 && selling > 0 && (selling / (1 + tva / 100)) < price;
        });

        if (produitsEnPerte.length > 0) {
            const nomsPerte = produitsEnPerte.map((p) => {
                const nom = getProduitName(p.produit, p.produit_nom ?? '');
                const price = Math.round(Number(p.price || 0));
                const sellingHT = Math.round(Number(p.selling_price || 0) / (1 + Number(p.tva || 0) / 100));
                const productName = nom || t('orders:messages.product_reference', { id: String(p.id || t('common:unknown')) });
                return t('orders:messages.loss_product_line', { nom: productName, price, sellingHT });
            });
            warnings.push(`${t('orders:messages.section_selling_below_cost')}\n${nomsPerte.join('\n')}`);
        }

        const confirmed = await confirm(warnings.length > 0 ? {
            title: t('orders:messages.close_warnings_title'),
            message: [t('orders:messages.close_warnings_intro'), ...warnings, t('orders:messages.close_confirm')].join('\n\n'),
            confirmText: t('orders:details.close'),
            cancelText: t('orders:messages.missing_expiration_verify'),
            variant: 'warning'
        } : {
            title: t('orders:details.close'),
            message: t('orders:messages.close_confirm'),
            confirmText: t('common:confirm')
        });

        if (confirmed) {
            requireSudo(
                async (validatorId, password) => {
                    // En mode EDIT, sauvegarder les produits avant clôture pour ne pas perdre les dates de péremption
                    if (viewMode === 'EDIT' && commandeProduits.length > 0 && selectedCommande?.id) {
                        const cleanCommande: Partial<Commande> = {
                            fournisseur: newCommandeFournisseurId ? normalizeNumberInput(newCommandeFournisseurId) : undefined,
                            numero_facture: numeroFacture,
                            type: commandeType,
                            taux_change: commandeType === 'DIR' ? tauxChange : undefined,
                            frais_coefficient: commandeType === 'DIR' ? fraisCoefficient : undefined,
                        };
                        await handleSaveCommande(cleanCommande, commandeProduits, 'EDIT', selectedCommande, true);
                    }
                    await handleCloturerCommande(selectedCommande, {
                        validated_by_id: validatorId,
                        sudo_password: password
                    });
                    // Mettre à jour le state de navigation pour refléter la vue DETAILS
                    // et éviter qu'un re-render (via fetchCommandes) ne reset la vue
                    navigate(window.location.pathname, {
                        replace: true,
                        state: { viewState: { mode: 'DETAILS', commandeId: selectedCommande.id } }
                    });
                    queryClient.refetchQueries({ queryKey: ['products'], type: 'all' });
                },
                {
                    permission: 'can_close_commande',
                    title: t('orders:messages.confirm_sudo_title'),
                    message: t('orders:messages.confirm_sudo_message')
                }
            );
        }
    };

    const onDelete = async () => {
        if (!selectedCommande) return;

        const confirmed = await confirm({
            title: t('orders:details.delete'),
            message: t('orders:messages.delete_confirm', { id: selectedCommande.id }),
            confirmText: t('common:confirm'),
            cancelText: t('common:cancel')
        });

        if (!confirmed) return;

        requireSudo(
            (validatorId, password) => handleDeleteCommande(selectedCommande, {
                validated_by_id: validatorId,
                sudo_password: password
            }),
            {
                permission: 'can_delete_commande',
                title: t('orders:messages.confirm_sudo_title'),
                message: t('orders:messages.confirm_sudo_message')
            }
        );
    };

    const onMettreEnAttente = () => {
        if (selectedCommande) handleMettreEnAttente(selectedCommande);
    };

    // Annulation partielle : les index de `selectedRows` pointent sur
    // `selectedCommande.produits` (même convention que la création d'avoir).
    const selectedItemIds = (): number[] => {
        const produits = selectedCommande?.produits || [];
        return Array.from(selectedRows)
            .map(idx => produits[idx]?.id)
            .filter((id): id is number => typeof id === 'number');
    };

    const onAnnulerReception = async () => {
        if (!selectedCommande) return;

        const itemIds = selectedItemIds();
        const totalLines = selectedCommande.produits?.length || 0;
        const isPartial = itemIds.length > 0 && itemIds.length < totalLines;

        const confirmed = await confirm(isPartial ? {
            title: t('orders:messages.cancel_reception_confirm_title'),
            message: t('orders:messages.cancel_reception_partial_message', { count: itemIds.length }),
            confirmText: t('orders:messages.cancel_reception_confirm_button'),
            cancelText: t('common:cancel'),
            variant: 'danger'
        } : {
            title: t('orders:messages.cancel_reception_confirm_title'),
            message: t('orders:messages.cancel_reception_confirm_message'),
            confirmText: t('orders:messages.cancel_reception_confirm_button'),
            cancelText: t('common:cancel'),
            variant: 'danger'
        });
        if (!confirmed) return;

        requireSudo(
            (validatorId, password) => handleAnnulerReception(selectedCommande, {
                validated_by_id: validatorId,
                sudo_password: password,
                ...(isPartial ? { item_ids: itemIds } : {}),
            }),
            {
                permission: 'can_close_commande',
                title: t('orders:messages.confirm_sudo_title'),
                message: t('orders:messages.confirm_sudo_message')
            }
        );
    };

    const onUpdateReceptionQty = async (item: CommandeProduit, quantityReceived: number) => {
        if (!selectedCommande || !item.id) return;

        const confirmed = await confirm({
            title: t('orders:messages.update_received_qty_title'),
            message: t('orders:messages.update_received_qty_message', {
                name: item.produit_nom || '',
                quantity: quantityReceived,
            }),
            confirmText: t('common:confirm'),
            cancelText: t('common:cancel'),
            variant: 'warning'
        });
        if (!confirmed) return;

        requireSudo(
            (validatorId, password) => handleAnnulerReception(selectedCommande, {
                validated_by_id: validatorId,
                sudo_password: password,
                updates: [{ id: item.id as number, quantity_received: quantityReceived }],
            }),
            {
                permission: 'can_close_commande',
                title: t('orders:messages.confirm_sudo_title'),
                message: t('orders:messages.confirm_sudo_message')
            }
        );
    };

    const onDeleteReceptionLigne = async (item: CommandeProduit) => {
        if (!selectedCommande || !item.id) return;

        const confirmed = await confirm({
            title: t('orders:messages.delete_received_line_title'),
            message: t('orders:messages.delete_received_line_message', {
                name: item.produit_nom || '',
            }),
            confirmText: t('orders:messages.cancel_reception_confirm_button'),
            cancelText: t('common:cancel'),
            variant: 'danger'
        });
        if (!confirmed) return;

        requireSudo(
            (validatorId, password) => handleAnnulerReception(selectedCommande, {
                validated_by_id: validatorId,
                sudo_password: password,
                delete_item_ids: [item.id as number],
            }),
            {
                permission: 'can_close_commande',
                title: t('orders:messages.confirm_sudo_title'),
                message: t('orders:messages.confirm_sudo_message')
            }
        );
    };

    const onImprimer = (fournisseurName: string, groupBy?: ReceptionGroupBy) => {
        if (selectedCommande) handleImprimerReception(selectedCommande, fournisseurName, groupBy);
    };

    const onBulkDelete = () => {
        if (selectedOrderIds.size === 0) return;

        const selectedIds = Array.from(selectedOrderIds);
        // Filtrer les commandes qui ne sont pas clôturées
        const deletableIds = selectedIds.filter(id => {
            const cmd = commandes.find(c => c.id === id);
            return cmd && cmd.status !== 'CLOT';
        });

        if (deletableIds.length === 0) {
            gooeyToast.error(t('orders:messages.no_deletable_orders'));
            return;
        }

        if (deletableIds.length < selectedIds.length) {
            gooeyToast.error(t('orders:messages.some_orders_closed_warning'));
        }

        requireSudo(
            async (validatorId, password) => {
                await handleBulkDelete(deletableIds, {
                    validated_by_id: validatorId,
                    sudo_password: password
                });
                setSelectedOrderIds(new Set());
            },
            {
                permission: 'can_delete_commande',
                title: t('orders:messages.confirm_sudo_title'),
                message: t('orders:messages.confirm_sudo_message')
            }
        );
    };

    const handleCreateAvoirFromCommande = () => {
        if (!selectedCommande) return;

        const produitsSource = selectedCommande.produits || [];
        const produitsAvoir = (selectedRows.size > 0
            ? produitsSource.filter((_, idx) => selectedRows.has(idx))
            : produitsSource
        ).map(p => ({
            id: getProduitId(p.produit),
            name: p.produit_nom,
            cip: (getProduitObject(p.produit)?.cip1 ?? p.produit_cip) || '',
            purchase_price: p.price,
            quantity: 0,
            received_qty: p.quantity,
            lot: p.lot,
            expiration: p.date_expiration
        }));

        const avoirData = {
            fournisseur: selectedCommande.fournisseur,
            fournisseur_nom: selectedCommande.fournisseur_nom,
            source_commande: selectedCommande.id,
            produits: produitsAvoir
        };

        navigate('/app/avoirs', { state: { createFromCommande: avoirData } });
    };

    return {
        onCloture,
        onDelete,
        onMettreEnAttente,
        onAnnulerReception,
        onUpdateReceptionQty,
        onDeleteReceptionLigne,
        onImprimer,
        onBulkDelete,
        handleCreateAvoirFromCommande,
    };
}
