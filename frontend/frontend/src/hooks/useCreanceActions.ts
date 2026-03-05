import { useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import type { Creance } from '../types';
import { useSudo } from './useSudo';
import { usePharmacySettings } from './usePharmacySettings';

interface UseCreanceActionsProps {
    creancesEndpoint: string;
    refresh: () => void;
    selectedIds: number[];
    setSelectedIds: (ids: number[]) => void;
    filteredCreances: Creance[];
}

export const useCreanceActions = ({
    creancesEndpoint,
    refresh,
    selectedIds,
    setSelectedIds
}: UseCreanceActionsProps) => {
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
            const url = `${creancesEndpoint}${creanceId}/imprimer_recu/${paiementId ? `?paiement_id=${paiementId}` : ''}`;
            const response = await axios.get(url, { responseType: 'blob' });

            const blob = new Blob([response.data], { type: 'application/pdf' });
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
        } catch (err: any) {
            console.error('Erreur lors de l\'impression du reçu:', err);
            toast.error(err.response?.data?.detail || 'Erreur lors de l\'impression du reçu');
        }
    }, [creancesEndpoint]);

    const handlePrintBulkReceipt = useCallback(async (releveId: number) => {
        if (!releveId) return;

        try {
            const response = await axios.get(`${creancesEndpoint}imprimer_releve_paiement/`, {
                params: { releve_id: releveId },
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { type: 'application/pdf' });
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
        } catch (err: any) {
            console.error('Erreur lors de l\'impression du relevé:', err);
            toast.error(err.response?.data?.detail || 'Erreur lors de l\'impression du relevé');
        }
    }, [creancesEndpoint]);

    const performAjouterPaiement = useCallback(async (validatorId: number, password: string) => {
        if (!selectedCreance || !montantPaiement) return;

        try {
            const response = await axios.post(`${creancesEndpoint}${selectedCreance.id}/ajouter_paiement/`, {
                mode_paiement: modePaiement,
                montant: parseFloat(montantPaiement),
                reference: referencePaiement || undefined,
                validated_by_id: validatorId,
                sudo_password: password
            });

            const paiementId = response.data.paiement_id;

            setIsPaiementModalOpen(false);
            refresh();
            toast.success('Paiement enregistré avec succès !');

            if (window.confirm('Voulez-vous imprimer un reçu pour ce paiement ?')) {
                await handlePrintDirectReceipt(selectedCreance.id, paiementId);
            }
        } catch (err: any) {
            toast.error(err.response?.data?.detail || 'Erreur lors de l\'enregistrement du paiement');
            console.error('Erreur:', err);
        }
    }, [selectedCreance, montantPaiement, creancesEndpoint, modePaiement, referencePaiement, refresh, handlePrintDirectReceipt]);

    const handleAjouterPaiement = () => {
        requireSudo(performAjouterPaiement);
    };

    const performBulkPayment = useCallback(async (validatorId: number, password: string) => {
        try {
            const response = await axios.post(`${creancesEndpoint}bulk_paiement/`, {
                facture_ids: selectedIds,
                mode_paiement: modePaiement,
                reference: referencePaiement,
                validated_by_id: validatorId,
                sudo_password: password
            });

            const releveId = response.data.releve_id;

            setIsBulkModalOpen(false);
            setSelectedIds([]);
            refresh();
            toast.success('Règlement groupé effectué avec succès !');

            if (releveId && window.confirm('Voulez-vous imprimer le reçu récapitulatif pour ce règlement ?')) {
                await handlePrintBulkReceipt(releveId);
            }
        } catch (err: any) {
            toast.error(err.response?.data?.detail || 'Erreur lors du règlement groupé');
            console.error('Erreur:', err);
        }
    }, [creancesEndpoint, selectedIds, modePaiement, referencePaiement, setSelectedIds, refresh, handlePrintBulkReceipt]);

    const confirmBulkPayment = () => {
        requireSudo(performBulkPayment);
    };

    const handleImprimerReleve = useCallback(async (selectedClient: string, dateDebut: string, dateFin: string) => {
        if (!selectedClient) {
            toast.error('Veuillez sélectionner un client');
            return;
        }

        try {
            const params: any = { client_id: selectedClient };
            if (dateDebut) params.date_debut = dateDebut;
            if (dateFin) params.date_fin = dateFin;

            const response = await axios.get(`${creancesEndpoint}releve/`, { params });
            const data = response.data;

            // Simple HTML printing fallback as used in original code
            const win = window.open('', '', 'height=800,width=600');
            if (win) {
                const content = `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px;">
              <h1 style="margin: 0; font-size: 24px;">RELEVÉ DE CRÉANCES</h1>
              <p style="margin: 5px 0;">${pharmacySettings.pharmacy_name}</p>
              <p style="margin: 5px 0; font-size: 12px;">${pharmacySettings.city || ''}, ${pharmacySettings.country || ''}</p>
              ${pharmacySettings.niu ? `<p style="margin: 5px 0; font-size: 12px;">NIU: ${pharmacySettings.niu}</p>` : ''}
              ${pharmacySettings.registre_commerce ? `<p style="margin: 5px 0; font-size: 12px;">RC: ${pharmacySettings.registre_commerce}</p>` : ''}
            </div>

            <div style="margin-bottom: 20px;">
              <h3 style="margin: 10px 0;">Client</h3>
              <p style="margin: 5px 0;"><strong>Nom:</strong> ${data.client.name}</p>
              <p style="margin: 5px 0;"><strong>Adresse:</strong> ${data.client.address || ''}</p>
              <p style="margin: 5px 0;"><strong>Téléphone:</strong> ${data.client.phone || ''}</p>
              <p style="margin: 5px 0;"><strong>Email:</strong> ${data.client.email || ''}</p>
            </div>

            ${data.periode.date_debut || data.periode.date_fin ? `
              <div style="margin-bottom: 20px;">
                <h3 style="margin: 10px 0;">Période</h3>
                ${data.periode.date_debut ? `<p style="margin: 5px 0;"><strong>Du:</strong> ${new Date(data.periode.date_debut).toLocaleDateString('fr-FR')}</p>` : ''}
                ${data.periode.date_fin ? `<p style="margin: 5px 0;"><strong>Au:</strong> ${new Date(data.periode.date_fin).toLocaleDateString('fr-FR')}</p>` : ''}
              </div>
            ` : ''}

            <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 10px;">
              <thead>
                <tr style="background-color: #f0f0f0;">
                  <th style="border: 1px solid #ddd; padding: 4px; text-align: left;">Date</th>
                  <th style="border: 1px solid #ddd; padding: 4px; text-align: left;">N° Facture</th>
                  <th style="border: 1px solid #ddd; padding: 4px; text-align: left;">Ayant Droit</th>
                  <th style="border: 1px solid #ddd; padding: 4px; text-align: right;">Montant Total</th>
                  <th style="border: 1px solid #ddd; padding: 4px; text-align: right;">Payé</th>
                  <th style="border: 1px solid #ddd; padding: 4px; text-align: right;">Reste</th>
                </tr>
              </thead>
              <tbody>
                ${data.creances.map((c: any) => `
                  <tr>
                    <td style="border: 1px solid #ddd; padding: 4px;">${new Date(c.date).toLocaleDateString('fr-FR')}</td>
                    <td style="border: 1px solid #ddd; padding: 4px;">${c.numero_facture || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 4px;">${c.ayant_droit || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 4px; text-align: right;">${Math.round(parseFloat(c.montant_total))} F</td>
                    <td style="border: 1px solid #ddd; padding: 4px; text-align: right;">${Math.round(parseFloat(c.montant_paye))} F</td>
                    <td style="border: 1px solid #ddd; padding: 4px; text-align: right;">${Math.round(parseFloat(c.reste_a_payer))} F</td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr style="background-color: #f0f0f0; font-weight: bold;">
                  <td colspan="3" style="border: 1px solid #ddd; padding: 4px; text-align: right;">TOTAUX:</td>
                  <td style="border: 1px solid #ddd; padding: 4px; text-align: right;">${Math.round(parseFloat(data.totaux.total_factures))} F</td>
                  <td style="border: 1px solid #ddd; padding: 4px; text-align: right;">${Math.round(parseFloat(data.totaux.total_paye))} F</td>
                  <td style="border: 1px solid #ddd; padding: 4px; text-align: right;">${Math.round(parseFloat(data.totaux.total_reste))} F</td>
                </tr>
              </tfoot>
            </table>

            <div style="margin-top: 40px; display: flex; justify-content: space-between;">
              <div style="text-align: center;">
                <p style="margin-bottom: 60px;">Signature Client</p>
                <p>_____________________</p>
              </div>
              <div style="text-align: center;">
                <p style="margin-bottom: 60px;">Signature Pharmacie</p>
                <p>_____________________</p>
              </div>
            </div>

            <div style="text-align: center; margin-top: 30px; font-size: 12px; color: #666;">
              <p>Document généré le ${new Date().toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
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
            toast.error('Erreur lors de la génération du relevé');
        }
    }, [creancesEndpoint, pharmacySettings]);

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
