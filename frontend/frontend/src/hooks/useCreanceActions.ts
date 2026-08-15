import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import type { Creance } from '../types';
import { useSudo } from './useSudo';
import creanceService, { type BulkPaiementPayload } from '../services/creanceService';
import { usePharmacySettings } from './usePharmacySettings';
import { generateRelevePdfDraft } from '../utils/print/relevePdfDraft';
import { generateTicketReglementPdfDraft } from '../utils/print/ticketReglementPdfDraft';
import { logger } from '../utils/logger'

interface ReleveData {
    client: { id?: number; name: string };
    creances: Array<{
        numero_facture: string;
        date: string;
        ayant_droit?: string | null;
        montant_total: number | string;
        montant_paye: number | string;
        reste_a_payer: number | string;
    }>;
    totaux: { total_factures: number | string; total_paye: number | string; total_reste: number | string };
    periode: { date_debut?: string | null; date_fin?: string | null };
}

interface UseCreanceActionsProps {
    refresh: () => void;
    selectedIds: number[];
    setSelectedIds: (ids: number[]) => void;
    filteredCreances: Creance[];
    creancesEndpoint?: string;
    updateLocalCreance?: (id: number, data: unknown) => void;
    updateLocalSynthese?: (clientId: number, data: unknown) => void;
}

