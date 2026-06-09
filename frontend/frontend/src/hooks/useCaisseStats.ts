import { useMemo } from 'react'
import type { Facture, CouponMonnaie } from '../types'

interface StatsData {
  facturesEnAttente: Facture[]
  coupons: CouponMonnaie[]
  couponsParFacture: Record<number, CouponMonnaie>
}

/**
 * Hook pour calculer les statistiques affichées dans le header de la caisse
 */
export const useCaisseStats = ({
  facturesEnAttente,
  coupons,
  couponsParFacture
}: StatsData) => {
  // Total des montants en attente
  const totalMontantEnAttente = useMemo(() =>
    facturesEnAttente.reduce((acc, f) => acc + Number(f.total_ttc || 0), 0),
    [facturesEnAttente]
  )

  // Nombre de coupons actifs
  const activeCouponsCount = useMemo(() =>
    coupons.filter(c => c.status === 'ACTIF').length,
    [coupons]
  )

  // Nombre de coupons appliqués à des factures
  const appliedCouponsCount = useMemo(() =>
    Object.keys(couponsParFacture).length,
    [couponsParFacture]
  )

  // Nombre de factures en attente par statut
  const facturesByStatus = useMemo(() => {
    const brouillons = facturesEnAttente.filter(f => f.status === 'BROUILLON' || f.status === 'BROU').length
    const validees = facturesEnAttente.filter(f => f.status === 'VALIDEE' || f.status === 'VAL').length
    return { brouillons, validees }
  }, [facturesEnAttente])

  return {
    totalMontantEnAttente,
    activeCouponsCount,
    appliedCouponsCount,
    facturesByStatus,
    facturesCount: facturesEnAttente.length
  }
}
