import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18next from 'i18next'
import fr from '../../../public/locales/fr/cash_closings.json'
import en from '../../../public/locales/en/cash_closings.json'
import { buildClotureSalesRows, exportClotureSalesExcel, generateClotureSalesHtml } from '../../components/caisse/clotures/utils'
import { exportToExcel } from '../excelExport'
import type { ClotureSalesReport } from '../../components/caisse/clotures/types'
import type { PharmacySettings } from '../../types'

vi.mock('../excelExport', () => ({ exportToExcel: vi.fn(), fitExcelColumns: vi.fn() }))
vi.mock('../print/printTemplates', () => ({ generateClotureTemplate: vi.fn() }))
vi.mock('../print/printClotureSmart', () => ({ printClotureSmart: vi.fn() }))

const report: ClotureSalesReport = {
  cloture_id: 42,
  date_debut: '2026-11-28T08:00:00Z',
  date_fin: '2026-11-28T16:00:00Z',
  caissier: 'Caisse A',
  poste_caisse: 'Poste 1',
  count: 2,
  ventes: [
    { facture_id: 1, numero: 'FAC-1', date_encaissement: '2026-11-28T08:30:00Z', vendeur: 'Vendeur A', caissier: 'Caisse A', montant: '1000.00', regle: '400.00', en_compte: '600.00' },
    { facture_id: 2, numero: 'FAC-2', date_encaissement: '2026-11-28T10:00:00Z', vendeur: 'Vendeur B', caissier: 'Caisse A', montant: '500.00', regle: '500.00', en_compte: '0.00' },
  ],
  totaux: { montant: '1500.00', regle: '900.00', en_compte: '600.00' },
}
const settings = { pharmacy_name: 'Pharmacie Test', address: 'Rue 1', city: 'Douala', phone: '123', locale: 'fr-FR', currency_symbol: 'FCFA' } as PharmacySettings

async function translator(lang = 'fr') {
  const instance = i18next.createInstance()
  await instance.init({ lng: lang, resources: { fr: { translation: fr }, en: { translation: en } }, interpolation: { escapeValue: false } })
  return instance.t
}

describe('cash closing sales documents', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shares seven columns and numeric server totals between documents', async () => {
    const t = await translator()
    const rows = buildClotureSalesRows(report, t)
    expect(rows).toHaveLength(3)
    expect(Object.keys(rows[0])).toEqual(['N° vente', 'Heure', 'Vendeur', 'Caissier', 'Montant', 'Réglé', 'En compte'])
    expect(rows[2]).toMatchObject({ 'N° vente': 'TOTAUX', Montant: 1500, Réglé: 900, 'En compte': 600 })
    exportClotureSalesExcel(report, settings, t)
    expect(exportToExcel).toHaveBeenCalledWith(rows, settings, expect.objectContaining({ filename: 'Ventes_Cloture_42.xlsx', sheetName: 'Ventes' }))
    expect(vi.mocked(exportToExcel).mock.calls[0][2].title).toContain('Caisse A')
  })

  it('prints A4 with repeated headers and totals only at the end', async () => {
    const html = generateClotureSalesHtml(report, settings, await translator())
    const doc = new DOMParser().parseFromString(html, 'text/html')
    expect(html).toContain('size: A4 portrait')
    expect(doc.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe('only light')
    expect(html).toContain('color-scheme: only light')
    expect(html).toContain('background: #fff')
    expect(doc.querySelectorAll('thead th')).toHaveLength(7)
    expect(doc.querySelectorAll('tbody tr')).toHaveLength(2)
    expect(doc.querySelectorAll('tfoot tr')).toHaveLength(1)
    expect(doc.querySelector('tfoot')?.textContent).toContain('TOTAUX')
    expect(html).toContain('reste à payer à sa date de fin')
  })

  it('keeps each product occurrence in order in both A4 and Excel', async () => {
    const t = await translator()
    const detailed: ClotureSalesReport = {
      ...report,
      produits: {
        lignes: [
          { ligne_id: 1, facture_id: 1, numero: 'FAC-1', date_encaissement: report.ventes[0].date_encaissement, produit: 'Doliprane', quantite: 1, prix_unitaire: '500.00', montant: '500.00' },
          { ligne_id: 2, facture_id: 1, numero: 'FAC-1', date_encaissement: report.ventes[0].date_encaissement, produit: 'Vitamine C', quantite: 1, prix_unitaire: '500.00', montant: '500.00' },
          { ligne_id: 3, facture_id: 2, numero: 'FAC-2', date_encaissement: report.ventes[1].date_encaissement, produit: 'Doliprane', quantite: 1, prix_unitaire: '500.00', montant: '500.00' },
        ],
        totaux: { quantite: 3, montant: '1500.00' },
      },
    }
    const rows = buildClotureSalesRows(detailed, t)
    expect(rows.map(row => row.Produit)).toEqual(['Doliprane', 'Vitamine C', 'Doliprane', ''])
    expect(rows.map(row => row['N° vente'])).toEqual(['FAC-1', 'FAC-1', 'FAC-2', 'TOTAUX'])
    expect(rows[0].Heure).toBe(rows[1].Heure)
    expect(rows[2].Heure).not.toBe(rows[0].Heure)
    expect(rows[3]).toMatchObject({ 'Qté vendue': 3, 'Montant net': 1500 })
    exportClotureSalesExcel(detailed, settings, t)
    expect(exportToExcel).toHaveBeenCalledWith(rows, settings, expect.objectContaining({ filename: 'Produits_Ventes_Cloture_42.xlsx', sheetName: 'Produits' }))
    const doc = new DOMParser().parseFromString(generateClotureSalesHtml(detailed, settings, t), 'text/html')
    expect(doc.querySelectorAll('thead th')).toHaveLength(6)
    expect(doc.querySelectorAll('tbody tr')).toHaveLength(3)
    expect(doc.querySelector('h1')?.textContent).toBe('Journal des produits — clôture #42')
    expect(doc.querySelector('tfoot')?.textContent).toContain('TOTAUX')
    const english = generateClotureSalesHtml(detailed, settings, await translator('en'))
    expect(english).toContain('Product journal — closing #42')
    expect(english).not.toContain('sales.')
  })

  it('escapes names and references instead of injecting HTML', async () => {
    const malicious = '<img src=x onerror=alert(1)>'
    const html = generateClotureSalesHtml({ ...report, caissier: malicious, ventes: [{ ...report.ventes[0], numero: malicious, vendeur: malicious }] }, { ...settings, pharmacy_name: malicious }, await translator())
    const doc = new DOMParser().parseFromString(html, 'text/html')
    expect(doc.querySelector('img, script')).toBeNull()
    expect(doc.body.textContent).toContain(malicious)
  })

  it('supports English labels and a first closure without a start date', async () => {
    const html = generateClotureSalesHtml({ ...report, date_debut: null }, settings, await translator('en'))
    expect(html).toContain('Sales for closing #42')
    expect(html).toContain('start of activity')
    expect(html).not.toContain('sales.')
  })
})
