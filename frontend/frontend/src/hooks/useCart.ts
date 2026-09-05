import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../services/api'
import { gooeyToast } from 'goey-toast'
import type { ProduitModel, LigneFacture, StockLot, LotAllocation } from '../types'
import { normalizeNumberInput } from '../utils/formatters'
import { calculateLineTotal, calculateCartStats } from '../utils/finance'
import { useAuth } from '../context/AuthContext'
import { differenceInDays, parseISO } from 'date-fns'
import { showExpirationToast } from '../utils/toastUtils'
import { safeStorage } from '../utils/storage'
import { logger } from '../utils/logger'
import { sortLotsByFEFO } from '../utils/fefo'
import { generateUUID } from '../utils/uuid'
import { getLotPrice } from '../utils/lotPricing'

// --- Helpers purs pour la gestion des lots ---

/** Récupère les lots d'un produit et calcule les allocations FEFO + métadonnées */
async function fetchProductLots(produitId: number): Promise<{
    allocations: LotAllocation[] | null
    firstLotMaxQty: number
    needsLotModal: boolean
}> {
    try {
        const { data: lotsData } = await api.get<StockLot[]>('stock-lots/', {
            params: { produit: produitId, include_empty: 'false' },
        })
        const lots = Array.isArray(lotsData) ? lotsData : (lotsData.results || [])
        if (lots.length === 0) return { allocations: null, firstLotMaxQty: 0, needsLotModal: false }

        const sorted = sortLotsByFEFO(lots)
        const hasLotPrices = sorted.some(l => l.selling_price && Number(l.selling_price) > 0)
        if (!hasLotPrices) return { allocations: null, firstLotMaxQty: 0, needsLotModal: false }

        const allocations = sorted.map(lot => ({
            lotId: lot.id,
            lotText: lot.lot,
            lotExpiration: lot.date_expiration || null,
            quantity: 0,
            sellingPrice: lot.selling_price ?? null,
        }))
        const firstLotMaxQty = sorted[0].quantity_remaining ?? 0
        const needsLotModal = firstLotMaxQty < 1 && sorted.length > 1

        return { allocations, firstLotMaxQty, needsLotModal }
    } catch (err) {
        logger.error('Failed to fetch stock lots for auto-allocation:', err)
        return { allocations: null, firstLotMaxQty: 0, needsLotModal: false }
    }
}

/** Calcule le prix de base d'un produit selon les options (rétrocession, markup) */
function computeBasePrice(produit: ProduitModel, options?: { isRetrocession?: boolean; markupPercentage?: number }): string {
    let basePrice = produit.selling_price ?? '0'
    if (options?.isRetrocession) {
        const price = produit.last_purchase_price ? produit.last_purchase_price : produit.cost_price ?? '0'
        basePrice = price.toString()
    }
    let basePriceValue = Number(basePrice)
    if (options?.markupPercentage && options.markupPercentage > 0) {
        basePriceValue = basePriceValue * (1 + options.markupPercentage / 100)
    }
    return normalizeNumberInput(basePriceValue, { min: 0 }).toString()
}

/** Crée une LigneFacture avec lot associé */
function createLotLine(lineId: string, produit: ProduitModel, lot: LotAllocation, lotMaxQty: number): LigneFacture {
    const lotPrice = getLotPrice(lot.sellingPrice, produit.selling_price ?? '0')
    return {
        lineId,
        produit,
        quantite: 1,
        prix_unitaire: lotPrice,
        remise_produit: '0',
        total_ligne: calculateLineTotal(1, lotPrice, '0'),
        lotId: String(lot.lotId),
        lotText: lot.lotText,
        lotExpiration: lot.lotExpiration,
        lotSellingPrice: lot.sellingPrice || null,
        lotAllocations: [{ ...lot, quantity: 1 }],
        lotMaxQuantity: lotMaxQty,
        treatment_duration_days: produit.is_chronic ? produit.default_treatment_days : undefined,
    }
}

/** Crée une LigneFacture sans lot (prix global) */
function createPlainLine(lineId: string, produit: ProduitModel, prixUnitaire: string): LigneFacture {
    return {
        lineId,
        produit,
        quantite: 1,
        prix_unitaire: prixUnitaire,
        remise_produit: '0',
        total_ligne: Number(prixUnitaire),
        lotId: null,
        lotText: null,
        lotExpiration: null,
        lotSellingPrice: null,
        treatment_duration_days: produit.is_chronic ? produit.default_treatment_days : undefined,
    }
}

function playAddBeep() {
  try {
    const AudioCtx = (window.AudioContext || ((window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext))
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = 600
    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
    osc.start()
    osc.stop(ctx.currentTime + 0.1)
  } catch { /* ignore */ }
}

function triggerAddHaptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate(40) } catch { /* ignore */ }
  }
}

