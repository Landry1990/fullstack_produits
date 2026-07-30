import { useCallback } from 'react'
import type { TFunction } from 'i18next'
import toast from 'react-hot-toast'
import type { LigneFacture } from '../types'

export interface UseSecureCartOperationsOptions {
    cart: {
        lignesFacture: LigneFacture[]
        updateQuantite: (produitId: number, qty: number) => void
        updatePrix: (produitId: number, price: string) => void
        updateRemiseProduit: (produitId: number, remise: string) => void
    }
    requireSudo: (
        callback: (validatorId: number, password: string) => Promise<void>,
        options: { title: string; message: string; permission?: string; onCancel?: () => void }
    ) => void
    setActiveSudoCreds: (creds: { validatorId: number; password: string } | null) => void
    activeSudoCreds: { validatorId: number; password: string } | null
    t: TFunction
    triggerUiRefresh: () => void
    maxDiscountRate: number
}

export function useSecureCartOperations({
    cart,
    requireSudo,
    setActiveSudoCreds,
    activeSudoCreds,
    t,
    triggerUiRefresh,
    maxDiscountRate
}: UseSecureCartOperationsOptions) {
    const secureUpdateQuantite = useCallback((produitId: number, newQty: number) => {
        if (newQty < 0) {
            if (activeSudoCreds) {
                cart.updateQuantite(produitId, newQty)
                return
            }
            const currentLine = cart.lignesFacture.find((l) => l.produit.id === produitId)
            requireSudo(async (validatorId, password) => {
                setActiveSudoCreds({ validatorId, password })
                cart.updateQuantite(produitId, newQty)
            }, {
                title: t('facturation:payment.sudo_mode.validate_by'),
                message: `Confirmer la quantité ${newQty} pour le produit ${currentLine?.produit.name ?? ''} ?`,
                permission: 'can_do_returns',
                onCancel: triggerUiRefresh
            })
        } else {
            cart.updateQuantite(produitId, newQty)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cart.updateQuantite, cart.lignesFacture, requireSudo, setActiveSudoCreds, activeSudoCreds, t, triggerUiRefresh])

    const secureUpdatePrix = useCallback((produitId: number, newPrice: string) => {
        const currentLine = cart.lignesFacture.find((l) => l.produit.id === produitId)
        if (!currentLine) return
        if (newPrice !== currentLine.prix_unitaire) {
            if (activeSudoCreds) {
                cart.updatePrix(produitId, newPrice)
                return
            }
            requireSudo(async (validatorId, password) => {
                setActiveSudoCreds({ validatorId, password })
                cart.updatePrix(produitId, newPrice)
            }, {
                title: t('facturation:payment.sudo_mode.validate_by'),
                message: `Confirmer le changement de prix de ${currentLine.prix_unitaire} à ${newPrice} pour ${currentLine.produit.name} ?`,
                permission: 'can_modify_price',
                onCancel: triggerUiRefresh
            })
        } else {
            cart.updatePrix(produitId, newPrice)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cart.updatePrix, cart.lignesFacture, requireSudo, setActiveSudoCreds, activeSudoCreds, t, triggerUiRefresh])

    const secureUpdateRemiseProduit = useCallback((produitId: number, newRemise: string) => {
        const currentLine = cart.lignesFacture.find((l) => l.produit.id === produitId)
        if (!currentLine) return
        if (Number(newRemise) > 0 && newRemise !== currentLine.remise_produit) {
            if (activeSudoCreds) {
                cart.updateRemiseProduit(produitId, newRemise)
                return
            }
            requireSudo(async (validatorId, password) => {
                setActiveSudoCreds({ validatorId, password })
                cart.updateRemiseProduit(produitId, newRemise)
            }, {
                title: t('facturation:payment.sudo_mode.validate_by'),
                message: `Confirmer une remise de ${newRemise}% sur le produit ${currentLine.produit.name} ?`,
                permission: 'can_modify_price',
                onCancel: triggerUiRefresh
            })
        } else {
            cart.updateRemiseProduit(produitId, newRemise)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cart.updateRemiseProduit, cart.lignesFacture, requireSudo, setActiveSudoCreds, activeSudoCreds, t, triggerUiRefresh])

    const secureSetRemiseGlobale = useCallback((
        newValue: string,
        mode: 'montant' | 'taux',
        totalTTC: number,
        setRemiseGlobale: (v: string) => void
    ) => {
        const num = parseFloat(newValue) || 0
        if (num <= 0) {
            setRemiseGlobale('0')
            return
        }
        // Calcul du taux effectif pour comparer au plafond
        const tauxEffectif = mode === 'taux' ? num : (totalTTC > 0 ? (num / totalTTC) * 100 : 0)
        const exceedsMax = maxDiscountRate > 0 && tauxEffectif > maxDiscountRate

        if (activeSudoCreds) {
            if (exceedsMax) {
                const cappedValue = mode === 'taux'
                    ? String(maxDiscountRate)
                    : String(Math.round(totalTTC * maxDiscountRate / 100))
                setRemiseGlobale(cappedValue)
            } else {
                setRemiseGlobale(newValue)
            }
            return
        }

        if (exceedsMax) {
            const plafondAffiche = mode === 'taux'
                ? `${maxDiscountRate}%`
                : `${Math.round(totalTTC * maxDiscountRate / 100)} F`
            toast.error(t('facturation:messages.discount_limit_error', { rate: maxDiscountRate }) + ` (max: ${plafondAffiche})`)
            // Capper à la valeur max autorisée
            const cappedValue = mode === 'taux'
                ? String(maxDiscountRate)
                : String(Math.round(totalTTC * maxDiscountRate / 100))
            setRemiseGlobale('0')
            requireSudo(async (validatorId, password) => {
                setActiveSudoCreds({ validatorId, password })
                setRemiseGlobale(cappedValue)
            }, {
                title: t('facturation:payment.sudo_mode.validate_by'),
                message: `Autoriser une remise globale de ${cappedValue}${mode === 'taux' ? '%' : ' F'} (plafond maximum) ?`,
                permission: 'can_modify_price',
                onCancel: () => { setRemiseGlobale('0'); triggerUiRefresh() }
            })
            return
        }
        requireSudo(async (validatorId, password) => {
            setActiveSudoCreds({ validatorId, password })
            setRemiseGlobale(newValue)
        }, {
            title: t('facturation:payment.sudo_mode.validate_by'),
            message: `Autoriser une remise globale de ${newValue}${mode === 'taux' ? '%' : ' F'} ?`,
            permission: 'can_modify_price',
            onCancel: () => { setRemiseGlobale('0'); triggerUiRefresh() }
        })
    }, [requireSudo, setActiveSudoCreds, activeSudoCreds, t, triggerUiRefresh, maxDiscountRate])

    return {
        secureUpdateQuantite,
        secureUpdatePrix,
        secureUpdateRemiseProduit,
        secureSetRemiseGlobale
    }
}
