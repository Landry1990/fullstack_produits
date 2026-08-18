import { useCallback } from 'react';
import type { TFunction } from 'i18next';
import api from '../services/api';
import { gooeyToast } from 'goey-toast';
import { getApiErrorDetail } from '../utils/errorHandling';
import { safeStorage } from '../utils/storage';
import { useConfirm } from './useConfirm';
import type { Facture, LigneFacture, TotalsData, User, Client, LotAllocation } from '../types';
import type { PosteVente } from '../services/cashSessionService';
import type { OrdonnanceData } from '../components/OrdonnanceModal';
import type { useFacturationClients } from './useFacturationClients';
import type { useFacturationUI } from './useFacturationUI';
import type { usePendingSales } from './usePendingSales';
import type { useProductSearch } from './useProductSearch';

export interface UseFacturationActionsProps {
    apiBaseUrl?: string;
    cart: {
        lignesFacture: LigneFacture[];
        setLignesFacture: (lignes: LigneFacture[]) => void;
    };
    clientsHook: ReturnType<typeof useFacturationClients>;
    ui: ReturnType<typeof useFacturationUI>;
    totals: TotalsData & { tauxCouverture: number; partPatient: number };
    pendingSales: ReturnType<typeof usePendingSales>;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    t: TFunction;
    productSearch: ReturnType<typeof useProductSearch>;
    searchInputRef: React.RefObject<HTMLInputElement | null>;
    paymentInputRef: React.RefObject<HTMLInputElement | null>;
    pendingPrintFacture: Facture | null;
    setPendingPrintFacture: (f: Facture | null) => void;
    setShowClientNameModal: (show: boolean) => void;
    secureUpdateQuantite: (produitId: number, qty: number) => void;
    user: User | null;
    myActivePoste?: PosteVente | null;
    postesCaisses?: { id: number }[];
}