interface UseCartOptions {
    apiBaseUrl?: string
    onRequirePrescription?: () => void
    onAlert?: (msg: string, title: string, type: 'product' | 'client', is_blocking: boolean, targetId?: number) => void
    onSubstitution?: (produit: ProduitModel) => void
    onForceStock?: (produit: ProduitModel) => void
    onMultiLotDetected?: (produit: ProduitModel, lineId: string, quantity: number) => void
    onQuantityExceedsLot?: (produit: ProduitModel, lineId: string, quantity: number) => void
    quantityInputsRef?: React.MutableRefObject<Map<number, HTMLInputElement>>
}

export function useCart({ onRequirePrescription, onAlert, onSubstitution, onForceStock, onMultiLotDetected, onQuantityExceedsLot, quantityInputsRef }: UseCartOptions = {}) {
    const { t } = useTranslation(['facturation', 'prescriptions', 'common'])
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
                    // Use functional update to avoid overwriting data already set by useDevisLoader
                    setLignesFacture(prev => prev.length > 0 ? prev : JSON.parse(saved))
                }
                hasHydratedRef.current = true
            } catch (err) {
                logger.error("Failed to hydrate cart:", err)
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

    const addProduit = useCallback(async (produit: ProduitModel, options?: { isRetrocession?: boolean; preventFocus?: boolean; markupPercentage?: number; forceStock?: boolean }) => {
        setLoading(true)
        try {
            const { data: fullProduit } = await api.get<ProduitModel>(`produits/${produit.id}/`)

            // SUBSTITUTION CHECK: if product is out of stock, ask whether to force or substitute
            if (fullProduit.stock <= 0 && !options?.forceStock) {
                setLoading(false)
                if (onForceStock) {
                    onForceStock(fullProduit)
                } else if (onSubstitution) {
                    onSubstitution(fullProduit)
                }
                return undefined
            }

            // Récupérer les lots pour appliquer automatiquement le prix du lot (FEFO)
            const { allocations: autoAllocations, firstLotMaxQty, needsLotModal } = await fetchProductLots(fullProduit.id)

            // Générer le lineId à l'avance pour pouvoir l'utiliser dans le callback multi-lot
            const newLineId = generateUUID()

            setLignesFacture(prevLignes => {
                // REDUNDANCY / INTERACTION CHECK
                if (fullProduit.famille_risque) {
                    const conflict = prevLignes.find(l =>
                        l.produit.id !== fullProduit.id &&
                        l.produit.famille_risque === fullProduit.famille_risque
                    )
                    if (conflict) {
                        setTimeout(() => {
                            gooeyToast.error(
                                `⚠️ Interaction / Redondance\n${fullProduit.name} est de la même famille (${fullProduit.famille_risque_nom}) que ${conflict.produit.name} déjà présent.`,
                                { duration: 6000, position: 'top-center', style: { border: '2px solid #fbbd23', background: '#fff', color: '#333', maxWidth: '400px' }, icon: '⚠️' }
                            )
                        }, 100)
                    }
                }

                // Si ligne existante sans lot → incrémenter la quantité
                const existingLigne = prevLignes.find(ligne => ligne.produit.id === fullProduit.id)
                if (existingLigne && !existingLigne.lotId && !existingLigne.lotAllocations) {
                    const nouvelleQuantite = existingLigne.quantite + 1
                    return prevLignes.map(ligne =>
                        ligne.lineId === existingLigne.lineId
                            ? { ...ligne, produit: fullProduit, quantite: nouvelleQuantite, total_ligne: calculateLineTotal(nouvelleQuantite, ligne.prix_unitaire, ligne.remise_produit) }
                            : ligne
                    )
                }

                // Créer une nouvelle ligne
                const basePrice = computeBasePrice(fullProduit, options)

                // Avec lot FEFO
                if (autoAllocations && autoAllocations.length > 0) {
                    return [...prevLignes, createLotLine(newLineId, fullProduit, autoAllocations[0], firstLotMaxQty)]
                }

                // Sans lot
                return [...prevLignes, createPlainLine(newLineId, fullProduit, basePrice)]
            })

            // MULTI-LOT AUTO: si la qty demandée ne peut pas être satisfaite par le premier lot FEFO,
            // ouvrir automatiquement le modal de répartition
            if (needsLotModal && onMultiLotDetected) {
                setTimeout(() => onMultiLotDetected(fullProduit, newLineId, 1), 200)
            }

            // ORDONNANCIER CHECK
            const requiresOrdonnance = fullProduit.requires_prescription ||
                (fullProduit.surveillance_category && fullProduit.surveillance_category !== 'NONE')

            if (requiresOrdonnance && onRequirePrescription) {
                onRequirePrescription()
                gooeyToast(t('prescriptions:messages.prescription_product_detected'))
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

            playAddBeep()
            triggerAddHaptic()
            return fullProduit
        } catch (err) {
            logger.error('Erreur lors du chargement des détails du produit:', err)
            gooeyToast.error(t('facturation:messages.product_detail_load_error'))
        } finally {
            setLoading(false)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onRequirePrescription, onMultiLotDetected, quantityInputsRef])

    const updateQuantite = useCallback((lineId: string, quantite: number, callback?: (err: string) => void) => {
        // Permettre les quantités négatives (retours) et positives (ventes)
        const normalizedQuantite = Math.floor(normalizeNumberInput(quantite))
        const finalQuantite = normalizedQuantite === 0 ? 1 : normalizedQuantite

        // Vérifier les permissions pour les retours (quantité négative)
        if (finalQuantite < 0 && !user?.can_do_returns) {
            const msg = "Vous n'avez pas la permission d'effectuer des retours (quantités négatives)."
            gooeyToast.error(msg)
            if (callback) callback(msg)
            return
        }

        // Vérifier si la nouvelle quantité dépasse le stock du lot actuel
        // Si oui, ouvrir le modal de répartition multi-lots
        const currentLigne = lignesFacture.find(l => l.lineId === lineId)
        if (currentLigne && currentLigne.lotId && currentLigne.lotMaxQuantity != null
            && finalQuantite > currentLigne.lotMaxQuantity
            && onQuantityExceedsLot) {
            const totalStock = currentLigne.produit.stock ?? 0
            // Si la quantité dépasse le stock TOTAL (tous lots confondus),
            // on met à jour la quantité quand même — le modal promis au checkout
            // s'occupera de la différence. On n'ouvre pas le lot modal car il
            // ne pourrait pas allouer la quantité demandée.
            if (finalQuantite > totalStock) {
                setLignesFacture(prevLignes => prevLignes.map(ligne =>
                    ligne.lineId === lineId
                        ? {
                            ...ligne,
                            quantite: finalQuantite,
                            total_ligne: calculateLineTotal(finalQuantite, ligne.prix_unitaire, ligne.remise_produit),
                            isPromis: undefined,
                            promisQuantity: undefined,
                            promisPhone: undefined
                        }
                        : ligne
                ))
                return
            }
            // La quantité dépasse le lot actuel mais reste dans le stock total
            // → ouvrir le modal pour répartir sur plusieurs lots
            setTimeout(() => onQuantityExceedsLot(currentLigne.produit, lineId, finalQuantite), 0)
            return // Ne pas mettre à jour la qty ici — le modal s'en chargera
        }

        setLignesFacture(prevLignes => prevLignes.map(ligne =>
            ligne.lineId === lineId
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
    }, [user?.can_do_returns, lignesFacture, onQuantityExceedsLot])

    const updatePrix = useCallback((lineId: string, prix: string) => {
        setLignesFacture(prevLignes => prevLignes.map(ligne =>
            ligne.lineId === lineId
                ? { ...ligne, prix_unitaire: prix, total_ligne: calculateLineTotal(ligne.quantite, prix, ligne.remise_produit) }
                : ligne
        ))
    }, [])

    const updateRemiseProduit = useCallback((lineId: string, remise: string) => {
        setLignesFacture(prevLignes => prevLignes.map(ligne =>
            ligne.lineId === lineId
                ? { ...ligne, remise_produit: remise, total_ligne: calculateLineTotal(ligne.quantite, ligne.prix_unitaire, remise) }
                : ligne
        ))
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [calculateLineTotal])

    const updateLineLot = useCallback((lineId: string, lot: StockLot | null) => {
        setLignesFacture(prevLignes => prevLignes.map(ligne =>
            ligne.lineId === lineId
                ? {
                    ...ligne,
                    lotId: lot ? String(lot.id) : null,
                    lotText: lot ? lot.lot : null,
                    lotExpiration: lot?.date_expiration || null,
                    lotSellingPrice: lot?.selling_price ?? null,
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

    const updateTreatmentDuration = useCallback((lineId: string, duration: number) => {
        setLignesFacture(prevLignes => prevLignes.map(ligne =>
            ligne.lineId === lineId
                ? { ...ligne, treatment_duration_days: duration }
                : ligne
        ))
    }, [])

    const removeLigne = useCallback((lineId: string) => {
        setLignesFacture(prev => prev.filter(ligne => ligne.lineId !== lineId))
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
                        lineId: generateUUID(),
                        produit: product,
                        quantite: quantity,
                        prix_unitaire: prixBase,
                        remise_produit: remise,
                        total_ligne: calculateLineTotal(quantity, prixBase, remise),
                        lotId: null,
                        lotText: null,
                        lotExpiration: null,
                        lotSellingPrice: null,
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
