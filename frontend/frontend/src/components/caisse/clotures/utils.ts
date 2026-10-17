/**
 * Utilitaires purs de l'écran Historique des clôtures :
 * formatage dates API, agrégation journalière, export Excel, impression ticket.
 * Code déplacé tel quel depuis `components/HistoriqueClotures.tsx`.
 */
import type { TFunction } from 'i18next'
import { gooeyToast } from 'goey-toast'
import { normalizeNumberInput } from '../../../utils/formatters'
import { logger } from '../../../utils/logger'
import { generateClotureTemplate } from '../../../utils/print/printTemplates'
import { writePrintDocument } from '../../../utils/print/printHelpers'
import { printClotureSmart } from '../../../utils/print/printClotureSmart'
import type { ClotureCaisse, CloturesViewMode, DailyAggregate } from './types'
import type { PharmacySettings } from '../../../types'

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

    XLSX.utils.book_append_sheet(wb, ws, 'Clotures')
    XLSX.writeFile(wb, filename)
  } catch (err) {
    logger.error('Erreur export Excel:', err)
    gooeyToast.error(t('table.export_error', { defaultValue: 'Erreur lors de l\'export Excel' }))
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
