
import { useState } from 'react';
import { gooeyToast } from 'goey-toast';
import { useTranslation } from 'react-i18next';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { getApiErrorDetail } from '../utils/errorHandling';
import type { Commande, CommandeProduit, User, PaginatedResponse } from '../types';
import commandeService, { type SudoCredentials, type TransformationDisponible } from '../services/commandeService';
import { usePharmacySettings } from './usePharmacySettings';
import { formatDate as formatDateUtil, formatDateTime, getLocale } from '../utils/dateUtils';
import { escHtml, writePrintDocument } from '../utils/print/printHelpers';

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

    const { settings: pharmacySettings } = usePharmacySettings();

    const handleImprimerReception = async (commande: Commande, fournisseurName: string) => {
        if (executingAction) return;
        
        try {
            // Get the template component
            // We'll use a dynamic import or just import it at the top
            // To avoid circular or heavy imports, let's just build the HTML here 
            // OR better: use a hidden div in the component.
            // But since I already created the template, I'll use a trick: 
            // I'll define the HTML structure matching the template here for the print window.
            
            const now = formatDateTime(new Date().toISOString());

            const formatDate = (dateStr: string) => {
                try { return formatDateUtil(dateStr); } catch { return dateStr; }
            };

            const formatM = (val: number | string) => {
                const n = typeof val === 'string' ? parseFloat(val) : val;
                return (Math.round(n) || 0).toLocaleString(getLocale());
            };

            const produits = commande.produits || [];
            const totalHT = produits.reduce((sum, p) => sum + (parseFloat(p.price) * p.quantity), 0);
            const totalTVA = produits.reduce((sum, p) => {
                const price = parseFloat(p.price);
                const qty = p.quantity;
                const tvaPercent = parseFloat(String(p.tva || 0));
                return sum + (price * qty * tvaPercent / (100 + (commande.type === 'DIR' ? 0 : 0))); // Simple calculation for now
            }, 0);
            const totalTTC = totalHT + totalTVA;
            const totalUG = produits.reduce((sum, p) => sum + (p.unites_gratuites || 0), 0);
            const totalQty = produits.reduce((sum, p) => sum + p.quantity, 0);

            const productsHtml = produits.map(p => {
                const produitName = p.produit_nom || (typeof p.produit === 'object' ? p.produit.name : `Produit #${p.produit}`);
                const lineTotal = parseFloat(p.price) * p.quantity;
                const cip = p.produit_cip || (typeof p.produit === 'object' ? (p.produit.cip1 || '-') : '-');
                
                // Calcul de l'audit de stock
                const qtyTotal = (p.quantity || 0) + (p.unites_gratuites || 0);
                const currentStock = p.produit_stock ?? 0;
                // Formule: stAnt + qtyTotal = currentStock
                const stAnt = currentStock - qtyTotal;

                const lotInfo = p.lot ? `<div style="font-size: 8px; color: #555; font-family: monospace;">LOT: ${escHtml(p.lot)} | EXP: ${escHtml(formatDateUtil(p.date_expiration))}</div>` : ''
                const tvaLabel = p.tva ? `<span style="font-size: 8px; color: #555; margin-left: 4px;">(${p.tva}%)</span>` : '';

                return `
                    <tr style="border-bottom: 0.5px dotted #ccc; page-break-inside: avoid;">
                        <td style="padding: 4px; text-align: left;">
                            <div style="font-weight: 500; font-size: 10px;">${escHtml(produitName)}</div>
                            ${lotInfo}
                        </td>
                        <td style="padding: 4px; text-align: center; font-family: monospace; font-size: 9px;">${escHtml(cip)}</td>
                        <td style="padding: 4px; text-align: center;">${stAnt}</td>
                        <td style="padding: 4px; text-align: center;">${p.quantity}</td>
                        <td style="padding: 4px; text-align: center;">${p.unites_gratuites || 0}</td>
                        <td style="padding: 4px; text-align: center;">${currentStock}</td>
                        <td style="padding: 4px; text-align: right;">${formatM(p.price)}${tvaLabel}</td>
                        <td style="padding: 4px; text-align: right; font-weight: 500;">${formatM(lineTotal)}</td>
                    </tr>
                `;
            }).join('');

            const win = window.open('about:blank', '', 'height=800,width=1000');
            if (!win) {
                gooeyToast.error(t('orders:messages.popup_blocked'));
                return;
            }

            writePrintDocument(win, `
<!DOCTYPE html>
<html>
<head>
    <title>Bon de Réception - ${escHtml(commande.numero_facture || String(commande.id))}</title>
    <style>
        @media print {
            @page { size: A4; margin: 12mm; }
            body { margin: 0; padding: 0; }
            .no-print { display: none !important; }
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #000;
            line-height: 1.4;
            padding: 10px;
            max-width: 210mm;
            margin: 0 auto;
            background: white;
            font-size: 10px;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 0.5px solid #999;
            padding-bottom: 8px;
            margin-bottom: 10px;
        }
        .pharmacy-name {
            font-size: 16px;
            font-weight: 600;
            color: #000;
            margin: 0;
        }
        .pharmacy-info {
            color: #555;
            font-size: 10px;
            margin-top: 3px;
        }
        .doc-title-box {
            border: 0.5px solid #999;
            color: #000;
            padding: 6px 12px;
            border-radius: 2px;
            font-size: 13px;
            font-weight: 600;
            text-align: right;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 10px;
        }
        .info-card {
            padding: 6px 0;
            border-bottom: 0.5px solid #ccc;
        }
        .card-label {
            font-size: 9px;
            color: #555;
            padding-bottom: 2px;
            margin-bottom: 4px;
        }
        .provider-name {
            font-size: 14px;
            font-weight: 600;
            color: #000;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            margin-bottom: 2px;
        }
        .detail-value { font-weight: 500; }
        .operator-name { color: #000; text-decoration: underline; }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 8px;
            font-size: 9px;
        }
        thead {
            display: table-header-group;
        }
        tr {
            page-break-inside: avoid;
        }
        th {
            color: #000;
            border-bottom: 0.5px solid #999;
            font-size: 9px;
            padding: 4px;
            text-align: left;
            font-weight: 600;
        }
        td {
            padding: 4px;
            border-bottom: 0.5px dotted #ccc;
        }
        .footer-grid {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 15px;
            border-top: 0.5px solid #999;
            padding-top: 6px;
            page-break-inside: avoid;
        }
        .totals-card {
            color: #000;
            padding: 5px 8px;
            border-radius: 2px;
            border: 0.5px solid #999;
            width: 240px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1 class="pharmacy-name">${escHtml(pharmacySettings.pharmacy_name || 'PHARMACIE')}</h1>
            <div class="pharmacy-info">
                ${escHtml(pharmacySettings.address || '')}<br>
                ${t('orders:print.tel')}: ${escHtml(pharmacySettings.phone || '')} | ${escHtml(pharmacySettings.email || '')}<br>
                <span>NIU: ${escHtml(pharmacySettings.niu || '')} | RC: ${escHtml(pharmacySettings.registre_commerce || '')}</span>
            </div>
        </div>
        <div>
            <div class="doc-title-box">${t('orders:print.title')}</div>
            <div style="text-align: right; font-size: 9px; color: #555; margin-top: 4px;">
                ${t('orders:print.ref')}: ${escHtml(commande.numero_facture || '#' + commande.id)}
            </div>
        </div>
    </div>

    <div class="info-grid">
        <div class="info-card">
            <div class="card-label">${t('orders:form.provider_label')}</div>
            <div class="provider-name">${escHtml(fournisseurName)}</div>
        </div>
        <div class="info-card">
            <div class="card-label">${t('orders:print.reception_details')}</div>
            <div class="detail-row">
                <span>${t('orders:details.date')}:</span>
                <span class="detail-value">${formatDate(commande.date)}</span>
            </div>
            <div class="detail-row">
                <span>${t('orders:print.print_date')}:</span>
                <span class="detail-value">${now}</span>
            </div>
            <div class="detail-row" style="border-top: 1px solid #e2e8f0; margin-top: 5px; padding-top: 5px;">
                <span>${t('orders:details.created_by')}:</span>
                <span class="detail-value">${escHtml(commande.created_by_name || t('common:not_available'))}</span>
            </div>
            <div class="detail-row">
                <span>${t('orders:details.closed_by')}:</span>
                <span class="detail-value operator-name">${escHtml(commande.closed_by_name || t('common:not_available'))}</span>
            </div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>${t('orders:product_table.headers.product')}</th>
                <th style="text-align: center;">${t('orders:product_table.headers.cip')}</th>
                <th style="text-align: center;">${t('orders:product_table.headers.stAnt')}</th>
                <th style="text-align: center;">${t('orders:product_table.headers.qty')}</th>
                <th style="text-align: center;">${t('orders:product_table.headers.ug')}</th>
                <th style="text-align: center;">${t('orders:product_table.headers.stock')}</th>
                <th style="text-align: right;">${t('orders:product_table.headers.buy_price_ht')}</th>
                <th style="text-align: right;">${t('orders:product_table.headers.total_ht')}</th>
            </tr>
        </thead>
        <tbody>
            ${productsHtml}
        </tbody>
    </table>

    <div class="footer-grid">
        <div style="flex: 1;">
            <div class="info-card" style="margin-bottom: 4px;">
                <div class="card-label">${t('orders:print.recap_title')}</div>
                <div style="display: flex; gap: 20px; font-size: 9px;">
                    <div>${t('orders:print.lines')}: ${produits.length}</div>
                    <div>${t('orders:print.units')}: ${totalQty}</div>
                    <div>${t('orders:print.free_units')}: ${totalUG}</div>
                </div>
            </div>
            <div style="font-size: 8px; color: #777; font-style: italic; line-height: 1.2;">
                ${t('orders:print.cert_text')}
            </div>
        </div>
        <div>
            <div class="totals-card">
                <div class="detail-row" style="font-size: 9px; margin-bottom: 2px;">
                    <span>${t('orders:print.total_ht')}:</span>
                    <span>${formatM(totalHT)} F</span>
                </div>
                <div class="detail-row" style="font-size: 9px; border-bottom: 0.5px solid #eee; padding-bottom: 3px; margin-bottom: 6px;">
                    <span>${t('orders:print.total_tva')}:</span>
                    <span>${formatM(totalTVA)} F</span>
                </div>
                <div style="font-size: 9px; margin-bottom: 2px;">${t('orders:print.total_ttc_reception')}</div>
                <div style="font-size: 16px; font-weight: 600; font-family: monospace; display: flex; justify-content: space-between; align-items: baseline;">
                    ${formatM(totalTTC)}
                    <span style="font-size: 9px; margin-left: 5px;">FCFA</span>
                </div>
            </div>
        </div>
    </div>

    <div style="margin-top: 8px; padding-top: 4px; border-top: 0.5px solid #ccc; text-align: center; font-size: 7px; color: #999;">
        Logiciel de Gestion Antigravity POS - Document Interne
    </div>

    <script>
        window.onload = function() {
            setTimeout(function() {
                window.print();
                // window.close(); // Optional: close after print
            }, 300);
        };
    </script>
</body>
</html>
            `);

        } catch {
            gooeyToast.error(t('orders:messages.print_error'));
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


