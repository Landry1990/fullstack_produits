import { renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useCaisseStats } from '../useCaisseStats'
import type { Facture, CouponMonnaie } from '../../types'

describe('useCaisseStats Hook', () => {
  const mockFactures: Facture[] = [
    { id: 1, total_ttc: 10000, status: 'BROUILLON', date: '2024-01-01' } as unknown as Facture,
    { id: 2, total_ttc: 15000, status: 'VALIDEE', date: '2024-01-02' } as unknown as Facture,
    { id: 3, total_ttc: 25000, status: 'VALIDEE', date: '2024-01-03' } as unknown as Facture,
  ]

  const mockCoupons: CouponMonnaie[] = [
    { id: 1, numero: 'CP001', montant: 5000, status: 'ACTIF' } as unknown as CouponMonnaie,
    { id: 2, numero: 'CP002', montant: 3000, status: 'ACTIF' } as unknown as CouponMonnaie,
    { id: 3, numero: 'CP003', montant: 2000, status: 'UTILISE' } as unknown as CouponMonnaie,
  ]

  const mockCouponsParFacture: Record<number, CouponMonnaie> = {
    1: mockCoupons[0],
    2: mockCoupons[1],
  }

  it('devrait calculer le montant total des factures en attente', () => {
    const { result } = renderHook(() => useCaisseStats({
      facturesEnAttente: mockFactures,
      coupons: [],
      couponsParFacture: {}
    }))

    expect(result.current.totalMontantEnAttente).toBe(50000)
  })

  it('devrait retourner 0 si aucune facture', () => {
    const { result } = renderHook(() => useCaisseStats({
      facturesEnAttente: [],
      coupons: [],
      couponsParFacture: {}
    }))

    expect(result.current.totalMontantEnAttente).toBe(0)
    expect(result.current.facturesCount).toBe(0)
  })

  it('devrait compter les coupons actifs', () => {
    const { result } = renderHook(() => useCaisseStats({
      facturesEnAttente: [],
      coupons: mockCoupons,
      couponsParFacture: {}
    }))

    expect(result.current.activeCouponsCount).toBe(2) // ACTIF: CP001, CP002
  })

  it('devrait compter les coupons appliqués', () => {
    const { result } = renderHook(() => useCaisseStats({
      facturesEnAttente: [],
      coupons: [],
      couponsParFacture: mockCouponsParFacture
    }))

    expect(result.current.appliedCouponsCount).toBe(2)
  })

  it('devrait compter les factures par statut', () => {
    const { result } = renderHook(() => useCaisseStats({
      facturesEnAttente: mockFactures,
      coupons: [],
      couponsParFacture: {}
    }))

    expect(result.current.facturesByStatus.brouillons).toBe(1)
    expect(result.current.facturesByStatus.validees).toBe(2)
  })

  it('devrait gérer les valeurs nulles/undefined', () => {
    const facturesAvecNulls = [
      { id: 1, total_ttc: null, status: 'BROUILLON' } as unknown as Facture,
      { id: 2, total_ttc: undefined, status: 'VALIDEE' } as unknown as Facture,
      { id: 3, total_ttc: 10000, status: 'VALIDEE' } as unknown as Facture,
    ]

    const { result } = renderHook(() => useCaisseStats({
      facturesEnAttente: facturesAvecNulls,
      coupons: [],
      couponsParFacture: {}
    }))

    expect(result.current.totalMontantEnAttente).toBe(10000)
  })

  it('devrait separer les factures par statut (BROU, VAL, PROF non compte)', () => {
    const facturesMixtes = [
      { id: 1, total_ttc: 10000, status: 'BROU' } as unknown as Facture,
      { id: 2, total_ttc: 15000, status: 'VAL' } as unknown as Facture,
      { id: 3, total_ttc: 5000, status: 'PROF' } as unknown as Facture,
      { id: 4, total_ttc: 8000, status: 'BROUILLON' } as unknown as Facture,
      { id: 5, total_ttc: 12000, status: 'VALIDEE' } as unknown as Facture,
    ]

    const { result } = renderHook(() => useCaisseStats({
      facturesEnAttente: facturesMixtes,
      coupons: [],
      couponsParFacture: {}
    }))

    // BROU et BROUILLON comptent comme brouillons
    expect(result.current.facturesByStatus.brouillons).toBe(2)
    // VAL et VALIDEE comptent comme validees
    expect(result.current.facturesByStatus.validees).toBe(2)
    // PROF n'est compte dans aucune categorie
    expect(result.current.facturesCount).toBe(5)
    // Le total inclut toutes les factures
    expect(result.current.totalMontantEnAttente).toBe(50000)
  })

  it('devrait exclure les ventes annulees du comptage par statut', () => {
    const facturesAvecAnnulee = [
      { id: 1, total_ttc: 10000, status: 'BROUILLON' } as unknown as Facture,
      { id: 2, total_ttc: 15000, status: 'VALIDEE' } as unknown as Facture,
      { id: 3, total_ttc: 20000, status: 'ANNULEE' } as unknown as Facture,
    ]

    const { result } = renderHook(() => useCaisseStats({
      facturesEnAttente: facturesAvecAnnulee,
      coupons: [],
      couponsParFacture: {}
    }))

    // Les ventes annulees ne sont pas comptees dans brouillons ou validees
    expect(result.current.facturesByStatus.brouillons).toBe(1)
    expect(result.current.facturesByStatus.validees).toBe(1)
    expect(result.current.facturesCount).toBe(3)
  })
})
