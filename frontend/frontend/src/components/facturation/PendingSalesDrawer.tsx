import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { formatCurrency, normalizeNumberInput } from '../../utils/formatters'
import { Button } from '../shadcn/button'
import { Badge } from '../ui/Badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../shadcn/dialog'

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
}

const VENDOR_PALETTE = [
  { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200' },
]

function getVendorStyle(id: number | null | undefined, fallback = true) {
  if (!id) return fallback ? { bg: 'bg-slate-100', text: 'text-slate-500', border: 'border-slate-200' } : null
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
  onDelete: (id: number) => void
}

export default function PendingSalesDrawer({
  isOpen,
  onClose,
  ventesEnAttente,
  onRestore,
  onDelete
}: PendingSalesDrawerProps) {
  const { t } = useTranslation(['facturation', 'common'])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>{t('facturation:pending_sales.title')}</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6">
          {ventesEnAttente.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              {t('facturation:pending_sales.no_sales')}
            </div>
          ) : (
            <div className="space-y-3">
              {ventesEnAttente.map((vente, idx) => {
                const total = vente.lignes.reduce((sum: number, ligne) => sum + (normalizeNumberInput(ligne.total_ligne) || 0), 0)
                const remiseMontant = vente.remiseMode === 'montant'
                  ? normalizeNumberInput(vente.remise)
                  : total * (normalizeNumberInput(vente.remise) / 100)
                const totalNet = total - remiseMontant
                const vendeur = getVendorStyle(vente.vendeurId)
                const previewLines = vente.lignes.slice(0, 4)
                const diff = Date.now() - new Date(Number(vente.timestamp)).getTime()

                return (
                  <div key={vente.id} className="group/preview relative hover:bg-slate-50 transition-all rounded-xl border border-slate-200 p-2 sm:p-3 shadow-sm bg-white">
                    <div className="flex items-center gap-2 sm:gap-3 w-full">
                      {/* ID + Vendor */}
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <Badge variant="primary" size="sm" className="shrink-0 font-black">#{idx + 1}</Badge>
                        {vendeur && (
                          <span title={vente.vendeurName || t('facturation:pending_sales.unknown_vendor')} className={`text-[10px] font-black size-5 rounded-full flex items-center justify-center border ${vendeur.bg} ${vendeur.text} ${vendeur.border}`}>
                            {getInitials(vente.vendeurName || '')}
                          </span>
                        )}
                      </div>

                      {/* Client Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate" title={vente.clientName || vente.manualClientName || t('facturation:pending_sales.unspecified_client')}>
                          {vente.clientName || vente.manualClientName || t('facturation:pending_sales.unspecified_client')}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 sm:hidden">
                          {vente.lignes.length} {t('facturation:pending_sales.articles_short')}
                        </div>
                      </div>

                      {/* Stats, Duration, Total */}
                      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <div className="hidden sm:flex flex-col items-end">
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                            {t('facturation:cart.items_count', { count: vente.lignes.length })}
                          </span>
                          <span className="text-xs font-medium tabular-nums text-slate-500">
                            {vente.lignes.length} {t('facturation:pending_sales.articles_short')}
                          </span>
                        </div>

                        <div className="flex flex-col items-end">
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t('facturation:pending_sales.total')}</span>
                          <span className="text-sm font-black text-emerald-600 tabular-nums">
                            {formatCurrency(totalNet)}
                          </span>
                        </div>

                        <div className="hidden sm:flex flex-col items-end">
                          <Badge size="sm" className={`text-[10px] tabular-nums border font-semibold ${durationColor(diff)}`}>
                            {formatDurationAgo(vente.timestamp, t)}
                          </Badge>
                          <span className="text-[10px] font-medium text-slate-400 tabular-nums mt-0.5">
                            {new Date(Number(vente.timestamp)).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        <Button
                          onClick={() => onRestore(vente.id)}
                          size="sm"
                          className="h-8 px-3 rounded-lg font-bold shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white"
                          title={t('common:restore')}
                        >
                          {t('common:restore')}
                        </Button>
                        <Button
                          onClick={() => onDelete(vente.id)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 rounded-lg text-red-500 hover:bg-red-50 border-none transition-colors"
                          title={t('common:delete')}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Hover preview */}
                    <div className="pointer-events-none absolute left-0 right-0 top-full z-10 mt-1 opacity-0 invisible group-hover/preview:opacity-100 group-hover/preview:visible transition-all duration-200">
                      <div className="bg-white border border-slate-200 rounded-xl shadow-xl p-3 mx-1">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">
                          {t('facturation:pending_sales.preview_title')}
                        </p>
                        <div className="space-y-1 mb-2">
                          {previewLines.map((ligne, i) => (
                            <div key={i} className="flex justify-between text-xs">
                              <span className="truncate max-w-[70%] text-slate-700">{ligne.quantite}x {ligne.produit?.name || 'Produit'}</span>
                              <span className="tabular-nums text-slate-500">{formatCurrency(normalizeNumberInput(ligne.total_ligne) || 0)}</span>
                            </div>
                          ))}
                          {vente.lignes.length > 4 && (
                            <p className="text-[10px] text-slate-400 italic">+ {vente.lignes.length - 4} {t('facturation:pending_sales.more_items')}</p>
                          )}
                        </div>
                        <div className="flex justify-between items-center border-t border-slate-200 pt-2">
                          <span className="text-xs font-bold text-slate-700">{t('facturation:pending_sales.total')}</span>
                          <span className="text-sm font-black text-emerald-600 tabular-nums">{formatCurrency(totalNet)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
