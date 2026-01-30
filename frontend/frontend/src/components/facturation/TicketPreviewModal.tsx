import { useTranslation } from 'react-i18next'
import DOMPurify from 'dompurify'
import { TicketTemplate } from '../printing/TicketTemplate'

interface TicketPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  ticket: any
  settings: any
}

export default function TicketPreviewModal({
  isOpen,
  onClose,
  ticket,
  settings
}: TicketPreviewModalProps) {
  const { t } = useTranslation()

  if (!isOpen || !ticket) return null

  const handlePrint = () => {
    const content = DOMPurify.sanitize(document.getElementById('ticket-preview')?.innerHTML || '');
    const win = window.open('', '', 'height=600,width=400');
    if (win && content) {
      win.document.write('<html><head><title>Ticket</title>');
      win.document.write('<style>@media print { @page { margin: 0; size: 80mm auto; } body { margin: 0; padding: 0; } } body { margin: 0; padding: 0; background: white; }</style>');
      win.document.write('</head><body>');
      win.document.write(content);
      win.document.write('</body></html>');
      win.document.close();
      win.focus();
      setTimeout(() => {
        win.print();
        win.close();
      }, 250);
    }
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box p-0 max-w-sm bg-white overflow-hidden">
        <div className="bg-base-50 p-3 flex justify-between items-center border-b border-base-200">
          <h3 className="font-bold text-lg">{t('common.receipt')}</h3>
          <button className="btn btn-sm btn-circle btn-ghost" onClick={onClose}>✕</button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto bg-gray-50 flex justify-center py-4" id="ticket-preview-container">
          <div id="ticket-preview">
            <TicketTemplate ticket={ticket} settings={settings} />
          </div>
        </div>

        <div className="p-3 bg-base-50 border-t border-base-200 flex justify-end gap-2">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>{t('common.close')} (Esc)</button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handlePrint}
          >
            {t('common.print')}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  )
}
