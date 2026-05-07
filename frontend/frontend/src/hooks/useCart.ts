import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import api from '../services/api'
import { toast } from 'react-hot-toast'
import type { ProduitModel, LigneFacture, StockLot } from '../types'
import { normalizeNumberInput } from '../utils/formatters'
import { calculateLineTotal, calculateCartStats } from '../utils/finance'
import { useAuth } from '../context/AuthContext'
import { differenceInDays, parseISO } from 'date-fns'
import { showExpirationToast } from '../utils/toastUtils'
import { safeStorage } from '../utils/storage'

interface UseCartOptions {
    apiBaseUrl?: string
    onRequirePrescription?: () => void
    onAlert?: (msg: string, title: string, type: 'product' | 'client', is_blocking: boolean, targetId?: number) => void
    quantityInputsRef?: React.MutableRefObject<Map<number, HTMLInputElement>>
}

export function useCart({ onRequirePrescription, onAlert, quantityInputsRef }: UseCartOptions = {}) {
    const { user } = useAuth()
    
    // Logic keys (prefixed with user ID for multi-user safety)
    const cartStorageKey = useMemo(() => user?.id ? `activeCartLignes_${user.id}` : null, [user?.id])

    const [lignesFacture, setLignesFacture] = useState<LigneFacture[]>([])
    const [loading, setLoading] = useState(false)
    const hasHydratedRef = useRef(false)

    // 1. Hydrate from localStorage when user becomes available
    useEffect(() => {
        if (cartStorageKey && !hasHydratedRef.current) {
            try {
                const saved = safeStorage.getItem(cartStorageKey, 'local')
                if (saved) {
                    setLignesFacture(JSON.parse(saved))
                }
                hasHydratedRef.current = true
            } catch (err) {
                console.error("Failed to hydrate cart:", err)
            }
            
            // Cleanup: remove old global key if it exists
            safeStorage.removeItem('activeCartLignes', 'local')
        }
    }, [cartStorageKey])

    // 2. Persist to localStorage on change (debounced implicitly by render cycle)
    useEffect(() => {
        if (!cartStorageKey || !hasHydratedRef.current) return

        if (lignesFacture.length > 0) {
            safeStorage.setItem(cartStorageKey, JSON.stringify(lignesFacture), 'local')
        } else {
            safeStorage.removeItem(cartStorageKey, 'local')
        }
    }, [lignesFacture, cartStorageKey])

    const addProduit = useCallback(async (produit: ProduitModel, options?: { isRetrocession?: boolean; preventFocus?: boolean; markupPercentage?: number }) => {
        setLoading(true)
        try {
            const { data: fullProduit } = await api.get<ProduitModel>(`produits/${produit.id}/`)

            setLignesFacture(prevLignes => {
                // REDUNDANCY / INTERACTION CHECK
                if (fullProduit.famille_risque) {
                    const conflict = prevLignes.find(l =>
                        l.produit.id !== fullProduit.id && // Don't warn for itself (redundancy of quantity is fine)
                        l.produit.famille_risque === fullProduit.famille_risque
                    )

                    if (conflict) {
                        // Trigger toast outside of render cycle
                        setTimeout(() => {
                            toast.error(
                                `⚠️ Interaction / Redondance\n${fullProduit.name} est de la même famille (${fullProduit.famille_risque_nom}) que ${conflict.produit.name} déjà présent.`,
                                {
                                    duration: 6000,
                                    position: 'top-center',
                                    style: { border: '2px solid #fbbd23', background: '#fff', color: '#333', maxWidth: '400px' },
                                    icon: '⚠️'
                                }
                            )
                        }, 100)
                    }
                }

                const existingLigne = prevLignes.find(ligne => ligne.produit.id === fullProduit.id)

                if (existingLigne) {
                    const nouvelleQuantite = existingLigne.quantite + 1
                    return prevLignes.map(ligne =>
                        ligne.produit.id === fullProduit.id
                            ? {
                                ...ligne,
                                produit: fullProduit, // Update product with fresh data (stock, prices, etc.)
                                quantite: nouvelleQuantite,
                                total_ligne: calculateLineTotal(nouvelleQuantite, ligne.prix_unitaire, ligne.remise_produit),
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
                        basePrice = price.toString()
                    }

                    let basePriceValue = Number(basePrice)
                    if (options?.markupPercentage && options.markupPercentage > 0) {
                        basePriceValue = basePriceValue * (1 + options.markupPercentage / 100)
                    }

                    const prixUnitaire = normalizeNumberInput(basePriceValue, { min: 0 })
                    const nouvelleLigne: LigneFacture = {
                        produit: fullProduit,
                        quantite: 1,
                        prix_unitaire: prixUnitaire.toString(),
                        remise_produit: '0',
                        total_ligne: prixUnitaire,
                        lotId: null, // Default to Auto/FEFO
                        lotText: null,
                        lotExpiration: null,
                        treatment_duration_days: fullProduit.is_chronic ? fullProduit.default_treatment_days : undefined
                    }

                    // Focus logic moved to after ALERT check to avoid stealing focus from the modal.
                    // This prevents typing implicitly behind the modal.
                    
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

            // CHECKOUT ALERT MESSAGE CHECK
            let hasAlert = false;
            if (fullProduit.message_alerte && onAlert) {
                onAlert(fullProduit.message_alerte, fullProduit.name, 'product', !!fullProduit.blocking_alerte, fullProduit.id)
                hasAlert = true;
            }

            // Focus logic: only focus if there is NO alert. If there is an alert, 
            // the Acknowledge handler of the alert modal will do the focus to avoid stealing 
            // focus while the modal is open.
            if (!options?.preventFocus && !hasAlert) {
                setTimeout(() => {
                    if (quantityInputsRef?.current) {
                        const qtyInput = quantityInputsRef.current.get(fullProduit.id)
                        if (qtyInput) {
                            qtyInput.focus()
                            qtyInput.select()
                        }
                    }
                }, 50)
            }

            // PEREMPTION CHECK
            // Use calculated property from serializer (next_expiring_date) if available, fallback to expire_date
            const expirationToCheck = fullProduit.next_expiring_date || fullProduit.expire_date;





            if (expirationToCheck) {
                const daysUntilExpiration = differenceInDays(parseISO(expirationToCheck), new Date())
                showExpirationToast(daysUntilExpiration)
            }
        } catch (err) {
            console.error('Erreur lors du chargement des détails du produit:', err)
            toast.error('Impossible de charger les détails complets du produit')
        } finally {
            setLoading(false)
        }
    }, [onRequirePrescription, quantityInputsRef])

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
                    total_ligne: calculateLineTotal(finalQuantite, ligne.prix_unitaire, ligne.remise_produit),
                    // Clear promis if stock is sufficient (logic simplified here, mostly clearing old promis state)
                    isPromis: undefined,
                    promisQuantity: undefined,
                    promisPhone: undefined
                }
                : ligne
        ))
    }, [user?.can_do_returns])

    const updatePrix = useCallback((produitId: number, prix: string) => {
        setLignesFacture(prevLignes => prevLignes.map(ligne =>
            ligne.produit.id === produitId
                ? { ...ligne, prix_unitaire: prix, total_ligne: calculateLineTotal(ligne.quantite, prix, ligne.remise_produit) }
                : ligne
        ))
    }, [])

    const updateRemiseProduit = useCallback((produitId: number, remise: string) => {
        setLignesFacture(prevLignes => prevLignes.map(ligne =>
            ligne.produit.id === produitId
                ? { ...ligne, remise_produit: remise, total_ligne: calculateLineTotal(ligne.quantite, ligne.prix_unitaire, remise) }
                : ligne
        ))
    }, [calculateLineTotal])

    const updateLineLot = useCallback((produitId: number, lot: StockLot | null) => {
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
                    total_ligne: calculateLineTotal(
                        ligne.quantite,
                        (lot && lot.selling_price !== null && lot.selling_price !== undefined)
                            ? String(lot.selling_price)
                            : ligne.prix_unitaire,
                        ligne.remise_produit
                    )
                }
                : ligne
        ))
    }, [])

    const updateTreatmentDuration = useCallback((produitId: number, duration: number) => {
        setLignesFacture(prevLignes => prevLignes.map(ligne =>
            ligne.produit.id === produitId
                ? { ...ligne, treatment_duration_days: duration }
                : ligne
        ))
    }, [])

    const removeLigne = useCallback((produitId: number) => {
        setLignesFacture(prev => prev.filter(ligne => ligne.produit.id !== produitId))
    }, [])

    const clearCart = useCallback(() => {
        setLignesFacture([])
    }, [])

    const cartStats = useMemo(() => calculateCartStats(lignesFacture), [lignesFacture])

    const bulkAddProduits = useCallback((items: { product: ProduitModel, quantity: number, discountPercent?: string }[]) => {
        setLignesFacture(prevLignes => {
            const newLignes = [...prevLignes]
            items.forEach(({ product, quantity, discountPercent }) => {
                const existingIndex = newLignes.findIndex(l => l.produit.id === product.id)
                const remise = discountPercent || '0'
                const prixBase = product.selling_price || '0'

                if (existingIndex >= 0) {
                    const existing = newLignes[existingIndex]
                    const newQty = existing.quantite + quantity
                    // For bulk add, we might want to override remise if specified, or keep existing.
                    // Usually for a Pack, we want to apply the pack discount.
                    const finalRemise = discountPercent !== undefined ? remise : existing.remise_produit

                    newLignes[existingIndex] = {
                        ...existing,
                        produit: product,
                        quantite: newQty,
                        remise_produit: finalRemise,
                        total_ligne: calculateLineTotal(newQty, existing.prix_unitaire, finalRemise)
                    }
                } else {
                    newLignes.push({
                        produit: product,
                        quantite: quantity,
                        prix_unitaire: prixBase,
                        remise_produit: remise,
                        total_ligne: calculateLineTotal(quantity, prixBase, remise),
                        lotId: null,
                        lotText: null,
                        lotExpiration: null,
                        treatment_duration_days: product.is_chronic ? product.default_treatment_days : undefined
                    })
                }
            })
            return newLignes
        })
    }, [])

    const applyMarkupToCart = useCallback((percentage: number) => {
        setLignesFacture(prevLignes => prevLignes.map(ligne => {
            const basePrice = Number(ligne.produit.selling_price || 0)
            const markedUpPrice = basePrice * (1 + percentage / 100)
            const finalPrice = normalizeNumberInput(markedUpPrice, { min: 0 }).toString()
            
            return {
                ...ligne,
                prix_unitaire: finalPrice,
                total_ligne: calculateLineTotal(ligne.quantite, finalPrice, ligne.remise_produit)
            }
        }))
    }, [])

    return {
        lignesFacture,
        setLignesFacture,
        addProduit,
        applyMarkupToCart,
        bulkAddProduits,
        updateQuantite,
        updatePrix,
        updateRemiseProduit,
        updateLineLot,
        updateTreatmentDuration,
        removeLigne,
        clearCart,
        cartStats,
        loading
    }
}
