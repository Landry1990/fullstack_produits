import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import JsBarcode from 'jsbarcode'
import bwipjs from 'bwip-js'
import PremiumModal from './common/PremiumModal'
import { useTranslation } from 'react-i18next'
import { usePharmacySettings } from '../hooks/usePharmacySettings'
import type { Commande, CommandeProduit, ProduitModel } from '../types'

/* ═══════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════ */

interface LabelField {
  key: string
  label: string
  enabled: boolean
  icon: string
}

interface LabelData {
  productName: string
  cip: string
  rayon: string
  barcode: string
  sellingPrice: number
  pharmacyName: string
  orderNumber: string
  lot: string
  invoiceNumber: string
  dateEntree: string
  dateExpiration: string
  fournisseur: string
  quantity: number
}

interface SimplePrintLabelsModalProps {
  commandeId: number
  commandeNumero: string
  commande?: Commande
  produitsList?: ProduitModel[]
  selectedRows?: Set<number>
  onClose: () => void
}

// Constante de module pour éviter la recréation à chaque render
const EMPTY_PRODUCTS_LIST: ProduitModel[] = []

/* ═══════════════════════════════════════════
   STORAGE KEY
   ═══════════════════════════════════════════ */
const LABEL_CONFIG_KEY = 'zenith_label_fields_config'
const LABEL_FORMAT_KEY = 'zenith_label_format'
const LABEL_BARCODE_TYPE_KEY = 'zenith_label_barcode_type'

function loadBarcodeType(): 'CODE128' | 'DATAMATRIX' {
  try {
    const saved = localStorage.getItem(LABEL_BARCODE_TYPE_KEY)
    if (saved === 'DATAMATRIX') return 'DATAMATRIX'
  } catch { /* ignore */ }
  return 'CODE128'
}

/* ═══════════════════════════════════════════
   DEFAULT FIELDS LOADER (Internal keys)
   ═══════════════════════════════════════════ */
const FIELD_KEYS = [
  { key: 'productName', icon: '📦' },
  { key: 'rayon', icon: '📍' },
  { key: 'barcode', icon: '▮▯▮▯' },
  { key: 'sellingPrice', icon: '💰' },
  { key: 'pharmacyName', icon: '🏥' },
  { key: 'fournisseur', icon: '🚚' },
  { key: 'dateEntree', icon: '📅' },
  { key: 'dateExpiration', icon: '⏳' },
  { key: 'orderNumber', icon: '📋' },
  { key: 'lot', icon: '🏷️' },
  { key: 'invoiceNumber', icon: '🧾' },
]

function loadFieldsConfig(): Partial<LabelField>[] {
  try {
    const saved = localStorage.getItem(LABEL_CONFIG_KEY)
    if (saved) return JSON.parse(saved)
  } catch { /* ignore */ }
  return []
}

function loadFormat(): '40x20' | '30x15' {
  try {
    const saved = localStorage.getItem(LABEL_FORMAT_KEY)
    if (saved === '30x15') return '30x15'
  } catch { /* ignore */ }
  return '40x20'
}

/* ═══════════════════════════════════════════
   BARCODE COMPONENTS
   ═══════════════════════════════════════════ */
function BarcodeCanvas({ value, height, width }: { value: string; height: number; width: number }) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: 'CODE128',
          width: 1.2,
          height,
          displayValue: true,
          fontSize: 8,
          margin: 0,
          textMargin: 1,
          font: 'monospace',
        })
      } catch {
        if (svgRef.current) svgRef.current.innerHTML = ''
      }
    }
  }, [value, height, width])

  if (!value) return null
  return <svg ref={svgRef} style={{ maxWidth: width }} />
}

