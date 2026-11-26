import { useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { gooeyToast } from 'goey-toast'
import api from '../services/api'
import type { Facture, TicketCaisse, CouponMonnaie } from '../types'
import { getApiErrorDetail } from '../utils/errorHandling'
import { logger } from '../utils/logger'
import { generateUUID } from '../utils/uuid'
import { buildTicketCaisse } from '../utils/ticketCaisse'
import { usePharmacySettings } from './usePharmacySettings'
import { useInvoiceSettings } from './useInvoiceSettings'
import { printTicketSmart } from '../utils/print/printTicketSmart'

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

export const useCaissePayment = ({
  selectedFacture,
  couponsParFacture,
  setCouponsParFacture,
  setTicketCaisse,
  setIsPaymentModalOpen,
  setShowTicketPreview,
  fetchFacturesEnAttente,
  fetchSessionRecap,
  fetchCoupons
}: PaymentState) => {
  const { t } = useTranslation('caisse')
  const queryClient = useQueryClient()
  const { settings: pharmacySettings } = usePharmacySettings()
  const { settings: invoiceSettings } = useInvoiceSettings()
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

      // 2. Calculer le montant à encaisser — arrondi par excès (totaux
      // décimaux, ex. majoration pro) : le backend cappe au reste exact,
      // et le rendu monnaie reste cohérent avec le montant affiché.
      // ATTENTION : reste_a_payer = total_ttc - encaissé, il INCLUT la part
      // assurance (en_compte) des factures à tiers payant. En caisse on
      // n'encaisse que la part patient : reste_total - part_assurance.
      const totalTtc = Number(factureValidee.total_ttc)
      const partClient = factureValidee.part_client !== null && factureValidee.part_client !== undefined
        ? Number(factureValidee.part_client)
        : null
      const hasTiersPayant = partClient !== null && partClient >= 0 && partClient < totalTtc
      const resteTotal = factureValidee.reste_a_payer !== undefined && factureValidee.reste_a_payer !== null
        ? Number(factureValidee.reste_a_payer)
        : totalTtc
      const partAssurance = hasTiersPayant ? totalTtc - (partClient as number) : 0
      const montantAEncaisser = Math.ceil(Math.max(0, resteTotal - partAssurance))

      // 3. Enregistrer atomiquement coupon, paiements mixtes et informations ticket
      const couponUtilise = couponsParFacture[factureValidee.id]
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
          // Le coupon couvre une partie du reste à payer : il réduit le dû
          // cash (cf. montantDu du PaymentModal) mais n'est jamais rendu en
          // monnaie — on le cappe au dû comme dans buildPaymentPayloads,
          // sinon un coupon > dû gonflerait le rendu espèces.
          montant_rendu: Math.max(
            0,
            montantTotal
              + Math.min(Number(couponUtilise?.montant ?? 0), montantAEncaisser)
              - montantAEncaisser
          ).toString(),
        },
      }, { headers: { 'Idempotency-Key': idempotencyKey } })

      // 6. Récupérer la facture finale
      const { data: factureFinale } = await api.get<Facture>(`factures/${factureValidee.id}/`)

      // 7. Créer le ticket
      const ticketData = buildTicketCaisse(factureFinale, {
        fallbackClientName: t('table.passerby_client'),
        enteredPayments: paiementsValides,
        paiementsDetailsSource: 'facture',
        fallbackMontantVerse: montantTotal,
        fallbackRendu: montantTotal - montantAEncaisser,
        datePaiement: new Date().toISOString(),
        userDetails: user as TicketCaisse['user_details'],
      })
      setTicketCaisse(ticketData)

      // 8. Fermer modale ; impression auto silencieuse ou aperçu ticket
      setIsPaymentModalOpen(false)
      if (invoiceSettings?.auto_print_ticket && pharmacySettings) {
        try {
          // ESC/POS réussi → aucune modale ; sinon le fallback ouvre l'aperçu
          const mode = await printTicketSmart(ticketData, pharmacySettings, () => setShowTicketPreview(true), invoiceSettings.ticket_copies)
          if (mode === 'escpos') gooeyToast.success(t('ticket.printed'))
        } catch {
          setShowTicketPreview(true)
        }
      } else {
        setShowTicketPreview(true)
      }

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
    queryClient
  ])

  return {
    loading,
    enregistrerPaiement
  }
}
