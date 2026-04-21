import { useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { safeStorage } from '../utils/storage';
import type { Facture, LigneFacture } from '../types';
import type { OrdonnanceData } from '../components/OrdonnanceModal';

export interface UseFacturationActionsProps {
    apiBaseUrl: string;
    cart: {
        lignesFacture: LigneFacture[];
        setLignesFacture: (lignes: LigneFacture[]) => void;
    };
    clientsHook: any;
    ui: any;
    totals: any;
    pendingSales: any;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    t: (key: string, options?: any) => string;
    productSearch: any;
    searchInputRef: React.RefObject<HTMLInputElement>;
    paymentInputRef: React.RefObject<HTMLInputElement>;
    pendingPrintFacture: Facture | null;
    setPendingPrintFacture: (f: Facture | null) => void;
    setShowClientNameModal: (show: boolean) => void;
    secureUpdateQuantite: (produitId: number, qty: number) => void;
    user: any;
}

export function useFacturationActions({
    apiBaseUrl,
    cart,
    clientsHook,
    ui,
    totals,
    pendingSales,
    setLoading,
    setError,
    t,
    productSearch,
    searchInputRef,
    paymentInputRef,
    pendingPrintFacture,
    setPendingPrintFacture,
    setShowClientNameModal,
    secureUpdateQuantite,
    user
}: UseFacturationActionsProps) {

    const handleProforma = useCallback(async () => {
        if (cart.lignesFacture.length === 0) return
        setLoading(true)
        try {
            const facturesEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/factures/` : '/api/factures/'
            const factureProduitsEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/facture-produits/` : '/api/facture-produits/'

            const facturePayload = {
                client: clientsHook.useManualClient ? null : clientsHook.selectedClient,
                client_name_override: clientsHook.useManualClient ? clientsHook.manualClientName : null,
                remise: totals.remiseMontant.toString(),
                tva: '0',
                status: 'PROF',
                ayant_droit: clientsHook.selectedAyantDroit,
                part_client: (clientsHook.selectedClient && clientsHook.clients.find((c: any) => c.id === clientsHook.selectedClient)?.client_type === 'PROFESSIONNEL' && totals.tauxCouverture > 0) ? totals.partPatient : null
            }
            const { data: createdFacture } = await axios.post(facturesEndpoint, facturePayload)

            const produitsPayload = cart.lignesFacture.map((ligne: any) => {
                const prixUnitaire = Number(ligne.prix_unitaire)
                const remiseProduit = Number(ligne.remise_produit)
                const prixNet = prixUnitaire * (1 - remiseProduit / 100)
                return {
                    facture: createdFacture.id,
                    produit: ligne.produit.id,
                    quantity: Number(ligne.quantite),
                    selling_price: prixNet.toString(),
                    discount: (prixUnitaire - prixNet).toFixed(0),
                    stock_lot: ligne.lotId ? Number(ligne.lotId) : null,
                    lot: null,
                    date_expiration: ligne.produit.expire_date || null,
                }
            })

            await Promise.all(produitsPayload.map((payload: any) => axios.post(factureProduitsEndpoint, payload)))

            try {
                window.open(`/app/print-invoice/${createdFacture.id}`, '_blank')
                toast.success("Proforma généré avec succès")
            } catch (err) {}

            cart.setLignesFacture([])
            ui.setMontantPaye('')
            ui.setModePaiement('especes')
            ui.setPaiements([{ mode: 'especes', montant: 0 }])
            clientsHook.setSelectedClient(null)
            clientsHook.setManualClientName('')
            ui.setTicketCaisse(null)
        } catch (error) {
            toast.error("Erreur lors de la création du proforma")
        } finally {
            setLoading(false)
        }
    }, [cart.lignesFacture, apiBaseUrl, clientsHook, totals, ui, setLoading])

    const handleBonDeLivraison = useCallback(async () => {
        if (cart.lignesFacture.length === 0) {
            toast.error("Le panier est vide")
            return
        }
        if (ui.isModificationMode && ui.modificationInvoiceId) {
            window.open(`/app/print-invoice/${ui.modificationInvoiceId}?type=BL`, '_blank')
            return
        }

        setLoading(true)
        try {
            const facturesEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/factures/` : '/api/factures/'
            const factureProduitsEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/facture-produits/` : '/api/facture-produits/'

            const facturePayload = {
                client: clientsHook.selectedClient || null,
                client_name_override: clientsHook.manualClientName || null,
                ayant_droit: clientsHook.selectedAyantDroit || null,
                status: 'PROF',
                remise: Number(ui.remiseGlobale) || 0,
                notes: "Généré via Bon de Livraison"
            }

            const res = await axios.post(facturesEndpoint, facturePayload, {
                headers: { Authorization: `Token ${safeStorage.getItem('authToken')}` }
            })
            const createdFacture = res.data

            const produitsPayload = cart.lignesFacture.map((ligne: any) => {
                const prixUnitaire = Number(ligne.prix_unitaire)
                const remiseProduit = Number(ligne.remise_produit) || 0
                const prixNet = prixUnitaire * (1 - remiseProduit / 100)
                const lotIdNum = ligne.lotId && !isNaN(Number(ligne.lotId)) ? Number(ligne.lotId) : null

                return {
                    facture: createdFacture.id,
                    produit: ligne.produit.id,
                    produit_nom: ligne.produit.name,
                    quantity: Number(ligne.quantite),
                    selling_price: prixNet.toFixed(2),
                    discount: (prixUnitaire - prixNet).toFixed(2),
                    stock_lot_id: lotIdNum,
                    lot: ligne.lotText || null,
                    date_expiration: ligne.lotExpiration || ligne.produit.expire_date || null,
                }
            })

            for (const payload of produitsPayload) {
                await axios.post(factureProduitsEndpoint, payload, {
                    headers: { Authorization: `Token ${safeStorage.getItem('authToken')}` }
                })
            }

            window.open(`/app/print-invoice/${createdFacture.id}?type=BL`, '_blank')

            ui.setModificationInvoiceId(createdFacture.id)
            ui.setModificationInvoiceStatus('PROF')
            ui.setIsModificationMode(true)

            toast.success("Bon de livraison généré - Document prêt pour validation")
        } catch (error: any) {
            toast.error(`Erreur lors de la création du document : ${error.message}`)
        } finally {
            setLoading(false)
        }
    }, [cart.lignesFacture, apiBaseUrl, clientsHook, ui, setLoading])

    const handleImprimerFacture = useCallback(async (facture: Facture) => {
        if (!facture) {
            setError("Aucune facture à imprimer.");
            return;
        }
        try {
            if (facture.id) {
                window.open(`/app/print-invoice/${facture.id}`, '_blank')
            }
        } catch (err: any) {
            setError(err?.response?.data?.detail || "Erreur lors de l'impression de la facture")
        }
    }, [setError])

    const handleConfirmPrintClientName = useCallback(async (clientNameInput: string) => {
        if (!pendingPrintFacture) return;
        try {
            await axios.patch(`${apiBaseUrl}/api/factures/${pendingPrintFacture.id}/`,
                { client_name_override: clientNameInput }
            );
            let url = `/app/print-invoice/${pendingPrintFacture.id}`;
            if (clientNameInput) url += `?client_name=${encodeURIComponent(clientNameInput)}`;
            window.open(url, '_blank');
        } catch (error) {
            let url = `/app/print-invoice/${pendingPrintFacture.id}`;
            if (clientNameInput) url += `?client_name=${encodeURIComponent(clientNameInput)}`;
            window.open(url, '_blank');
        } finally {
            setShowClientNameModal(false);
            setPendingPrintFacture(null);
            setTimeout(() => searchInputRef.current?.focus(), 100);
        }
    }, [pendingPrintFacture, apiBaseUrl, setShowClientNameModal, setPendingPrintFacture, searchInputRef])

    const ouvrirModalPaiement = useCallback((facture?: Facture) => {
        if (facture) {
            ui.setMontantPaye(Math.round(Number(facture.total_ttc)).toString())
            ui.openPaymentModal(facture)
        } else {
            if (!clientsHook.selectedClient) {
                setError('Veuillez sélectionner un client')
                return
            }
            if (cart.lignesFacture.length === 0) {
                setError('Veuillez ajouter au moins un produit')
                return
            }
            ui.setMontantPaye(Math.round(totals.totalTtc).toString())
            ui.openPaymentModal()
        }
        ui.setModePaiement('especes')
        ui.setReference('')
        ui.setPaiements([])
        setTimeout(() => {
            paymentInputRef.current?.focus()
            paymentInputRef.current?.select()
        }, 100)
    }, [ui, clientsHook.selectedClient, cart.lignesFacture.length, totals.totalTtc, setError, paymentInputRef])

    const handleSendWhatsApp = useCallback(async () => {
        if (!ui.ticketCaisse || !ui.ticketCaisse.facture || typeof ui.ticketCaisse.facture === 'number') return
        const facture = ui.ticketCaisse.facture as any
        const clientPhone = (typeof facture.client === 'object' ? facture.client?.phone : '') || facture.client_phone
        const phone = window.prompt(t('facturation.messages.enter_whatsapp_number') || 'Entrez le numéro WhatsApp', clientPhone || '')
        if (!phone) return

        setLoading(true)
        try {
            const facturesEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/factures/` : '/api/factures/'
            const response = await axios.post(`${facturesEndpoint}${facture.id}/send_whatsapp/`, { phone: phone })
            toast.success(response.data.detail || 'Ticket envoyé par WhatsApp !')
        } catch (err: any) {
            toast.error(err.response?.data?.detail || "Erreur lors de l'envoi WhatsApp")
        } finally {
            setLoading(false)
        }
    }, [ui.ticketCaisse, apiBaseUrl, t, setLoading])

    const handleOrdonnanceSave = useCallback(async (data: OrdonnanceData) => {
        setLoading(true);
        try {
            const endpoint = apiBaseUrl ? `${apiBaseUrl}/api/ordonnancier/` : '/api/ordonnancier/';
            const lignesForBackend = data.lignes.map((ligne: any) => ({
                produit: ligne.produit_id,
                produit_nom: ligne.produit_nom,
                quantite: ligne.quantite,
                surveillance_category: ligne.surveillance_category
            }));
            const payload = {
                patient_nom: data.patient_nom,
                prescripteur_nom: data.prescripteur_nom,
                facture: ui.pendingOrdonnanceFacture?.id || null,
                lignes: lignesForBackend
            };
            await axios.post(endpoint, payload);
            toast.success(t('prescriptions:messages.save_success'));
            ui.setShowOrdonnanceModal(false);
            ui.setPendingOrdonnanceFacture(null);
        } catch (err: any) {
            toast.error(t('prescriptions:messages.save_error') + ": " + (err.response?.data?.detail || err.message));
        } finally {
            setLoading(false);
        }
    }, [apiBaseUrl, ui, t, setLoading])

    const handleQuantityShortcut = useCallback((qty: number) => {
        if (cart.lignesFacture.length > 0) {
            const lastLine = cart.lignesFacture[cart.lignesFacture.length - 1];
            secureUpdateQuantite(lastLine.produit.id, qty);
            toast.success(`Quantité mise à jour : ${qty} x ${lastLine.produit.name}`, { icon: '🔢' });
        } else {
            toast.error("Aucun produit dans le panier pour appliquer une quantité");
        }
    }, [cart.lignesFacture, secureUpdateQuantite])

    const handleLotSelect = useCallback((lot: any | null) => {
        if (!ui.lotModal.product) return
        cart.setLignesFacture(
            cart.lignesFacture.map((l: any) => {
                if (l.produit.id === ui.lotModal.product.id) {
                    return {
                        ...l,
                        lotId: lot?.id?.toString() || null,
                        lotText: lot?.numero_lot || null,
                        lotExpiration: lot?.date_expiration || null
                    }
                }
                return l
            })
        )
        ui.closeLotModal()
        setTimeout(() => searchInputRef.current?.focus(), 100)
    }, [ui.lotModal.product, cart, ui.closeLotModal, searchInputRef])

    const _resetSaleDataOnly = useCallback(() => {
        cart.setLignesFacture([])
        clientsHook.setClientSearch('')
        clientsHook.setManualClientName('')
        clientsHook.setSelectedClient(null)
        const clientsDivers = clientsHook.clients.find((c: any) => c.name.toLowerCase() === 'clients divers')
        clientsHook.setSelectedClient(clientsDivers ? clientsDivers.id : null)
        clientsHook.setUseManualClient(false)
        clientsHook.setManualClientName('')
        ui.setRemiseGlobale('0')
        ui.setRemiseMode('montant')
        clientsHook.setAyantDroitNom('')
        clientsHook.setAyantDroitMatricule('')
        clientsHook.setAyantDroitSociete('')
        clientsHook.setSelectedAyantDroit(null)
        clientsHook.setShowNewAyantDroit(false)
        productSearch.setSearchQuery('')
        ui.setTempOrdonnanceData(null)

        // Nettoyer explicitement le cache auto-save (clé dynamique)
        if (user?.id) {
            safeStorage.removeItem(`activeCartLignes_${user.id}`, 'local')
            safeStorage.removeItem(`activeSaleContext_${user.id}`, 'local')
        }

        setTimeout(() => searchInputRef.current?.focus(), 50)
    }, [cart, clientsHook, ui, productSearch, user, searchInputRef])

    const _resetSale = useCallback(() => {
        cart.setLignesFacture([])
        const clientsDivers = clientsHook.clients.find((c: any) => c.name.toLowerCase() === 'clients divers')
        clientsHook.setSelectedClient(clientsDivers ? clientsDivers.id : null)
        clientsHook.setUseManualClient(false)
        clientsHook.setManualClientName('')
        ui.resetUIState()
        clientsHook.setAyantDroitNom('')
        clientsHook.setAyantDroitMatricule('')
        clientsHook.setAyantDroitSociete('')
        clientsHook.setSelectedAyantDroit(null)
        clientsHook.setShowNewAyantDroit(false)
        productSearch.setSearchQuery('')
        setError(null)
        ui.setTempOrdonnanceData(null)
        searchInputRef.current?.focus()
    }, [cart, clientsHook, ui, productSearch, setError, searchInputRef])

    const mettreEnAttente = useCallback(() => {
        if (cart.lignesFacture.length === 0) {
            setError('Impossible de mettre en attente une vente vide')
            return
        }
        if (pendingSales.ventesEnAttente.length >= 4) {
            setError('Maximum 4 ventes en attente atteint')
            return
        }
        const clientName = !clientsHook.useManualClient && clientsHook.selectedClient
            ? clientsHook.clients.find((c: any) => c.id === clientsHook.selectedClient)?.name || ''
            : clientsHook.manualClientName

        const ayantDroitData = clientsHook.selectedAyantDroit || clientsHook.showNewAyantDroit || clientsHook.ayantDroitNom ? {
            id: clientsHook.selectedAyantDroit,
            nom: clientsHook.ayantDroitNom,
            matricule: clientsHook.ayantDroitMatricule,
            societe: clientsHook.ayantDroitSociete,
            showNew: clientsHook.showNewAyantDroit
        } : null

        pendingSales.savePendingSale({
            client: clientsHook.useManualClient ? null : clientsHook.selectedClient,
            clientName,
            useManualClient: clientsHook.useManualClient,
            manualClientName: clientsHook.manualClientName,
            lignes: cart.lignesFacture,
            remise: ui.remiseGlobale,
            remiseMode: ui.remiseMode,
            ayantDroit: ayantDroitData
        })
        _resetSale()
        toast.success('Vente mise en attente')
    }, [cart.lignesFacture, clientsHook, pendingSales, ui, setError, _resetSale])

    const annulerVente = useCallback(() => {
        if (cart.lignesFacture.length > 0) {
            ui.setConfirmModal({
                isOpen: true,
                message: t('facturation.messages.cancel_sale_confirm', { defaultValue: 'Êtes-vous sûr de vouloir annuler cette vente en cours ? Tout le panier sera perdu.' }),
                onConfirm: () => _resetSale()
            })
            return
        }
        _resetSale()
    }, [cart.lignesFacture.length, ui, t, _resetSale])

    const restaurerVente = useCallback((id: number) => {
        const vente = pendingSales.ventesEnAttente.find((v: any) => v.id === id)
        if (!vente) return
        if (cart.lignesFacture.length > 0) {
            if (!window.confirm('Le panier actuel n\'est pas vide. Voulez-vous le remplacer par la vente en attente ?')) return
        }
        cart.setLignesFacture(vente.lignes)
        clientsHook.setUseManualClient(vente.useManualClient)
        clientsHook.setManualClientName(vente.manualClientName)
        ui.setRemiseGlobale(vente.remise)
        ui.setRemiseMode(vente.remiseMode)
        if (vente.client) clientsHook.setSelectedClient(vente.client)
        else clientsHook.setSelectedClient(null)
        if (vente.ayantDroit) {
            clientsHook.setSelectedAyantDroit(vente.ayantDroit.id)
            clientsHook.setAyantDroitNom(vente.ayantDroit.nom)
            clientsHook.setAyantDroitMatricule(vente.ayantDroit.matricule)
            clientsHook.setAyantDroitSociete(vente.ayantDroit.societe)
            clientsHook.setShowNewAyantDroit(vente.ayantDroit.showNew)
        }
        pendingSales.deletePendingSale(id)
        pendingSales.setShowPendingSales(false)
        toast.success(t('facturation:messages.save_success'))
    }, [pendingSales, cart, clientsHook, ui, t])

    const supprimerVenteEnAttente = useCallback((id: number) => {
        ui.setConfirmModal({
            isOpen: true,
            message: "Voulez-vous vraiment supprimer cette vente en attente ?",
            onConfirm: () => {
                pendingSales.deletePendingSale(id);
                ui.setConfirmModal(null);
                toast.success("Vente en attente supprimée");
            }
        });
    }, [ui, pendingSales])

    return {
        handleProforma,
        handleBonDeLivraison,
        handleImprimerFacture,
        handleConfirmPrintClientName,
        ouvrirModalPaiement,
        handleSendWhatsApp,
        handleOrdonnanceSave,
        handleQuantityShortcut,
        handleLotSelect,
        _resetSaleDataOnly,
        _resetSale,
        mettreEnAttente,
        annulerVente,
        restaurerVente,
        supprimerVenteEnAttente
    }
}
