import i18next from 'i18next';
import { escHtml, formatMoney } from './printHelpers';
import { getDocumentLanguage, getDocumentLocale } from '../documentLang';
import type { PharmacySettings } from '../../types';

export interface RelevePrintProduit {
    produit_nom?: string;
    quantity: number | string;
    selling_price: number | string;
    discount?: number | string;
    total_ligne: number | string;
}

export interface RelevePrintCreance {
    id?: number;
    numero_facture?: string;
    date?: string | null;
    ayant_droit?: string | null;
    societe?: string | null;
    montant_total: number | string;
    montant_paye: number | string;
    reste_a_payer: number | string;
    produits?: RelevePrintProduit[];
}

export interface RelevePrintData {
    client: {
        id?: number;
        name: string;
        address?: string;
        phone?: string;
        email?: string;
        niu?: string;
        registre_commerce?: string;
    };
    creances: RelevePrintCreance[];
    totaux: {
        total_factures: number | string;
        total_paye: number | string;
        total_reste: number | string;
        total_lettres?: string;
    };
    periode?: {
        date_debut?: string | null;
        date_fin?: string | null;
    };
    includeProducts?: boolean;
}

/**
 * Génère le document HTML complet pour l'impression d'un relevé de factures
 * (groupé ou détaillé avec produits). A4, impression navigateur — même
 * habillage que le ticket de règlement (relevePaiementPrintHtml).
 */
