import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import type { Facture, TicketCaisse, Client, FactureProduit } from '../types';
import { safeStorage } from '../utils/storage';

interface UseInvoiceActionsProps {
    setFacturesLocal?: React.Dispatch<React.SetStateAction<Facture[]>>; // For optimistic updates
}

export const useInvoiceActions = ({ setFacturesLocal }: UseInvoiceActionsProps) => {
    const { t } = useTranslation(['sales', 'common']);
    const navigate = useNavigate();
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
                const response = await api.get(`factures/${facture.id}/`);
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
    const printInvoicePDF = (factureId: number, clientName?: string | null, type?: string) => {
        let url = `/app/print-invoice/${factureId}`;
        const params = new URLSearchParams();
        if (clientName) params.append('client_name', clientName);
        if (type) params.append('type', type);
        
        const queryString = params.toString();
        if (queryString) url += `?${queryString}`;

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
        const nameToUse = facture.client_name_override || facture.client_name;
        printInvoicePDF(facture.id, nameToUse);
    };

    const handlePrintBL = (facture: Facture) => {
        const nameToUse = facture.client_name_override || facture.client_name;
        printInvoicePDF(facture.id, nameToUse, 'BL');
    };

    const handleConfirmPrintClientName = async (clientNameInput: string) => {
        if (!pendingPrintFacture) return;

        try {
            await api.patch(`factures/${pendingPrintFacture.id}/`,
                { client_name_override: clientNameInput }
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
            toast.error(t('messages.save_error'));
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
            const toastId = toast.loading(t('messages.loading_details', { defaultValue: 'Chargement...' }));
            try {
                const response = await api.get(`factures/${facture.id}/`);
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

        // Priorité: client_name_override > client_name > nom du client > 'Client de passage'
        const clientNameForTicket = fullFacture.client_name_override 
            || fullFacture.client_name 
            || (typeof fullFacture.client === 'object' ? (fullFacture.client as Client).name : undefined) 
            || 'Client de passage';
        
        const ticket: TicketCaisse = {
            id: fullFacture.session_ticket_number || fullFacture.id, // Utiliser num ticket session si dispo
            facture: fullFacture,
            facture_numero: fullFacture.numero_facture || undefined,
            client_name: clientNameForTicket,
            mode_paiement: modePaiement,
            montant: fullFacture.total_ttc,
            statut: 'completee',
            date_paiement: fullFacture.date,
            montant_verse: fullFacture.total_ttc,
            rendu: '0',
            reference: null,
            is_duplicate: true, // Marquer comme duplicata
            user_details: {
                id: 0,
                // Utiliser le nom retourné par l'API (qui est maintenant ajouté au serializer)
                username: fullFacture.created_by_name || '?'
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
            const toastId = toast.loading(t('messages.loading_details', { defaultValue: 'Chargement...' }));
            try {
                const response = await api.get(`factures/${facture.id}/`);
                fullFacture = response.data;
                toast.dismiss(toastId);
            } catch (error) {
                console.error("Erreur chargement détails pour modification", error);
                toast.error("Impossible de charger le détail de la vente.");
                toast.dismiss(toastId);
                return;
            }
        }

        // Sauvegarder la facture complète pour le chargement dans Facturation
        safeStorage.setItem('devis_to_load', JSON.stringify(fullFacture), 'local');
        
        // Rediriger vers la facturation
        navigate('/app/facturation');
    };

    // --- DUPLICATE ---
    const handleDuplicateInvoice = async (facture: Facture) => {
        let fullFacture = facture;

        // Si les produits ne sont pas complets, on charge le détail
        if (!facture.produits || facture.produits.length === 0) {
            const toastId = toast.loading(t('messages.loading_details', { defaultValue: 'Chargement...' }));
            try {
                const response = await api.get(`factures/${facture.id}/`);
                fullFacture = response.data;
                toast.dismiss(toastId);
            } catch (error) {
                console.error("Erreur chargement détails pour duplication", error);
                toast.error("Impossible de charger le détail de la vente à dupliquer.");
                toast.dismiss(toastId);
                return;
            }
        }

        // On crée une copie expurgée des données d'identification unique
        // On supprime aussi spécifiquement les lots car ils peuvent ne plus exister
        const duplicatedProduits = fullFacture.produits?.map(p => ({
            ...p,
            lot: undefined,
            stock_lot: undefined,
            date_expiration: undefined
        })) || [];

        const duplicatedFacture: Partial<Facture> = {
            ...fullFacture,
            produits: duplicatedProduits as FactureProduit[],
            id: undefined, 
            numero_facture: undefined,
            status: 'BROU', 
            paiements: [], 
            session_ticket_number: undefined,
            date: new Date().toISOString()
        };

        // Sauvegarder la facture "dupliquée" pour le chargement dans Facturation
        safeStorage.setItem('devis_to_load', JSON.stringify(duplicatedFacture), 'local');
        toast.success(t('messages.duplicated_to_cart', { defaultValue: 'Facture copiée vers la facturation' }));
        
        // Rediriger vers la facturation
        navigate('/app/facturation');
    };

    // --- GENERER AVOIR ---
    const handleGenerateAvoir = async (facture: Facture) => {
        const toastId = toast.loading(t('sales.messages.loading_details', { defaultValue: 'Génération de l\'avoir...' }));
        try {
            const response = await api.get(`factures/${facture.id}/generer_avoir/`);
            const avoirData = response.data;
            toast.dismiss(toastId);

            // Create a pseudo-Facture to load in Facturation
            const newDraftAvoir: Partial<Facture> = {
                ...avoirData,
                id: undefined, // ensure it's loaded as new
                numero_facture: undefined,
                status: 'BROU',
                paiements: [], // Pas de paiements liés
                session_ticket_number: undefined,
                date: new Date().toISOString(),
                date_paiement: new Date().toISOString(),
                reference: null,
                is_avoir_client: true, // Flag to bypass Sudo validation
            };

            // Sauvegarder la facture "avoir" pour le chargement dans Facturation
            safeStorage.setItem('devis_to_load', JSON.stringify(newDraftAvoir), 'local');
            toast.success(t('messages.avoir_to_cart', { defaultValue: 'Produits en négatif ajoutés à la facturation' }));
            
            // Rediriger vers la facturation
            navigate('/app/facturation');

        } catch (error: unknown) {
            console.error("Erreur génération avoir", error);
            const err = error as { response?: { data?: { detail?: string } } };
            const detail = err.response?.data?.detail;
            toast.error(detail || "Impossible de générer un avoir pour cette vente.");
            toast.dismiss(toastId);
        }
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
            handlePrintBL,
            handleConfirmPrintClientName,
            handlePrintTicket, // New action
            handleEditInvoice,
            handleDuplicateInvoice,
            handleGenerateAvoir
        }
    };
};
