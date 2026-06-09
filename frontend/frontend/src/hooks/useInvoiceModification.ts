import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import api from '../services/api'
import type { Facture } from '../types'
import { getApiErrorDetail } from '../utils/errorHandling'

interface ModificationState {
  setLoading: (loading: boolean) => void
  fetchFacturesEnAttente: () => Promise<void>
  t: (key: string, options?: any) => string
}

export const useInvoiceModification = ({
  setLoading,
  fetchFacturesEnAttente,
  t
}: ModificationState) => {
  const navigate = useNavigate()

  /**
   * Modifier une facture complète (redirection vers Facturation)
   * Charge tous les produits, annule la facture originale, puis navigue
   */
  const handleFullModification = useCallback(async (facture: Facture) => {
    if (!window.confirm(t('confirm_modify_invoice'))) return

    try {
      setLoading(true)

      // 1. Récupérer la facture complète avec tous les détails
      const { data: fullFacture } = await api.get<Facture>(`factures/${facture.id}/`)

      if (!fullFacture.produits || fullFacture.produits.length === 0) {
        toast.error(t('messages.empty_invoice_error'))
        setLoading(false)
        return
      }

      // 2. Récupérer les détails complets de tous les produits
      const productPromises = fullFacture.produits.map(async (p: any) => {
        try {
          const response = await api.get(`produits/${p.produit}/`)
          return {
            id: response.data.id,
            name: response.data.name,
            price: p.selling_price,
            quantity: p.quantity,
            stock: response.data.stock,
            discount: p.discount || 0,
            cip: response.data.cip,
            tva: response.data.tva
          }
        } catch (err) {
          console.error(`Failed to fetch product ${p.produit}:`, err)
          // Fallback avec données minimales
          return {
            id: p.produit,
            name: p.produit_nom || 'Produit',
            price: p.selling_price,
            quantity: p.quantity,
            stock: 9999,
            discount: p.discount || 0
          }
        }
      })

      const cartItems = await Promise.all(productPromises)

      // 3. Annuler la facture originale
      await api.post(`factures/${facture.id}/annuler/`, { motif: 'Modification (Reload)' })

      // 4. Naviguer vers la page de facturation avec les données
      navigate('/app/facturation', {
        state: {
          cartData: cartItems,
          client: fullFacture.client ? { id: fullFacture.client, name: fullFacture.client_name } : null,
          remise: fullFacture.remise,
          mode: 'edit_reload'
        }
      })

    } catch (err) {
      console.error('Erreur modification:', err)
      toast.error(t('messages.load_invoice_error'))
    } finally {
      setLoading(false)
    }
  }, [navigate, setLoading, t])

  /**
   * Modification partielle - met à jour la quantité d'un produit
   */
  const handleUpdateQuantity = useCallback(async (
    factureId: number,
    produitId: number,
    newQty: number,
    facturesEnAttente: Facture[]
  ) => {
    try {
      setLoading(true)
      const facture = facturesEnAttente.find(f => f.id === factureId)
      if (!facture) return

      const updatedProducts = (facture.produits || []).map((p: any) => {
        if (p.produit === produitId) {
          return { ...p, quantity: newQty }
        }
        return p
      })

      const response = await api.post(`factures/${factureId}/modifier/`, {
        produits: updatedProducts,
        remise: facture.remise,
        client: facture.client,
        client_name_override: facture.client_name_override
      })

      toast.success(t('messages.modification_success'))
      await fetchFacturesEnAttente()

    } catch (err) {
      console.error('Erreur modification produit:', err)
      toast.error(getApiErrorDetail(err, t('messages.modification_error')))
    } finally {
      setLoading(false)
    }
  }, [fetchFacturesEnAttente, setLoading, t])

  /**
   * Suppression partielle - retire un produit de la facture
   */
  const handleRemoveProduct = useCallback(async (
    factureId: number,
    produitId: number,
    facturesEnAttente: Facture[],
    handleAnnuler: (facture: Facture) => Promise<void>
  ) => {
    try {
      setLoading(true)
      const facture = facturesEnAttente.find(f => f.id === factureId)
      if (!facture) return

      const updatedProducts = (facture.produits || []).filter((p: any) => p.produit !== produitId)

      // Si plus de produits, proposer d'annuler la facture
      if (updatedProducts.length === 0) {
        if (window.confirm(t('messages.confirm_cancel_empty'))) {
          await handleAnnuler(facture)
        }
        setLoading(false)
        return
      }

      const response = await api.post(`factures/${factureId}/modifier/`, {
        produits: updatedProducts,
        remise: facture.remise,
        client: facture.client,
        client_name_override: facture.client_name_override
      })

      toast.success(t('messages.product_removed'))
      await fetchFacturesEnAttente()

    } catch (err) {
      console.error('Erreur suppression produit:', err)
      toast.error(getApiErrorDetail(err, t('messages.modification_error')))
    } finally {
      setLoading(false)
    }
  }, [fetchFacturesEnAttente, setLoading, t])

  return {
    handleFullModification,
    handleUpdateQuantity,
    handleRemoveProduct
  }
}
