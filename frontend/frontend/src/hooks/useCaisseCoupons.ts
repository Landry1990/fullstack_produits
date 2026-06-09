import { useState, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import api from '../services/api'
import type { Facture, CouponMonnaie } from '../types'
import { getApiErrorDetail } from '../utils/errorHandling'

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
  coupons,
  setCoupons,
  couponsParFacture,
  setCouponsParFacture,
  setIsGenererCouponModalOpen,
  setIsDetailsCouponModalOpen,
  setCouponTrouve,
  selectedFacture,
  onSuccess
}: CouponsState) => {
  const [loading, setLoading] = useState(false)
  const [searchCouponNumero, setSearchCouponNumero] = useState('')

  const fetchCoupons = useCallback(async () => {
    try {
      const response = await api.get('coupons/', { params: { ordering: '-date_creation', page_size: 50 } })
      setCoupons(response.data.results || response.data || [])
    } catch (err) {
      console.error('Erreur lors du chargement des coupons:', err)
    }
  }, [setCoupons])

  const handleGenererCoupon = async (
    montant: string,
    notes: string,
    factureId: number | null,
    t: (key: string, options?: any) => string
  ) => {
    if (!montant || Number(montant) <= 0) {
      toast.error(t('messages.invalid_amount'))
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
      toast.success(t('messages.coupon_generated', { numero: data.numero }))

      setCoupons(prev => [data, ...prev])
      setIsGenererCouponModalOpen(false)
      setCouponTrouve(data)
      setIsDetailsCouponModalOpen(true)
      onSuccess?.()
    } catch (err) {
      console.error('Erreur génération coupon:', err)
      toast.error(getApiErrorDetail(err, t('messages.error_generation')))
    } finally {
      setLoading(false)
    }
  }

  const handleRechercherCoupon = useCallback(async (
    numero: string,
    t: (key: string, options?: any) => string
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
        toast.error(t('messages.coupon_not_found'))
      }
    } catch (err) {
      console.error('Erreur recherche coupon:', err)
      toast.error(t('messages.search_error'))
    } finally {
      setLoading(false)
    }
  }, [setCouponTrouve, setIsDetailsCouponModalOpen])

  const handleAppliquerCouponAFacture = useCallback((
    coupon: CouponMonnaie,
    facture: Facture,
    t: (key: string, options?: any) => string
  ) => {
    if (coupon.status !== 'ACTIF') {
      toast.error(t('messages.coupon_not_active'))
      return
    }

    // Vérifier si ce coupon est déjà appliqué à une autre facture
    const existingFactureId = Object.keys(couponsParFacture).find(
      id => couponsParFacture[Number(id)]?.id === coupon.id
    )
    if (existingFactureId && Number(existingFactureId) !== facture.id) {
      toast.error(t('messages.coupon_already_applied'))
      return
    }

    setCouponsParFacture(prev => ({ ...prev, [facture.id]: coupon }))
    toast.success(t('messages.coupon_applied_to', {
      numero: coupon.numero,
      ticket: facture.session_ticket_number || facture.numero_facture
    }))
  }, [couponsParFacture, setCouponsParFacture])

  const handleRetirerCouponDeFacture = useCallback((factureId: number, t: (key: string) => string) => {
    setCouponsParFacture(prev => {
      const updated = { ...prev }
      delete updated[factureId]
      return updated
    })
    toast(t('messages.coupon_removed'), { icon: '🗑️' })
  }, [setCouponsParFacture])

  const utiliserCouponApresEncaissement = useCallback(async (couponId: number, factureId: number) => {
    try {
      await api.post(`coupons/${couponId}/utiliser/`, { facture_id: factureId })
      fetchCoupons()
    } catch (err) {
      console.error('Erreur utilisation coupon:', err)
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