export function buildRelevePrintHtml(data: RelevePrintData, settings?: PharmacySettings | null): string {
    const docLang = getDocumentLanguage();
    const docLocale = getDocumentLocale();
    const docT = i18next.getFixedT(docLang, 'printing');

    const fmt = (v: number | string | null | undefined) => formatMoney(v ?? 0, docLocale);
    const reste = Number(data.totaux.total_reste) || 0;

    const primary = '#0f172a';
    const light = '#64748b';
    const accent = '#16a34a';
    const amber = '#b45309';
    const border = '#0f172a';
    const rowBorder = '1px solid #e2e8f0';

    const fmtDate = (d?: string | null) => d
        ? new Date(d).toLocaleDateString(docLocale, { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '—';

    // Période réellement couverte : « Du » = borne demandée ou plus ancienne
    // facture du relevé ; « Au » = borne demandée ou date d'édition.
    const earliest = data.creances.reduce<string | null>(
        (acc, c) => (c.date && (!acc || c.date < acc) ? c.date : acc), null
    );
    const periodDebut = data.periode?.date_debut || earliest;
    const periodFin = data.periode?.date_fin;
    const todayLabel = new Date().toLocaleDateString(docLocale, { day: '2-digit', month: '2-digit', year: 'numeric' });

    const refDate = new Date();
    const ref = `REL-${data.client.id ?? '0'}-${refDate.getFullYear()}${String(refDate.getMonth() + 1).padStart(2, '0')}${String(refDate.getDate()).padStart(2, '0')}`;

    const includeProducts = data.includeProducts || false;
    const title = includeProducts ? docT('releve.title_detailed') : docT('releve.title');

    const clientMeta = [
        data.client.niu ? `NIU: ${escHtml(data.client.niu)}` : '',
        data.client.registre_commerce ? `RC: ${escHtml(data.client.registre_commerce)}` : '',
        data.client.phone ? escHtml(data.client.phone) : '',
        data.client.address ? escHtml(data.client.address) : '',
    ].filter(Boolean).join(' | ');

    const productRows = (c: RelevePrintCreance) => (c.produits || []).map(p => `
            <tr>
                <td>${escHtml(p.produit_nom || '-')}</td>
                <td class="text-center">${escHtml(String(p.quantity))}</td>
                <td class="text-right">${fmt(p.selling_price)}</td>
                <td class="text-right">${Number(p.discount) > 0 ? fmt(p.discount) : '-'}</td>
                <td class="text-right strong">${fmt(p.total_ligne)}</td>
            </tr>`).join('');

    const bodyHtml = includeProducts
        ? data.creances.map(c => {
            const benef = [c.ayant_droit, c.societe].filter(Boolean).join(' — ') || '-';
            const rows = productRows(c);
            return `
    <div class="invoice-block">
        <div class="invoice-head">
            <span class="invoice-title">${escHtml(fmtDate(c.date))} &nbsp; ${escHtml(c.numero_facture || '-')} &nbsp; ${escHtml(benef.toUpperCase())}</span>
            <span class="invoice-amounts">${escHtml(docT('releve.ttc'))} ${fmt(c.montant_total)} &nbsp;·&nbsp; ${escHtml(docT('releve.paid'))} ${fmt(c.montant_paye)} &nbsp;·&nbsp; ${escHtml(docT('releve.remaining'))} <b>${fmt(c.reste_a_payer)}</b></span>
        </div>
        ${rows
            ? `<table class="products">
                <thead><tr>
                    <th>${escHtml(docT('releve.col_product'))}</th>
                    <th class="text-center" style="width: 10%;">${escHtml(docT('releve.col_qty'))}</th>
                    <th class="text-right" style="width: 15%;">${escHtml(docT('releve.col_pu'))}</th>
                    <th class="text-right" style="width: 15%;">${escHtml(docT('releve.col_discount'))}</th>
                    <th class="text-right" style="width: 17%;">${escHtml(docT('releve.col_line_total'))}</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>`
            : `<div class="no-products">${escHtml(docT('releve.no_products'))}</div>`}
    </div>`;
        }).join('')
        : `<table class="fixed">
      <thead>
        <tr>
          <th class="text-center" style="width: 5%;">${escHtml(docT('reglement.col_num'))}</th>
          <th style="width: 11%;">${escHtml(docT('releve.col_date'))}</th>
          <th style="width: 15%;">${escHtml(docT('releve.col_invoice_num'))}</th>
          <th style="width: 20%;">${escHtml(docT('releve.col_beneficiary'))}</th>
          <th style="width: 13%;">${escHtml(docT('releve.col_societe'))}</th>
          <th class="text-right" style="width: 12%;">${escHtml(docT('releve.col_total_ttc'))}</th>
          <th class="text-right" style="width: 12%;">${escHtml(docT('releve.col_paid'))}</th>
          <th class="text-right" style="width: 12%;">${escHtml(docT('releve.col_remaining'))}</th>
        </tr>
      </thead>
      <tbody>
        ${data.creances.map((c, idx) => `
        <tr>
            <td class="text-center">${idx + 1}</td>
            <td>${escHtml(fmtDate(c.date))}</td>
            <td>${escHtml(c.numero_facture || '-')}</td>
            <td>${escHtml(c.ayant_droit ? c.ayant_droit.toUpperCase() : '-')}</td>
            <td>${escHtml(c.societe ? c.societe.toUpperCase() : '-')}</td>
            <td class="text-right">${fmt(c.montant_total)}</td>
            <td class="text-right">${fmt(c.montant_paye)}</td>
            <td class="text-right strong" style="color: ${Number(c.reste_a_payer) > 0 ? amber : accent};">${fmt(c.reste_a_payer)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;

    return `<!DOCTYPE html>
<html lang="${docLang}">
<head>
  <title>${escHtml(title)} ${escHtml(ref)}</title>
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
    .doc-type { border: 2px solid ${border}; padding: 8px 20px; font-size: 12pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; text-align: center; }
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
    /* Noms sur une seule ligne : colonnes fixes + ellipsis plutôt que retour à la ligne. */
    table.fixed { table-layout: fixed; }
    table.fixed th, table.fixed td { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .invoice-block { margin-bottom: 12px; break-inside: avoid; }
    .invoice-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; background: #f1f5f9; border: ${rowBorder}; padding: 6px 10px; font-size: 9pt; }
    .invoice-title { font-weight: 700; text-transform: uppercase; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .invoice-amounts { color: ${light}; white-space: nowrap; }
    table.products { margin-top: 0; }
    table.products th { border-top: none; }
    .no-products { font-size: 8.5pt; color: ${light}; font-style: italic; padding: 5px 10px; border: ${rowBorder}; border-top: none; }

    .summary { margin-top: 14px; display: flex; justify-content: space-between; align-items: stretch; gap: 20px; break-inside: avoid; }
    .summary-msg { flex: 1; font-size: 9pt; color: ${light}; font-style: italic; align-self: center; }
    .totals-box { min-width: 70mm; padding: 10px 16px; border: 1px solid #cbd5e1; border-radius: 8px; }
    .totals-box .row { display: flex; justify-content: space-between; align-items: center; padding: 3px 0; font-size: 10pt; }
    .totals-box .row .lbl { color: ${light}; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.4px; }
    .totals-box .row.total { border-top: 2px solid ${border}; margin-top: 6px; padding-top: 8px; }
    .totals-box .row.total .val { font-size: 13pt; font-weight: 700; }
    .totals-box .row.reste .val { font-weight: 700; color: ${reste > 0 ? amber : accent}; }

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
        <div class="doc-type">${escHtml(title)}</div>
        <div class="doc-ref">${escHtml(docT('releve.ref'))} ${escHtml(ref)}<br/>${escHtml(docT('releve.issued_on', { date: todayLabel }))}</div>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-box">
        <h3>${escHtml(docT('releve.client'))}</h3>
        <div class="value">${escHtml(data.client.name)}</div>
        ${clientMeta ? `<div class="sub">${clientMeta}</div>` : ''}
      </div>
      <div class="info-box" style="text-align: right;">
        <h3>${escHtml(docT('releve.period'))}</h3>
        <div class="value" style="font-size: 10pt;">${escHtml(docT('releve.from'))} ${escHtml(periodDebut ? fmtDate(periodDebut) : '—')}<br/>${escHtml(docT('releve.to'))} ${escHtml(periodFin ? fmtDate(periodFin) : todayLabel)}</div>
      </div>
    </div>

    ${bodyHtml}

    <div class="summary">
      <div class="summary-msg">
        ${data.totaux.total_lettres ? `${escHtml(docT('releve.amount_in_words'))}<br/><b>${escHtml(data.totaux.total_lettres)}</b>` : ''}
      </div>
      <div class="totals-box">
        <div class="row"><span class="lbl">${escHtml(docT('releve.total_invoiced'))}</span><span class="val">${fmt(data.totaux.total_factures)} F</span></div>
        <div class="row"><span class="lbl">${escHtml(docT('releve.total_paid'))}</span><span class="val">${fmt(data.totaux.total_paye)} F</span></div>
        <div class="row total reste"><span class="lbl">${escHtml(docT('releve.net_to_pay'))}</span><span class="val">${fmt(data.totaux.total_reste)} F</span></div>
      </div>
    </div>

    <div class="print-footer">
      ${escHtml(docT('releve.justification'))}<br/>
      ${escHtml(docT('releve.generated_on', { date: new Date().toLocaleString(docLocale) }))}
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
