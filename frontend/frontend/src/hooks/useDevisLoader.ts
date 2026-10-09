import { useEffect, useRef } from 'react'
import api from '../services/api'
import { gooeyToast } from 'goey-toast'
import { useTranslation } from 'react-i18next'
import { safeStorage } from '../utils/storage'
import { generateUUID } from '../utils/uuid'
import type { ProduitModel, Facture, FactureProduit, LigneFacture, StockLot } from '../types'

interface DevisProduit extends FactureProduit {
    stock_lot?: number | string | null
}

export interface UseDevisLoaderOptions {
    clientsHook: {
        setSelectedClient: (id: number | null) => void
        setUseManualClient: (v: boolean) => void
        setManualClientName: (name: string) => void
        setSelectedAyantDroit: (id: number | null) => void
    }
    cart: {
        setLignesFacture: (lignes: LigneFacture[]) => void
    }
    ui: {
        setRemiseGlobale: (v: string) => void
        setRemiseMode: (v: 'montant' | 'taux') => void
        setIsModificationMode: (v: boolean) => void
        setModificationInvoiceId: (v: number | null) => void
        setModificationInvoiceStatus: (v: string | null) => void
        setOriginalTotalTtc: (v: number) => void
        setIsAvoirClient?: (v: boolean) => void
    }
    /**
     * N'hydrater qu'une fois le poste de vente actif : quand le modal forcé
     * « Ouvrir un point de vente » est affiché, le flux d'ouverture remet à
     * plat l'écran et effacerait un panier hydraté trop tôt. Sans poste
     * actif, `devis_to_load` reste en stockage → re-proposé ensuite.
     */
    isPosteActive?: boolean
}

