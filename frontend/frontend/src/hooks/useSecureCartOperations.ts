import { useCallback } from 'react'
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
        options: { title: string; message: string; onCancel?: () => void }
    ) => void
    setActiveSudoCreds: (creds: { validatorId: number; password: string } | null) => void
    t: (key: string, options?: any) => string
    triggerUiRefresh: () => void
}

export function useSecureCartOperations({
    cart,
    requireSudo,
    setActiveSudoCreds,
    t,
    triggerUiRefresh
}: UseSecureCartOperationsOptions) {
    const secureUpdateQuantite = useCallback((produitId: number, newQty: number) => {
        if (newQty < 0) {
            const currentLine = cart.lignesFacture.find((l) => l.produit.id === produitId)
            requireSudo(async (validatorId, password) => {
                setActiveSudoCreds({ validatorId, password })
                cart.updateQuantite(produitId, newQty)
            }, {
                title: t('facturation:payment.sudo_mode.validate_by'),
                message: `Confirmer la quantité ${newQty} pour le produit ${currentLine?.produit.name ?? ''} ?`,
                onCancel: triggerUiRefresh
            })
        } else {
            cart.updateQuantite(produitId, newQty)
        }
    }, [cart.updateQuantite, cart.lignesFacture, requireSudo, setActiveSudoCreds, t, triggerUiRefresh])

    const secureUpdatePrix = useCallback((produitId: number, newPrice: string) => {
        const currentLine = cart.lignesFacture.find((l) => l.produit.id === produitId)
        if (!currentLine) return
        if (newPrice !== currentLine.prix_unitaire) {
            requireSudo(async (validatorId, password) => {
                setActiveSudoCreds({ validatorId, password })
                cart.updatePrix(produitId, newPrice)
            }, {
                title: t('facturation:payment.sudo_mode.validate_by'),
                message: `Confirmer le changement de prix de ${currentLine.prix_unitaire} à ${newPrice} pour ${currentLine.produit.name} ?`,
                onCancel: triggerUiRefresh
            })
        } else {
            cart.updatePrix(produitId, newPrice)
        }
    }, [cart.updatePrix, cart.lignesFacture, requireSudo, setActiveSudoCreds, t, triggerUiRefresh])

    const secureUpdateRemiseProduit = useCallback((produitId: number, newRemise: string) => {
        const currentLine = cart.lignesFacture.find((l) => l.produit.id === produitId)
        if (!currentLine) return
        if (Number(newRemise) > 0 && newRemise !== currentLine.remise_produit) {
            requireSudo(async (validatorId, password) => {
                setActiveSudoCreds({ validatorId, password })
                cart.updateRemiseProduit(produitId, newRemise)
            }, {
                title: t('facturation:payment.sudo_mode.validate_by'),
                message: `Confirmer une remise de ${newRemise}% sur le produit ${currentLine.produit.name} ?`,
                onCancel: triggerUiRefresh
            })
        } else {
            cart.updateRemiseProduit(produitId, newRemise)
        }
    }, [cart.updateRemiseProduit, cart.lignesFacture, requireSudo, setActiveSudoCreds, t, triggerUiRefresh])

    return {
        secureUpdateQuantite,
        secureUpdatePrix,
        secureUpdateRemiseProduit
    }
}
