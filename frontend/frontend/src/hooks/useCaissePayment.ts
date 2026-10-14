import { useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { gooeyToast } from 'goey-toast'
import api from '../services/api'
import type { Facture, TicketCaisse, CouponMonnaie, PaymentDetails } from '../types'
import { getApiErrorDetail } from '../utils/errorHandling'
import { logger } from '../utils/logger'
import { generateUUID } from '../utils/uuid'

interface PaymentState {
  selectedFacture: Facture | null
  couponsParFacture: Record<number, CouponMonnaie>
  setCouponsParFacture: React.Dispatch<React.SetStateAction<Record<number, CouponMonnaie>>>
  setTicketCaisse: (ticket: TicketCaisse | null) => void
  setIsPaymentModalOpen: (isOpen: boolean) => void
  setShowTicketPreview: (show: boolean) => void
  fetchFacturesEnAttente: () => Promise<void>
  fetchSessionRecap: () => Promise<void>
  fetchCoupons: () => Promise<void>
  onSuccess?: () => void
}

const buildPaymentPayloads = (
  factureId: number,
  paiements: { mode: string; montant: number }[],
  montantAEncaisser: number,
  hasTiersPayant: boolean,
  coupon?: CouponMonnaie
) => {
  const items: Array<{
    facture: number;
    mode_paiement: string;
    montant: number;
    reference: string | null;
    statut: string;
    part_patient?: number;
    part_assurance?: number;
  }> = []
  let resteAEnregistrer = montantAEncaisser

  if (coupon && resteAEnregistrer > 0) {
    const montantCoupon = Math.min(Number(coupon.montant), resteAEnregistrer)
    items.push({
      facture: factureId,
      mode_paiement: 'coupon',
      montant: montantCoupon,
      reference: `COUPON-${coupon.numero}`,
      statut: 'completee',
    })
    resteAEnregistrer -= montantCoupon
  }

  for (const paiement of paiements) {
    if (resteAEnregistrer <= 0) break
    const montantReel = Math.min(paiement.montant, resteAEnregistrer)
    const item: (typeof items)[number] = {
      facture: factureId,
      mode_paiement: paiement.mode,
      montant: montantReel,
      reference: null,
      statut: 'completee',
    }
    if (hasTiersPayant) {
      item.part_patient = montantReel
      item.part_assurance = 0
    }
    items.push(item)
    resteAEnregistrer -= montantReel
  }

  return items
}

const createTicketData = (
  facture: Facture,
  paiements: { mode: string; montant: number }[],
  montantTotal: number,
  montantAEncaisser: number,
  user: unknown,
  fallbackClientName: string
): TicketCaisse => {
  const rendu = montantTotal - montantAEncaisser
  const clientName = facture.client_name_override || facture.client_name || fallbackClientName

  return {
    id: facture.id,
    facture: facture as unknown,
    mode_paiement: paiements.length > 1 ? 'Mixte' : (paiements[0]?.mode || 'especes'),
    montant: facture.total_ttc,
    montant_verse: (facture.montant_verse ? Number(facture.montant_verse) : montantTotal).toString(),
    rendu: (facture.montant_rendu ? Number(facture.montant_rendu) : rendu).toString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    statut: 'completee',
    date_paiement: new Date().toISOString(),
    client_name: clientName,
    paiements_details: ((facture as unknown as { paiements?: Array<{ mode_paiement?: string; montant: string | number; part_patient?: string | number | null; part_assurance?: string | number | null }> }).paiements || [])
      .map((p): PaymentDetails => ({
        mode: p.mode_paiement ?? '',
        montant: Number(p.montant),
        part_patient: p.part_patient != null ? Number(p.part_patient) : null,
        part_assurance: p.part_assurance != null ? Number(p.part_assurance) : null,
      })),
    user_details: user,
    reference: null
  } as TicketCaisse
}

export const useCaissePayment = ({
  selectedFacture,
  couponsParFacture,
  setCouponsParFacture,
  setTicketCaisse,
  setIsPaymentModalOpen,
  setShowTicketPreview,
  fetchFacturesEnAttente,
  fetchSessionRecap,
  fetchCoupons,
  onSuccess
}: PaymentState) => {
  const { t } = useTranslation('caisse')
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  // Verrou synchrone : un double Enter/clic avant le re-render ne doit pas
  // enregistrer le paiement deux fois.
  const inFlightRef = useRef(false)

  const enregistrerPaiement = useCallback(async (
    paiementsValides: { mode: string; montant: number }[],
    user: unknown,
    successMessage?: string
  ) => {
    if (!selectedFacture || inFlightRef.current) return
    inFlightRef.current = true

    const montantTotal = paiementsValides.reduce((acc, p) => acc + p.montant, 0)

    if (montantTotal === 0) {
      inFlightRef.current = false
      gooeyToast.error(t('messages.invalid_amount'))
      return
    }

    setLoading(true)

    try {
      const idempotencyKey = generateUUID()
      // 1. Valider la facture si nécessaire
      let factureValidee = selectedFacture
      if (selectedFacture.status !== 'VAL' && selectedFacture.status !== 'VALIDEE') {
        const { data } = await api.post<Facture>(
          `factures/${selectedFacture.id}/valider/`,
          {},
          { headers: { 'Idempotency-Key': idempotencyKey } }
        )
        factureValidee = data
      }

      // 2. Calculer le montant à encaisser
      const montantAEncaisser = factureValidee.reste_a_payer !== undefined && factureValidee.reste_a_payer !== null
        ? Number(factureValidee.reste_a_payer)
        : (factureValidee.part_client !== null && Number(factureValidee.part_client) >= 0
            ? Number(factureValidee.part_client)
            : Number(factureValidee.total_ttc))

      // 3. Enregistrer atomiquement coupon, paiements mixtes et informations ticket
      const couponUtilise = couponsParFacture[factureValidee.id]
      const hasTiersPayant = factureValidee.part_client !== null && Number(factureValidee.part_client) >= 0
      const items = buildPaymentPayloads(
        factureValidee.id,
        paiementsValides,
        montantAEncaisser,
        hasTiersPayant,
        couponUtilise
      )
      await api.post('caisse/bulk_create/', {
        items,
        coupon_numero: couponUtilise?.numero,
        ticket: {
          montant_verse: montantTotal.toString(),
          montant_rendu: (montantTotal - montantAEncaisser).toString(),
        },
      }, { headers: { 'Idempotency-Key': idempotencyKey } })

      // 6. Récupérer la facture finale
      const { data: factureFinale } = await api.get<Facture>(`factures/${factureValidee.id}/`)

      // 7. Créer le ticket
      const ticketData = createTicketData(factureFinale, paiementsValides, montantTotal, montantAEncaisser, user, t('table.passerby_client'))
      setTicketCaisse(ticketData)

      // 8. Fermer modale et afficher ticket
      setIsPaymentModalOpen(false)
      setShowTicketPreview(true)

      // 9. Rafraîchir les données
      await fetchFacturesEnAttente()
      fetchSessionRecap()
      queryClient.invalidateQueries({ queryKey: ['products'] })

      // 10. Le coupon a été consommé dans la transaction d'encaissement
      if (couponUtilise) {
        await fetchCoupons()
        setCouponsParFacture(prev => {
          const updated = { ...prev }
          delete updated[factureFinale.id]
          return updated
        })
      }

      gooeyToast.success(successMessage ?? t('payment.success'))
      onSuccess?.()
    } catch (err) {
      logger.error('Erreur lors du paiement:', err)
      gooeyToast.error(getApiErrorDetail(err, t('messages.save_payment_error')))
    } finally {
      inFlightRef.current = false
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedFacture,
    couponsParFacture,
    setTicketCaisse,
    setIsPaymentModalOpen,
    setShowTicketPreview,
    fetchFacturesEnAttente,
    fetchSessionRecap,
    fetchCoupons,
    setCouponsParFacture,
    onSuccess,
    queryClient
  ])

  return {
    loading,
    enregistrerPaiement
  }
}