export const useCreanceActions = ({
    refresh,
    selectedIds,
    setSelectedIds,
    filteredCreances,
    creancesEndpoint: _creancesEndpoint,
    updateLocalCreance,
    updateLocalSynthese: _updateLocalSynthese
}: UseCreanceActionsProps) => {
    const { t } = useTranslation(['creances', 'common']);
    const { sudoState, requireSudo, closeSudo } = useSudo();
    const { settings: pharmacySettings } = usePharmacySettings();

    // Modal states
    const [selectedCreance, setSelectedCreance] = useState<Creance | null>(null);
    const [isPaiementModalOpen, setIsPaiementModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

    // Form states
    const [modePaiement, setModePaiement] = useState('especes');
    const [montantPaiement, setMontantPaiement] = useState('');
    const [referencePaiement, setReferencePaiement] = useState('');
    const [montantTotalBulk, setMontantTotalBulk] = useState<string>(''); // Pour paiement partiel sur plusieurs factures

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
        setMontantTotalBulk(''); // Reset du montant bulk
    }, [selectedIds.length]);

    const handlePrintDirectReceipt = useCallback(async (creanceId: number, paiementId?: number) => {
        let blobUrl: string | undefined;
        try {
            const blob = await creanceService.imprimerRecu(creanceId, paiementId);
            blobUrl = window.URL.createObjectURL(blob);
            const printWindow = window.open(blobUrl, '_blank');

            if (!printWindow) {
                const link = document.createElement('a');
                link.href = blobUrl;
                link.setAttribute('download', `recu_paiement_${creanceId}_${paiementId || 'all'}.pdf`);
                document.body.appendChild(link);
                link.click();
                link.parentNode?.removeChild(link);
            }

            await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (err: unknown) {
            logger.error('Erreur lors de l\'impression du reçu:', err);
            const error = err as { response?: { data?: { detail?: string } } };
            toast.error(error.response?.data?.detail || t('creances:toasts.error_print_receipt'));
        } finally {
            if (blobUrl) window.URL.revokeObjectURL(blobUrl);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handlePrintBulkReceipt = useCallback(async (releveId: number) => {
        if (!releveId) return;

        let url: string | undefined;
        try {
            const blob = await creanceService.imprimerRelevePaiement(releveId);
            url = window.URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');

            if (!printWindow) {
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `recapitulatif_reglement_${releveId}.pdf`);
                document.body.appendChild(link);
                link.click();
                link.parentNode?.removeChild(link);
            }

            await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (err: unknown) {
            logger.error('Erreur lors de l\'impression du relevé:', err);
            const error = err as { response?: { data?: { detail?: string } } };
            toast.error(error.response?.data?.detail || t('creances:toasts.error_print_statement'));
        } finally {
            if (url) window.URL.revokeObjectURL(url);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            
            // Instant update if possible
            if (updateLocalCreance && data.creance) {
                updateLocalCreance(selectedCreance.id, data.creance);
            } else {
                refresh();
            }

            toast.success(t('creances:toasts.payment_success'));

            if (window.confirm(t('creances:toasts.confirm_print_receipt'))) {
                await handlePrintDirectReceipt(selectedCreance.id, paiementId);
            }
        } catch (err: unknown) {
            const error = err as { response?: { data?: { detail?: string } } };
            toast.error(error.response?.data?.detail || t('common:messages.error_saving'));
            logger.error('Erreur:', err);
            throw err;
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCreance, montantPaiement, modePaiement, referencePaiement, refresh, handlePrintDirectReceipt, updateLocalCreance]);

    const handleAjouterPaiement = () => {
        requireSudo(performAjouterPaiement, { permission: 'can_cash_out' });
    };

    const performBulkPayment = useCallback(async (validatorId: number, password: string) => {
        try {
            const payload: BulkPaiementPayload = {
                facture_ids: selectedIds,
                mode_paiement: modePaiement,
                reference: referencePaiement,
                validated_by_id: validatorId,
                sudo_password: password
            };
            // Si un montant bulk personnalisé est saisi, l'ajouter
            if (montantTotalBulk && parseFloat(montantTotalBulk) > 0) {
                payload.montant_total = parseFloat(montantTotalBulk);
            }
            
            const data = await creanceService.bulkPaiement(payload);

            const releveId = data.releve_id;

            setIsBulkModalOpen(false);
            setSelectedIds([]);
            setMontantTotalBulk(''); // Reset après paiement
            refresh();
            toast.success(t('creances:toasts.bulk_success'));

            // Générer le ticket de confirmation avec les détails
            if (data.paiements && data.paiements.length > 0) {
                try {
                    // Récupérer le nom du client depuis les créances
                    const firstCreance = filteredCreances.find(c => c.id === selectedIds[0]);
                    const clientName = firstCreance?.client_name || 'Client';
                    
                    console.log('=== BULK PAYMENT RESPONSE ===');
                    console.log('Total dettes:', data.total_dettes);
                    console.log('Montant réglé:', data.total_amount);
                    console.log('Reste à payer global:', data.reste_a_payer);
                    console.log('=== PAIEMENTS DÉTAIL ===');
                    data.paiements?.forEach((p, i: number) => {
                        console.log(`  ${i+1}. Facture ${p.numero_facture}:`, {
                            montant_paye: p.montant_paye,
                            reste_avant: p.reste_avant,
                            reste_apres: p.reste_apres,
                            est_soldee: p.est_soldee,
                            type_est_soldee: typeof p.est_soldee
                        });
                    });
                    
                    const ticketDoc = generateTicketReglementPdfDraft({
                        reference: data.releve_reference || `REL-${releveId}`,
                        date: new Date().toISOString(),
                        client_name: clientName,
                        mode_paiement: modePaiement,
                        total_dettes: data.total_dettes || data.total_amount,
                        montant_regle: data.total_amount,
                        reste_a_payer: data.reste_a_payer || '0.00',
                        paiements: data.paiements,
                        settings: pharmacySettings
                    });
                    
                    ticketDoc.save(`ticket_reglement_${data.releve_reference || releveId}.pdf`);
                } catch (ticketErr) {
                    logger.error('Erreur génération ticket:', ticketErr);
                    const errMsg = ticketErr instanceof Error
                        ? `${ticketErr.name}: ${ticketErr.message}`
                        : String(ticketErr);
                    toast.error(t('creances:toasts.ticket_generation_error', { error: errMsg }));
                }
            }

            if (releveId && window.confirm(t('creances:toasts.confirm_print_bulk_receipt'))) {
                await handlePrintBulkReceipt(releveId);
            }
        } catch (err: unknown) {
            const error = err as { response?: { data?: { detail?: string } } };
            toast.error(error.response?.data?.detail || t('common:messages.error_saving'));
            logger.error('Erreur:', err);
            throw err;
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedIds, modePaiement, referencePaiement, montantTotalBulk, setSelectedIds, refresh, handlePrintBulkReceipt, filteredCreances, pharmacySettings]);

    const confirmBulkPayment = () => {
        requireSudo(performBulkPayment, { permission: 'can_cash_out' });
    };

    const handleImprimerReleve = useCallback(async (selectedClient: string, dateDebut: string, dateFin: string, includeProducts: boolean = false) => {
        if (!selectedClient) {
            toast.error(t('creances:toasts.select_client_error'));
            return;
        }

        const loadingToast = toast.loading(t('creances:toasts.releve_loading'));
        try {
            const releveData = await creanceService.getReleve({
                client_id: selectedClient,
                ...(dateDebut ? { date_debut: dateDebut } : {}),
                ...(dateFin ? { date_fin: dateFin } : {}),
                include_products: includeProducts,
            }) as ReleveData;

            const doc = generateRelevePdfDraft({
                client: releveData.client,
                creances: releveData.creances,
                totaux: releveData.totaux,
                periode: releveData.periode,
                settings: pharmacySettings,
                includeProducts,
            });

            const clientSlug = releveData.client?.name
                ? releveData.client.name.toLowerCase().replace(/\s+/g, '_')
                : selectedClient;
            const suffix = includeProducts ? '_detaille' : '';
            doc.save(`releve_${clientSlug}${suffix}_${new Date().toISOString().slice(0, 10)}.pdf`);
            toast.success(t('creances:toasts.releve_generated'), { id: loadingToast });
        } catch {
            toast.error(t('creances:toasts.error_print_statement'), { id: loadingToast });
        }
    }, [t, pharmacySettings]);

    const handleExportExcel = useCallback(async (params: {
        client_id?: string;
        date_debut?: string;
        date_fin?: string;
        history?: boolean;
    }) => {
        const loadingToast = toast.loading(t('creances:toasts.excel_loading'));
        try {
            const blob = await creanceService.exportExcel(params);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const dateStr = new Date().toISOString().slice(0, 10);
            link.setAttribute('download', `creances_${dateStr}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
            setTimeout(() => window.URL.revokeObjectURL(url), 100);
            toast.success(t('creances:toasts.excel_export_success'), { id: loadingToast });
        } catch (err) {
            logger.error('Erreur export Excel:', err);
            toast.error(t('creances:toasts.excel_export_error'), { id: loadingToast });
        }
    }, [t]);

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
            setReferencePaiement,
            montantTotalBulk,
            setMontantTotalBulk
        },
        actions: {
            handleOpenPaiementModal,
            handleOpenDetailsModal,
            handleBulkPayment,
            confirmBulkPayment,
            handleAjouterPaiement,
            handlePrintDirectReceipt,
            handlePrintBulkReceipt,
            handleImprimerReleve,
            handleExportExcel
        }
    };
};
