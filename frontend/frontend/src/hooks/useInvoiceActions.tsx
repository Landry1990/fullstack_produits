import { useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Facture } from '../types';
import { safeStorage } from '../utils/storage';
import { renderToStaticMarkup } from 'react-dom/server';
import { TicketTemplate } from '../components/printing/TicketTemplate';

interface UseInvoiceActionsProps {
    refreshFactures: () => void; // To refresh list after actions
    setFacturesLocal?: React.Dispatch<React.SetStateAction<Facture[]>>; // For optimistic updates
}

export const useInvoiceActions = ({ refreshFactures, setFacturesLocal }: UseInvoiceActionsProps) => {
    const { t } = useTranslation();
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

    // States for Modals
    const [selectedFacture, setSelectedFacture] = useState<Facture | null>(null);
    const [showRefundModal, setShowRefundModal] = useState(false);
    const [showProductDetailsModal, setShowProductDetailsModal] = useState(false);
    const [detailsLoading, setDetailsLoading] = useState(false);

    // Print states
    const [showClientNameModal, setShowClientNameModal] = useState(false);
    const [pendingPrintFacture, setPendingPrintFacture] = useState<Facture | null>(null);

    // --- VIEW DETAILS ---
    const handleViewProducts = async (facture: Facture) => {
        setSelectedFacture(facture);
        setShowProductDetailsModal(true);

        // Si les produits ne sont pas chargés (liste allégée)
        if (!facture.produits || facture.produits.length === 0) {
            setDetailsLoading(true);
            try {
                const token = safeStorage.getItem('authToken');
                const response = await axios.get(`${apiBaseUrl}/factures/${facture.id}/`, {
                    headers: { Authorization: `Token ${token}` }
                });
                setSelectedFacture(response.data);
            } catch (error) {
                console.error("Erreur chargement détails", error);
                toast.error("Impossible de charger le détail.");
            } finally {
                setDetailsLoading(false);
            }
        }
    };

    // --- PRINTING ---
    const printInvoicePDF = (factureId: number, clientName?: string | null) => {
        let url = `/app/print-invoice/${factureId}`;
        if (clientName) {
            url += `?client_name=${encodeURIComponent(clientName)}`;
        }

        // Ouvrir dans une popup centrée
        const width = 1000;
        const height = 800;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;

        window.open(
            url,
            'PrintInvoice',
            `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`
        );
    };

    const handlePrintInvoice = (facture: Facture) => {
        // Logique de vérification si nom client nécessaire
        const isGenericClient = !facture.client_name_override && (
            !facture.client_name || facture.client_name === 'Client de passage'
        );

        if (isGenericClient) {
            setPendingPrintFacture(facture);
            setShowClientNameModal(true);
        } else {
            // Imprimer directement avec le nom existant
            // On peut passer le nom override s'il existe, sinon le nom standard
            const nameToUse = facture.client_name_override || facture.client_name;
            printInvoicePDF(facture.id, nameToUse);
        }
    };

    const handleConfirmPrintClientName = async (clientNameInput: string) => {
        if (!pendingPrintFacture) return;

        try {
            const token = safeStorage.getItem('authToken');
            // PATCH update
            await axios.patch(`${apiBaseUrl}/factures/${pendingPrintFacture.id}/`,
                { client_name_override: clientNameInput },
                { headers: { Authorization: `Token ${token}` } }
            );

            // Mise à jour locale du state global (via prop)
            if (setFacturesLocal) {
                const updatedFacture = {
                    ...pendingPrintFacture,
                    client_name: clientNameInput,
                    client_name_override: clientNameInput
                };

                setFacturesLocal(prev =>
                    prev.map(f => f.id === pendingPrintFacture.id ? updatedFacture : f)
                );
            }

            // Lancer impression
            printInvoicePDF(pendingPrintFacture.id, clientNameInput);

        } catch (error) {
            console.error('Erreur sauvegarde nom client:', error);
            toast.error(t('sales.messages.save_error'));
            // Fallback print
            printInvoicePDF(pendingPrintFacture.id, clientNameInput);
        } finally {
            setShowClientNameModal(false);
            setPendingPrintFacture(null);
        }
    };

    // --- TICKET PREVIEW ---
    const handleOpenTicketPreview = async (facture: Facture) => {
        try {
            // Need to fetch full details first (payments etc)
            const token = safeStorage.getItem('authToken');
            const res = await axios.get(`${apiBaseUrl}/factures/${facture.id}/`, {
                headers: { Authorization: `Token ${token}` }
            });
            const fullFacture = res.data;

            // Fetch settings
            const settingsRes = await axios.get(`${apiBaseUrl}/invoice-settings/`, {
                headers: { Authorization: `Token ${token}` }
            });
            const settings = settingsRes.data;

            const printWindow = window.open('', '', 'width=300,height=600');
            if (printWindow) {
                // Render component to static HTML
                const htmlContent = renderToStaticMarkup(
                    <TicketTemplate data={ fullFacture } settings = { settings } />
                );

                printWindow.document.write('<html><head><title>Ticket</title>');
                // Add tailwind CDN for styling in popup (quick fix) or custom styles
                printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');
                printWindow.document.write('</head><body>');
                printWindow.document.write(htmlContent);
                printWindow.document.write('</body></html>');
                printWindow.document.close();
                printWindow.focus();
                // printWindow.print(); // Optional auto-print
            }
        } catch (err) {
            console.error("Erreur ticket preview", err);
            toast.error("Erreur ouverture ticket");
        }
    };

    // --- REFUNDS ---
    const handleOpenRefundModal = (facture: Facture) => {
        setSelectedFacture(facture);
        setShowRefundModal(true);
    };

    const handleConfirmRefund = async (reason: string) => {
        if (!selectedFacture) return;
        try {
            const token = safeStorage.getItem('authToken');
            await axios.post(`${apiBaseUrl}/factures/${selectedFacture.id}/annuler/`,
                { motif: reason },
                { headers: { Authorization: `Token ${token}` } }
            );
            toast.success(t('sales.messages.refund_success'));
            refreshFactures();
        } catch (error) {
            console.error(error);
            toast.error(t('sales.messages.refund_error'));
        } finally {
            setShowRefundModal(false);
            setSelectedFacture(null);
        }
    };

    return {
        // State
        modals: {
            selectedFacture,
            detailsLoading,
            showRefundModal, setShowRefundModal,
            showProductDetailsModal, setShowProductDetailsModal,
            showClientNameModal, setShowClientNameModal,
            pendingPrintFacture
        },
        // Actions
        actions: {
            handleViewProducts,
            handlePrintInvoice,
            handleConfirmPrintClientName,
            handleOpenTicketPreview,
            handleOpenRefundModal,
            handleConfirmRefund
        }
    };
};
