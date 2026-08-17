import React from 'react'
import { normalizeNumberInput } from '../utils/formatters'
import { toast } from 'react-hot-toast'
import type { LigneFacture } from '../types'

interface UseCartRowStateParams {
  ligne: LigneFacture
  updateQuantite: (produitId: number, quantite: number) => void
  updatePrix: (produitId: number, prix: string) => void
  updateRemiseProduit: (produitId: number, remise: string) => void
  maxDiscount: number
  t: (key: string, options?: unknown) => string
  refreshTrigger?: number
}

export function useCartRowState({
  ligne,
  updateQuantite,
  updatePrix,
  updateRemiseProduit,
  maxDiscount,
  t,
  refreshTrigger,
}: UseCartRowStateParams) {
  const [localQty, setLocalQty] = React.useState(() => ligne.quantite.toString())
  const [localPrice, setLocalPrice] = React.useState(() => ligne.prix_unitaire)
  const [localRemise, setLocalRemise] = React.useState(() => ligne.remise_produit)

  React.useEffect(() => {
    setLocalQty(ligne.quantite.toString())
    setLocalPrice(ligne.prix_unitaire)
    setLocalRemise(ligne.remise_produit)
  }, [ligne.quantite, ligne.prix_unitaire, ligne.remise_produit, refreshTrigger])

  const handleQtyChange = (value: string) => {
    const filteredValue = value.replace(/[^0-9-]/g, '').replace(/(?!^)-/g, '')
    setLocalQty(filteredValue)
  }

  const handleQtyStep = (delta: number) => {
    const current = normalizeNumberInput(localQty) || 0
    const newValue = Math.max(1, current + delta)
    setLocalQty(newValue.toString())
    updateQuantite(ligne.produit.id, newValue)
  }

  const handleQtySubmit = () => {
    const numValue = normalizeNumberInput(localQty)
    if (!isNaN(numValue) && numValue !== 0) {
      updateQuantite(ligne.produit.id, numValue)
    } else if (localQty === '' || localQty === '0') {
      setLocalQty(ligne.quantite.toString())
    }
  }

  const handlePriceSubmit = () => {
    if (localPrice !== ligne.prix_unitaire) {
      updatePrix(ligne.produit.id, localPrice)
    }
  }

  const handleRemiseSubmit = () => {
    const numValue = normalizeNumberInput(localRemise)
    if (!isNaN(numValue) && numValue > maxDiscount) {
      toast.error(t('facturation:messages.discount_limit_error', { rate: maxDiscount }))
      setLocalRemise(String(maxDiscount))
      updateRemiseProduit(ligne.produit.id, String(maxDiscount))
    } else if (localRemise !== ligne.remise_produit) {
      updateRemiseProduit(ligne.produit.id, localRemise || '0')
    }
  }

  const isReturn = normalizeNumberInput(ligne.quantite) < 0

  return {
    localQty,
    setLocalQty,
    localPrice,
    setLocalPrice,
    localRemise,
    setLocalRemise,
    handleQtyChange,
    handleQtyStep,
    handleQtySubmit,
    handlePriceSubmit,
    handleRemiseSubmit,
    isReturn,
  }
}
