import { useTranslation } from 'react-i18next'
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
    const ticketElement = document.getElementById('ticket-preview');
    if (!ticketElement) return;
    
    // Get computed styles from the preview element
    const ticketWidth = settings.ticket_paper_width || 80;
    
    // Clone the element to preserve all styles
    const clonedElement = ticketElement.cloneNode(true) as HTMLElement;
    
    // Get all styles from the original element and its children
    const getAllStyles = (element: HTMLElement): string => {
      let styles = '';
      const computed = window.getComputedStyle(element);
      const tagName = element.tagName.toLowerCase();
      
      // Get inline styles
      if (element.style.cssText) {
        styles += `#ticket-print ${tagName} { ${element.style.cssText} }\n`;
      }
      
      // Get computed styles for key properties
      const importantProps = ['font-family', 'font-size', 'font-weight', 'color', 'background-color', 
                              'padding', 'margin', 'border', 'text-align', 'display', 'flex-direction',
                              'justify-content', 'align-items', 'width', 'max-width', 'min-width'];
      
      importantProps.forEach(prop => {
        const value = computed.getPropertyValue(prop);
        if (value) {
          styles += `#ticket-print ${tagName} { ${prop}: ${value}; }\n`;
        }
      });
      
      // Recursively get styles from children
      Array.from(element.children).forEach(child => {
        styles += getAllStyles(child as HTMLElement);
      });
      
      return styles;
    };
    
    const content = clonedElement.outerHTML;
    const additionalStyles = getAllStyles(ticketElement);
    
    const win = window.open('', '', 'height=600,width=400');
    if (win && content) {
      win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Ticket de Caisse</title>
  <style>
    @media print {
      @page { 
        size: ${ticketWidth}mm auto; 
        margin: 0; 
      }
      body { 
        margin: 0; 
        padding: 0; 
      }
      #ticket-print {
        width: ${ticketWidth}mm !important;
        max-width: ${ticketWidth}mm !important;
        min-width: ${ticketWidth}mm !important;
        margin: 0 auto;
      }
    }
    body {
      margin: 0;
      padding: 0;
      background: white;
      font-family: 'Courier New', monospace;
    }
    #ticket-print {
      width: ${ticketWidth}mm;
      max-width: ${ticketWidth}mm;
      min-width: ${ticketWidth}mm;
      margin: 0 auto;
      padding: 1rem;
      background: white;
      color: black;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      line-height: 1.4;
    }
    ${additionalStyles}
    /* Preserve Tailwind-like classes */
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .font-semibold { font-weight: 600; }
    .font-black { font-weight: 900; }
    .uppercase { text-transform: uppercase; }
    .border-b { border-bottom: 1px solid black; }
    .border-t { border-top: 1px solid black; }
    .border-y { border-top: 1px solid black; border-bottom: 1px solid black; }
    .border-dashed { border-style: dashed; }
    .border-dotted { border-style: dotted; }
    .flex { display: flex; }
    .justify-between { justify-content: space-between; }
    .justify-center { justify-content: center; }
    .items-start { align-items: flex-start; }
    .space-y-1 > * + * { margin-top: 0.25rem; }
    .space-y-0\.5 > * + * { margin-top: 0.125rem; }
    .mb-1 { margin-bottom: 0.25rem; }
    .mb-2 { margin-bottom: 0.5rem; }
    .mb-3 { margin-bottom: 0.75rem; }
    .mb-4 { margin-bottom: 1rem; }
    .mt-1 { margin-top: 0.25rem; }
    .mt-2 { margin-top: 0.5rem; }
    .mt-4 { margin-top: 1rem; }
    .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
    .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
    .pb-2 { padding-bottom: 0.5rem; }
    .pb-3 { padding-bottom: 0.75rem; }
    .pt-1 { padding-top: 0.25rem; }
    .pt-2 { padding-top: 0.5rem; }
    .pr-2 { padding-right: 0.5rem; }
    .text-xs { font-size: 0.75rem; }
    .text-\[11px\] { font-size: 11px; }
    .text-\[10px\] { font-size: 10px; }
    .text-base { font-size: 1rem; }
    .text-lg { font-size: 1.125rem; }
    .leading-relaxed { line-height: 1.625; }
    .whitespace-nowrap { white-space: nowrap; }
    .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .max-w-\[50\%\] { max-width: 50%; }
    .flex-1 { flex: 1 1 0%; }
  </style>
</head>
<body>
  <div id="ticket-print">
    ${content}
  </div>
</body>
</html>`);
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
