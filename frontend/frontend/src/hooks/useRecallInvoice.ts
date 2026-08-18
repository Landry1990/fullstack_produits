import { useState, useCallback } from 'react'
import api from '../services/api'
import { gooeyToast } from 'goey-toast'
import type { Facture } from '../types'

export interface UseRecallInvoiceOptions {
  onInvoiceLoaded: (invoice: Facture) => Promise<void> | void
  t: (key: string, options?: Record<string, unknown>) => string
}

export function useRecallInvoice({ onInvoiceLoaded, t }: UseRecallInvoiceOptions) {
  const [recallNumber, setRecallNumber] = useState('')
  const [isRecalling, setIsRecalling] = useState(false)

  const handleRecallInvoice = useCallback(async () => {
    const value = recallNumber.trim()
    if (!value) return

    const numero = value.toUpperCase().startsWith('FAC-')
      ? value.toUpperCase()
      : `FAC-${value.toUpperCase()}`

    setIsRecalling(true)
    try {
      const { data: invoice } = await api.get<Facture>('factures/by_number/', {
        params: { numero, include_details: 'true' }
      })
      await onInvoiceLoaded(invoice)
      setRecallNumber('')
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status
      if (status === 404) {
        gooeyToast.error(t('facturation:messages.invoice_not_found'))
      } else if (status === 400) {
        gooeyToast.error(t('facturation:messages.invoice_not_modifiable'))
      } else {
        gooeyToast.error(t('facturation:messages.devis_load_error') || 'Erreur lors du chargement de la facture')
      }
    } finally {
      setIsRecalling(false)
    }
  }, [recallNumber, onInvoiceLoaded, t])

  return {
    recallNumber,
    setRecallNumber,
    isRecalling,
    handleRecallInvoice
  }
}
