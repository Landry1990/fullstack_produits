import { useState, useCallback, useMemo } from 'react'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import type { ProduitModel, LigneFacture } from '../types'
import { normalizeNumberInput } from '../utils/formatters'
import { useAuth } from '../context/AuthContext'

interface UseCartOptions {
    apiBaseUrl?: string
    onRequirePrescription?: () => void
    quantityInputsRef?: React.MutableRefObject<Map<number, HTMLInputElement>>
}

export function useCart({ apiBaseUrl = '', onRequirePrescription, quantityInputsRef }: UseCartOptions = {}) {
    const { user } = useAuth()
    const [lignesFacture, setLignesFacture] = useState<LigneFacture[]>([])
    const [loading, setLoading] = useState(false)

    // Calculate line total helper
    const calculateLigneTotal = useCallback((quantite: number, prixUnitaire: string, remiseProduit: string): number => {
        const qty = quantite
        const prix = normalizeNumberInput(prixUnitaire, { min: 0 })
        const remise = normalizeNumberInput(remiseProduit, { min: 0, max: 100 })
        const sousTotal = qty * prix
        const montantRemise = Math.abs(sousTotal) * (remise / 100)
        // If quantity is negative (return), discount must also be subtracted for net credit
        return sousTotal - (sousTotal < 0 ? -montantRemise : montantRemise)
    }, [])

    const addProduit = useCallback(async (produit: ProduitModel, options?: { isRetrocession?: boolean }) => {
        setLoading(true)
        try {
            const produitsEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/produits/` : '/api/produits/'
            const { data: fullProduit } = await axios.get<ProduitModel>(`${produitsEndpoint}${produit.id}/`)

            setLignesFacture(prevLignes => {
                const existingLigne = prevLignes.find(ligne => ligne.produit.id === fullProduit.id)

                if (existingLigne) {
                    const nouvelleQuantite = existingLigne.quantite + 1
                    return prevLignes.map(ligne =>
                        ligne.produit.id === fullProduit.id
                            ? {
                                ...ligne,
                                quantite: nouvelleQuantite,
                                total_ligne: calculateLigneTotal(nouvelleQuantite, ligne.prix_unitaire, ligne.remise_produit),
                            }
                            : ligne
                    )
                } else {
                    let basePrice = fullProduit.selling_price ?? '0'

                    if (options?.isRetrocession) {
                        // Rétrocession: Use Last Purchase Price (Best) -> Cost Price (Fallback) -> Selling Price
                        const price = fullProduit.last_purchase_price
                            ? fullProduit.last_purchase_price
                            : fullProduit.cost_price ?? '0'
                        basePrice = price
                    }

                    const prixUnitaire = normalizeNumberInput(basePrice, { min: 0 })
                    const nouvelleLigne: LigneFacture = {
                        produit: fullProduit,
                        quantite: 1,
                        prix_unitaire: prixUnitaire.toString(),
                        remise_produit: '0',
                        total_ligne: prixUnitaire,
                        lotId: null, // Default to Auto/FEFO
                        lotText: null,
                        lotExpiration: null
                    }

                    // Focus logic
                    setTimeout(() => {
                        if (quantityInputsRef?.current) {
                            const qtyInput = quantityInputsRef.current.get(fullProduit.id)
                            if (qtyInput) {
                                qtyInput.focus()
                                qtyInput.select()
                            }
                        }
                    }, 50)

                    return [...prevLignes, nouvelleLigne]
                }
            })

            // ORDONNANCIER CHECK
            const requiresOrdonnance = fullProduit.requires_prescription ||
                (fullProduit.surveillance_category && fullProduit.surveillance_category !== 'NONE')

            if (requiresOrdonnance && onRequirePrescription) {
                onRequirePrescription()
                toast('Produit sous ordonnance/surveillance détecté', { icon: '📋' })
            }

        } catch (err) {
            console.error('Erreur lors du chargement des détails du produit:', err)
            toast.error('Impossible de charger les détails complets du produit')
        } finally {
            setLoading(false)
        }
    }, [apiBaseUrl, calculateLigneTotal, onRequirePrescription, quantityInputsRef])

    const updateQuantite = useCallback((produitId: number, quantite: number, callback?: (err: string) => void) => {
        // Permettre les quantités négatives (retours) et positives (ventes)
        const normalizedQuantite = Math.floor(normalizeNumberInput(quantite))
        const finalQuantite = normalizedQuantite === 0 ? 1 : normalizedQuantite

        // Vérifier les permissions pour les retours (quantité négative)
        if (finalQuantite < 0 && !user?.can_do_returns) {
            const msg = "Vous n'avez pas la permission d'effectuer des retours (quantités négatives)."
            toast.error(msg)
            if (callback) callback(msg)
            return
        }

        setLignesFacture(prevLignes => prevLignes.map(ligne =>
            ligne.produit.id === produitId
                ? {
                    ...ligne,
                    quantite: finalQuantite,
                    total_ligne: calculateLigneTotal(finalQuantite, ligne.prix_unitaire, ligne.remise_produit),
                    // Clear promis if stock is sufficient (logic simplified here, mostly clearing old promis state)
                    isPromis: undefined,
                    promisQuantity: undefined,
                    promisPhone: undefined
                }
                : ligne
        ))
    }, [calculateLigneTotal, user?.can_do_returns])

    const updatePrix = useCallback((produitId: number, prix: string) => {
        setLignesFacture(prevLignes => prevLignes.map(ligne =>
            ligne.produit.id === produitId
                ? { ...ligne, prix_unitaire: prix, total_ligne: calculateLigneTotal(ligne.quantite, prix, ligne.remise_produit) }
                : ligne
        ))
    }, [calculateLigneTotal])

    const updateRemiseProduit = useCallback((produitId: number, remise: string) => {
        setLignesFacture(prevLignes => prevLignes.map(ligne =>
            ligne.produit.id === produitId
                ? { ...ligne, remise_produit: remise, total_ligne: calculateLigneTotal(ligne.quantite, ligne.prix_unitaire, remise) }
                : ligne
        ))
    }, [calculateLigneTotal])

    const updateLineLot = useCallback((produitId: number, lot: any | null) => {
        setLignesFacture(prevLignes => prevLignes.map(ligne =>
            ligne.produit.id === produitId
                ? {
                    ...ligne,
                    lotId: lot ? String(lot.id) : null,
                    lotText: lot ? lot.lot : null,
                    lotExpiration: lot?.date_expiration || null,
                    // Update price if lot has a specific selling price
                    prix_unitaire: (lot && lot.selling_price !== null && lot.selling_price !== undefined)
                        ? String(lot.selling_price)
                        : ligne.prix_unitaire,
                    // Recalculate total with new price
                    total_ligne: calculateLigneTotal(
                        ligne.quantite,
                        (lot && lot.selling_price !== null && lot.selling_price !== undefined)
                            ? String(lot.selling_price)
                            : ligne.prix_unitaire,
                        ligne.remise_produit
                    )
                }
                : ligne
        ))
    }, [calculateLigneTotal])

    const removeLigne = useCallback((produitId: number) => {
        setLignesFacture(prev => prev.filter(ligne => ligne.produit.id !== produitId))
    }, [])

    const clearCart = useCallback(() => {
        setLignesFacture([])
    }, [])

    const cartStats = useMemo(() => {
        const totalLines = lignesFacture.length
        const totalQty = lignesFacture.reduce((acc, l) => acc + l.quantite, 0)

        let totalTTC = 0  // Sum of line totals (TTC because selling_price includes TVA)
        let totalTva = 0  // Extracted TVA amount
        let totalHT = 0   // HT = TTC - TVA

        lignesFacture.forEach(ligne => {
            const valeurLigneTTC = typeof ligne.total_ligne === 'number' ? ligne.total_ligne : Number(ligne.total_ligne)
            const ligneTTC = Number.isFinite(valeurLigneTTC) ? valeurLigneTTC : 0
            totalTTC += ligneTTC

            // Per-line TVA extraction from TTC (selling prices include TVA)
            const tauxTva = normalizeNumberInput(ligne.produit.tva ?? 0, { min: 0, max: 100 })
            if (tauxTva > 0) {
                // TTC = HT * (1 + taux/100), so HT = TTC / (1 + taux/100)
                const ligneHT = ligneTTC / (1 + tauxTva / 100)
                const ligneTvaAmount = ligneTTC - ligneHT
                totalTva += ligneTvaAmount
                totalHT += ligneHT
            } else {
                totalHT += ligneTTC // No TVA, HT = TTC
            }
        })

        return { totalLines, totalQty, sousTotal: totalHT, totalTva, totalTTC }
    }, [lignesFacture])

    return {
        lignesFacture,
        setLignesFacture, // Exposed for special cases (like restoring cart)
        addProduit,
        updateQuantite,
        updatePrix,
        updateRemiseProduit,
        updateLineLot,
        removeLigne,
        clearCart,
        cartStats,
        loading
    }
}