function DatamatrixCanvas({ cip, lot, expiration, size }: { cip: string; lot: string; expiration: string; size: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Construit la chaîne GS1 Datamatrix : 01<CIP13 padded to 14> 10<LOT> 17<YYMMDD>
  const gs1Data = (() => {
    const gtin = cip.length === 13 ? '0' + cip : cip.padStart(14, '0')
    let s = `(01)${gtin}`
    if (lot) s += `(10)${lot}`
    if (expiration) {
      try {
        const d = new Date(expiration)
        const yy = String(d.getFullYear()).slice(-2)
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        s += `(17)${yy}${mm}${dd}`
      } catch { /* ignore */ }
    }
    return s
  })()

  useEffect(() => {
    if (!canvasRef.current || !cip) return
    try {
      bwipjs.toCanvas(canvasRef.current, {
        bcid: 'datamatrix',
        text: gs1Data,
        scale: 2,
        height: Math.round(size / 3.78), // px → mm approx
        width: Math.round(size / 3.78),
        parsefnc: true,
      })
    } catch { /* ignore */ }
  }, [gs1Data, size])

  if (!cip) return null
  return <canvas ref={canvasRef} style={{ width: size, height: size }} />
}

/* ═══════════════════════════════════════════
   LABEL PREVIEW COMPONENT 
   ═══════════════════════════════════════════ */
function LabelPreview({
  label,
  fields,
  format,
  barcodeType,
  t,
}: {
  label: LabelData
  fields: LabelField[]
  format: '40x20' | '30x15'
  barcodeType: 'CODE128' | 'DATAMATRIX'
  t: any
}) {
  const isEnabled = (key: string) => fields.find(f => f.key === key)?.enabled ?? false
  const isCompact = format === '30x15'

  return (
    <div
      className="label-item"
      style={{
        width: isCompact ? '30mm' : '40mm',
        height: isCompact ? '15mm' : '20mm',
        padding: isCompact ? '0.5mm 1mm' : '0.8mm 1.2mm',
        border: '0.3px solid #ccc',
        borderRadius: '1px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        overflow: 'hidden',
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        background: '#fff',
        color: '#000',
        boxSizing: 'border-box',
        pageBreakAfter: 'always',
        breakAfter: 'page',
      }}
    >
      {/* Top zone: pharmacy + product name */}
      <div style={{ lineHeight: 1.15 }}>
        {isEnabled('pharmacyName') && label.pharmacyName && (
          <div style={{
            fontSize: isCompact ? '4.5pt' : '5pt',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
            color: '#333',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textAlign: 'center',
          }}>
            {label.pharmacyName}
          </div>
        )}
        {isEnabled('productName') && (
          <div style={{
            fontSize: isCompact ? '5pt' : '6pt',
            fontWeight: 900,
            lineHeight: 1.1,
            marginTop: '0.3mm',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            wordBreak: 'break-word',
          }}>
            {label.productName}
          </div>
        )}
      </div>

      {/* Middle zone: barcode / datamatrix */}
      {isEnabled('barcode') && label.barcode && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          margin: '0.2mm 0',
          flexShrink: 1,
          overflow: 'hidden',
          minHeight: 0,
        }}>
          {barcodeType === 'DATAMATRIX'
            ? <DatamatrixCanvas
                cip={label.cip}
                lot={label.lot}
                expiration={label.dateExpiration}
                size={isCompact ? 28 : 36}
              />
            : <BarcodeCanvas
                value={label.barcode}
                height={isCompact ? 7 : 10}
                width={isCompact ? 80 : 110}
              />
          }
        </div>
      )}

      {/* Bottom zone: metadata row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: '0.5mm',
        lineHeight: 1,
      }}>
        {/* Left: metadata stacked */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Row 1: Rayon & Lot */}
          {(isEnabled('rayon') || isEnabled('lot')) && (
            <div style={{ fontSize: isCompact ? '3.5pt' : '4pt', color: '#444', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {isEnabled('rayon') && label.rayon ? `${t('prefixes.rayon')}:${label.rayon} ` : ''}
              {isEnabled('lot') && label.lot ? `${t('prefixes.lot')}:${label.lot}` : ''}
            </div>
          )}
          
          {/* Row 2: Entry Date */}
          {isEnabled('dateEntree') && label.dateEntree && (
            <div style={{ fontSize: isCompact ? '3.5pt' : '4pt', fontWeight: 600, color: '#444' }}>
              {label.dateEntree}
            </div>
          )}
          
          {/* Row 3: Expiration Date */}
          {isEnabled('dateExpiration') && label.dateExpiration && (
            <div style={{ fontSize: isCompact ? '3.5pt' : '4.5pt', fontWeight: 700, color: '#c00' }}>
              {t('prefixes.expiration')}:{label.dateExpiration}
            </div>
          )}
          
          {/* Row 4: Fournisseur */}
          {isEnabled('fournisseur') && label.fournisseur && (
            <div style={{ fontSize: isCompact ? '3.5pt' : '4pt', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {label.fournisseur}
            </div>
          )}

          {/* Row 5: CMD & Invoice */}
          {(isEnabled('orderNumber') || isEnabled('invoiceNumber')) && (
            <div style={{ fontSize: isCompact ? '3.5pt' : '4pt', color: '#777', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {isEnabled('orderNumber') && label.orderNumber ? `${t('prefixes.order')}:${label.orderNumber} ` : ''}
              {isEnabled('invoiceNumber') && label.invoiceNumber ? `${t('prefixes.invoice')}:${label.invoiceNumber}` : ''}
            </div>
          )}
        </div>

        {/* Right: price */}
        {isEnabled('sellingPrice') && (
          <div style={{
            fontSize: isCompact ? '7pt' : '8pt',
            fontWeight: 900,
            whiteSpace: 'nowrap',
            flexShrink: 0,
            textAlign: 'right',
          }}>
            {label.sellingPrice.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}{t('common:currency_symbol', { defaultValue: 'F' })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   PREVIEW WRAPPER (Handles scaling correctly)
   ═══════════════════════════════════════════ */
function PreviewLabelWrapper({
  label,
  fields,
  format,
  barcodeType,
  t,
  scale = 2.0,
}: {
  label: LabelData
  fields: LabelField[]
  format: '40x20' | '30x15'
  barcodeType: 'CODE128' | 'DATAMATRIX'
  t: any
  scale?: number
}) {
  const isCompact = format === '30x15'
  const baseW = isCompact ? 30 : 40 // mm
  const baseH = isCompact ? 15 : 20 // mm

  return (
    <div
      className="label-preview-container"
      style={{
        width: `${baseW * scale}mm`,
        height: `${baseH * scale}mm`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '4px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          width: `${baseW}mm`,
          height: `${baseH}mm`,
        }}
      >
        <LabelPreview label={label} fields={fields} format={format} barcodeType={barcodeType} t={t} />
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   MAIN MODAL COMPONENT
   ═══════════════════════════════════════════ */
export default function SimplePrintLabelsModal({
  commandeId,
  commandeNumero,
  commande,
  produitsList = EMPTY_PRODUCTS_LIST,
  selectedRows,
  onClose,
}: SimplePrintLabelsModalProps) {
  const { t } = useTranslation(['labels', 'common'])
  const { settings: pharmacySettings } = usePharmacySettings()

  // Initialize and merge fields with current language
  const [fields, setFields] = useState<LabelField[]>(() => {
    const saved = loadFieldsConfig()
    return FIELD_KEYS.map(f => {
      const savedField = saved.find(s => s.key === f.key)
      return {
        key: f.key,
        icon: f.icon,
        label: t(`fields.${f.key}`),
        enabled: savedField ? savedField.enabled : (f.key !== 'orderNumber' && f.key !== 'invoiceNumber')
      }
    }) as LabelField[]
  })

  // Update labels if language changes
  useEffect(() => {
    setFields(prev => prev.map(f => ({ ...f, label: t(`fields.${f.key}`) })))
  }, [t])

  const [labelFormat, setLabelFormat] = useState<'40x20' | '30x15'>(loadFormat)
  const [barcodeType, setBarcodeType] = useState<'CODE128' | 'DATAMATRIX'>(loadBarcodeType)
  const [qtyMode, setQtyMode] = useState<'received' | 'fixed'>('received')
  const [fixedQty, setFixedQty] = useState(1)
  const [printing, setPrinting] = useState(false)

  const [showConfig, setShowConfig] = useState(false)

  // Persist config to localStorage
  useEffect(() => {
    localStorage.setItem(LABEL_CONFIG_KEY, JSON.stringify(fields))
  }, [fields])

  useEffect(() => {
    localStorage.setItem(LABEL_FORMAT_KEY, labelFormat)
  }, [labelFormat])

  useEffect(() => {
    localStorage.setItem(LABEL_BARCODE_TYPE_KEY, barcodeType)
  }, [barcodeType])

  const toggleField = (key: string) => {
    setFields(prev =>
      prev.map(f => (f.key === key ? { ...f, enabled: !f.enabled } : f))
    )
  }

  // ─── Drag & Drop for reordering ───
  const dragIndexRef = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const handleDragStart = (index: number) => {
    dragIndexRef.current = index
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (dragIndexRef.current === null || dragIndexRef.current === index) return
    setDragOverIndex(index)
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    const dragIndex = dragIndexRef.current
    if (dragIndex === null || dragIndex === dropIndex) {
      dragIndexRef.current = null
      setDragOverIndex(null)
      return
    }
    setFields(prev => {
      const updated = [...prev]
      const [dragged] = updated.splice(dragIndex, 1)
      updated.splice(dropIndex, 0, dragged)
      return updated
    })
    dragIndexRef.current = null
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    dragIndexRef.current = null
    setDragOverIndex(null)
  }

  /* ─── Build label data from commande ─── */
  const labelsData: LabelData[] = (() => {
    if (!commande?.produits) return []

    const result: LabelData[] = []
    const produitsMap = new Map(produitsList.map(p => [p.id, p]))

    // Si des produits sont sélectionnés (checkbox), ne générer que pour ceux-là
    const produits = selectedRows && selectedRows.size > 0
      ? commande.produits.filter((_, idx) => selectedRows.has(idx))
      : commande.produits

    for (const item of produits) {
      const isObj = item.produit && typeof item.produit === 'object'
      const produitObj = isObj ? (item.produit as ProduitModel) : null
      const produitId = isObj ? produitObj!.id : (item.produit as number)

      // Resolve product data
      const resolved = produitObj || produitsMap.get(produitId)

      const productName =
        (item as any).produit_nom ||
        resolved?.name ||
        `Produit #${produitId}`

      const cip =
        (item as any).produit_cip ||
        resolved?.cip1 ||
        resolved?.cip2 ||
        resolved?.cip3 ||
        ''

      const rayon = resolved?.rayon_name || ''

      const barcode = cip || String(produitId).padStart(8, '0')

      const sellingPrice = item.selling_price
        ? parseFloat(item.selling_price)
        : resolved?.selling_price
          ? parseFloat(resolved.selling_price)
          : 0

      const lot = item.lot || ''
      // Date de péremption — forcer le format MM/YY
      const dateExpiration = (() => {
        const raw = item.date_expiration || ''
        if (!raw) return ''
        // Si c'est déjà MM/YY (ex: 03/27), on garde
        if (/^\d{2}\/\d{2}$/.test(raw)) return raw
        // Sinon essaye de parser (ISO YYYY-MM-DD)
        try {
          const d = new Date(raw)
          if (isNaN(d.getTime())) return raw
          const mm = String(d.getMonth() + 1).padStart(2, '0')
          const yy = String(d.getFullYear()).slice(-2)
          return `${mm}/${yy}`
        } catch {
          return raw
        }
      })()

      const orderNumber = `#${commande.id}`
      const invoiceNumber = commande.numero_facture || ''
      const pharmacyName = pharmacySettings?.pharmacy_name || 'PHARMACIE'

      // Date d'entrée = date de clôture de la commande (réception effective) ou date du jour
      const refDate = (commande as any).date_cloture || commande.date || new Date().toISOString()
      const dateEntree = (() => {
        try {
          const d = new Date(refDate)
          return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
        } catch {
          return ''
        }
      })()

      // Fournisseur
      const fournisseur =
        (commande as any).fournisseur_nom ||
        resolved?.fournisseur_name ||
        ''

      const receivedTotal = (item.quantity || 0) + (item.unites_gratuites || 0)
      const copies = qtyMode === 'received' ? receivedTotal : fixedQty

      for (let i = 0; i < copies; i++) {
        result.push({
          productName,
          cip,
          rayon,
          barcode,
          sellingPrice,
          pharmacyName,
          orderNumber,
          lot,
          invoiceNumber,
          dateEntree,
          dateExpiration,
          fournisseur,
          quantity: receivedTotal,
        })
      }
    }

    return result
  })()

  /* ─── Print handler ─── */
  const handlePrint = useCallback(() => {
    setPrinting(true)
    const isCompact = labelFormat === '30x15'
    const w = isCompact ? '30mm' : '40mm'
    const h = isCompact ? '15mm' : '20mm'

    // Build print-ready HTML
    const printWindow = window.open('', '_blank', 'width=600,height=800')
    if (!printWindow) {
      setPrinting(false)
      return
    }

    const labelsHTML = labelsData.map(label => {
      const isEnabled = (key: string) => fields.find(f => f.key === key)?.enabled ?? false
      const truncate = (s: string, max: number) => s.length > max ? s.slice(0, max - 2) + '..' : s

      // Build barcode / datamatrix SVG string
      let barcodeSvg = ''
      if (isEnabled('barcode') && label.barcode) {
        if (barcodeType === 'DATAMATRIX') {
          try {
            const gtin = label.cip.length === 13 ? '0' + label.cip : label.cip.padStart(14, '0')
            let gs1 = `(01)${gtin}`
            if (label.lot) gs1 += `(10)${label.lot}`
            if (label.dateExpiration) {
              const d = new Date(label.dateExpiration)
              if (!isNaN(d.getTime())) {
                const yy = String(d.getFullYear()).slice(-2)
                const mm = String(d.getMonth() + 1).padStart(2, '0')
                const dd = String(d.getDate()).padStart(2, '0')
                gs1 += `(17)${yy}${mm}${dd}`
              }
            }
            const size = isCompact ? 7 : 9
            const svgRaw = bwipjs.toSVG({ bcid: 'datamatrix', text: gs1, scale: 1, height: size, width: size, parsefnc: true })
            const svgMm = isCompact ? '7mm' : '9mm'
            barcodeSvg = svgRaw.replace('<svg ', `<svg style="width:${svgMm};height:${svgMm};display:block;" `)
          } catch { /* ignore */ }
        } else {
          try {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
            JsBarcode(svg, label.barcode, {
              format: 'CODE128',
              width: isCompact ? 1 : 1.2,
              height: isCompact ? 7 : 10,
              displayValue: true,
              fontSize: isCompact ? 6 : 7,
              margin: 0,
              textMargin: 1,
              font: 'monospace',
            })
            barcodeSvg = svg.outerHTML
          } catch { /* ignore */ }
        }
      }

      const lines: string[] = []

      // Pharmacy name
      if (isEnabled('pharmacyName') && label.pharmacyName) {
        lines.push(`<div style="font-size:${isCompact ? '4.5pt' : '5pt'};font-weight:800;text-transform:uppercase;letter-spacing:0.02em;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center;">${label.pharmacyName}</div>`)
      }

      // Product name
      if (isEnabled('productName')) {
        lines.push(`<div style="font-size:${isCompact ? '5pt' : '6pt'};font-weight:900;line-height:1.1;margin-top:0.3mm;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word;">${label.productName}</div>`)
      }

      // Barcode
      if (barcodeSvg) {
        const barcodeMaxH = barcodeType === 'DATAMATRIX' ? (isCompact ? '6mm' : '8mm') : (isCompact ? '5mm' : '7mm')
        lines.push(`<div style="display:flex;justify-content:center;align-items:center;margin:0.1mm 0;flex-shrink:1;max-height:${barcodeMaxH};overflow:hidden;">${barcodeSvg}</div>`)
      }

      // Bottom row - Grouped version for space saving
      const leftRows: string[] = []
      
      // Group: Rayon + Lot
      if ((isEnabled('rayon') && label.rayon) || (isEnabled('lot') && label.lot)) {
        let txt = ""
        if (isEnabled('rayon') && label.rayon) txt += `${t('prefixes.rayon')}:${truncate(label.rayon, 12)} `
        if (isEnabled('lot') && label.lot) txt += `${t('prefixes.lot')}:${truncate(label.lot, 10)}`
        leftRows.push(`<div style="font-size:${isCompact ? '3.5pt' : '4pt'};color:#444;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${txt}</div>`)
      }

      if (isEnabled('dateEntree') && label.dateEntree) {
        leftRows.push(`<div style="font-size:${isCompact ? '3.5pt' : '4pt'};font-weight:600;color:#444;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${label.dateEntree}</div>`)
      }
      if (isEnabled('dateExpiration') && label.dateExpiration) {
        leftRows.push(`<div style="font-size:${isCompact ? '3.5pt' : '4.5pt'};font-weight:700;color:#c00;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t('prefixes.expiration')}:${label.dateExpiration}</div>`)
      }
      if (isEnabled('fournisseur') && label.fournisseur) {
        leftRows.push(`<div style="font-size:${isCompact ? '3.5pt' : '4pt'};color:#666;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${truncate(label.fournisseur, 15)}</div>`)
      }

      // Group: Order + Invoice
      if ((isEnabled('orderNumber') && label.orderNumber) || (isEnabled('invoiceNumber') && label.invoiceNumber)) {
        let txt = ""
        if (isEnabled('orderNumber') && label.orderNumber) txt += `${t('prefixes.order')}:${label.orderNumber} `
        if (isEnabled('invoiceNumber') && label.invoiceNumber) txt += `${t('prefixes.invoice')}:${truncate(label.invoiceNumber, 10)}`
        leftRows.push(`<div style="font-size:${isCompact ? '3.5pt' : '4pt'};color:#777;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${txt}</div>`)
      }

      const priceHtml = isEnabled('sellingPrice')
        ? `<div style="font-size:${isCompact ? '7pt' : '8pt'};font-weight:900;white-space:nowrap;flex-shrink:0;text-align:right;">${label.sellingPrice.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}${t('common:currency_symbol', { defaultValue: 'F' })}</div>`
        : ''

      const bottomRow = `<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:0.5mm;line-height:1.0;">
        <div style="flex:1;min-width:0;">${leftRows.join('')}</div>
        ${priceHtml}
      </div>`

      lines.push(bottomRow)

      return `<div class="label" style="width:${w};height:${h};padding:${isCompact ? '0.5mm 1mm' : '0.8mm 1.2mm'};border:0.3px solid #ccc;border-radius:1px;display:flex;flex-direction:column;justify-content:flex-start;overflow:hidden;font-family:'Inter','Helvetica Neue',Arial,sans-serif;background:#fff;color:#000;box-sizing:border-box;page-break-after:always;break-after:page;">
        ${lines.join('')}
      </div>`
    }).join('\n')

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${t('modal_title')} - ${commandeNumero}</title>
  <style>
    /* Local Fonts (Offline Support) */
    @font-face {
      font-family: 'Inter';
      src: url('/fonts/inter-400.woff2') format('woff2');
      font-weight: 400;
      font-style: normal;
      font-display: block;
    }
    @font-face {
      font-family: 'Inter';
      src: url('/fonts/inter-600.woff2') format('woff2');
      font-weight: 600;
      font-style: normal;
      font-display: block;
    }
    @font-face {
      font-family: 'Inter';
      src: url('/fonts/inter-800.woff2') format('woff2');
      font-weight: 800;
      font-style: normal;
      font-display: block;
    }
    @font-face {
      font-family: 'Inter';
      src: url('/fonts/inter-900.woff2') format('woff2');
      font-weight: 900;
      font-style: normal;
      font-display: block;
    }

    @page {
      size: ${w} ${h};
      margin: 0;
    }
    * { 
      margin: 0; 
      padding: 0; 
      box-sizing: border-box; 
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
    }
    body {
      font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
      background: #fff;
    }
    .label {
      page-break-after: always;
      break-after: page;
      position: relative;
    }
    .label:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    @media print {
      body { margin: 0; padding: 0; }
      .label { border: none !important; }
    }
  </style>
</head>
<body>
${labelsHTML}
</body>
</html>`)

    printWindow.document.close()

    // Function to trigger printing
    const triggerPrint = () => {
      printWindow.focus()
      printWindow.print()
      setTimeout(() => {
        setPrinting(false)
        onClose()
        printWindow.close()
      }, 500)
    }

    // Wait for fonts to be ready
    if ((printWindow.document as any).fonts) {
      (printWindow.document as any).fonts.ready.then(() => {
        // Small delay to ensure browser layout engine catch up
        setTimeout(triggerPrint, 500)
      })
    } else {
      setTimeout(triggerPrint, 1000)
    }
  }, [labelsData, fields, labelFormat, commandeNumero, onClose])

  const enabledFieldsCount = fields.filter(f => f.enabled).length

  return (
    <PremiumModal
      isOpen={true}
      onClose={onClose}
      title={t('modal_title')}
      subtitle={t('subtitle', { numero: commandeNumero })}
      icon={
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      }
      gradientFrom="primary/10"
      gradientTo="info/10"
      disableClose={printing}
    >
      <div className="p-5 space-y-4">

        {/* ── Format Selection ── */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2.5">{t('format_label')}</label>
          <div className="flex gap-3">
            <label className={`label cursor-pointer gap-2 border rounded-xl p-3 flex-1 transition-all ${labelFormat === '40x20' ? 'border-primary bg-primary/5 shadow-sm' : 'hover:bg-base-200'}`}>
              <input
                type="radio"
                name="format"
                className="radio radio-primary radio-sm"
                checked={labelFormat === '40x20'}
                onChange={() => setLabelFormat('40x20')}
              />
              <div className="flex-1">
                <span className="label-text font-semibold text-sm">40×20mm</span>
                <p className="text-xs text-base-content/50">{t('format_standard')}</p>
              </div>
            </label>
            <label className={`label cursor-pointer gap-2 border rounded-xl p-3 flex-1 transition-all ${labelFormat === '30x15' ? 'border-primary bg-primary/5 shadow-sm' : 'hover:bg-base-200'}`}>
              <input
                type="radio"
                name="format"
                className="radio radio-primary radio-sm"
                checked={labelFormat === '30x15'}
                onChange={() => setLabelFormat('30x15')}
              />
              <div className="flex-1">
                <span className="label-text font-semibold text-sm">30×15mm</span>
                <p className="text-xs text-base-content/50">{t('format_compact')}</p>
              </div>
            </label>
          </div>
        </div>

        {/* ── Barcode Type Selection ── */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2.5">
            Type de code-barres
          </label>
          <div className="flex gap-3">
            <label className={`label cursor-pointer gap-2 border rounded-xl p-3 flex-1 transition-all ${barcodeType === 'CODE128' ? 'border-primary bg-primary/5 shadow-sm' : 'hover:bg-base-200'}`}>
              <input
                type="radio"
                name="barcodeType"
                className="radio radio-primary radio-sm"
                checked={barcodeType === 'CODE128'}
                onChange={() => setBarcodeType('CODE128')}
              />
              <div className="flex-1">
                <span className="label-text font-semibold text-sm">Code-barres</span>
                <p className="text-xs text-base-content/50">CODE128 linéaire</p>
              </div>
            </label>
            <label className={`label cursor-pointer gap-2 border rounded-xl p-3 flex-1 transition-all ${barcodeType === 'DATAMATRIX' ? 'border-emerald-500 bg-emerald-50 shadow-sm' : 'hover:bg-base-200'}`}>
              <input
                type="radio"
                name="barcodeType"
                className="radio radio-sm"
                style={{ accentColor: '#10b981' }}
                checked={barcodeType === 'DATAMATRIX'}
                onChange={() => setBarcodeType('DATAMATRIX')}
              />
              <div className="flex-1">
                <span className="label-text font-semibold text-sm">Datamatrix</span>
                <p className="text-xs text-base-content/50">GS1 (CIP + lot + exp.)</p>
              </div>
            </label>
          </div>
        </div>

        {/* ── Configuration Toggle ── */}
        <div className="border border-base-200 rounded-xl overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center justify-between p-3 hover:bg-base-50 transition-colors"
            onClick={() => setShowConfig(!showConfig)}
          >
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="font-bold text-sm">{t('info_title')}</span>
              <span className="badge badge-primary badge-sm font-mono">{enabledFieldsCount}/{fields.length}</span>
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 transition-transform ${showConfig ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showConfig && (
            <div className="border-t border-base-200 p-3 space-y-0.5 bg-base-50/50">
              <div className="text-[10px] text-base-content/40 font-medium mb-2 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
                {t('drag_info')}
              </div>
              {fields.map((field, index) => (
                <div
                  key={field.key}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 p-2 rounded-lg transition-all select-none ${
                    dragOverIndex === index
                      ? 'border-2 border-primary border-dashed bg-primary/10 scale-[1.02]'
                      : field.enabled
                        ? 'bg-primary/5 border border-primary/15'
                        : 'hover:bg-base-200/80 border border-transparent'
                  }`}
                  style={{ cursor: 'grab' }}
                >
                  {/* Drag handle */}
                  <span className="text-base-content/30 hover:text-base-content/60 text-sm font-bold shrink-0" style={{ cursor: 'grab', lineHeight: 1 }}>
                    ⠿
                  </span>
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary checkbox-sm shrink-0"
                    checked={field.enabled}
                    onChange={() => toggleField(field.key)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="text-base select-none shrink-0">{field.icon}</span>
                  <span className={`text-sm font-medium select-none flex-1 ${field.enabled ? 'text-base-content' : 'text-base-content/50'}`}>
                    {field.label}
                  </span>
                  <span className="text-[10px] text-base-content/25 font-mono shrink-0">{index + 1}</span>
                </div>
              ))}
              
              {/* Reset button */}
              <div className="pt-1.5 flex justify-end">
                <button
                  type="button"
                  className="btn btn-ghost btn-xs text-primary gap-1"
                  onClick={() => setFields(FIELD_KEYS.map(f => ({
                    key: f.key,
                    icon: f.icon,
                    label: t(`fields.${f.key}`),
                    enabled: f.key !== 'orderNumber' && f.key !== 'invoiceNumber'
                  })))}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {t('common:reset_default', { defaultValue: 'Par défaut' })}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Selection indicator ── */}
        {selectedRows && selectedRows.size > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-info/10 border border-info/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-info shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium text-info">
              {t('common:selection_count', { count: selectedRows.size, total: commande?.produits?.length || 0, defaultValue: `${selectedRows.size} produit(s) sélectionné(s)` })}
            </span>
          </div>
        )}

        {/* ── Quantity Selection ── */}
        <div className="space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-base-content/40">{t('quantity_label', { defaultValue: 'Quantité d\'étiquettes' })}</label>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className={`label cursor-pointer items-start gap-3 border rounded-xl p-3 h-full transition-all ${qtyMode === 'received' ? 'border-primary bg-primary/5 shadow-sm' : 'hover:bg-base-200'}`}>
              <input
                type="radio"
                name="qtyMode"
                className="radio radio-primary radio-sm mt-1"
                checked={qtyMode === 'received'}
                onChange={() => setQtyMode('received')}
              />
              <div className="flex-1 min-w-0">
                <span className="label-text font-bold text-sm block whitespace-normal leading-tight">{t('qty.by_unit')}</span>
                <p className="text-[10px] text-base-content/50 mt-0.5 leading-snug whitespace-normal">{t('qty.received_desc', { defaultValue: 'Total unités + gratuits' })}</p>
              </div>
            </label>

            <label className={`label cursor-pointer items-start gap-3 border rounded-xl p-3 h-full transition-all ${qtyMode === 'fixed' ? 'border-primary bg-primary/5 shadow-sm' : 'hover:bg-base-200'}`}>
              <input
                type="radio"
                name="qtyMode"
                className="radio radio-primary radio-sm mt-1"
                checked={qtyMode === 'fixed'}
                onChange={() => setQtyMode('fixed')}
              />
              <div className="flex-1 min-w-0">
                <span className="label-text font-bold text-sm block whitespace-normal leading-tight">{t('qty.fixed')}</span>
                <p className="text-[10px] text-base-content/50 mt-0.5 leading-snug whitespace-normal">{t('qty.fixed_desc', { defaultValue: 'Nombre identique par produit' })}</p>
              </div>
            </label>
          </div>

          {qtyMode === 'fixed' && (
            <div className="flex items-center gap-3 bg-base-100 border border-base-200 p-3 rounded-xl animate-in fade-in slide-in-from-top-1 duration-200">
              <span className="text-sm font-medium flex-1">{t('qty.fixed_count_label', { defaultValue: "Nombre d'étiquettes par produit :" })}</span>
              <div className="flex items-center gap-1">
                <button 
                  type="button"
                  className="btn btn-circle btn-ghost btn-xs"
                  onClick={() => setFixedQty(Math.max(0, fixedQty - 1))}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                </button>
                <input
                  type="number"
                  min="0"
                  className="input input-bordered input-sm w-16 text-center font-bold"
                  value={fixedQty}
                  onChange={(e) => setFixedQty(Math.max(0, parseInt(e.target.value) || 0))}
                />
                <button 
                  type="button"
                  className="btn btn-circle btn-ghost btn-xs"
                  onClick={() => setFixedQty(fixedQty + 1)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Preview ── */}
        {labelsData.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-base-content/40">
                {t('preview')} ({labelsData.length})
              </label>
              <div className="badge badge-sm badge-outline text-[10px] text-base-content/50">Zoom 200%</div>
            </div>
            
            <div className="bg-base-300/30 rounded-2xl p-6 max-h-[400px] overflow-y-auto custom-scrollbar border border-base-content/5">
              <div className="grid grid-cols-1 gap-8 justify-items-center">
                {labelsData.slice(0, 10).map((label, i) => (
                  <PreviewLabelWrapper
                    key={i}
                    label={label}
                    fields={fields}
                    format={labelFormat}
                    barcodeType={barcodeType}
                    t={t}
                    scale={1.8}
                  />
                ))}
              </div>
              
              {labelsData.length > 10 && (
                <div className="mt-6 flex flex-col items-center gap-2">
                  <div className="h-px w-12 bg-base-content/10"></div>
                  <span className="text-xs text-base-content/40 font-medium">
                    {t('qty.hidden_preview', { count: labelsData.length - 10, defaultValue: `+ ${labelsData.length - 10} autre(s) étiqette(s) masquée(s)` })}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── No data warning ── */}
        {labelsData.length === 0 && (
          <div className="alert alert-warning rounded-xl">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 size-5">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div className="text-sm">
              <p><strong>{t('no_data_title', { defaultValue: 'Aucune donnée produit disponible' })}</strong></p>
              <p className="text-xs mt-0.5">{t('no_data_desc', { defaultValue: 'Les données de la commande doivent être chargées pour générer les étiquettes.' })}</p>
            </div>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex justify-end gap-3 pt-1">
          <button onClick={onClose} className="btn btn-ghost px-6 rounded-xl">
            {t('cancel')}
          </button>
          <button
            onClick={handlePrint}
            className="btn btn-primary px-8 rounded-xl shadow-lg shadow-primary/20 gap-2"
            disabled={printing || labelsData.length === 0}
          >
            {printing ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                {t('generating')}
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                {t('print')} ({labelsData.length})
              </>
            )}
          </button>
        </div>
      </div>
    </PremiumModal>
  )
}