export function useFacturationActions({
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
    user,
    myActivePoste,
    postesCaisses: _postesCaisses
}: UseFacturationActionsProps) {
    const confirm = useConfirm();

    const handleProforma = useCallback(async () => {
        if (cart.lignesFacture.length === 0) return
        setLoading(true)

        // Ouvrir le popup AVANT les appels async pour conserver le contexte du clic utilisateur
        // et éviter le blocage par le navigateur.
        let printWindow: Window | null = null
        try {
            printWindow = window.open('about:blank', '_blank')
        } catch { /* ignore */ }
        if (!printWindow) {
            gooeyToast.error(t('common:popup_blocked'))
            setLoading(false)
            return
        }

        try {
            const facturePayload = {
                client: clientsHook.useManualClient ? null : clientsHook.selectedClient,
                client_name_override: clientsHook.useManualClient ? clientsHook.manualClientName : null,
                remise: totals.remiseMontant.toString(),
                tva: '0',
                status: 'PROF',
                ayant_droit: clientsHook.selectedAyantDroit,
                part_client: (clientsHook.selectedClient && clientsHook.clients.find((c: Client) => c.id === clientsHook.selectedClient)?.client_type === 'PROFESSIONNEL' && totals.tauxCouverture > 0) ? totals.partPatient : null
            }
            const { data: createdFacture } = await api.post('factures/', facturePayload)

            const produitsPayload = cart.lignesFacture.map((ligne: LigneFacture) => {
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
                    lot_allocations: ligne.lotAllocations && ligne.lotAllocations.length > 0
                        ? ligne.lotAllocations.map(a => ({
                            lot_id: Number(a.lotId),
                            quantity: Number(a.quantity),
                            selling_price: a.sellingPrice ? Number(a.sellingPrice) : undefined,
                        }))
                        : undefined,
                }
            })

            await Promise.all(produitsPayload.map((payload) => api.post('facture-produits/', payload)))

            printWindow.location.href = `/app/print-invoice/${createdFacture.id}?type=proforma`
            printWindow.focus?.()
            gooeyToast.success(t('facturation:messages.proforma_success'))

            cart.setLignesFacture([])
            ui.setMontantPaye('')
            ui.setModePaiement('especes')
            ui.setPaiements([{ mode: 'especes', montant: 0 }])
            clientsHook.setSelectedClient(null)
            clientsHook.setManualClientName('')
            ui.setTicketCaisse(null)
        } catch (_error) {
            try { printWindow.close() } catch { /* ignore */ }
            gooeyToast.error(t('facturation:messages.proforma_error'))
        } finally {
            setLoading(false)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cart.lignesFacture, clientsHook, totals, ui, setLoading])

    const handleBonDeLivraison = useCallback(async () => {
        if (cart.lignesFacture.length === 0) {
            gooeyToast.error(t('facturation:messages.cart_empty'))
            return
        }
        if (ui.isModificationMode && ui.modificationInvoiceId) {
            const w = window.open(`/app/print-invoice/${ui.modificationInvoiceId}?type=BL`, '_blank')
            if (!w) gooeyToast.error(t('common:popup_blocked'))
            return
        }

        setLoading(true)

        // Ouvrir le popup AVANT les appels async pour conserver le contexte du clic utilisateur.
        let printWindow: Window | null = null
        try {
            printWindow = window.open('about:blank', '_blank')
        } catch { /* ignore */ }
        if (!printWindow) {
            gooeyToast.error(t('common:popup_blocked'))
            setLoading(false)
            return
        }

        try {
            const facturePayload = {
                client: clientsHook.selectedClient || null,
                client_name_override: clientsHook.manualClientName || null,
                ayant_droit: clientsHook.selectedAyantDroit || null,
                status: 'PROF',
                remise: Number(ui.remiseGlobale) || 0,
                notes: "Généré via Bon de Livraison"
            }

            const res = await api.post('factures/', facturePayload)
            const createdFacture = res.data

            const produitsPayload = cart.lignesFacture.map((ligne: LigneFacture) => {
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
                    lot_allocations: ligne.lotAllocations && ligne.lotAllocations.length > 0
                        ? ligne.lotAllocations.map(a => ({
                            lot_id: Number(a.lotId),
                            quantity: Number(a.quantity),
                            selling_price: a.sellingPrice ? Number(a.sellingPrice) : undefined,
                        }))
                        : undefined,
                }
            })

            await Promise.all(produitsPayload.map(payload =>
                api.post('facture-produits/', payload)
            ))

            printWindow.location.href = `/app/print-invoice/${createdFacture.id}?type=BL`
            printWindow.focus?.()

            ui.setModificationInvoiceId(createdFacture.id)
            ui.setModificationInvoiceStatus('PROF')
            ui.setIsModificationMode(true)

            gooeyToast.success(t('facturation:messages.delivery_note_success'))
        } catch (error) {
            try { printWindow.close() } catch { /* ignore */ }
            gooeyToast.error(t('facturation:messages.delivery_note_error', { error: error instanceof Error ? error.message : t('common:messages.error_generic') }))
        } finally {
            setLoading(false)
        }
    }, [cart.lignesFacture, clientsHook, ui, setLoading, t])

    const handleImprimerFacture = useCallback(async (facture: Facture) => {
        if (!facture) {
            setError(t('facturation:messages.no_invoice_to_print'));
            return;
        }
        try {
            if (facture.id) {
                const w = window.open(`/app/print-invoice/${facture.id}`, '_blank')
                if (!w) setError(t('common:popup_blocked'))
            }
        } catch (err) {
            setError(getApiErrorDetail(err, t('facturation:messages.print_error')))
        }
    }, [setError, t])

    const handleConfirmPrintClientName = useCallback(async (clientNameInput: string) => {
        if (!pendingPrintFacture) return;

        // Ouvrir le popup AVANT l'appel API pour conserver le contexte du clic utilisateur.
        let printWindow: Window | null = null;
        try {
            printWindow = window.open('about:blank', '_blank');
        } catch { /* ignore */ }
        if (!printWindow) {
            gooeyToast.error(t('common:popup_blocked'));
            setShowClientNameModal(false);
            setPendingPrintFacture(null);
            setTimeout(() => searchInputRef.current?.focus(), 100);
            return;
        }

        try {
            await api.patch(`factures/${pendingPrintFacture.id}/`,
                { client_name_override: clientNameInput }
            );
            gooeyToast.success(t('facturation:messages.client_name_updated', { defaultValue: 'Nom du client mis à jour' }));
            let url = `/app/print-invoice/${pendingPrintFacture.id}`;
            if (clientNameInput) url += `?client_name=${encodeURIComponent(clientNameInput)}`;
            printWindow.location.href = url;
            printWindow.focus?.();
        } catch (err) {
            try { printWindow.close(); } catch { /* ignore */ }
            gooeyToast.error(getApiErrorDetail(err, t('facturation:messages.client_name_update_error')));
        } finally {
            setShowClientNameModal(false);
            setPendingPrintFacture(null);
            setTimeout(() => searchInputRef.current?.focus(), 100);
        }
    }, [pendingPrintFacture, setShowClientNameModal, setPendingPrintFacture, searchInputRef, t])

    const ouvrirModalPaiement = useCallback((facture?: Facture) => {
        // Bloquer si aucun poste de vente actif pour l'utilisateur courant
        if (!myActivePoste) {
            setError(t('facturation:messages.no_cash_register_open'))
            return
        }
        if (facture) {
            ui.setMontantPaye(Math.round(Number(facture.total_ttc)).toString())
            ui.openPaymentModal(facture)
        } else {
            if (!clientsHook.selectedClient) {
                setError(t('facturation:messages.select_client'))
                return
            }
            if (cart.lignesFacture.length === 0) {
                setError(t('facturation:messages.add_product'))
                return
            }
            const montantInitial = totals.tauxCouverture > 0 ? totals.partPatient : totals.totalTtc
            ui.setMontantPaye(Math.round(montantInitial).toString())
            ui.openPaymentModal()
        }
        ui.setModePaiement('especes')
        ui.setReference('')
        ui.setPaiements([])
        setTimeout(() => {
            paymentInputRef.current?.focus()
            paymentInputRef.current?.select()
        }, 100)
    }, [ui, clientsHook.selectedClient, cart.lignesFacture.length, totals.totalTtc, totals.tauxCouverture, totals.partPatient, setError, paymentInputRef, myActivePoste, t])

    const handleSendWhatsApp = useCallback(async () => {
        if (!ui.ticketCaisse || !ui.ticketCaisse.facture || typeof ui.ticketCaisse.facture === 'number') return
        const facture = ui.ticketCaisse.facture as unknown as { id: number; client: number | { phone?: string }; client_phone?: string }
        const clientPhone = (typeof facture.client === 'object' ? facture.client?.phone : '') || facture.client_phone
        const phone = window.prompt(t('facturation.messages.enter_whatsapp_number') || 'Entrez le numéro WhatsApp', clientPhone || '')
        if (!phone) return

        setLoading(true)
        try {
            const response = await api.post(`factures/${facture.id}/send_whatsapp/`, { phone: phone })
            gooeyToast.success(response.data.detail || t('facturation:messages.whatsapp_sent'))
        } catch (err) {
            gooeyToast.error(getApiErrorDetail(err, t('facturation:messages.whatsapp_send_error')))
        } finally {
            setLoading(false)
        }
    }, [ui.ticketCaisse, t, setLoading])

    const handleOrdonnanceSave = useCallback(async (data: OrdonnanceData) => {
        setLoading(true);
        try {
            const lignesForBackend = data.lignes.map((ligne) => ({
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
            await api.post('ordonnancier/', payload);
            gooeyToast.success(t('prescriptions:messages.save_success'));
            ui.setShowOrdonnanceModal(false);
            ui.setPendingOrdonnanceFacture(null);
        } catch (err) {
            gooeyToast.error(t('prescriptions:messages.save_error') + ": " + getApiErrorDetail(err, err instanceof Error ? err.message : t('common:messages.error_generic')));
        } finally {
            setLoading(false);
        }
    }, [ui, t, setLoading])

    const handleQuantityShortcut = useCallback((qty: number) => {
        if (cart.lignesFacture.length > 0) {
            const lastLine = cart.lignesFacture[cart.lignesFacture.length - 1];
            secureUpdateQuantite(lastLine.produit.id, qty);
            gooeyToast.success(t('facturation:messages.quantity_updated', { qty, product: lastLine.produit.name }));
        } else {
            gooeyToast.error(t('facturation:messages.quantity_cart_empty'));
        }
    }, [cart.lignesFacture, secureUpdateQuantite, t])

    const handleLotSelect = useCallback((allocations: LotAllocation[] | null) => {
        const product = ui.lotModal.product;
        if (!product) return
        cart.setLignesFacture(
            cart.lignesFacture.map((l) => {
                if (l.produit.id === product.id) {
                    if (!allocations || allocations.length === 0) {
                        return {
                            ...l,
                            lotId: null,
                            lotText: null,
                            lotExpiration: null,
                            lotSellingPrice: null,
                            lotAllocations: null,
                        }
                    }
                    if (allocations.length === 1) {
                        const alloc = allocations[0]
                        return {
                            ...l,
                            lotId: String(alloc.lotId),
                            lotText: alloc.lotText,
                            lotExpiration: alloc.lotExpiration || null,
                            lotSellingPrice: alloc.sellingPrice || null,
                            lotAllocations: allocations,
                        }
                    }
                    return {
                        ...l,
                        lotId: null,
                        lotText: `${allocations.length} lots`,
                        lotExpiration: null,
                        lotSellingPrice: null,
                        lotAllocations: allocations,
                    }
                }
                return l
            })
        )
        ui.closeLotModal()
        setTimeout(() => searchInputRef.current?.focus(), 100)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ui.lotModal.product, cart, ui.closeLotModal, searchInputRef])

    const _resetSaleDataOnly = useCallback(() => {
        cart.setLignesFacture([])
        clientsHook.setClientSearch('')
        clientsHook.setManualClientName('')
        clientsHook.setSelectedClient(null)
        const clientsDivers = clientsHook.clients.find((c: Client) => c.name.toLowerCase() === 'clients divers')
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

        if (user?.id) {
            safeStorage.removeItem(`activeCartLignes_${user.id}`, 'local')
            safeStorage.removeItem(`activeSaleContext_${user.id}`, 'local')
        }

        // Auto-focus search input for next sale
        setTimeout(() => {
            if (searchInputRef.current) {
                searchInputRef.current.focus()
                searchInputRef.current.select()
            }
        }, 150)
    }, [cart, clientsHook, ui, productSearch, user, searchInputRef])

    const _resetSale = useCallback(() => {
        _resetSaleDataOnly()
    }, [_resetSaleDataOnly])

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
            ? clientsHook.clients.find((c: Client) => c.id === clientsHook.selectedClient)?.name || ''
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
            vendeurId: user?.id ?? null,
            vendeurName: user?.username || (user ? String(user.id) : ''),
            lignes: cart.lignesFacture,
            remise: ui.remiseGlobale,
            remiseMode: ui.remiseMode,
            ayantDroit: ayantDroitData
        })
        _resetSale()
        gooeyToast.success(t('facturation:messages.pending_sale_success'))
    }, [cart.lignesFacture, clientsHook, pendingSales, ui, setError, _resetSale, t])

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

    const restaurerVente = useCallback(async (id: number) => {
        const vente = pendingSales.ventesEnAttente.find((v) => v.id === id)
        if (!vente) return
        if (cart.lignesFacture.length > 0) {
            const ok = await confirm({
                title: t('facturation:pending.replace_title', { defaultValue: 'Remplacer le panier ?' }),
                message: t('facturation:pending.replace_message', { defaultValue: 'Le panier actuel n\'est pas vide. Voulez-vous le remplacer par la vente en attente ?' }),
                confirmText: t('common:confirm', { defaultValue: 'Confirmer' }),
                cancelText: t('common:cancel', { defaultValue: 'Annuler' }),
                variant: 'warning',
            })
            if (!ok) return
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
        gooeyToast.success(t('facturation:messages.save_success'))
    }, [pendingSales, cart, clientsHook, ui, t, confirm])

    const supprimerVenteEnAttente = useCallback((id: number) => {
        ui.setConfirmModal({
            isOpen: true,
            message: "Voulez-vous vraiment supprimer cette vente en attente ?",
            onConfirm: () => {
                pendingSales.deletePendingSale(id);
                ui.setConfirmModal(null);
                gooeyToast.success(t('facturation:messages.pending_sale_deleted'));
            }
        });
    }, [ui, pendingSales, t])

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
