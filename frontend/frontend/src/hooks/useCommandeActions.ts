import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { getApiErrorDetail } from '../utils/errorHandling';
import type { Commande, CommandeProduit, User } from '../types';
import commandeService, { type SudoCredentials } from '../services/commandeService';
import { usePharmacySettings } from './usePharmacySettings';
import { formatDate as formatDateUtil, formatDateTime, getLocale } from '../utils/dateUtils';

interface UseCommandeActionsProps {
    fetchCommandes: () => Promise<void>;
    setSelectedCommande: (commande: Commande | null) => void;
    setViewMode: (mode: 'LIST' | 'CREATE' | 'DETAILS' | 'EDIT') => void;
    confirm: (options: { title?: string; message: string; variant?: 'success' | 'warning' | 'danger' | 'info'; confirmText?: string }) => Promise<boolean>;
    user: User | null;
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
            toast.error(getApiErrorDetail(err, "Erreur de sauvegarde"));
        } finally {
            if (!isAutoSave) setExecutingAction(false);
        }
    }

    const handleDeleteCommande = async (commande: Commande, sudoCredentials?: SudoCredentials) => {
        if (executingAction) return;
        setExecutingAction(true);
        try {
            await commandeService.delete(commande.id, sudoCredentials);
            toast.success(t('messages.delete_success'));
            fetchCommandes();
            setSelectedCommande(null);
            setViewMode('LIST');
        } catch (err) {
            toast.error(getApiErrorDetail(err, t('messages.delete_error')));
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
            toast.success(res.message || t('messages.close_success'));
            fetchCommandes();
            const updated = await commandeService.getById(commande.id);
            setSelectedCommande(updated);
        } catch (err) {
            toast.error(getApiErrorDetail(err, "Erreur de clôture"));
            throw err;
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
        } catch (err) {
            toast.error(getApiErrorDetail(err, "Erreur lors du changement de statut"));
        } finally {
            setExecutingAction(false);
        }
    };

    const handleAnnulerReception = async (commande: Commande, sudoCredentials?: SudoCredentials) => {
        if (executingAction) return;
        setExecutingAction(true);
        try {
            await commandeService.annulerReception(commande.id, sudoCredentials);
            toast.success(t('messages.cancel_reception_success'));
            fetchCommandes();
            const updated = await commandeService.getById(commande.id);
            setSelectedCommande(updated);
        } catch (err) {
            toast.error(getApiErrorDetail(err, "Erreur lors de l'annulation"));
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
                return (n || 0).toLocaleString(getLocale());
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
                const produitName = p.produit_nom || (typeof p.produit === 'object' ? (p.produit as any).name : `Produit #${p.produit}`);
                const lineTotal = parseFloat(p.price) * p.quantity;
                const cip = (p as any).produit_cip || (typeof p.produit === 'object' ? (p.produit as any).cip1 : '-');
                
                // Calcul de l'audit de stock
                const qtyTotal = (p.quantity || 0) + (p.unites_gratuites || 0);
                const currentStock = (p as any).produit_stock ?? 0;
                // Formule: stAnt + qtyTotal = currentStock
                const stAnt = currentStock - qtyTotal;

                const lotInfo = p.lot ? `<div style="font-size: 9px; color: #666; font-family: monospace;">LOT: ${p.lot} | EXP: ${formatDateUtil(p.date_expiration)}</div>` : ''
                const tvaLabel = p.tva ? `<span style="font-size: 8px; color: #64748b; margin-left: 4px;">(${p.tva}%)</span>` : '';
                
                return `
                    <tr style="border-bottom: 1px solid #eee; page-break-inside: avoid;">
                        <td style="padding: 6px 8px; text-align: left;">
                            <div style="font-weight: bold; text-transform: uppercase; font-size: 11px;">${produitName}</div>
                            ${lotInfo}
                        </td>
                        <td style="padding: 6px 8px; text-align: center; font-family: monospace; font-size: 10px;">${cip}</td>
                        <td style="padding: 6px 8px; text-align: center; font-weight: bold;">${stAnt}</td>
                        <td style="padding: 6px 8px; text-align: center; font-weight: bold;">${p.quantity}</td>
                        <td style="padding: 6px 8px; text-align: center; color: #64748b; font-weight: bold; background: #f8fafc;">${p.unites_gratuites || 0}</td>
                        <td style="padding: 6px 8px; text-align: center; font-weight: bold;">${currentStock}</td>
                        <td style="padding: 6px 8px; text-align: right;">${formatM(p.price)}${tvaLabel}</td>
                        <td style="padding: 6px 8px; text-align: right; font-weight: bold;">${formatM(lineTotal)}</td>
                    </tr>
                `;
            }).join('');

            const win = window.open('', '', 'height=800,width=1000');
            if (!win) return;

            win.document.write(`
<!DOCTYPE html>
<html>
<head>
    <title>Bon de Réception - ${commande.numero_facture || commande.id}</title>
    <style>
        @media print {
            @page { size: A4; margin: 15mm; }
            body { margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .no-print { display: none !important; }
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #1e293b;
            line-height: 1.5;
            padding: 20px;
            max-width: 210mm;
            margin: 0 auto;
            background: white;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 3px solid #0f172a;
            padding-bottom: 12px;
            margin-bottom: 15px;
        }
        .pharmacy-name {
            font-size: 24px;
            font-weight: 900;
            text-transform: uppercase;
            color: #0f172a;
            margin: 0;
        }
        .pharmacy-info {
            color: #64748b;
            font-size: 12px;
            margin-top: 5px;
        }
        .doc-title-box {
            border: 2px solid #0f172a;
            color: #0f172a;
            padding: 10px 20px;
            border-radius: 4px;
            font-size: 18px;
            font-weight: bold;
            text-align: right;
            text-transform: uppercase;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 15px;
        }
        .info-card {
            background: #fff;
            padding: 10px 12px;
            border-radius: 8px;
            border: 1px solid #cbd5e1;
        }
        .card-label {
            font-size: 9px;
            font-weight: 900;
            text-transform: uppercase;
            color: #64748b;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 3px;
            margin-bottom: 8px;
            letter-spacing: 0.1em;
        }
        .provider-name {
            font-size: 18px;
            font-weight: 900;
            color: #1e293b;
            text-transform: uppercase;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            margin-bottom: 4px;
        }
        .detail-value { font-weight: bold; }
        .operator-name { color: #000; text-decoration: underline; }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 11px;
        }
        thead {
            display: table-header-group;
        }
        tr {
            page-break-inside: avoid;
        }
        th {
            background: #f1f5f9;
            color: #0f172a;
            border-bottom: 2px solid #0f172a;
            text-transform: uppercase;
            font-size: 9px;
            padding: 8px 6px;
            text-align: left;
        }
        .footer-grid {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            border-top: 2px solid #0f172a;
            padding-top: 15px;
            page-break-inside: avoid;
        }
        .totals-card {
            background: #fff;
            color: #0f172a;
            padding: 12px 15px;
            border-radius: 8px;
            border: 2px solid #0f172a;
            width: 240px;
        }
        .signature-box {
            width: 200px;
            height: 80px;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            margin-top: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #94a3b8;
            font-size: 10px;
            text-transform: uppercase;
        }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1 class="pharmacy-name">${pharmacySettings.pharmacy_name || 'PHARMACIE'}</h1>
            <div class="pharmacy-info">
                ${pharmacySettings.address || ''}<br>
                Tél: ${pharmacySettings.phone || ''} | ${pharmacySettings.email || ''}<br>
                <span style="font-weight: bold; opacity: 0.7;">NIU: ${pharmacySettings.niu || ''} | RC: ${pharmacySettings.registre_commerce || ''}</span>
            </div>
        </div>
        <div>
            <div class="doc-title-box">${t('orders.tabs.delivery', { defaultValue: 'BON DE RÉCEPTION' })}</div>
            <div style="text-align: right; font-size: 10px; font-weight: bold; color: #64748b; margin-top: 5px; text-transform: uppercase;">
                RÉF: ${commande.numero_facture || '#' + commande.id}
            </div>
        </div>
    </div>

    <div class="info-grid">
        <div class="info-card">
            <div class="card-label">${t('orders.form.provider_label', { defaultValue: 'Fournisseur' })}</div>
            <div class="provider-name">${fournisseurName}</div>
        </div>
        <div class="info-card">
            <div class="card-label">${t('orders.product_table.info_row.indicators', { defaultValue: 'Détails de Réception' })}</div>
            <div class="detail-row">
                <span>${t('orders.details.date', { defaultValue: 'Date Commande' })}:</span>
                <span class="detail-value">${formatDate(commande.date)}</span>
            </div>
            <div class="detail-row">
                <span>${t('common:print_date', { defaultValue: 'Imprimé le' })}:</span>
                <span class="detail-value">${now}</span>
            </div>
            <div class="detail-row" style="border-top: 1px solid #e2e8f0; margin-top: 5px; padding-top: 5px;">
                <span>${t('orders.details.created_by', { defaultValue: 'Saisie par' })}:</span>
                <span class="detail-value">${(commande as any).created_by_name || 'N/A'}</span>
            </div>
            <div class="detail-row">
                <span>${t('orders.details.closed_by', { defaultValue: 'Clôturée par' })}:</span>
                <span class="detail-value operator-name">${commande.closed_by_name || 'N/A'}</span>
            </div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th style="border-top-left-radius: 4px;">${t('orders.product_table.headers.product', { defaultValue: 'Désignation' })}</th>
                <th style="text-align: center;">${t('orders.product_table.headers.cip', { defaultValue: 'CIP' })}</th>
                <th style="text-align: center;">${t('orders.product_table.headers.stAnt', { defaultValue: 'stAnt' })}</th>
                <th style="text-align: center;">${t('orders.product_table.headers.qty', { defaultValue: 'Qté' })}</th>
                <th style="text-align: center; background: #f8fafc;">${t('orders.product_table.headers.ug', { defaultValue: 'UG' })}</th>
                <th style="text-align: center;">${t('orders.product_table.headers.stock', { defaultValue: 'Stock' })}</th>
                <th style="text-align: right;">${t('orders.product_table.headers.buy_price_ht', { defaultValue: 'P.U HT' })}</th>
                <th style="text-align: right; border-top-right-radius: 4px;">${t('orders.product_table.headers.total_ht', { defaultValue: 'Total HT' })}</th>
            </tr>
        </thead>
        <tbody>
            ${productsHtml}
        </tbody>
    </table>

    <div class="footer-grid">
        <div style="flex: 1;">
            <div class="info-card" style="margin-bottom: 10px;">
                <div class="card-label">Récapitulatif Articles</div>
                <div style="display: flex; gap: 20px; font-size: 10px; font-weight: bold;">
                    <div>Lignes: ${produits.length}</div>
                    <div>Unités: ${totalQty}</div>
                    <div style="color: #64748b;">Gratuites: ${totalUG}</div>
                </div>
            </div>
            <div style="font-size: 8px; color: #94a3b8; font-style: italic; line-height: 1.2;">
                Ce document certifie la réception physique des articles mentionnés dans les stocks de l'établissement.
            </div>
        </div>
        <div>
            <div class="totals-card">
                <div class="detail-row" style="font-size: 9px; color: #64748b; margin-bottom: 2px;">
                    <span>TOTAL HT:</span>
                    <span style="font-weight: bold;">${formatM(totalHT)} F</span>
                </div>
                <div class="detail-row" style="font-size: 9px; color: #64748b; border-bottom: 1px solid #f1f5f9; padding-bottom: 3px; margin-bottom: 6px;">
                    <span>TOTAL TVA:</span>
                    <span style="font-weight: bold;">${formatM(totalTVA)} F</span>
                </div>
                <div style="font-size: 9px; font-weight: 900; text-transform: uppercase; color: #94a3b8; margin-bottom: 2px; letter-spacing: 0.1em;">Total TTC Réception</div>
                <div style="font-size: 22px; font-weight: 900; font-family: monospace; display: flex; justify-content: space-between; align-items: baseline; letter-spacing: -1px;">
                    ${formatM(totalTTC)}
                    <span style="font-size: 10px; font-weight: normal; opacity: 0.6; margin-left: 5px;">FCFA</span>
                </div>
            </div>
            <div style="text-align: center; margin-top: 20px;">
                <div style="font-size: 9px; font-weight: bold; text-transform: uppercase; color: #94a3b8;">Cachet & Signature</div>
                <div class="signature-box">Responsable Stocks</div>
            </div>
        </div>
    </div>

    <div style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 9px; font-weight: bold; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.3em;">
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
            win.document.close();

        } catch (err) {
            toast.error(t('messages.print_error'));
        } finally {
            setExecutingAction(false);
        }
    };

    const handleBulkDelete = async (ids: number[], sudoCredentials?: SudoCredentials) => {
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
        executingAction
    };
}


