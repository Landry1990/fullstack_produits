import { useTranslation } from 'react-i18next'
import { X, MessageCircle } from 'lucide-react'
import { TicketTemplate } from '../printing/TicketTemplate'
import { buildTicketPrintHtml } from '../../utils/print/printHelpers'
import { gooeyToast } from 'goey-toast'
import type { TicketCaisse, PharmacySettings } from '../../types'

interface TicketPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  ticket: TicketCaisse | null
  settings: PharmacySettings | null
  onSendWhatsApp?: () => void
}

export default function TicketPreviewModal({
  isOpen,
  onClose,
  ticket,
  settings,
  onSendWhatsApp
}: TicketPreviewModalProps) {
  const { t } = useTranslation(['facturation', 'common'])

  if (!isOpen || !ticket || !settings) return null

  const handlePrint = () => {
    const ticketElement = document.getElementById('ticket-preview');
    if (!ticketElement) return;
    
    const ticketWidth = settings?.ticket_paper_width || 80;
    
    // Get all stylesheets and styles from the parent document to properly apply Tailwind classes
    const styleTags = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(node => node.outerHTML)
      .join('\n');

    const printWindow = window.open('', '_blank', '')
    if (!printWindow) {
      gooeyToast.error(t('common:popup_blocked'))
      return
    }

    const html = buildTicketPrintHtml(ticketWidth, ticketElement.outerHTML, styleTags)
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-slate-50 p-3 flex justify-between items-center border-b border-slate-200">
          <h3 className="font-bold text-lg text-slate-800">{t('common:receipt')}</h3>
          <button className="inline-flex items-center justify-center size-8 rounded-full text-slate-400 hover:bg-slate-100 transition-colors" onClick={onClose} aria-label={t('common:close')}>
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-900/90 flex justify-center py-8 px-4" id="ticket-preview-container">
          <div id="ticket-preview" className="shadow-2xl ring-1 ring-white/10">
            <TicketTemplate ticket={ticket} settings={settings} />
          </div>
        </div>

        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
          <button className="inline-flex items-center justify-center h-9 px-4 rounded-lg text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors" onClick={onClose}>{t('common:close')} (Esc)</button>

          {settings?.whatsapp_enabled && onSendWhatsApp && (
             <button
               className="inline-flex items-center justify-center h-9 px-4 rounded-lg text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors gap-2"
               onClick={onSendWhatsApp}
             >
               <MessageCircle className="size-4" />
               WhatsApp
             </button>
          )}

          <button
            className="inline-flex items-center justify-center h-9 px-4 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
            onClick={handlePrint}
          >
            {t('common:print')}
          </button>
        </div>
      </div>
    </div>
  )
}
