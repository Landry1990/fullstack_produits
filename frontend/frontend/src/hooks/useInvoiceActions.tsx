import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import type { Facture, TicketCaisse } from '../types';
import { safeStorage } from '../utils/storage';
// import { renderToStaticMarkup } from 'react-dom/server';
// import { TicketTemplate } from '../components/printing/TicketTemplate';

interface UseInvoiceActionsProps {
    refreshFactures: () => void; // To refresh list after actions
    setFacturesLocal?: React.Dispatch<React.SetStateAction<Facture[]>>; // For optimistic updates
}

export const useInvoiceActions = ({ refreshFactures, setFacturesLocal }: UseInvoiceActionsProps) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

    // States for Modals
    const [selectedFacture, setSelectedFacture] = useState<Facture | null>(null);
    const [showProductDetailsModal, setShowProductDetailsModal] = useState(false);
    const [detailsLoading, setDetailsLoading] = useState(false);

    // Print states
    const [showClientNameModal, setShowClientNameModal] = useState(false);
    const [pendingPrintFacture, setPendingPrintFacture] = useState<Facture | null>(null);
    const [showTicketModal, setShowTicketModal] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<TicketCaisse | null>(null);

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
    const handlePrintTicket = async (facture: Facture) => {
        let fullFacture = facture;

        // Charger détails si manquants
        if (!facture.produits || facture.produits.length === 0) {
            const toastId = toast.loading(t('sales.messages.loading_details', { defaultValue: 'Chargement...' }));
            try {
                const token = safeStorage.getItem('authToken');
                const response = await axios.get(`${apiBaseUrl}/factures/${facture.id}/`, {
                    headers: { Authorization: `Token ${token}` }
                });
                fullFacture = response.data;
                toast.dismiss(toastId);
            } catch (error) {
                console.error("Erreur chargement pour ticket", error);
                toast.error("Impossible de charger le détail.");
                toast.dismiss(toastId);
                return;
            }
        }

        // Construire l'objet TicketCaisse
        // Note: On reconstruit un ticket approximatif car l'original n'est pas toujours persisté
        // ou accessible directement ici sans endpoint dédié.
        
        // Déterminer le mode de paiement principal
        let modePaiement: TicketCaisse['mode_paiement'] = 'especes'; // Defaut
        if (fullFacture.paiements && fullFacture.paiements.length > 0) {
            const pm = fullFacture.paiements[0].mode_paiement;
             if (['especes', 'cheque', 'carte', 'virement', 'om', 'momo', 'en_compte'].includes(pm)) {
                 modePaiement = pm as TicketCaisse['mode_paiement'];
             } else {
                 modePaiement = 'Mixte'; // Ou autre logique
             }
             if (fullFacture.paiements.length > 1) modePaiement = 'Mixte';
        }

        const ticket: TicketCaisse = {
            id: fullFacture.session_ticket_number || fullFacture.id, // Utiliser num ticket session si dispo
            facture: fullFacture,
            facture_numero: fullFacture.numero_facture || undefined,
            client_name: fullFacture.client_name || fullFacture.client_name_override || 'Passage',
            mode_paiement: modePaiement,
            montant: fullFacture.total_ttc,
            statut: 'completee',
            date_paiement: fullFacture.date,
            montant_verse: fullFacture.total_ttc,
            rendu: '0',
            is_duplicate: true, // Marquer comme duplicata
            user_details: {
                id: 0,
                // Utiliser le nom retourné par l'API (qui est maintenant ajouté au serializer)
                username: fullFacture.created_by_name || 'Vendeur'
            },
            paiements_details: fullFacture.paiements || [] // Structure compatible ?
        };

        setSelectedTicket(ticket);
        setShowTicketModal(true);
    };

    // --- EDIT / MODIFY ---
    const handleEditInvoice = async (facture: Facture) => {
        let fullFacture = facture;

        // Si les produits ne sont pas complets, on charge le détail
        if (!facture.produits || facture.produits.length === 0) {
            const toastId = toast.loading(t('sales.messages.loading_details', { defaultValue: 'Chargement...' }));
            try {
                const token = safeStorage.getItem('authToken');
                const response = await axios.get(`${apiBaseUrl}/factures/${facture.id}/`, {
                    headers: { Authorization: `Token ${token}` }
                });
                fullFacture = response.data;
                toast.dismiss(toastId);
            } catch (error) {
                console.error("Erreur chargement détails pour modification", error);
                toast.error("Impossible de charger le détail de la vente.");
                toast.dismiss(toastId);
                return; // Stop if failed
            }
        }

        // Sauvegarder la facture complète pour le chargement dans Facturation
        safeStorage.setItem('devis_to_load', JSON.stringify(fullFacture), 'local');
        
        // Rediriger vers la facturation
        navigate('/app/facturation');
    };

    return {
        // State
        modals: {
            selectedFacture,
            detailsLoading,
            showProductDetailsModal, setShowProductDetailsModal,
            showClientNameModal, setShowClientNameModal,
            pendingPrintFacture,
            showTicketModal, setShowTicketModal,
            selectedTicket
        },
        // Actions
        actions: {
            handleViewProducts,
            handlePrintInvoice,
            handleConfirmPrintClientName,
            handlePrintTicket, // New action
            handleEditInvoice 
        }
    };
};
