import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, Moon, Sun, FileText, ShoppingCart, AlertTriangle, Monitor, ScanLine } from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'
import { formatDateShort } from '../../utils/dateUtils'
import { Button } from '../shadcn/button'
import { Badge } from '../shadcn/badge'
import { cn } from '../../lib/utils'
import PosteRequisOverlay from './PosteRequisOverlay'
import FacturationNotifications from './FacturationNotifications'
import type { FacturationState } from '../../hooks/useFacturationState'

interface FacturationHeaderProps {
  hook: FacturationState
  datamatrixEnabled: boolean
  setDatamatrixEnabled: (updater: (prev: boolean) => boolean) => void
  setShowOpenPosteModal: (open: boolean) => void
}

export default function FacturationHeader({ hook, datamatrixEnabled, setDatamatrixEnabled, setShowOpenPosteModal }: FacturationHeaderProps) {
  const { t: tCaisse } = useTranslation('caisse')

  return (
    <>
      {/* ── HEADER SHADCN ─────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-200 bg-white shrink-0 shadow-sm">

        {/* Left */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl shrink-0">
            <FileText className="size-5" />
          </div>
          <h1 className="text-base font-bold text-slate-900 uppercase tracking-wider truncate">{hook.t('facturation:title')}</h1>

          <div className="flex items-center gap-1 border-l border-slate-200 pl-3 ml-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={hook.toggleZenithMode}
              className={cn(
                "size-8 rounded-lg transition-all",
                hook.isZenithMode
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
              )}
            >
              {hook.isZenithMode ? <EyeOff size={16} /> : <Eye size={16} />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={hook.toggleMidnightTheme}
              className={cn(
                "size-8 rounded-lg transition-all",
                hook.isMidnightTheme
                  ? 'bg-slate-800 text-amber-400 hover:bg-slate-900'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
              )}
            >
              {hook.isMidnightTheme ? <Sun size={16} /> : <Moon size={16} />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDatamatrixEnabled(prev => !prev)}
              className={cn(
                "size-8 rounded-lg transition-all",
                datamatrixEnabled
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
              )}
              title={datamatrixEnabled ? 'Désactiver le scan Data Matrix' : 'Activer le scan Data Matrix'}
            >
              <ScanLine size={16} />
            </Button>
          </div>

          {hook.ventesEnAttente.length > 0 && (
            <Button
              onClick={() => hook.setShowPendingSales(true)}
              variant="default"
              className="gap-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold shadow-lg shadow-amber-500/20 animate-pulse h-8"
            >
              <ShoppingCart className="size-3.5" />
              <span className="font-bold">{hook.ventesEnAttente.length}</span>
              <span className="hidden sm:inline uppercase text-[10px] tracking-wider">{hook.t('facturation:actions.pending')}</span>
            </Button>
          )}
        </div>

        {/* Right: date + shortcuts */}
        <div className="flex flex-col items-end shrink-0">
          <span className="text-xs font-medium text-slate-500">{formatDateShort(new Date())}</span>
          <div className="hidden sm:flex gap-3 text-[10px] text-slate-400 mt-0.5 uppercase font-semibold tracking-wider">
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-mono text-[9px]">/</kbd> {hook.t('facturation:shortcuts.search')}</span>
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-mono text-[9px]">F9</kbd> {hook.t('facturation:shortcuts.pay')}</span>
          </div>
        </div>
      </div>

      {/* ── BANNIÈRE POINT DE VENTE NON ACTIF ── */}
      {!hook.isPosteCaisseActive && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-amber-50 border-b border-amber-200 shrink-0">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <Monitor className="size-4" />
            <span>{hook.hasMyActivePoste
              ? tCaisse('open_point_vente.banner.active_message', { defaultValue: 'Vous avez un point de vente ouvert sur une autre session. Cliquez pour le réactiver.' })
              : tCaisse('open_point_vente.banner.required_message', { defaultValue: 'Aucun point de vente ouvert. Ouvrez un point pour verrouiller ce poste sur la facturation.' })}</span>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => setShowOpenPosteModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg"
          >
            {hook.hasMyActivePoste ? tCaisse('open_point_vente.banner.activate', { defaultValue: 'Réactiver' }) : tCaisse('open_point_vente.banner.open', { defaultValue: 'Ouvrir un point de vente' })}
          </Button>
        </div>
      )}

      {/* ── BANNIÈRE MODE MODIFICATION SHADCN ── */}
      {hook.isModificationMode && hook.modificationInvoiceId && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border-b border-amber-200 shrink-0">
          <div className="p-2 bg-amber-100 text-amber-600 rounded-xl shrink-0">
            <AlertTriangle className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">{hook.t('facturation:modification_mode.title')}</p>
            <div className="flex flex-wrap gap-3 text-[11px] text-amber-700 mt-0.5">
              <span>{hook.t('facturation:modification_mode.original_total')}: <strong className="font-semibold">{formatCurrency(Math.round(hook.originalTotalTtc))}</strong></span>
              <span>{hook.t('facturation:modification_mode.new_total')}: <strong className="font-semibold">{formatCurrency(Math.round(hook.totals.totalTtc))}</strong></span>
              {hook.totals.totalTtc !== hook.originalTotalTtc && (
                <Badge variant={hook.totals.totalTtc > hook.originalTotalTtc ? 'default' : 'destructive'} className="text-[10px] h-5">
                  {hook.totals.totalTtc > hook.originalTotalTtc ? '+' : ''}{formatCurrency(Math.round(hook.totals.totalTtc - hook.originalTotalTtc))}
                  {hook.totals.totalTtc > hook.originalTotalTtc ? ` (${hook.t('facturation:modification_mode.to_collect')})` : ` (${hook.t('facturation:modification_mode.to_refund')})`}
                </Badge>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-amber-700 hover:text-amber-800 hover:bg-amber-100 shrink-0"
            onClick={() => {
              hook.setIsModificationMode(false)
              hook.setModificationInvoiceId(null)
              hook.setOriginalTotalTtc(0)
              hook.setLignesFacture([])
            }}
          >
            {hook.t('common:cancel')}
          </Button>
        </div>
      )}

      {/* ── VERROU POINT DE VENTE ── */}
      {!hook.isPosteCaisseActive && (
        <PosteRequisOverlay
          hasMyActivePoste={hook.hasMyActivePoste}
          onOpenExisting={() => setShowOpenPosteModal(true)}
        />
      )}

      {/* ── NOTIFICATIONS ── */}
      <FacturationNotifications
        error={hook.error}
        setError={hook.setError}
        successInfo={hook.successInfo}
        setSuccessInfo={hook.setSuccessInfo}
        onOpenPaymentModal={hook.ouvrirModalPaiement}
        onShowTicket={() => hook.setShowTicketPreview(true)}
        onPrintA4={hook.handleImprimerFacture}
        ticketCaisse={hook.ticketCaisse}
      />
    </>
  )
}
