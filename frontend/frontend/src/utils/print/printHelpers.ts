import i18next from 'i18next';
import DOMPurify from 'dompurify';
import { formatDateTime } from '../dateUtils';
import { formatNumber } from '../formatters';
import type { Commande, CommandeProduit } from '../../types';

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

function _computeReceptionTotals(produits: CommandeProduit[]) {
  let totalHT = 0;
  let totalTVA = 0;
  let totalLignes = 0;
  let totalUnites = 0;
  let totalGratuites = 0;

  for (const p of produits) {
    const qty = p.quantity || 0;
    const free = p.unites_gratuites || 0;
    const totalQty = qty + free;
    const priceCost = parseFloat(String(p.price_cost || p.price || 0));
    const tva = parseFloat(String(p.tva || 0));
    const lineHT = priceCost * totalQty;
    const lineTVA = lineHT * (tva / 100);

    totalHT += lineHT;
    totalTVA += lineTVA;
    totalLignes += 1;
    totalUnites += totalQty;
    totalGratuites += free;
  }

  return { totalHT, totalTVA, totalLignes, totalUnites, totalGratuites };
}

/**
 * Génère le document HTML complet pour l'impression d'un bon de réception.
 */
export function buildReceptionPrintHtml(commande: Commande, companyInfo: { name?: string; address?: string; tel?: string; niu?: string; rc?: string }, mode: 'normal' | 'inkless' = 'inkless'): string {
  const produits = (commande.produits || []) as CommandeProduit[];
  const { totalHT, totalTVA, totalLignes, totalUnites, totalGratuites } = _computeReceptionTotals(produits);
  const isInkless = mode === 'inkless';
  const primaryColor = isInkless ? '#334155' : '#0f172a';
  const lightColor = isInkless ? '#94a3b8' : '#64748b';
  const borderColor = isInkless ? '#cbd5e1' : '#0f172a';
  const headerBorder = isInkless ? '1px dashed #94a3b8' : '2px solid #0f172a';
  const tableHeaderBg = isInkless ? 'transparent' : '#f1f5f9';
  const tableBorder = isInkless ? '1px dashed #cbd5e1' : '2px solid #0f172a';
  const rowBorder = isInkless ? '1px dotted #cbd5e1' : '1px solid #e2e8f0';
  const totalsBorder = isInkless ? '1px dashed #94a3b8' : '2px solid #0f172a';
  const totalsBorderTop = isInkless ? '1px dashed #94a3b8' : '1px solid #0f172a';
  const totalTTC = totalHT + totalTVA;

  const companyName = escHtml(companyInfo.name || '');
  const companyAddress = escHtml(companyInfo.address || '');
  const companyTel = escHtml(companyInfo.tel || '');
  const companyNiu = escHtml(companyInfo.niu || '');
  const companyRc = escHtml(companyInfo.rc || '');

  const fournisseurName = escHtml(commande.fournisseur_nom || 'N/A');
  const ref = escHtml(commande.numero_facture || `CMD-${commande.id}`);
  const dateEmission = commande.date ? formatDateFr(commande.date) : '';
  const dateImpression = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const saisiePar = escHtml(commande.created_by_name || 'N/A');
  const cloturePar = escHtml(commande.closed_by_name || 'System Administrator');

  const rowsHtml = produits.map((p) => {
    const nom = escHtml(p.produit_nom || (typeof p.produit === 'object' ? p.produit.name : `Produit #${p.produit}`) || '');
    const lot = escHtml(p.lot || '');
    const exp = p.date_expiration ? new Date(p.date_expiration).toLocaleDateString('fr-FR', { month: '2-digit', year: 'numeric' }).replace('/', '/') : '';
    const cip = escHtml(p.produit_cip || (typeof p.produit === 'object' ? p.produit.cip1 : '') || '');
    const qty = p.quantity || 0;
    const free = p.unites_gratuites || 0;
    const stockAvant = (p.produit_stock || 0) - (qty + free);
    const stockApres = p.produit_stock || 0;
    const paHT = parseFloat(String(p.price_cost || p.price || 0));
    const totalLine = paHT * (qty + free);
    const tvaPct = parseFloat(String(p.tva || 0));

    return `
      <tr>
        <td>
          <div class="product-name">${nom}</div>
          ${lot ? `<div class="product-lot">LOT: ${lot}${exp ? `&nbsp;&nbsp;|&nbsp;&nbsp;EXP: ${exp}` : ''}</div>` : ''}
        </td>
        <td class="text-center">${cip}</td>
        <td class="text-center">${stockAvant > 0 ? stockAvant : 0}</td>
        <td class="text-center">${qty}</td>
        <td class="text-center">${free}</td>
        <td class="text-center">${stockApres}</td>
        <td class="text-right">${formatMoney(paHT)}${tvaPct > 0 ? ` <span class="tva">(${tvaPct.toFixed(2)}%)</span>` : ''}</td>
        <td class="text-right">${formatMoney(totalLine)}</td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <title>Bon de Réception N°${commande.id}</title>
  <base href="${window.location.origin}/">
  <style>
    @page { size: A4; margin: 12mm 10mm 15mm 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif; font-size: 10pt; color: ${primaryColor}; background: #fff; line-height: 1.4; }
    .page { width: 100%; max-width: 180mm; margin: 0 auto; }
    
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: ${headerBorder}; padding-bottom: 10px; margin-bottom: 16px; }
    .company-info .name { font-size: 16pt; font-weight: 700; color: ${primaryColor}; text-transform: uppercase; }
    .company-info .meta { font-size: 9pt; color: ${lightColor}; margin-top: 4px; }
    .doc-type { border: ${totalsBorder}; padding: 8px 20px; font-size: 13pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; text-align: center; }
    .doc-ref { text-align: right; font-size: 9pt; color: ${lightColor}; margin-top: 6px; }
    
    .info-grid { display: flex; justify-content: space-between; gap: 20px; margin-bottom: 16px; }
    .info-box { flex: 1; }
    .info-box h3 { font-size: 8pt; text-transform: uppercase; color: ${lightColor}; margin-bottom: 4px; letter-spacing: 0.5px; }
    .info-box .value { font-size: 11pt; font-weight: 600; color: ${primaryColor}; }
    .info-box .sub { font-size: 9pt; color: ${lightColor}; margin-top: 2px; }
    
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 9pt; }
    th { background: ${tableHeaderBg}; color: ${primaryColor}; font-weight: 600; text-transform: uppercase; font-size: 8pt; padding: 8px 6px; border-top: ${tableBorder}; border-bottom: ${tableBorder}; text-align: left; }
    td { padding: 8px 6px; border-bottom: ${rowBorder}; vertical-align: top; }
    .product-name { font-weight: 500; color: ${primaryColor}; }
    .product-lot { font-size: 8pt; color: ${lightColor}; margin-top: 2px; }
    .tva { font-size: 7pt; color: ${lightColor}; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    
    .summary { margin-top: 12px; display: flex; justify-content: space-between; align-items: flex-start; }
    .summary-left { font-size: 9pt; color: ${lightColor}; }
    .summary-left span { display: inline-block; margin-right: 16px; }
    .totals-box { border: ${totalsBorder}; padding: 12px 16px; min-width: 160px; }
    .totals-box .row { display: flex; justify-content: space-between; font-size: 9pt; margin-bottom: 4px; }
    .totals-box .row.total { font-size: 13pt; font-weight: 700; margin-top: 8px; padding-top: 8px; border-top: ${totalsBorderTop}; }
    
    .footer-note { margin-top: 20px; font-size: 8pt; color: ${lightColor}; font-style: italic; border-top: ${rowBorder}; padding-top: 8px; }
    .print-footer { margin-top: 30px; text-align: center; font-size: 7pt; color: ${lightColor}; }
    
    @media print {
      html, body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="company-info">
        <div class="name">${companyName}</div>
        <div class="meta">${companyAddress}${companyAddress ? '<br/>' : ''}Tél: ${companyTel}${companyTel ? '' : ''}${companyNiu || companyRc ? '<br/>' : ''}${companyNiu ? `NIU: ${companyNiu}` : ''}${companyNiu && companyRc ? ' | ' : ''}${companyRc ? `RC: ${companyRc}` : ''}</div>
      </div>
      <div style="text-align: right;">
        <div class="doc-type">Bon de Réception</div>
        <div class="doc-ref">RÉF: ${ref}</div>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-box">
        <h3>Fournisseur</h3>
        <div class="value">${fournisseurName}</div>
      </div>
      <div class="info-box" style="text-align: right;">
        <h3>Détails de Réception</h3>
        <div class="sub"><b>Date d'émission:</b> ${dateEmission}</div>
        <div class="sub"><b>Imprimé le:</b> ${dateImpression}</div>
        <div class="sub"><b>Saisie par:</b> ${saisiePar}</div>
        <div class="sub"><b>Clôturée par:</b> ${cloturePar}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Produit / Désignation</th>
          <th class="text-center">CIP / Code</th>
          <th class="text-center">stAnt</th>
          <th class="text-center">Qté</th>
          <th class="text-center">U.G</th>
          <th class="text-center">Stock</th>
          <th class="text-right">PA HT</th>
          <th class="text-right">Total HT</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div class="summary">
      <div class="summary-left">
        <span><b>Lignes:</b> ${totalLignes}</span>
        <span><b>Unités:</b> ${totalUnites}</span>
        <span><b>Gratuites:</b> ${totalGratuites}</span>
      </div>
      <div class="totals-box">
        <div class="row"><span>TOTAL HT:</span><span>${formatMoney(totalHT)} F</span></div>
        <div class="row"><span>TOTAL TVA:</span><span>${formatMoney(totalTVA)} F</span></div>
        <div class="row total"><span>Total TTC Réception</span><span>${formatMoney(totalTTC)} FCFA</span></div>
      </div>
    </div>

    <div class="footer-note">Ce document atteste la réception physique des articles mentionnés dans les stocks de l'établissement.</div>
    <div class="print-footer">Logiciel de Gestion Antigravity POS - Document Interne</div>
  </div>
  <script>
    window.onload = () => {
      if (document.fonts) {
        document.fonts.ready.then(() => setTimeout(() => { window.print(); }, 500));
      } else {
        setTimeout(() => { window.print(); }, 1000);
      }
    };
  </script>
</body>
</html>`;
}
