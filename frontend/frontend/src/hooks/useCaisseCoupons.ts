import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { gooeyToast } from 'goey-toast'
import api from '../services/api'
import type { Facture, CouponMonnaie } from '../types'
import { getApiErrorDetail } from '../utils/errorHandling'
import { logger } from '../utils/logger'

interface CouponsState {
  coupons: CouponMonnaie[]
  setCoupons: React.Dispatch<React.SetStateAction<CouponMonnaie[]>>
  couponsParFacture: Record<number, CouponMonnaie>
  setCouponsParFacture: React.Dispatch<React.SetStateAction<Record<number, CouponMonnaie>>>
  setIsGenererCouponModalOpen: (isOpen: boolean) => void
  setIsDetailsCouponModalOpen: (isOpen: boolean) => void
  setCouponTrouve: (coupon: CouponMonnaie | null) => void
  selectedFacture: Facture | null
  onSuccess?: () => void
}

export const useCaisseCoupons = ({
  coupons: _coupons,
  setCoupons,
  couponsParFacture,
  setCouponsParFacture,
  setIsGenererCouponModalOpen,
  setIsDetailsCouponModalOpen,
  setCouponTrouve,
  selectedFacture: _selectedFacture,
  onSuccess
}: CouponsState) => {
  const { t } = useTranslation('caisse')
  const [loading, setLoading] = useState(false)
  const [searchCouponNumero, setSearchCouponNumero] = useState('')

  const fetchCoupons = useCallback(async () => {
    try {
      const response = await api.get('coupons/', { params: { ordering: '-date_creation', page_size: 50 } })
      setCoupons(response.data.results || response.data || [])
    } catch (err) {
      logger.error('Erreur lors du chargement des coupons:', err)
    }
  }, [setCoupons])

  const handleGenererCoupon = async (
    montant: string,
    notes: string,
    factureId: number | null
  ) => {
    if (!montant || Number(montant) <= 0) {
      gooeyToast.error(t('messages.invalid_amount'))
      return
    }

    setLoading(true)
    try {
      const payload = {
        montant: Number(montant),
        notes,
        facture_origine: factureId
      }

      const { data } = await api.post<CouponMonnaie>('coupons/', payload)
      gooeyToast.success(t('messages.coupon_generated', { numero: data.numero }))

      setCoupons(prev => [data, ...prev])
      setIsGenererCouponModalOpen(false)
      setCouponTrouve(data)
      setIsDetailsCouponModalOpen(true)
      onSuccess?.()
    } catch (err) {
      logger.error('Erreur génération coupon:', err)
      gooeyToast.error(getApiErrorDetail(err, t('messages.error_generation')))
    } finally {
      setLoading(false)
    }
  }

  const handleRechercherCoupon = useCallback(async (
    numero: string
  ) => {
    if (!numero) return

    setLoading(true)
    try {
      const response = await api.get('coupons/', { params: { search: numero } })
      const results = response.data.results || response.data || []

      if (results.length > 0) {
        setCouponTrouve(results[0])
        setIsDetailsCouponModalOpen(true)
      } else {
        gooeyToast.error(t('messages.coupon_not_found'))
      }
    } catch (err) {
      logger.error('Erreur recherche coupon:', err)
      gooeyToast.error(t('messages.search_error'))
    } finally {
      setLoading(false)
    }
  }, [setCouponTrouve, setIsDetailsCouponModalOpen, t])

  const handleAppliquerCouponAFacture = useCallback((
    coupon: CouponMonnaie,
    facture: Facture
  ) => {
    if (coupon.status !== 'ACTIF') {
      gooeyToast.error(t('messages.coupon_not_active'))
      return
    }

    // Vérifier si ce coupon est déjà appliqué à une autre facture
    const existingFactureId = Object.keys(couponsParFacture).find(
      id => couponsParFacture[Number(id)]?.id === coupon.id
    )
    if (existingFactureId && Number(existingFactureId) !== facture.id) {
      gooeyToast.error(t('messages.coupon_already_applied'))
      return
    }

    setCouponsParFacture(prev => ({ ...prev, [facture.id]: coupon }))
    gooeyToast.success(t('messages.coupon_applied_to', {
      numero: coupon.numero,
      ticket: facture.session_ticket_number || facture.numero_facture
    }))
  }, [couponsParFacture, setCouponsParFacture, t])

  const handleRetirerCouponDeFacture = useCallback((factureId: number) => {
    setCouponsParFacture(prev => {
      const updated = { ...prev }
      delete updated[factureId]
      return updated
    })
    gooeyToast(t('messages.coupon_removed'))
  }, [setCouponsParFacture, t])

  const utiliserCouponApresEncaissement = useCallback(async (couponId: number, factureId: number) => {
    try {
      await api.post(`coupons/${couponId}/utiliser/`, { facture_id: factureId })
      fetchCoupons()
    } catch (err) {
      logger.error('Erreur utilisation coupon:', err)
      // Ne pas bloquer - le paiement a réussi
    }
  }, [fetchCoupons])

  return {
    loading,
    searchCouponNumero,
    setSearchCouponNumero,
    fetchCoupons,
    handleGenererCoupon,
    handleRechercherCoupon,
    handleAppliquerCouponAFacture,
    handleRetirerCouponDeFacture,
    utiliserCouponApresEncaissement
  }
}
