import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, RefreshCcw, Trash2, Printer, GitMerge, AlertTriangle } from 'lucide-react'
import { formatCurrency, normalizeNumberInput } from '../../utils/formatters'
import { Button } from '../shadcn/button'
import { Badge } from '../shadcn/badge'
import { Input } from '../shadcn/input'
import { Card, CardContent, CardHeader } from '../shadcn/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../shadcn/dialog'
import { EmptyState } from '../ui/EmptyState'

interface PendingSale {
  id: number
  lignes: { total_ligne: string | number; produit?: { name?: string }; quantite?: number }[]
  remiseMode: string
  remise: string | number
  clientName: string
  manualClientName: string
  timestamp: number | string
  vendeurId?: number | null
  vendeurName?: string | null
  note?: string | null
  isRetrocession?: boolean
  isFactureA4?: boolean
}

const VENDOR_PALETTE = [
  { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200' },
]

function getVendorStyle(id: number | null | undefined) {
  if (!id) return { bg: 'bg-slate-100', text: 'text-slate-500', border: 'border-slate-200' }
  const index = Math.abs(id) % VENDOR_PALETTE.length
  return VENDOR_PALETTE[index]
}

function getInitials(name: string) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function formatDurationAgo(timestamp: number | string, t: (key: string, opts?: Record<string, unknown>) => string) {
  const then = new Date(Number(timestamp))
  const diff = Math.max(0, Date.now() - then.getTime())
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(diff / (60 * 1000))
  const hours = Math.floor(diff / (60 * 60 * 1000))
  const days = Math.floor(diff / (24 * 60 * 60 * 1000))

  if (seconds < 90) return t('facturation:pending_sales.just_now')
  if (minutes < 60) return t('facturation:pending_sales.minutes_ago', { count: minutes })
  if (hours < 24) return t('facturation:pending_sales.hours_ago', { count: hours })
  return t('facturation:pending_sales.days_ago', { count: days })
}

function durationColor(diffMs: number) {
  if (diffMs > 60 * 60 * 1000) return 'bg-red-100 text-red-700 border-red-200'
  if (diffMs > 15 * 60 * 1000) return 'bg-amber-100 text-amber-700 border-amber-200'
  return 'bg-emerald-100 text-emerald-700 border-emerald-200'
}

interface PendingSalesDrawerProps {
  isOpen: boolean
  onClose: () => void
  ventesEnAttente: PendingSale[]
  onRestore: (id: number) => void
  onMerge: (id: number) => void
  onDelete: (id: number) => void
  onUpdateNote: (id: number, note: string) => void
  cartEmpty?: boolean
}

export default function PendingSalesDrawer({
  isOpen,
  onClose,
  ventesEnAttente,
  onRestore,
  onMerge,
  onDelete,
  onUpdateNote,
  cartEmpty = true
}: PendingSalesDrawerProps) {
  const { t } = useTranslation(['facturation', 'common'])
  const [printingId, setPrintingId] = useState<number | null>(null)

  const OLD_THRESHOLD_MS = 15 * 60 * 1000
  const hasOldPending = ventesEnAttente.some(v => Date.now() - new Date(Number(v.timestamp)).getTime() > OLD_THRESHOLD_MS)

  const handlePrint = (vente: PendingSale, idx: number) => {
    setPrintingId(vente.id)
    const total = vente.lignes.reduce(
      (sum: number, ligne) => sum + (normalizeNumberInput(ligne.total_ligne) || 0),
      0
    )
    const remiseMontant = vente.remiseMode === 'montant'
      ? normalizeNumberInput(vente.remise)
      : total * (normalizeNumberInput(vente.remise) / 100)
    const totalNet = total - remiseMontant
    const linesHtml = vente.lignes.map(l =>
      `<tr><td style="text-align:left;padding:2px 0;">${l.quantite ?? 1}x ${l.produit?.name || t('facturation:pending_sales.unspecified_product', { defaultValue: 'Produit' })}</td><td style="text-align:right;padding:2px 0;">${formatCurrency(normalizeNumberInput(l.total_ligne) || 0)}</td></tr>`
    ).join('')

    const html = `
      <html>
        <head>
          <title>${t('facturation:pending_sales.title')}</title>
          <style>
            body { font-family: sans-serif; font-size: 12px; width: 80mm; margin: 0 auto; padding: 8px; }
            h2 { font-size: 14px; margin: 0 0 8px; text-align: center; }
            .meta { margin-bottom: 8px; color: #555; }
            table { width: 100%; border-collapse: collapse; margin: 8px 0; }
            .total { font-weight: bold; border-top: 1px dashed #000; padding-top: 4px; margin-top: 8px; display: flex; justify-content: space-between; }
            .note { margin-top: 8px; font-style: italic; color: #555; word-break: break-word; }
          </style>
        </head>
        <body>
          <h2>#${idx + 1} - ${t('facturation:pending_sales.title')}</h2>
          <div class="meta">
            ${vente.clientName || vente.manualClientName || t('facturation:pending_sales.unspecified_client')}<br>
            ${new Date(Number(vente.timestamp)).toLocaleString('fr-FR')}
          </div>
          <table>${linesHtml}</table>
          <div class="total">
            <span>${t('facturation:pending_sales.total')}</span>
            <span>${formatCurrency(totalNet)}</span>
          </div>
          ${vente.note ? `<div class="note">${vente.note}</div>` : ''}
        </body>
      </html>
    `
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setPrintingId(null)
      return
    }
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      setPrintingId(null)
    }, 250)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden p-0 gap-0 flex flex-col">
        <DialogHeader className="px-4 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Clock className="size-5 text-amber-500" />
              {t('facturation:pending_sales.title')}
              {ventesEnAttente.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {ventesEnAttente.length}
                </Badge>
              )}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {ventesEnAttente.length === 0 ? (
            <EmptyState
              compact
              icon={<Clock className="size-6" />}
              title={t('facturation:pending_sales.no_sales')}
              description={t('facturation:pending_sales.no_sales_description', { defaultValue: '' }) || undefined}
            />
          ) : (
            <div className="space-y-3">
              {hasOldPending && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
                  <AlertTriangle className="size-4 shrink-0" />
                  {t('facturation:pending_sales.old_warning', { defaultValue: 'Certaines ventes attendent depuis plus de 15 min.' })}
                </div>
              )}

              {ventesEnAttente.map((vente, idx) => {
                const total = vente.lignes.reduce(
                  (sum: number, ligne) => sum + (normalizeNumberInput(ligne.total_ligne) || 0),
                  0
                )
                const remiseMontant = vente.remiseMode === 'montant'
                  ? normalizeNumberInput(vente.remise)
                  : total * (normalizeNumberInput(vente.remise) / 100)
                const totalNet = total - remiseMontant
                const vendeur = getVendorStyle(vente.vendeurId)
                const diff = Date.now() - new Date(Number(vente.timestamp)).getTime()
                const previewLines = vente.lignes.slice(0, 4)
                const moreCount = vente.lignes.length - previewLines.length
                const isOld = diff > OLD_THRESHOLD_MS

                return (
                  <Card key={vente.id} className={`overflow-hidden border-slate-200 shadow-sm ${isOld ? 'ring-1 ring-amber-300' : ''}`}>
                    <CardHeader className="p-3 pb-2 space-y-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            title={vente.vendeurName || t('facturation:pending_sales.unknown_vendor')}
                            className={`shrink-0 text-[10px] font-black size-6 rounded-full flex items-center justify-center border ${vendeur.bg} ${vendeur.text} ${vendeur.border}`}
                          >
                            {getInitials(vente.vendeurName || '')}
                          </span>
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm text-slate-800 truncate">
                              {vente.clientName || vente.manualClientName || t('facturation:pending_sales.unspecified_client')}
                            </h4>
                            <p className="text-[11px] text-slate-400 truncate">
                              #{idx + 1} · {t('facturation:pending_sales.items_count', { count: vente.lignes.length })}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge className={`text-[10px] border ${durationColor(diff)}`}>
                            {formatDurationAgo(vente.timestamp, t)}
                          </Badge>
                          <span className="text-[10px] text-slate-400 tabular-nums">
                            {new Date(Number(vente.timestamp)).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-3 pt-0">
                      <div className="text-xs text-slate-600 space-y-1 mb-3">
                        {previewLines.map((ligne, lineIdx) => (
                          <div key={`${lineIdx}-${ligne.produit?.name ?? 'prod'}-${ligne.quantite}-${ligne.total_ligne}`} className="flex justify-between gap-2">
                            <span className="truncate">
                              <span className="font-semibold tabular-nums">{ligne.quantite ?? 1}x</span>{' '}
                              {ligne.produit?.name || t('facturation:pending_sales.unspecified_product', { defaultValue: 'Produit' })}
                            </span>
                            <span className="tabular-nums text-slate-500 shrink-0">
                              {formatCurrency(normalizeNumberInput(ligne.total_ligne) || 0)}
                            </span>
                          </div>
                        ))}
                        {moreCount > 0 && (
                          <p className="text-slate-400 italic">
                            + {moreCount} {t('facturation:pending_sales.more_items')}
                          </p>
                        )}
                      </div>

                      <div className="mb-3">
                        <Input
                          value={vente.note || ''}
                          onChange={(e) => onUpdateNote(vente.id, e.target.value)}
                          placeholder={t('facturation:pending_sales.note_placeholder', { defaultValue: 'Note…' })}
                          className="h-8 text-xs"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                        <div className="text-sm">
                          <span className="text-slate-400 text-[11px] uppercase font-bold tracking-wider">
                            {t('facturation:pending_sales.total')}
                          </span>
                          <p className="font-black text-emerald-600 tabular-nums">
                            {formatCurrency(totalNet)}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            onClick={() => handlePrint(vente, idx)}
                            disabled={printingId === vente.id}
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 rounded-md border-slate-200 text-slate-600 hover:bg-slate-50"
                            aria-label={t('facturation:pending_sales.print_ticket', { defaultValue: 'Imprimer ticket' })}
                            title={t('facturation:pending_sales.print_ticket', { defaultValue: 'Imprimer ticket' })}
                          >
                            <Printer className="size-3.5" />
                          </Button>

                          {!cartEmpty && (
                            <Button
                              onClick={() => onMerge(vente.id)}
                              variant="outline"
                              size="sm"
                              className="h-8 px-2.5 rounded-md border-sky-200 text-sky-700 hover:bg-sky-50 text-xs font-bold"
                              title={t('facturation:pending_sales.merge', { defaultValue: 'Ajouter au panier actuel' })}
                            >
                              <GitMerge className="size-3.5 mr-1" />
                              {t('common:merge', { defaultValue: 'Fusionner' })}
                            </Button>
                          )}

                          <Button
                            onClick={() => onRestore(vente.id)}
                            size="sm"
                            className="h-8 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <RefreshCcw className="size-3.5 mr-1.5" />
                            {t('common:restore')}
                          </Button>
                          <Button
                            onClick={() => onDelete(vente.id)}
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 rounded-md border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                            aria-label={t('common:delete')}
                            title={t('common:delete')}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
