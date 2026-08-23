import { useCallback } from 'react'
import type { TFunction } from 'i18next'
import { gooeyToast } from 'goey-toast'
import type { LigneFacture } from '../types'

export interface UseSecureCartOperationsOptions {
    cart: {
        lignesFacture: LigneFacture[]
        updateQuantite: (lineId: string, qty: number) => void
        updatePrix: (lineId: string, price: string) => void
        updateRemiseProduit: (lineId: string, remise: string) => void
    }
    requireSudo: (
        callback: (validatorId: number, password: string) => Promise<void>,
        options: { title: string; message: string; permission?: string; onCancel?: () => void }
    ) => void
    // Creds pour les remises (et retours quantité négative)
    setRemiseSudoCreds: (creds: { validatorId: number; password: string } | null) => void
    remiseSudoCreds: { validatorId: number; password: string } | null
    // Creds pour les modifications de prix
    setPrixSudoCreds: (creds: { validatorId: number; password: string } | null) => void
    prixSudoCreds: { validatorId: number; password: string } | null
    t: TFunction
    triggerUiRefresh: () => void
    maxDiscountRate: number
}

export function useSecureCartOperations({
    cart,
    requireSudo,
    setRemiseSudoCreds,
    remiseSudoCreds,
    setPrixSudoCreds,
    prixSudoCreds,
    t,
    triggerUiRefresh,
    maxDiscountRate
}: UseSecureCartOperationsOptions) {
    const secureUpdateQuantite = useCallback((lineId: string, newQty: number) => {
        if (newQty < 0) {
            if (remiseSudoCreds) {
                cart.updateQuantite(lineId, newQty)
                return
            }
            const currentLine = cart.lignesFacture.find((l) => l.lineId === lineId)
            requireSudo(async (validatorId, password) => {
                setRemiseSudoCreds({ validatorId, password })
                cart.updateQuantite(lineId, newQty)
            }, {
                title: t('facturation:payment.sudo_mode.validate_by'),
                message: `Confirmer la quantité ${newQty} pour le produit ${currentLine?.produit.name ?? ''} ?`,
                permission: 'can_do_returns',
                onCancel: triggerUiRefresh
            })
        } else {
            cart.updateQuantite(lineId, newQty)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cart.updateQuantite, cart.lignesFacture, requireSudo, setRemiseSudoCreds, remiseSudoCreds, t, triggerUiRefresh])

    const secureUpdatePrix = useCallback((lineId: string, newPrice: string) => {
        const currentLine = cart.lignesFacture.find((l) => l.lineId === lineId)
        if (!currentLine) return
        if (newPrice !== currentLine.prix_unitaire) {
            if (prixSudoCreds) {
                cart.updatePrix(lineId, newPrice)
                return
            }
            requireSudo(async (validatorId, password) => {
                setPrixSudoCreds({ validatorId, password })
                cart.updatePrix(lineId, newPrice)
            }, {
                title: t('facturation:payment.sudo_mode.validate_by'),
                message: `Confirmer le changement de prix de ${currentLine.prix_unitaire} à ${newPrice} pour ${currentLine.produit.name} ?`,
                permission: 'can_modify_price',
                onCancel: triggerUiRefresh
            })
        } else {
            cart.updatePrix(lineId, newPrice)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cart.updatePrix, cart.lignesFacture, requireSudo, setPrixSudoCreds, prixSudoCreds, t, triggerUiRefresh])

    const secureUpdateRemiseProduit = useCallback((lineId: string, newRemise: string) => {
        const currentLine = cart.lignesFacture.find((l) => l.lineId === lineId)
        if (!currentLine) return
        if (Number(newRemise) > 0 && newRemise !== currentLine.remise_produit) {
            if (remiseSudoCreds) {
                cart.updateRemiseProduit(lineId, newRemise)
                return
            }
            requireSudo(async (validatorId, password) => {
                setRemiseSudoCreds({ validatorId, password })
                cart.updateRemiseProduit(lineId, newRemise)
            }, {
                title: t('facturation:payment.sudo_mode.validate_by'),
                message: `Confirmer une remise de ${newRemise}% sur le produit ${currentLine.produit.name} ?`,
                permission: 'can_do_remise',
                onCancel: triggerUiRefresh
            })
        } else {
            cart.updateRemiseProduit(lineId, newRemise)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cart.updateRemiseProduit, cart.lignesFacture, requireSudo, setRemiseSudoCreds, remiseSudoCreds, t, triggerUiRefresh])

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

        if (remiseSudoCreds) {
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
            gooeyToast.error(t('facturation:messages.discount_limit_error', { rate: maxDiscountRate }) + ` (max: ${plafondAffiche})`)
            // Capper à la valeur max autorisée
            const cappedValue = mode === 'taux'
                ? String(maxDiscountRate)
                : String(Math.round(totalTTC * maxDiscountRate / 100))
            setRemiseGlobale('0')
            requireSudo(async (validatorId, password) => {
                setRemiseSudoCreds({ validatorId, password })
                setRemiseGlobale(cappedValue)
            }, {
                title: t('facturation:payment.sudo_mode.validate_by'),
                message: `Autoriser une remise globale de ${cappedValue}${mode === 'taux' ? '%' : ' F'} (plafond maximum) ?`,
                permission: 'can_do_remise',
                onCancel: () => { setRemiseGlobale('0'); triggerUiRefresh() }
            })
            return
        }
        requireSudo(async (validatorId, password) => {
            setRemiseSudoCreds({ validatorId, password })
            setRemiseGlobale(newValue)
        }, {
            title: t('facturation:payment.sudo_mode.validate_by'),
            message: `Autoriser une remise globale de ${newValue}${mode === 'taux' ? '%' : ' F'} ?`,
            permission: 'can_do_remise',
            onCancel: () => { setRemiseGlobale('0'); triggerUiRefresh() }
        })
    }, [requireSudo, setRemiseSudoCreds, remiseSudoCreds, t, triggerUiRefresh, maxDiscountRate])

    return {
        secureUpdateQuantite,
        secureUpdatePrix,
        secureUpdateRemiseProduit,
        secureSetRemiseGlobale
    }
}
