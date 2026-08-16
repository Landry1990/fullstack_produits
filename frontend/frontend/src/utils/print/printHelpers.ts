import i18next from 'i18next';
import DOMPurify from 'dompurify';
import { formatDateTime } from '../dateUtils';
import { formatNumber } from '../formatters';

/**
 * Utilitaires d'assistance pour l'impression
 */

/**
 * Écrit du contenu HTML dans une fenêtre d'impression sans utiliser document.write().
 * Utilise DOMParser pour analyser le HTML de manière sûre, puis innerHTML pour
 * l'injecter. Les scripts inline sont ré-exécutés manuellement car innerHTML
 * n'exécute pas les scripts.
 */
export function writePrintDocument(win: Window, html: string): void {
  const parsed = new DOMParser().parseFromString(html, 'text/html');

  win.document.head.innerHTML = parsed.head.innerHTML;
  win.document.body.innerHTML = parsed.body.innerHTML;
  win.document.title = parsed.title;

  const scripts = win.document.querySelectorAll('script');
  scripts.forEach(oldScript => {
    const newScript = win.document.createElement('script');
    if (oldScript.src) {
      newScript.src = oldScript.src;
    } else {
      newScript.textContent = oldScript.textContent;
    }
    oldScript.parentNode?.replaceChild(newScript, oldScript);
  });
}

/**
 * Échappe les caractères HTML spéciaux dans une chaîne provenant de la base de données.
 * Empêche l'injection HTML/XSS dans les templates d'impression.
 */
export function escHtml(value: unknown): string {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Formate un nombre en format monétaire français pour l'impression
 */
export function formatMoney(value: number | string): string {
  const num = Math.round(parseFloat(String(value)));
  return formatNumber(num);
}

/**
 * Formate une date pour l'impression (inclut l'heure par défaut)
 */
export function formatDateFr(dateString: string): string {
  if (!dateString) return '';
  return formatDateTime(dateString);
}

/**
 * Génère une ligne de détail pour impression HTML
 */
function _printRow(label: string, value: string): string {
  return `
    <div class="print-row">
      <span>${label}</span>
      <span>${value}</span>
    </div>
  `;
}

/**
 * Génère un séparateur horizontal pour impression HTML
 */
function _printDivider(): string {
  return '<div class="print-divider"></div>';
}

/**
 * Génère une ligne de total pour impression HTML
 */
function _printTotal(label: string, value: string): string {
  return `
    <div class="print-row print-total">
      <span>${label}</span>
      <span>${value}</span>
    </div>
  `;
}

/**
 * Retourne le libellé d'un mode de paiement
 */
export function getModeLabel(mode: string): string {
  const keys: Record<string, string> = {
    especes: 'common:payment_modes.cash',
    cheque: 'common:payment_modes.check',
    carte: 'common:payment_modes.card',
    virement: 'common:payment_modes.transfer',
    om: 'common:payment_modes.orange_money',
    momo: 'common:payment_modes.mobile_money',
    coupon: 'common:payment_modes.coupon',
    en_compte: 'common:payment_modes.recouvrement'
  };
  
  const key = keys[mode];
  if (key && i18next.exists(key)) {
    return i18next.t(key);
  }
  
  const fallbacks: Record<string, string> = {
    especes: 'Espèces',
    cheque: 'Chèque',
    carte: 'Carte',
    virement: 'Virement',
    om: 'Orange Money',
    momo: 'Mobile Money',
    coupon: 'Coupon de Monnaie',
    en_compte: 'En Compte'
  };
  return fallbacks[mode] || mode?.toUpperCase() || 'N/A';
}

/**
 * Génère le document HTML complet pour l'impression d'un ticket de caisse.
 */
export function buildTicketPrintHtml(ticketWidth: number, content: string, styleTags: string): string {
  const safeContent = DOMPurify.sanitize(content, { RETURN_TRUSTED_TYPE: false })
  const safeStyleTags = DOMPurify.sanitize(styleTags, {
    ALLOWED_TAGS: ['style', 'link'],
    ALLOWED_ATTR: ['rel', 'href', 'type', 'media'],
    RETURN_TRUSTED_TYPE: false,
  })

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <title>Ticket de Caisse</title>
  <base href="${window.location.origin}/">
  <!-- Polices système uniquement : évite tout appel réseau (Google Fonts) pour fonctionner offline. -->
  ${safeStyleTags}
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @media print {
      @page { 
        size: ${ticketWidth}mm auto; 
        margin: 0; 
      }
      html, body { 
        width: ${ticketWidth}mm !important;
        margin: 0 !important; 
        padding: 0 !important; 
        background: white !important;
        color: black !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
    html, body {
      width: ${ticketWidth}mm;
      max-width: ${ticketWidth}mm;
      margin: 0 auto;
      padding: 0;
      background: white !important;
      color: black !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
      overflow: hidden;
    }
    #print-root {
      width: ${ticketWidth}mm;
      max-width: ${ticketWidth}mm;
      overflow: hidden;
    }
    #ticket-preview {
      width: ${ticketWidth}mm !important;
      max-width: ${ticketWidth}mm !important;
      min-width: 0 !important;
      margin: 0 !important;
      padding: 2mm !important;
      background: white !important;
      color: black !important;
      box-shadow: none !important;
      outline: none !important;
      overflow: hidden;
      word-break: break-word;
      overflow-wrap: break-word;
    }
    #ticket-preview * {
      color: black !important;
    }
    #ticket-preview table { table-layout: fixed; width: 100% !important; }
    #ticket-preview td, #ticket-preview th { overflow: hidden; text-overflow: ellipsis; }
  </style>
</head>
<body>
  <div id="print-root">
    ${safeContent}
  </div>
  <script>
    window.onload = () => {
        const doPrint = () => {
            window.print();
            window.close();
        };
        if (document.fonts) {
            document.fonts.ready.then(() => {
                setTimeout(doPrint, 500);
            });
        } else {
            setTimeout(doPrint, 1500);
        }
    };
  </script>
</body>
</html>`
}
