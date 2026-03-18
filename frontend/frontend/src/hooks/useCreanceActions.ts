import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import type { Creance } from '../types';
import { useSudo } from './useSudo';
import { usePharmacySettings } from './usePharmacySettings';
import { formatCurrency } from '../utils/formatters';
import creanceService from '../services/creanceService';

interface UseCreanceActionsProps {
    refresh: () => void;
    selectedIds: number[];
    setSelectedIds: (ids: number[]) => void;
    filteredCreances: Creance[];
    creancesEndpoint?: string;
}

export const useCreanceActions = ({
    refresh,
    selectedIds,
    setSelectedIds
}: UseCreanceActionsProps) => {
    const { t } = useTranslation(['creances', 'common']);
    const { settings: pharmacySettings } = usePharmacySettings();
    const { sudoState, requireSudo, closeSudo } = useSudo();

    // Modal states
    const [selectedCreance, setSelectedCreance] = useState<Creance | null>(null);
    const [isPaiementModalOpen, setIsPaiementModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

    // Form states
    const [modePaiement, setModePaiement] = useState('especes');
    const [montantPaiement, setMontantPaiement] = useState('');
    const [referencePaiement, setReferencePaiement] = useState('');

    const handleOpenPaiementModal = useCallback((creance: Creance) => {
        setSelectedCreance(creance);
        setModePaiement('especes');
        setMontantPaiement(creance.reste_a_payer);
        setReferencePaiement('');
        setIsPaiementModalOpen(true);
    }, []);

    const handleOpenDetailsModal = useCallback((creance: Creance) => {
        setSelectedCreance(creance);
        setIsDetailsModalOpen(true);
    }, []);

    const handleBulkPayment = useCallback(() => {
        if (selectedIds.length === 0) return;
        setIsBulkModalOpen(true);
        setModePaiement('especes');
        setReferencePaiement('');
        setMontantPaiement('');
    }, [selectedIds.length]);

    const handlePrintDirectReceipt = useCallback(async (creanceId: number, paiementId?: number) => {
        try {
            const blob = await creanceService.imprimerRecu(creanceId, paiementId);
            const blobUrl = window.URL.createObjectURL(blob);
            const printWindow = window.open(blobUrl, '_blank');

            if (!printWindow) {
                const link = document.createElement('a');
                link.href = blobUrl;
                link.setAttribute('download', `recu_paiement_${creanceId}_${paiementId || 'all'}.pdf`);
                document.body.appendChild(link);
                link.click();
                link.parentNode?.removeChild(link);
            }

            setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);
        } catch (err: unknown) {
            console.error('Erreur lors de l\'impression du reçu:', err);
            const error = err as { response?: { data?: { detail?: string } } };
            toast.error(error.response?.data?.detail || t('creances:toasts.error_print_receipt'));
        }
    }, []);

    const handlePrintBulkReceipt = useCallback(async (releveId: number) => {
        if (!releveId) return;

        try {
            const blob = await creanceService.imprimerRelevePaiement(releveId);
            const url = window.URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');

            if (!printWindow) {
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `recapitulatif_reglement_${releveId}.pdf`);
                document.body.appendChild(link);
                link.click();
                link.parentNode?.removeChild(link);
            }

            setTimeout(() => window.URL.revokeObjectURL(url), 100);
        } catch (err: unknown) {
            console.error('Erreur lors de l\'impression du relevé:', err);
            const error = err as { response?: { data?: { detail?: string } } };
            toast.error(error.response?.data?.detail || t('creances:toasts.error_print_statement'));
        }
    }, []);

    const performAjouterPaiement = useCallback(async (validatorId: number, password: string) => {
        if (!selectedCreance || !montantPaiement) return;

        try {
            const data = await creanceService.ajouterPaiement(selectedCreance.id, {
                mode_paiement: modePaiement,
                montant: parseFloat(montantPaiement),
                reference: referencePaiement || undefined,
                validated_by_id: validatorId,
                sudo_password: password
            });

            const paiementId = data.paiement_id;

            setIsPaiementModalOpen(false);
            refresh();
            toast.success(t('creances:toasts.payment_success'));

            if (window.confirm(t('creances:toasts.confirm_print_receipt'))) {
                await handlePrintDirectReceipt(selectedCreance.id, paiementId);
            }
        } catch (err: unknown) {
            const error = err as { response?: { data?: { detail?: string } } };
            toast.error(error.response?.data?.detail || t('common:messages.error_saving'));
            console.error('Erreur:', err);
        }
    }, [selectedCreance, montantPaiement, modePaiement, referencePaiement, refresh, handlePrintDirectReceipt]);

    const handleAjouterPaiement = () => {
        requireSudo(performAjouterPaiement);
    };

    const performBulkPayment = useCallback(async (validatorId: number, password: string) => {
        try {
            const data = await creanceService.bulkPaiement({
                facture_ids: selectedIds,
                mode_paiement: modePaiement,
                reference: referencePaiement,
                validated_by_id: validatorId,
                sudo_password: password
            });

            const releveId = data.releve_id;

            setIsBulkModalOpen(false);
            setSelectedIds([]);
            refresh();
            toast.success(t('creances:toasts.bulk_success'));

            if (releveId && window.confirm(t('creances:toasts.confirm_print_bulk_receipt'))) {
                await handlePrintBulkReceipt(releveId);
            }
        } catch (err: unknown) {
            const error = err as { response?: { data?: { detail?: string } } };
            toast.error(error.response?.data?.detail || t('common:messages.error_saving'));
            console.error('Erreur:', err);
        }
    }, [selectedIds, modePaiement, referencePaiement, setSelectedIds, refresh, handlePrintBulkReceipt]);

    const confirmBulkPayment = () => {
        requireSudo(performBulkPayment);
    };

    const handleImprimerReleve = useCallback(async (selectedClient: string, dateDebut: string, dateFin: string) => {
        if (!selectedClient) {
            toast.error(t('creances:toasts.select_client_error'));
            return;
        }

        try {
            const data = await creanceService.getReleve({
                client_id: selectedClient,
                date_debut: dateDebut || undefined,
                date_fin: dateFin || undefined
            });

            // Simple HTML printing fallback as used in original code
            const win = window.open('', '', 'height=800,width=600');
            if (win) {
                const content = `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px;">
              <h1 style="margin: 0; font-size: 24px;">${t('creances:print_view.title')}</h1>
              <p style="margin: 5px 0;">${pharmacySettings.pharmacy_name}</p>
              <p style="margin: 5px 0; font-size: 12px;">${pharmacySettings.city || ''}, ${pharmacySettings.country || ''}</p>
              ${pharmacySettings.niu ? `<p style="margin: 5px 0; font-size: 12px;">NIU: ${pharmacySettings.niu}</p>` : ''}
              ${pharmacySettings.registre_commerce ? `<p style="margin: 5px 0; font-size: 12px;">RC: ${pharmacySettings.registre_commerce}</p>` : ''}
            </div>

            <div style="margin-bottom: 20px;">
              <h3 style="margin: 10px 0;">${t('creances:print_view.client')}</h3>
              <p style="margin: 5px 0;"><strong>${t('creances:print_view.name')}</strong> ${data.client.name}</p>
              <p style="margin: 5px 0;"><strong>${t('creances:print_view.address')}</strong> ${data.client.address || ''}</p>
              <p style="margin: 5px 0;"><strong>${t('creances:print_view.phone')}</strong> ${data.client.phone || ''}</p>
              <p style="margin: 5px 0;"><strong>${t('creances:print_view.email')}</strong> ${data.client.email || ''}</p>
            </div>

            ${data.periode.date_debut || data.periode.date_fin ? `
              <div style="margin-bottom: 20px;">
                <h3 style="margin: 10px 0;">${t('creances:print_view.period')}</h3>
                ${data.periode.date_debut ? `<p style="margin: 5px 0;"><strong>${t('creances:print_view.from')}</strong> ${new Date(data.periode.date_debut).toLocaleDateString(t('common:locale'))}</p>` : ''}
                ${data.periode.date_fin ? `<p style="margin: 5px 0;"><strong>${t('creances:print_view.to')}</strong> ${new Date(data.periode.date_fin).toLocaleDateString(t('common:locale'))}</p>` : ''}
              </div>
            ` : ''}

            <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 10px;">
              <thead>
                <tr style="background-color: #f0f0f0;">
                  <th style="border: 1px solid #ddd; padding: 4px; text-align: left;">${t('creances:print_view.date_header')}</th>
                  <th style="border: 1px solid #ddd; padding: 4px; text-align: left;">${t('creances:print_view.invoice_header')}</th>
                  <th style="border: 1px solid #ddd; padding: 4px; text-align: left;">${t('creances:print_view.beneficiary_header')}</th>
                  <th style="border: 1px solid #ddd; padding: 4px; text-align: right;">${t('creances:print_view.total_header')}</th>
                  <th style="border: 1px solid #ddd; padding: 4px; text-align: right;">${t('creances:print_view.paid_header')}</th>
                  <th style="border: 1px solid #ddd; padding: 4px; text-align: right;">${t('creances:print_view.remaining_header')}</th>
                </tr>
              </thead>
              <tbody>
                ${data.creances.map((c: Creance) => `
                  <tr>
                    <td style="border: 1px solid #ddd; padding: 4px;">${new Date(c.date).toLocaleDateString(t('common:locale'))}</td>
                    <td style="border: 1px solid #ddd; padding: 4px;">${c.numero_facture || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 4px;">${c.ayant_droit || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 4px; text-align: right;">${formatCurrency(parseFloat(c.total_ttc))} ${t('common:currency')}</td>
                    <td style="border: 1px solid #ddd; padding: 4px; text-align: right;">${formatCurrency(parseFloat(c.montant_paye))} ${t('common:currency')}</td>
                    <td style="border: 1px solid #ddd; padding: 4px; text-align: right;">${formatCurrency(parseFloat(c.reste_a_payer))} ${t('common:currency')}</td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr style="background-color: #f0f0f0; font-weight: bold;">
                  <td colspan="3" style="border: 1px solid #ddd; padding: 4px; text-align: right;">${t('creances:print_view.totals_label')}</td>
                  <td style="border: 1px solid #ddd; padding: 4px; text-align: right;">${formatCurrency(parseFloat(data.totaux.total_factures))} ${t('common:currency')}</td>
                  <td style="border: 1px solid #ddd; padding: 4px; text-align: right;">${formatCurrency(parseFloat(data.totaux.total_paye))} ${t('common:currency')}</td>
                  <td style="border: 1px solid #ddd; padding: 4px; text-align: right;">${formatCurrency(parseFloat(data.totaux.total_reste))} ${t('common:currency')}</td>
                </tr>
              </tfoot>
            </table>

            <div style="margin-top: 40px; display: flex; justify-content: space-between;">
              <div style="text-align: center;">
                <p style="margin-bottom: 60px;">${t('creances:print_view.client_signature')}</p>
                <p>_____________________</p>
              </div>
              <div style="text-align: center;">
                <p style="margin-bottom: 60px;">${t('creances:print_view.pharmacy_signature')}</p>
                <p>_____________________</p>
              </div>
            </div>

            <div style="text-align: center; margin-top: 30px; font-size: 12px; color: #666;">
              <p>${t('creances:print_view.generated_on')} ${new Date().toLocaleString(t('common:locale'))}</p>
            </div>
          </div>
        `;

                win.document.write('<html><head><title>Relevé de Créances</title>');
                win.document.write('<style>@media print { body { margin: 0; } }</style>');
                win.document.write('</head><body>');
                win.document.write(content);
                win.document.write('</body></html>');
                win.document.close();
                win.print();
            }
        } catch (err) {
            console.error('Erreur impression relevé:', err);
            toast.error(t('creances:toasts.error_print_statement'));
        }
    }, [pharmacySettings]);

    return {
        selectedCreance,
        modals: {
            isPaiementModalOpen,
            setIsPaiementModalOpen,
            isDetailsModalOpen,
            setIsDetailsModalOpen,
            isBulkModalOpen,
            setIsBulkModalOpen,
            sudoState,
            closeSudo
        },
        form: {
            modePaiement,
            setModePaiement,
            montantPaiement,
            setMontantPaiement,
            referencePaiement,
            setReferencePaiement
        },
        actions: {
            handleOpenPaiementModal,
            handleOpenDetailsModal,
            handleBulkPayment,
            confirmBulkPayment,
            handleAjouterPaiement,
            handlePrintDirectReceipt,
            handlePrintBulkReceipt,
            handleImprimerReleve
        }
    };
};
