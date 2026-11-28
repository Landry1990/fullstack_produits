/**
 * Utilitaires purs de l'écran Historique des clôtures :
 * formatage dates API, agrégation journalière, export Excel, impression ticket.
 * Code déplacé tel quel depuis `components/HistoriqueClotures.tsx`.
 */
import type { TFunction } from 'i18next'
import { gooeyToast } from 'goey-toast'
import { normalizeNumberInput } from '../../../utils/formatters'
import { logger } from '../../../utils/logger'
import { getDocumentLocale } from '../../../utils/documentLang'
import { exportToExcel, fitExcelColumns } from '../../../utils/excelExport'
import { generateClotureTemplate } from '../../../utils/print/printTemplates'
import { escHtml, formatDateFr, writePrintDocument } from '../../../utils/print/printHelpers'
import { printClotureSmart } from '../../../utils/print/printClotureSmart'
import type { ClotureCaisse, ClotureSalesReport, CloturesViewMode, DailyAggregate } from './types'
import type { PharmacySettings } from '../../../types'

function saleTime(date: string): string {
  return new Date(date).toLocaleTimeString(getDocumentLocale(), { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function buildClotureSalesRows(report: ClotureSalesReport, t: TFunction): Record<string, string | number>[] {
  if (report.produits) {
    const values: Record<string, string | number>[] = report.produits.lignes.map(line => ({
      [t('sales.number')]: line.numero,
      [t('sales.time')]: saleTime(line.date_encaissement),
      [t('sales.product')]: line.produit || '—',
      [t('sales.quantity')]: line.quantite,
      [t('sales.unit_price')]: Number(line.prix_unitaire),
      [t('sales.net_amount')]: Number(line.montant),
    }))
    values.push({
      [t('sales.number')]: t('sales.totals'),
      [t('sales.time')]: '',
      [t('sales.product')]: '',
      [t('sales.quantity')]: report.produits.totaux.quantite,
      [t('sales.unit_price')]: '',
      [t('sales.net_amount')]: Number(report.produits.totaux.montant),
    })
    return values
  }
  const values = report.ventes.map(sale => ({
    [t('sales.number')]: sale.numero,
    [t('sales.time')]: saleTime(sale.date_encaissement),
    [t('sales.seller')]: sale.vendeur || '—',
    [t('sales.cashier')]: sale.caissier,
    [t('sales.amount')]: Number(sale.montant),
    [t('sales.paid')]: Number(sale.regle),
    [t('sales.on_account')]: Number(sale.en_compte),
  }))
  values.push({
    [t('sales.number')]: t('sales.totals'),
    [t('sales.time')]: '',
    [t('sales.seller')]: '',
    [t('sales.cashier')]: '',
    [t('sales.amount')]: Number(report.totaux.montant),
    [t('sales.paid')]: Number(report.totaux.regle),
    [t('sales.on_account')]: Number(report.totaux.en_compte),
  })
  return values
}

function salesPeriod(report: ClotureSalesReport, t: TFunction): string {
  return t('sales.period', {
    start: report.date_debut ? formatDateFr(report.date_debut) : t('sales.beginning'),
    end: formatDateFr(report.date_fin),
  })
}

export function exportClotureSalesExcel(report: ClotureSalesReport, settings: PharmacySettings, t: TFunction): void {
  exportToExcel(buildClotureSalesRows(report, t), { ...settings, city: settings.city || '' }, {
    filename: `${report.produits ? 'Produits_' : ''}Ventes_Cloture_${report.cloture_id}.xlsx`,
    sheetName: t(report.produits ? 'sales.products_sheet' : 'sales.sheet_name'),
    title: [
      t(report.produits ? 'sales.products_title' : 'sales.title', { id: report.cloture_id }), salesPeriod(report, t),
      `${t('sales.cashier')} : ${report.caissier}`,
      report.poste_caisse, t(report.produits ? 'sales.products_note' : 'sales.note'),
    ].filter(Boolean).join('\n'),
  })
}

export function generateClotureSalesHtml(report: ClotureSalesReport, settings: PharmacySettings, t: TFunction): string {
  const rows = buildClotureSalesRows(report, t)
  const headers = Object.keys(rows[0])
  const numericHeaders = new Set(headers.filter(header => typeof rows[0][header] === 'number'))
  const renderRow = (row: Record<string, string | number>) => `<tr>${headers.map(header => {
    const value = row[header]
    return `<td${numericHeaders.has(header) ? ' class="money"' : ''}>${escHtml(typeof value === 'number' ? value.toLocaleString(getDocumentLocale(), { maximumFractionDigits: 2 }) : value)}</td>`
  }).join('')}</tr>`
  const title = t(report.produits ? 'sales.products_title' : 'sales.title', { id: report.cloture_id })
  return `<!DOCTYPE html><html lang="${escHtml(settings.locale || 'fr-FR')}"><head>
    <meta charset="utf-8"><meta name="color-scheme" content="only light"><title>${escHtml(title)}</title>
    <style>
      @page { size: A4 portrait; margin: 12mm; }
      html { color-scheme: only light; background: #fff; }
      body { margin: 0; background: #fff; color: #0f172a; font: 11px Arial, sans-serif; }
      h1 { font-size: 17px; margin: 16px 0 8px; }
      .pharmacy { font-size: 18px; font-weight: bold; }
      .meta { margin: 4px 0; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { border: 1px solid #cbd5e1; padding: 6px; text-align: left; overflow-wrap: anywhere; }
      td { background: #fff; }
      th, tfoot td { background: #f1f5f9; }
      .money { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
      thead { display: table-header-group; }
      tfoot { display: table-row-group; font-weight: bold; background: #f1f5f9; }
      tr { break-inside: avoid; }
      .note { color: #475569; font-size: 10px; margin-top: 12px; }
    </style>
    </head><body>
    <div class="pharmacy">${escHtml(settings.pharmacy_name)}</div>
    <div class="meta">${escHtml([settings.address, settings.city].filter(Boolean).join(' — '))}</div>
    <div class="meta">${escHtml(settings.phone)}</div>
    <h1>${escHtml(title)}</h1>
    <div class="meta">${escHtml(salesPeriod(report, t))}</div>
    <div class="meta">${escHtml(t('sales.cashier'))} : ${escHtml(report.caissier)}${report.poste_caisse ? ` — ${escHtml(report.poste_caisse)}` : ''}</div>
    <div class="meta">${escHtml(t('sales.count', { count: report.count }))} — ${escHtml(settings.currency_symbol || 'FCFA')}</div>
    <table><thead><tr>${headers.map(header => `<th${numericHeaders.has(header) ? ' class="money"' : ''}>${escHtml(header)}</th>`).join('')}</tr></thead>
    <tbody>${rows.slice(0, -1).map(renderRow).join('')}</tbody>
    <tfoot>${renderRow(rows[rows.length - 1])}</tfoot></table>
    <p class="note">${escHtml(t(report.produits ? 'sales.products_note' : 'sales.note'))}</p>
    </body></html>`
}

export const formatDateForApi = (date: Date): string => {
  const pad = (num: number) => num.toString().padStart(2, '0')
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  return `${year}-${month}-${day}`
}

export const formatDay = (dateString: string): string => {
  return new Date(dateString + 'T00:00:00').toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

/** Agrégation journalière des clôtures (vue "Par jour"). */
export function buildDailyData(clotures: ClotureCaisse[]): DailyAggregate[] {
  const map = new Map<string, DailyAggregate>()

  clotures.forEach(c => {
    const d = c.date?.split('T')[0] || ''
    if (!d) return
    const existing = map.get(d)
    if (existing) {
      existing.count += 1
      existing.montant_theorique += normalizeNumberInput(c.montant_theorique)
      existing.montant_reel += normalizeNumberInput(c.montant_reel)
      existing.ecart_caisse += normalizeNumberInput(c.ecart_caisse)
      existing.total_ventes += normalizeNumberInput(c.total_ventes)
      existing.total_entrees += normalizeNumberInput(c.total_entrees)
      existing.total_sorties += normalizeNumberInput(c.total_sorties)
    } else {
      map.set(d, {
        date: d,
        count: 1,
        montant_theorique: normalizeNumberInput(c.montant_theorique),
        montant_reel: normalizeNumberInput(c.montant_reel),
        ecart_caisse: normalizeNumberInput(c.ecart_caisse),
        total_ventes: normalizeNumberInput(c.total_ventes),
        total_entrees: normalizeNumberInput(c.total_entrees),
        total_sorties: normalizeNumberInput(c.total_sorties),
      })
    }
  })

  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date))
}

interface ExportCloturesParams {
  viewMode: CloturesViewMode
  clotures: ClotureCaisse[]
  dailyData: DailyAggregate[]
  t: TFunction
}

export async function exportCloturesExcel({ viewMode, clotures, dailyData, t }: ExportCloturesParams): Promise<void> {
  if (clotures.length === 0) return
  try {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    let filename: string
    let ws

    if (viewMode === 'daily') {
      const rows = dailyData.map(d => ({
        [t('daily.header_date')]: d.date,
        [t('daily.header_count')]: d.count,
        [t('daily.header_theoretical')]: d.montant_theorique,
        [t('daily.header_real')]: d.montant_reel,
        [t('daily.header_gap')]: d.ecart_caisse,
        [t('daily.header_sales')]: d.total_ventes,
        [t('daily.header_entries')]: d.total_entrees,
        [t('daily.header_exits')]: d.total_sorties,
      }))
      ws = XLSX.utils.json_to_sheet(rows)
      filename = `clotures_journalier_${new Date().toISOString().split('T')[0]}.xlsx`
    } else {
      const rows = clotures.map(c => ({
        [t('table.header_date')]: (c.date || '').split('T')[0],
        [t('table.header_post')]: c.poste_caisse_nom || '',
        [t('table.header_cashier')]: c.user_name || '',
        [t('table.header_done_by')]: c.cloture_par_name || '',
        [t('table.header_theoretical')]: normalizeNumberInput(c.montant_theorique),
        [t('table.header_real')]: normalizeNumberInput(c.montant_reel),
        [t('table.header_gap')]: normalizeNumberInput(c.ecart_caisse),
      }))
      ws = XLSX.utils.json_to_sheet(rows)
      filename = `clotures_${new Date().toISOString().split('T')[0]}.xlsx`
    }

    fitExcelColumns(ws)
    XLSX.utils.book_append_sheet(wb, ws, 'Clotures')
    XLSX.writeFile(wb, filename)
  } catch (err) {
    logger.error('Erreur export Excel:', err)
    gooeyToast.error(t('table.export_error'))
  }
}

/** Impression ticket 80mm d'une clôture : QZ Tray d'abord, fenêtre HTML en fallback. */
export async function printCloture(
  cloture: ClotureCaisse,
  settings: PharmacySettings,
  title: string
): Promise<void> {
  const htmlFallback = () => {
    const win = window.open('about:blank', '', 'height=600,width=400')
    if (!win) return

    const htmlContent = generateClotureTemplate({
      ...cloture,
      montant_reel: cloture.montant_reel,
      montant_theorique: cloture.montant_theorique,
      ecart_caisse: cloture.ecart_caisse,
      total_ventes: cloture.total_ventes,
      total_entrees: cloture.total_entrees,
      total_sorties: cloture.total_sorties,
      details_paiement: cloture.details_paiement,
      pharmacy_name: settings.pharmacy_name
    });

    writePrintDocument(win, `
      <html>
        <head>
          <title>${title}</title>
          <style>
            @media print {
              body { margin: 0; padding: 0; }
              @page { margin: 0; }
            }
            body { margin: 0; padding: 2mm; width: 80mm; background: white; }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
      </html>
    `)

    win.onload = () => {
      win.print();
    };

    setTimeout(() => {
      if (win) win.print();
    }, 500);
  };

  try {
    await printClotureSmart(cloture, settings, htmlFallback);
  } catch (err) {
    logger.error('Erreur impression clôture:', err);
    htmlFallback();
  }
}
