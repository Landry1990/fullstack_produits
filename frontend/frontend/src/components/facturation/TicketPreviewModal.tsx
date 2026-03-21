import { useTranslation } from 'react-i18next'
import { TicketTemplate } from '../printing/TicketTemplate'

interface TicketPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  ticket: any
  settings: any
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

  if (!isOpen || !ticket) return null

  const handlePrint = () => {
    const ticketElement = document.getElementById('ticket-preview');
    if (!ticketElement) return;
    
    const ticketWidth = settings?.ticket_paper_width || 80;
    
    // Get all stylesheets and styles from the parent document to properly apply Tailwind classes
    const styleTags = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(node => node.outerHTML)
      .join('\n');
    
    const win = window.open('', '', 'height=800,width=600');
    if (win) {
      win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Ticket de Caisse</title>
  ${styleTags}
  <style>
    @media print {
      @page { 
        size: ${ticketWidth}mm auto; 
        margin: 0; 
      }
      body { 
        margin: 0; 
        padding: 0; 
        background: white !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
    body {
      background: white;
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
    }
  </style>
</head>
<body class="bg-white text-black">
  ${ticketElement.innerHTML}
</body>
</html>`);
      win.document.close();
      win.focus();
      
      // Wait for fonts/styles to fully apply in the new window before printing
      setTimeout(() => {
        win.print();
        win.close();
      }, 500);
    }
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box p-0 max-w-sm bg-base-100 overflow-hidden">
        <div className="bg-base-50 p-3 flex justify-between items-center border-b border-base-200">
          <h3 className="font-bold text-lg">{t('common:receipt')}</h3>
          <button className="btn btn-sm btn-circle btn-ghost" onClick={onClose}>✕</button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto bg-base-200/50 flex justify-center py-4" id="ticket-preview-container">
          <div id="ticket-preview">
            <TicketTemplate ticket={ticket} settings={settings} />
          </div>
        </div>

        <div className="p-3 bg-base-50 border-t border-base-200 flex justify-end gap-2">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>{t('common:close')} (Esc)</button>
          
          {settings?.whatsapp_enabled && onSendWhatsApp && (
             <button 
               className="btn btn-outline btn-success btn-sm gap-2"
               onClick={onSendWhatsApp}
             >
               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 448 512">
                 <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 54 81.2 54 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-5.5-2.8-23.4-8.6-44.4-27.4-16.4-14.6-27.4-32.7-30.6-38.2-3.2-5.6-.3-8.6 2.5-11.3 2.5-2.4 5.5-6.5 8.3-9.7 2.8-3.3 3.7-5.6 5.5-9.3 1.9-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 13.2 5.8 23.5 9.2 31.5 11.8 13.3 4.2 25.4 3.6 35 2.2 10.7-1.5 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
               </svg>
               WhatsApp
             </button>
          )}

          <button
            className="btn btn-primary btn-sm"
            onClick={handlePrint}
          >
            {t('common:print')}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  )
}