export function useDevisLoader({ clientsHook, cart, ui, isPosteActive = true }: UseDevisLoaderOptions) {
    const { t } = useTranslation('facturation')
    const hasLoadedDevisRef = useRef(false)

    useEffect(() => {
        const loadDevis = async () => {
            if (!isPosteActive) return
            if (hasLoadedDevisRef.current) return
            const devisString = safeStorage.getItem('devis_to_load', 'local')
            if (!devisString) return
            try {
                hasLoadedDevisRef.current = true
                const devis = JSON.parse(devisString) as Facture

                if (devis.client) {
                    clientsHook.setSelectedClient(devis.client)
                    clientsHook.setUseManualClient(false)
                    if (devis.ayant_droit) clientsHook.setSelectedAyantDroit(devis.ayant_droit)
                } else if (devis.client_name_override) {
                    clientsHook.setUseManualClient(true)
                    clientsHook.setManualClientName(devis.client_name_override)
                }

                const isDevis = devis.status === 'PROF' || devis.status === 'PROFORMA'

                if (devis.produits && devis.produits.length > 0) {
                    const devisProduits = devis.produits as DevisProduit[]
                    const missingIds = devisProduits
                        .filter((p) => !(typeof p.produit === 'object' && p.produit.stock !== undefined))
                        .map((p) => typeof p.produit === 'object' ? p.produit.id : p.produit)

                    const productMap = new Map<number, ProduitModel>()
                    if (missingIds.length > 0) {
                        try {
                            const { data: fullProducts } = await api.post<ProduitModel[]>('produits/bulk-detail/', { ids: missingIds })
                            fullProducts.forEach((prod) => productMap.set(prod.id, prod))
                        } catch { /* fallback individuel géré ci-dessous */ }
                    }

                    // Un devis ne gère pas les lots (pas de déstockage à la
                    // création) : le lot sera choisi ou alloué en FEFO à la
                    // conversion. La restauration ne concerne que le rappel
                    // d'une facture VALIDÉE — son stock est restitué puis
                    // revalidé, le lot d'origine est restauré s'il est encore
                    // disponible (sinon AUTO, au lieu d'échouer sur
                    // « lot insuffisant »).
                    const todayStr = new Date().toISOString().slice(0, 10)
                    const lotsById = new Map<number, StockLot>()
                    if (!isDevis) {
                        const collectLots = (prod: ProduitModel | null | undefined) => {
                            prod?.stock_lots?.forEach((l) => { if (l?.id) lotsById.set(Number(l.id), l) })
                        }
                        productMap.forEach(collectLots)
                        devisProduits.forEach((p) => {
                            if (typeof p.produit === 'object') collectLots(p.produit as ProduitModel)
                        })

                        const pidsToFetch = new Set<number>()
                        devisProduits.forEach((p) => {
                            if (!p.stock_lot || lotsById.has(Number(p.stock_lot))) return
                            const pid = typeof p.produit === 'object' ? p.produit.id : p.produit
                            if (pid) pidsToFetch.add(pid)
                        })
                        if (pidsToFetch.size > 0) {
                            await Promise.all([...pidsToFetch].map(async (pid) => {
                                try {
                                    const { data } = await api.get('stock-lots/', { params: { produit: pid } })
                                    const lots: StockLot[] = Array.isArray(data) ? data : data.results || []
                                    lots.forEach((l) => { if (l?.id) lotsById.set(Number(l.id), l) })
                                } catch { /* lot considéré indisponible */ }
                            }))
                        }
                    }

                    const droppedLots: string[] = []
                    const lignes: LigneFacture[] = devisProduits.map((p) => {
                        let produitData: ProduitModel
                        if (typeof p.produit === 'object' && p.produit.stock !== undefined) {
                            produitData = p.produit
                        } else {
                            const produitId = typeof p.produit === 'object' ? p.produit.id : p.produit
                            produitData = productMap.get(produitId) || { id: produitId, name: p.produit_nom || t('messages.product_fallback_name', { id: produitId }), stock: 0, is_deleted: true } as ProduitModel
                        }
                        const stockLotId = !isDevis && p.stock_lot ? Number(p.stock_lot) : null
                        const storedLot = stockLotId ? lotsById.get(stockLotId) : null
                        const lotAvailable = storedLot != null
                            && storedLot.quantity_remaining >= p.quantity
                            && (!storedLot.date_expiration || storedLot.date_expiration >= todayStr)
                        if (stockLotId && !lotAvailable) {
                            droppedLots.push(p.lot || `#${stockLotId}`)
                        }
                        return {
                            lineId: generateUUID(),
                            produit: produitData,
                            quantite: p.quantity,
                            prix_unitaire: p.selling_price,
                            remise_produit: '0',
                            total_ligne: p.quantity * Number(p.selling_price),
                            lotId: lotAvailable ? String(stockLotId) : null,
                            lotText: lotAvailable ? (p.lot || null) : null,
                            lotExpiration: lotAvailable ? (p.date_expiration || null) : null,
                            lotSellingPrice: p.selling_price || null,
                            treatment_duration_days: p.treatment_duration_days
                        }
                    })
                    cart.setLignesFacture(lignes)
                    if (droppedLots.length > 0) {
                        gooeyToast.info(t('messages.devis_lots_unavailable', { lots: droppedLots.join(', ') }))
                    }
                }

                if (devis.remise) {
                    ui.setRemiseGlobale(devis.remise)
                    ui.setRemiseMode('montant')
                }

                if (devis.is_avoir_client && ui.setIsAvoirClient) {
                    ui.setIsAvoirClient(devis.is_avoir_client)
                }

                const isValidatedOrPaid = devis.status === 'VAL' || devis.status === 'PAY'
                if ((isDevis || isValidatedOrPaid) && devis.id) {
                    ui.setIsModificationMode(true)
                    ui.setModificationInvoiceId(devis.id)
                    ui.setModificationInvoiceStatus(devis.status || null)
                    ui.setOriginalTotalTtc(Number(devis.total_ttc || 0))
                    if (isDevis) {
                        gooeyToast.success(t('messages.devis_loaded_for_edit', { num: devis.numero_facture || devis.id }))
                    } else {
                        gooeyToast.success(t('messages.invoice_loaded_for_edit', { num: devis.numero_facture || devis.id }))
                    }
                } else if (devis.id) {
                    gooeyToast.success(t('messages.devis_loaded', { num: devis.numero_facture || devis.id }))
                } else {
                    gooeyToast.success(t('messages.cart_prefilled_from_copy'))
                }
                safeStorage.removeItem('devis_to_load', 'local')
            } catch {
                gooeyToast.error(t('messages.devis_load_error'))
                safeStorage.removeItem('devis_to_load', 'local')
            }
        }
        loadDevis()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPosteActive])
}
