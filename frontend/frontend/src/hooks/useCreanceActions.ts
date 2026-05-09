import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import type { Creance } from '../types';
import { useSudo } from './useSudo';
import creanceService from '../services/creanceService';
import { usePharmacySettings } from './usePharmacySettings';
import { generateRelevePdf } from '../utils/print/relevePdf';

interface UseCreanceActionsProps {
    refresh: () => void;
    selectedIds: number[];
    setSelectedIds: (ids: number[]) => void;
    filteredCreances: Creance[];
    creancesEndpoint?: string;
    updateLocalCreance?: (id: number, data: any) => void;
    updateLocalSynthese?: (clientId: number, data: any) => void;
}

export const useCreanceActions = ({
    refresh,
    selectedIds,
    setSelectedIds,
    filteredCreances,
    creancesEndpoint,
    updateLocalCreance,
    updateLocalSynthese
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
            console.error('Erreur:', err);
        }
    }, [selectedCreance, montantPaiement, modePaiement, referencePaiement, refresh, handlePrintDirectReceipt, updateLocalCreance]);

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

        const loadingToast = toast.loading('Génération du relevé...');
        try {
            const releveData = await creanceService.getReleve({
                client_id: selectedClient,
                ...(dateDebut ? { date_debut: dateDebut } : {}),
                ...(dateFin ? { date_fin: dateFin } : {}),
            });

            const doc = generateRelevePdf({
                client: releveData.client,
                creances: releveData.creances,
                totaux: releveData.totaux,
                periode: releveData.periode,
                settings: pharmacySettings,
            });

            const clientSlug = releveData.client?.name
                ? releveData.client.name.toLowerCase().replace(/\s+/g, '_')
                : selectedClient;
            doc.save(`releve_${clientSlug}_${new Date().toISOString().slice(0, 10)}.pdf`);
            toast.success('Relevé généré avec succès.', { id: loadingToast });
        } catch (err) {
            toast.error(t('creances:toasts.error_print_statement'), { id: loadingToast });
        }
    }, [t, pharmacySettings]);

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
