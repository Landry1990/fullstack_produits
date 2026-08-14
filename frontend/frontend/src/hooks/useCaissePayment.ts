import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import api from '../services/api'
import type { Facture, TicketCaisse, CouponMonnaie, PaymentDetails } from '../types'
import { getApiErrorDetail } from '../utils/errorHandling'
import { logger } from '../utils/logger'

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
  utiliserCouponApresEncaissement: (couponId: number, factureId: number) => Promise<void>
  onSuccess?: () => void
}

const processCouponPayment = async (factureId: number, coupon: CouponMonnaie): Promise<void> => {
  const couponPayload = {
    facture: factureId,
    mode_paiement: 'coupon',
    montant: coupon.montant,
    reference: `COUPON-${coupon.numero}`,
    statut: 'completee',
  }
  await api.post('caisse/', couponPayload)
}

const processRegularPayments = async (
  factureId: number,
  paiements: { mode: string; montant: number }[],
  montantAEncaisser: number,
  hasTiersPayant: boolean
): Promise<void> => {
  let resteAEnregistrer = montantAEncaisser

  for (const paiement of paiements) {
    if (resteAEnregistrer <= 0) break

    const montantReel = Math.min(paiement.montant, resteAEnregistrer)

    const paiementPayload: {
      facture: number;
      mode_paiement: string;
      montant: number;
      reference: string | null;
      statut: string;
      part_patient?: number;
      part_assurance?: number;
    } = {
      facture: factureId,
      mode_paiement: paiement.mode,
      montant: montantReel,
      reference: null,
      statut: 'completee',
    }

    if (hasTiersPayant) {
      paiementPayload.part_patient = montantReel
      paiementPayload.part_assurance = 0
    }

    await api.post('caisse/', paiementPayload)
    resteAEnregistrer -= montantReel
  }
}

const createTicketData = (
  facture: Facture,
  paiements: { mode: string; montant: number }[],
  montantTotal: number,
  montantAEncaisser: number,
  user: unknown
): TicketCaisse => {
  const rendu = montantTotal - montantAEncaisser
  const clientName = facture.client_name_override || facture.client_name || 'Client de passage'

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
  utiliserCouponApresEncaissement,
  onSuccess
}: PaymentState) => {
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)

  const enregistrerPaiement = useCallback(async (
    paiementsValides: { mode: string; montant: number }[],
    t: (key: string, options?: unknown) => string,
    user: unknown,
    successMessage: string = 'Paiement enregistré'
  ) => {
    if (!selectedFacture) return

    const montantTotal = paiementsValides.reduce((acc, p) => acc + p.montant, 0)

    if (montantTotal === 0) {
      toast.error(t('messages.invalid_amount'))
      return
    }

    setLoading(true)

    try {
      // 1. Valider la facture si nécessaire
      let factureValidee = selectedFacture
      if (selectedFacture.status !== 'VAL' && selectedFacture.status !== 'VALIDEE') {
        const { data } = await api.post<Facture>(`factures/${selectedFacture.id}/valider/`, {})
        factureValidee = data
      }

      // 2. Calculer le montant à encaisser
      const montantAEncaisser = factureValidee.reste_a_payer !== undefined && factureValidee.reste_a_payer !== null
        ? Number(factureValidee.reste_a_payer)
        : (factureValidee.part_client !== null && Number(factureValidee.part_client) >= 0
            ? Number(factureValidee.part_client)
            : Number(factureValidee.total_ttc))

      // 3. Traiter le coupon si présent
      const couponUtilise = couponsParFacture[factureValidee.id]
      if (couponUtilise) {
        await processCouponPayment(factureValidee.id, couponUtilise)
      }

      // 4. Traiter les paiements réguliers
      const hasTiersPayant = factureValidee.part_client !== null && Number(factureValidee.part_client) >= 0
      await processRegularPayments(factureValidee.id, paiementsValides, montantAEncaisser, hasTiersPayant)

      // 5. Mettre à jour le statut et stocker les infos ticket
      await api.patch(`factures/${factureValidee.id}/`, {
          status: 'PAY',
          montant_verse: montantTotal.toString(),
          montant_rendu: (montantTotal - montantAEncaisser).toString(),
      });

      // 6. Récupérer la facture finale
      const { data: factureFinale } = await api.get<Facture>(`factures/${factureValidee.id}/`)

      // 7. Créer le ticket
      const ticketData = createTicketData(factureFinale, paiementsValides, montantTotal, montantAEncaisser, user)
      setTicketCaisse(ticketData)

      // 8. Fermer modale et afficher ticket
      setIsPaymentModalOpen(false)
      setShowTicketPreview(true)

      // 9. Rafraîchir les données
      await fetchFacturesEnAttente()
      fetchSessionRecap()
      queryClient.invalidateQueries({ queryKey: ['products'] })

      // 10. Marquer le coupon comme utilisé
      if (couponUtilise) {
        await utiliserCouponApresEncaissement(couponUtilise.id, factureFinale.id)
        setCouponsParFacture(prev => {
          const updated = { ...prev }
          delete updated[factureFinale.id]
          return updated
        })
      }

      toast.success(successMessage)
      onSuccess?.()
    } catch (err) {
      logger.error('Erreur lors du paiement:', err)
      toast.error(getApiErrorDetail(err, t('messages.save_payment_error')))
    } finally {
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
    utiliserCouponApresEncaissement,
    setCouponsParFacture,
    onSuccess,
    queryClient
  ])

  return {
    loading,
    enregistrerPaiement
  }
}
