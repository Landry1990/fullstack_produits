import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useCaisseCoupons } from '../useCaisseCoupons'
import type { Facture, CouponMonnaie } from '../../types'
import api from '../../services/api'

// Mock de l'API
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}))

// Mock de react-hot-toast
vi.mock('react-hot-toast', () => {
  const mockToast = vi.fn()
  return {
    toast: Object.assign(mockToast, {
      success: vi.fn(),
      error: vi.fn()
    }),
    default: mockToast
  }
})

describe('useCaisseCoupons Hook', () => {
  const mockFacture: Facture = {
    id: 1,
    numero_facture: 'FAC-001',
    session_ticket_number: 'T001',
    total_ttc: 10000
  } as unknown as Facture

  const mockCoupon: CouponMonnaie = {
    id: 1,
    numero: 'CP001',
    montant: 5000,
    status: 'ACTIF',
    status_display: 'Actif'
  } as unknown as CouponMonnaie

  const mockSetCoupons = vi.fn()
  const mockSetCouponsParFacture = vi.fn()
  const mockSetIsGenererCouponModalOpen = vi.fn()
  const mockSetIsDetailsCouponModalOpen = vi.fn()
  const mockSetCouponTrouve = vi.fn()
  const mockOnSuccess = vi.fn()

  const mockT = vi.fn((key: string, options?: any) => key)

  const defaultProps = {
    coupons: [],
    setCoupons: mockSetCoupons,
    couponsParFacture: {},
    setCouponsParFacture: mockSetCouponsParFacture,
    setIsGenererCouponModalOpen: mockSetIsGenererCouponModalOpen,
    setIsDetailsCouponModalOpen: mockSetIsDetailsCouponModalOpen,
    setCouponTrouve: mockSetCouponTrouve,
    selectedFacture: mockFacture,
    onSuccess: mockOnSuccess
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchCoupons', () => {
    it('devrait charger les coupons avec succès', async () => {
      const mockCoupons = [
        { id: 1, numero: 'CP001', status: 'ACTIF' },
        { id: 2, numero: 'CP002', status: 'UTILISE' }
      ]
      vi.mocked(api.get).mockResolvedValueOnce({ data: { results: mockCoupons } })

      const { result } = renderHook(() => useCaisseCoupons(defaultProps))

      await act(async () => {
        await result.current.fetchCoupons()
      })

      expect(api.get).toHaveBeenCalledWith('coupons/', {
        params: { ordering: '-date_creation', page_size: 50 }
      })
      expect(mockSetCoupons).toHaveBeenCalledWith(mockCoupons)
    })

    it('devrait gérer les erreurs de chargement', async () => {
      vi.mocked(api.get).mockRejectedValueOnce(new Error('Erreur réseau'))

      const { result } = renderHook(() => useCaisseCoupons(defaultProps))

      await act(async () => {
        await result.current.fetchCoupons()
      })

      expect(mockSetCoupons).not.toHaveBeenCalled()
    })
  })

  describe('handleGenererCoupon', () => {
    it('devrait générer un coupon avec succès', async () => {
      const newCoupon = { id: 1, numero: 'CP001', montant: 5000 }
      vi.mocked(api.post).mockResolvedValueOnce({ data: newCoupon })

      const { result } = renderHook(() => useCaisseCoupons(defaultProps))

      await act(async () => {
        await result.current.handleGenererCoupon('5000', 'Notes test', 1, mockT)
      })

      expect(api.post).toHaveBeenCalledWith('coupons/', {
        montant: 5000,
        notes: 'Notes test',
        facture_origine: 1
      })
      expect(mockSetIsGenererCouponModalOpen).toHaveBeenCalledWith(false)
      expect(mockSetCouponTrouve).toHaveBeenCalledWith(newCoupon)
      expect(mockSetIsDetailsCouponModalOpen).toHaveBeenCalledWith(true)
      expect(mockOnSuccess).toHaveBeenCalled()
    })

    it('ne devrait pas générer si le montant est invalide', async () => {
      const { result } = renderHook(() => useCaisseCoupons(defaultProps))

      await act(async () => {
        await result.current.handleGenererCoupon('', 'Notes', 1, mockT)
      })

      expect(api.post).not.toHaveBeenCalled()
    })

    it('ne devrait pas générer si le montant est <= 0', async () => {
      const { result } = renderHook(() => useCaisseCoupons(defaultProps))

      await act(async () => {
        await result.current.handleGenererCoupon('0', 'Notes', 1, mockT)
      })

      expect(api.post).not.toHaveBeenCalled()
    })
  })

  describe('handleRechercherCoupon', () => {
    it('devrait trouver un coupon par numéro', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: { results: [mockCoupon] }
      })

      const { result } = renderHook(() => useCaisseCoupons(defaultProps))

      await act(async () => {
        await result.current.handleRechercherCoupon('CP001', mockT)
      })

      expect(api.get).toHaveBeenCalledWith('coupons/', {
        params: { search: 'CP001' }
      })
      expect(mockSetCouponTrouve).toHaveBeenCalledWith(mockCoupon)
      expect(mockSetIsDetailsCouponModalOpen).toHaveBeenCalledWith(true)
    })

    it('ne devrait pas chercher si le numéro est vide', async () => {
      const { result } = renderHook(() => useCaisseCoupons(defaultProps))

      await act(async () => {
        await result.current.handleRechercherCoupon('', mockT)
      })

      expect(api.get).not.toHaveBeenCalled()
    })
  })

  describe('handleAppliquerCouponAFacture', () => {
    it('devrait appliquer un coupon actif à une facture', () => {
      const { result } = renderHook(() => useCaisseCoupons(defaultProps))

      act(() => {
        result.current.handleAppliquerCouponAFacture(mockCoupon, mockFacture, mockT)
      })

      expect(mockSetCouponsParFacture).toHaveBeenCalledWith(expect.any(Function))
    })

    it('ne devrait pas appliquer un coupon non-actif', () => {
      const couponInactif = { ...mockCoupon, status: 'UTILISE' }
      const { result } = renderHook(() => useCaisseCoupons(defaultProps))

      act(() => {
        result.current.handleAppliquerCouponAFacture(couponInactif as CouponMonnaie, mockFacture, mockT)
      })

      expect(mockSetCouponsParFacture).not.toHaveBeenCalled()
    })

    it('ne devrait pas appliquer si déjà utilisé sur une autre facture', () => {
      const propsAvecCoupon = {
        ...defaultProps,
        couponsParFacture: { 2: mockCoupon } // Déjà sur facture 2
      }
      const { result } = renderHook(() => useCaisseCoupons(propsAvecCoupon))

      act(() => {
        result.current.handleAppliquerCouponAFacture(mockCoupon, mockFacture, mockT)
      })

      expect(mockSetCouponsParFacture).not.toHaveBeenCalled()
    })
  })

  describe('handleRetirerCouponDeFacture', () => {
    it('devrait retirer un coupon d\'une facture', () => {
      const { result } = renderHook(() => useCaisseCoupons(defaultProps))

      act(() => {
        result.current.handleRetirerCouponDeFacture(1, mockT)
      })

      expect(mockSetCouponsParFacture).toHaveBeenCalledWith(expect.any(Function))
    })
  })

  describe('utiliserCouponApresEncaissement', () => {
    it('devrait marquer le coupon comme utilisé et rafraîchir', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({})

      const { result } = renderHook(() => useCaisseCoupons(defaultProps))

      await act(async () => {
        await result.current.utiliserCouponApresEncaissement(1, 100)
      })

      expect(api.post).toHaveBeenCalledWith('coupons/1/utiliser/', {
        facture_id: 100
      })
    })

    it('ne devrait pas bloquer en cas d\'erreur', async () => {
      vi.mocked(api.post).mockRejectedValueOnce(new Error('Erreur'))

      const { result } = renderHook(() => useCaisseCoupons(defaultProps))

      // Ne devrait pas throw
      await act(async () => {
        await result.current.utiliserCouponApresEncaissement(1, 100)
      })
    })
  })
})
