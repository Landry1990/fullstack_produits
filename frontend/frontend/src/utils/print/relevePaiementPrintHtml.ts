import i18next from 'i18next';
import { escHtml, formatMoney, getModeLabel } from './printHelpers';
import { getDocumentLanguage, getDocumentLocale } from '../documentLang';
import type { PharmacySettings } from '../../types';

export interface RelevePaiementPrintItem {
    facture_id?: number;
    numero_facture: string;
    montant_total_facture: number | string;
    montant_paye: number | string;
    reste_apres: number | string;
    est_soldee: boolean | string;
}

export interface RelevePaiementPrintData {
    reference: string;
    date?: string;
    client_name: string;
    client_niu?: string;
    client_rc?: string;
    mode_paiement: string;
    total_dettes: number | string;
    montant_regle: number | string;
    reste_a_payer: number | string;
    paiements: RelevePaiementPrintItem[];
}

/**
 * Génère le document HTML complet pour l'impression d'un ticket de règlement
 * (récapitulatif de paiement groupé de créances). A4, impression navigateur.
 */
export function buildRelevePaiementPrintHtml(data: RelevePaiementPrintData, settings?: PharmacySettings | null): string {
    const docLang = getDocumentLanguage();
    const docLocale = getDocumentLocale();
    const docT = i18next.getFixedT(docLang, 'printing');

    const fmt = (v: number | string | null | undefined) => formatMoney(v ?? 0, docLocale);
    const reste = Number(data.reste_a_payer) || 0;

    const primary = '#0f172a';
    const light = '#64748b';
    const accent = '#16a34a';
    const border = '#0f172a';
    const rowBorder = '1px solid #e2e8f0';

    const dateReleve = data.date
        ? new Date(data.date).toLocaleString(docLocale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleString(docLocale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const modeLabel = getModeLabel(data.mode_paiement);

    const rowsHtml = data.paiements.map((p, idx) => {
        const isSoldee = p.est_soldee === true || String(p.est_soldee).toLowerCase() === 'true';
        const resteApres = Number(p.reste_apres) || 0;
        const statutHtml = isSoldee
            ? `<span class="badge-paid">${escHtml(docT('reglement.status_paid'))}</span>`
            : `<span class="badge-partial">${escHtml(docT('reglement.remaining_suffix', { amount: fmt(resteApres) }))}</span>`;
        return `
        <tr>
            <td class="text-center">${idx + 1}</td>
            <td>${escHtml(p.numero_facture || '-')}</td>
            <td class="text-right">${fmt(p.montant_total_facture)}</td>
            <td class="text-right strong">${fmt(p.montant_paye)}</td>
            <td class="text-center">${statutHtml}</td>
        </tr>`;
    }).join('');

    const clientMeta = [data.client_niu ? `NIU: ${escHtml(data.client_niu)}` : '', data.client_rc ? `RC: ${escHtml(data.client_rc)}` : '']
        .filter(Boolean).join(' | ');

    return `<!DOCTYPE html>
<html lang="${docLang}">
<head>
  <title>${escHtml(docT('reglement.title'))} ${escHtml(data.reference)}</title>
  <meta charset="UTF-8">
  <style>
    @page { size: A4; margin: 12mm 10mm 15mm 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
      font-size: 10pt; color: ${primary}; background: #fff; line-height: 1.4;
      -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .page { width: 100%; max-width: 180mm; margin: 0 auto; }

    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid ${border}; padding-bottom: 10px; margin-bottom: 16px; }
    .company-info .name { font-size: 16pt; font-weight: 700; color: ${primary}; text-transform: uppercase; }
    .company-info .meta { font-size: 9pt; color: ${light}; margin-top: 4px; }
    .company-logo { max-height: 16mm; max-width: 45mm; object-fit: contain; filter: grayscale(100%); }
    .doc-type { border: 2px solid ${border}; padding: 8px 20px; font-size: 13pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; text-align: center; }
    .doc-ref { text-align: right; font-size: 9pt; color: ${light}; margin-top: 6px; }

    .info-grid { display: flex; justify-content: space-between; gap: 20px; margin-bottom: 16px; }
    .info-box { flex: 1; }
    .info-box h3 { font-size: 8pt; text-transform: uppercase; color: ${light}; margin-bottom: 4px; letter-spacing: 0.5px; }
    .info-box .value { font-size: 11pt; font-weight: 600; color: ${primary}; }
    .info-box .sub { font-size: 9pt; color: ${light}; margin-top: 2px; }

    table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 9.5pt; }
    th { color: ${primary}; font-weight: 600; text-transform: uppercase; font-size: 8pt; padding: 8px 6px; border-top: 2px solid ${border}; border-bottom: 2px solid ${border}; text-align: left; }
    td { padding: 7px 6px; border-bottom: ${rowBorder}; vertical-align: middle; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .strong { font-weight: 600; }
    .badge-paid { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 8pt; font-weight: 700; text-transform: uppercase; background: #dcfce7; color: #166534; }
    .badge-partial { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 8pt; font-weight: 600; background: #fef9c3; color: #854d0e; }

    .summary { margin-top: 14px; display: flex; justify-content: space-between; align-items: stretch; gap: 20px; }
    .summary-msg { flex: 1; font-size: 9pt; color: ${light}; font-style: italic; align-self: center; }
    .summary-msg.ok { color: ${accent}; font-style: normal; font-weight: 600; }
    .totals-box { min-width: 70mm; padding: 10px 16px; border: 1px solid #cbd5e1; border-radius: 8px; }
    .totals-box .row { display: flex; justify-content: space-between; align-items: center; padding: 3px 0; font-size: 10pt; }
    .totals-box .row .lbl { color: ${light}; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.4px; }
    .totals-box .row.total { border-top: 2px solid ${border}; margin-top: 6px; padding-top: 8px; }
    .totals-box .row.total .val { font-size: 13pt; font-weight: 700; }
    .totals-box .row.reste .val { font-weight: 700; color: ${reste > 0 ? '#b45309' : accent}; }

    .print-footer { margin-top: 34px; text-align: center; font-size: 7.5pt; color: ${light}; border-top: ${rowBorder}; padding-top: 8px; }

    @media print {
      html, body { background: white !important; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="company-info">
        ${settings?.logo ? `<img class="company-logo" src="${escHtml(settings.logo)}" alt="" />` : ''}
        <div class="name">${escHtml(settings?.pharmacy_name || 'PHARMACIE')}</div>
        <div class="meta">${escHtml(settings?.address || '')}${settings?.address ? '<br/>' : ''}${settings?.phone ? `${escHtml(docT('reglement.phone_short'))}${escHtml(settings.phone)}` : ''}${settings?.niu ? ` | NIU: ${escHtml(settings.niu)}` : ''}${settings?.registre_commerce ? ` | RC: ${escHtml(settings.registre_commerce)}` : ''}</div>
      </div>
      <div style="text-align: right;">
        <div class="doc-type">${escHtml(docT('reglement.title'))}</div>
        <div class="doc-ref">${escHtml(docT('reglement.reference'))} ${escHtml(data.reference)}</div>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-box">
        <h3>${escHtml(docT('reglement.client'))}</h3>
        <div class="value">${escHtml(data.client_name)}</div>
        ${clientMeta ? `<div class="sub">${clientMeta}</div>` : ''}
      </div>
      <div class="info-box" style="text-align: right;">
        <h3>${escHtml(docT('reglement.mode'))}</h3>
        <div class="value">${escHtml(modeLabel.toUpperCase())}</div>
        <div class="sub"><b>${escHtml(docT('reglement.date'))}</b> ${escHtml(dateReleve)}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="text-center" style="width: 8%;">${escHtml(docT('reglement.col_num'))}</th>
          <th style="width: 34%;">${escHtml(docT('reglement.col_invoice'))}</th>
          <th class="text-right" style="width: 20%;">${escHtml(docT('reglement.col_total'))}</th>
          <th class="text-right" style="width: 20%;">${escHtml(docT('reglement.col_paid'))}</th>
          <th class="text-center" style="width: 18%;">${escHtml(docT('reglement.col_status'))}</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div class="summary">
      <div class="summary-msg ${reste > 0 ? '' : 'ok'}">
        ${reste > 0
            ? escHtml(docT('reglement.remaining_msg', { amount: fmt(data.reste_a_payer) }))
            : escHtml(docT('reglement.all_paid_msg'))}
      </div>
      <div class="totals-box">
        <div class="row"><span class="lbl">${escHtml(docT('reglement.total_debts'))}</span><span class="val">${fmt(data.total_dettes)} F</span></div>
        <div class="row total"><span class="lbl">${escHtml(docT('reglement.amount_paid'))}</span><span class="val">${fmt(data.montant_regle)} F</span></div>
        <div class="row reste"><span class="lbl">${escHtml(docT('reglement.balance_due'))}</span><span class="val">${fmt(data.reste_a_payer)} F</span></div>
      </div>
    </div>

    <div class="print-footer">
      ${escHtml(docT('reglement.justification'))}<br/>
      ${escHtml(docT('reglement.generated_on', { date: new Date().toLocaleString(docLocale) }))}
    </div>
  </div>
  <script>
    window.onload = () => {
        const doPrint = () => { window.print(); };
        if (document.fonts) {
            document.fonts.ready.then(() => setTimeout(doPrint, 400));
        } else {
            setTimeout(doPrint, 1200);
        }
    };
  </script>
</body>
</html>`;
}
