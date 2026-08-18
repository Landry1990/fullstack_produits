import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { gooeyToast } from 'goey-toast'
import api from '../services/api'
import type { Facture } from '../types'
import { getApiErrorDetail } from '../utils/errorHandling'

interface UseBulkCancelParams {
  facturesEnAttente: Facture[]
  fetchFacturesEnAttente: () => Promise<void>
  requireSudo: (
    cb: (validatorId: number, password: string) => Promise<void> | void,
    opts: { title: string; message: string; permission: string }
  ) => void
  user: unknown
}

export const useBulkCancel = ({
  facturesEnAttente,
  fetchFacturesEnAttente,
  requireSudo,
  user,
}: UseBulkCancelParams) => {
  const { t } = useTranslation('caisse')
  const [selectedFactureIds, setSelectedFactureIds] = useState<Set<number>>(new Set())
  const [showBulkCancelModal, setShowBulkCancelModal] = useState(false)
  const [bulkCancelLoading, setBulkCancelLoading] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<{ processed: number; total: number } | null>(null)

  const toggleSelectFacture = useCallback((id: number) => {
    setSelectedFactureIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAllFactures = useCallback(() => {
    setSelectedFactureIds(prev => {
      if (prev.size === facturesEnAttente.length) return new Set()
      return new Set(facturesEnAttente.map(f => f.id))
    })
  }, [facturesEnAttente])

  const canBulkCancel =
    (user as { is_superuser?: boolean } | null)?.is_superuser ||
    (user as { can_cancel_invoice?: boolean } | null)?.can_cancel_invoice ||
    (user as { profile?: { can_cancel_invoice?: boolean } } | null)?.profile?.can_cancel_invoice ||
    false

  // Ouvrir le modal de confirmation
  const handleBulkCancelClick = () => {
    if (selectedFactureIds.size === 0 && facturesEnAttente.length === 0) return
    setShowBulkCancelModal(true)
  }

  // Confirmer → demander sudo → exécuter par lots
  const handleConfirmBulkCancel = () => {
    const BATCH_SIZE = 50
    const factureIdsToSend = selectedFactureIds.size > 0 ? Array.from(selectedFactureIds) : null
    const isAllPending = !factureIdsToSend || factureIdsToSend.length === facturesEnAttente.length

    requireSudo(
      async (validatorId: number, password: string) => {
        setBulkCancelLoading(true)
        setBulkProgress({ processed: 0, total: factureIdsToSend ? factureIdsToSend.length : facturesEnAttente.length })
        let totalSuccess = 0
        let totalError = 0
        let totalStockReintegrated = 0

        try {
          let remainingIds = factureIdsToSend ? [...factureIdsToSend] : null
          let totalProcessed = 0
          let totalRemaining = remainingIds ? remainingIds.length : facturesEnAttente.length
          let hasMore = true

          while (hasMore) {
            const payload: Record<string, unknown> = {
              motif: 'Vidange caisse centrale',
              sudo_user: validatorId,
              sudo_password: password,
              batch_size: BATCH_SIZE,
            }
            if (isAllPending) {
              payload.all_pending = true
            } else {
              payload.facture_ids = remainingIds!.slice(0, BATCH_SIZE)
            }

            const { data } = await api.post('factures/bulk_cancel/', payload)
            totalSuccess += data.success_count || 0
            totalError += data.error_count || 0
            totalStockReintegrated += data.total_stock_reintegrated || 0
            totalProcessed += data.processed || 0
            totalRemaining = data.remaining ?? 0

            setBulkProgress({ processed: totalProcessed, total: totalProcessed + totalRemaining })

            if (totalRemaining === 0) {
              hasMore = false
            } else if (!isAllPending) {
              remainingIds = remainingIds!.slice(data.processed)
              if (remainingIds.length === 0) hasMore = false
            }
          }

          gooeyToast.success(t('messages.bulk_cancel_success', { count: totalSuccess, stock: totalStockReintegrated }))
          if (totalError > 0) {
            gooeyToast.error(t('messages.bulk_cancel_total_errors', { count: totalError }))
          }
          setSelectedFactureIds(new Set())
          setShowBulkCancelModal(false)
          fetchFacturesEnAttente()
        } catch (err: unknown) {
          gooeyToast.error(getApiErrorDetail(err, t('messages.bulk_cancel_error')))
          throw err
        } finally {
          setBulkCancelLoading(false)
          setBulkProgress(null)
        }
      },
      {
        title: t('bulk_cancel_sudo_title', { defaultValue: 'Validation requise — Vidange caisse' }),
        message: t('bulk_cancel_sudo_msg', { defaultValue: 'Cette action annule des factures et réintègre le stock. Validation d\'un administrateur requise.' }),
        permission: 'can_cancel_invoice',
      }
    )
  }

  return {
    selectedFactureIds,
    setSelectedFactureIds,
    showBulkCancelModal,
    setShowBulkCancelModal,
    bulkCancelLoading,
    bulkProgress,
    toggleSelectFacture,
    selectAllFactures,
    canBulkCancel,
    handleBulkCancelClick,
    handleConfirmBulkCancel,
  }
}
