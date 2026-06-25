import { useEffect, useRef } from 'react'
import api from '../services/api'
import { toast } from 'react-hot-toast'
import { safeStorage } from '../utils/storage'
import type { ProduitModel, Facture, LigneFacture } from '../types'

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
}

export function useDevisLoader({ clientsHook, cart, ui }: UseDevisLoaderOptions) {
    const hasLoadedDevisRef = useRef(false)

    useEffect(() => {
        const loadDevis = async () => {
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

                if (devis.produits && devis.produits.length > 0) {
                    const lignes: LigneFacture[] = await Promise.all(devis.produits.map(async (p: any) => {
                        let produitData: ProduitModel
                        if (typeof p.produit === 'object' && p.produit.stock !== undefined) {
                            produitData = p.produit
                        } else {
                            const produitId = typeof p.produit === 'object' ? p.produit.id : p.produit
                            try {
                                const { data: fullProduct } = await api.get<ProduitModel>(`produits/${produitId}/`)
                                produitData = fullProduct
                            } catch {
                                produitData = { id: produitId, name: p.produit_nom || `Produit #${produitId}`, stock: 0, is_deleted: true } as ProduitModel
                            }
                        }
                        return {
                            produit: produitData,
                            quantite: p.quantity,
                            prix_unitaire: p.selling_price,
                            remise_produit: '0',
                            total_ligne: p.quantity * Number(p.selling_price),
                            lotId: p.lot || null,
                            lotText: p.lot || null,
                            lotExpiration: p.date_expiration || null
                        }
                    }))
                    cart.setLignesFacture(lignes)
                }

                if (devis.remise) {
                    ui.setRemiseGlobale(devis.remise)
                    ui.setRemiseMode('montant')
                }

                if (devis.is_avoir_client && ui.setIsAvoirClient) {
                    ui.setIsAvoirClient(devis.is_avoir_client)
                }

                const isValidatedOrPaid = devis.status === 'VAL' || devis.status === 'PAY'
                if (isValidatedOrPaid && devis.id) {
                    ui.setIsModificationMode(true)
                    ui.setModificationInvoiceId(devis.id)
                    ui.setModificationInvoiceStatus(devis.status || null)
                    ui.setOriginalTotalTtc(Number(devis.total_ttc || 0))
                    toast.success(`Facture #${devis.numero_facture || devis.id} chargée en mode modification`)
                } else if (devis.id) {
                    toast.success(`Devis #${devis.numero_facture || devis.id} chargé`)
                } else {
                    toast.success(`Panier pré-rempli à partir de la copie`)
                }
                safeStorage.removeItem('devis_to_load', 'local')
            } catch (err) {
                toast.error('Impossible de charger le devis')
                safeStorage.removeItem('devis_to_load', 'local')
            }
        }
        loadDevis()
    }, [])
}
