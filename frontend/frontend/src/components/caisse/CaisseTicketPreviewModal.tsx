import React, { useEffect, useMemo, useRef, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Receipt } from 'lucide-react'
import { toast } from 'react-hot-toast'
import PremiumModal from '../common/PremiumModal'
import { TicketTemplate } from '../printing/TicketTemplate'
import { ClientNameModal } from '../sales/modals/ClientNameModal'
import api from '../../services/api'
import type { TicketCaisse, Facture, PharmacySettings } from '../../types'
import { buildTicketPrintHtml, writePrintDocument } from '../../utils/print/printHelpers'
import { preparePrintAuthSync } from '../../utils/storage'

interface CaisseTicketPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  ticket: TicketCaisse | null
  settings: PharmacySettings
  onSendWhatsApp: () => void
  loading?: boolean
}

function isGenericClientName(name: string): boolean {
  const lower = (name || '').toLowerCase().trim()
  return !lower || lower.includes('divers') || lower.includes('passage')
}

export function CaisseTicketPreviewModal({
  isOpen,
  onClose,
  ticket,
  settings,
  onSendWhatsApp,
  loading = false
}: CaisseTicketPreviewModalProps) {
  const { t } = useTranslation(['caisse', 'common'])

  // Refs pour la navigation clavier dans le footer
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const whatsappButtonRef = useRef<HTMLButtonElement>(null)
  const printButtonRef = useRef<HTMLButtonElement>(null)
  const invoiceButtonRef = useRef<HTMLButtonElement>(null)

  const [showClientNameModal, setShowClientNameModal] = useState(false)
  const [pendingFacture, setPendingFacture] = useState<Facture | null>(null)

  const handlePrintInvoice = useCallback(() => {
    if (!ticket) return
    const factureObj = typeof ticket.facture === 'object' ? ticket.facture : null
    const factureId = factureObj?.id ?? ticket.facture
    if (!factureId) return

    const hasOverride = !!(factureObj?.client_name_override)
    const clientName = hasOverride ? factureObj!.client_name_override : ticket.client_name

    if (!hasOverride && isGenericClientName(ticket.client_name || '')) {
      setPendingFacture({
        id: factureId,
        numero_facture: factureObj?.numero_facture,
        client_name: ticket.client_name,
        client_name_override: undefined,
      } as Facture)
      setShowClientNameModal(true)
      return
    }

    let url = `/app/print-invoice/${factureId}`
    if (clientName) url += `?client_name=${encodeURIComponent(clientName)}`
    // Synchronisation d'auth dans localStorage avant ouverture pour permettre `noopener`.
    preparePrintAuthSync()
    const printWindow = window.open(url, '_blank', 'noopener,noreferrer')
    if (!printWindow) {
      toast.error(t('common:popup_blocked'))
    }
  }, [ticket, t])

  const handleConfirmPrintClientName = useCallback(async (clientNameInput: string) => {
    if (!pendingFacture) return
    const upperName = clientNameInput.toUpperCase().trim()
    // Synchronisation d'auth dans localStorage avant ouverture pour permettre `noopener`.
    preparePrintAuthSync()
    // Ouvrir la fenêtre AVANT l'appel async pour éviter le blocage des popups.
    const printWindow = window.open('about:blank', '_blank', 'noopener,noreferrer')
    try {
      await api.patch(`factures/${pendingFacture.id}/`,
        { client_name_override: upperName }
      )
      toast.success(t('common:messages.saved'))
    } catch (err) {
      console.error('Erreur mise à jour nom client facture :', err)
      toast.error(t('common:save_error'))
    }
    const url = `/app/print-invoice/${pendingFacture.id}${upperName ? `?client_name=${encodeURIComponent(upperName)}` : ''}`
    if (printWindow) {
      printWindow.location.href = url
    } else {
      toast.error(t('common:popup_blocked'))
    }
    setShowClientNameModal(false)
    setPendingFacture(null)
  }, [pendingFacture, t])

  // Focus automatique sur le bouton d'impression à l'ouverture
  useEffect(() => {
    if (isOpen && ticket) {
      const timer = setTimeout(() => {
        printButtonRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [isOpen, ticket])

  // Récupération des styles du document au moment de l'ouverture du modal
  const styleTags = useMemo(() => {
    if (!isOpen) return ''
    return Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(node => node.outerHTML)
      .join('\n')
  }, [isOpen])

  // Navigation gauche/droite entre les boutons d'action
  const handleFooterKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const buttons = [
      closeButtonRef.current,
      whatsappButtonRef.current,
      invoiceButtonRef.current,
      printButtonRef.current
    ].filter(Boolean) as HTMLButtonElement[]

    const currentIndex = buttons.findIndex(btn => btn === document.activeElement)
    if (currentIndex === -1) return

    if (e.key === 'ArrowLeft' && currentIndex > 0) {
      e.preventDefault()
      buttons[currentIndex - 1].focus()
    } else if (e.key === 'ArrowRight' && currentIndex < buttons.length - 1) {
      e.preventDefault()
      buttons[currentIndex + 1].focus()
    } else if (e.key === 'Tab' && !e.shiftKey && currentIndex === buttons.length - 1) {
      e.preventDefault()
      buttons[0].focus()
    } else if (e.key === 'Tab' && e.shiftKey && currentIndex === 0) {
      e.preventDefault()
      buttons[buttons.length - 1].focus()
    }
  }, [])

  const handlePrint = useCallback(() => {
    const ticketElement = document.getElementById('ticket-preview')
    if (!ticketElement) return

    const ticketWidth = settings?.ticket_paper_width || 80
    const content = ticketElement.outerHTML
    const win = window.open('about:blank', '_blank', 'noopener,height=800,width=600')
    if (!win) {
      toast.error(t('common:popup_blocked'))
      return
    }
    const html = buildTicketPrintHtml(ticketWidth, content, styleTags)
    writePrintDocument(win, html)
    win.focus()
  }, [settings, styleTags, t])

  return (
    <>
    <PremiumModal
      isOpen={isOpen && !!ticket}
      onClose={onClose}
      title={t('ticket.title')}
      icon={<Receipt className="h-6 w-6 text-emerald-600" aria-hidden="true" />}
      maxWidth="max-w-md"
      footer={
        <div className="flex justify-end gap-2 w-full" onKeyDown={handleFooterKeyDown}>
          <button
            ref={closeButtonRef}
            type="button"
            className="inline-flex items-center justify-center h-8 px-3 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-colors"
            onClick={onClose}
          >
            {t('common:close')}
          </button>
          {settings?.whatsapp_enabled && (
            <button
              ref={whatsappButtonRef}
              type="button"
              className="inline-flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-semibold border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-colors"
              onClick={onSendWhatsApp}
              disabled={loading}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 448 512" aria-hidden="true">
                <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 54 81.2 54 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-5.5-2.8-23.4-8.6-44.4-27.4-16.4-14.6-27.4-32.7-30.6-38.2-3.2-5.6-.3-8.6 2.5-11.3 2.5-2.4 5.5-6.5 8.3-9.7 2.8-3.3 3.7-5.6 5.5-9.3 1.9-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 13.2 5.8 23.5 9.2 31.5 11.8 13.3 4.2 25.4 3.6 35 2.2 10.7-1.5 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
              </svg>
              WhatsApp
            </button>
          )}
          <button
            ref={invoiceButtonRef}
            type="button"
            className="inline-flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-semibold border-2 border-sky-500 text-sky-600 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 transition-colors"
            onClick={handlePrintInvoice}
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            Facture A4
          </button>
          <button
            ref={printButtonRef}
            type="button"
            className="inline-flex items-center justify-center h-8 px-6 rounded-lg text-xs font-semibold bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-600 transition-colors"
            onClick={handlePrint}
          >
            {t('common:print')}
          </button>
        </div>
      }
    >
      <div className="max-h-[70vh] overflow-y-auto bg-slate-100 flex justify-center py-4">
        {ticket && settings && (
          <div id="ticket-preview" className="shadow-lg bg-white">
            <TicketTemplate ticket={ticket} settings={settings} />
          </div>
        )}
      </div>
    </PremiumModal>

    <ClientNameModal
      isOpen={showClientNameModal}
      onClose={() => {
        setShowClientNameModal(false)
        setPendingFacture(null)
      }}
      onConfirm={handleConfirmPrintClientName}
      facture={pendingFacture}
    />
    </>
  )
}
