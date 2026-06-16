import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/utils'
import { Button } from '../shadcn/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from '../shadcn/dropdown-menu'
import { Camera, FileText, Truck, Pause, X, CreditCard, Menu } from 'lucide-react'

interface BaseActionProps {
  onPayment: () => void
  onProforma: () => void
  onSuspend: () => void
  onCancel: () => void
  isValid: boolean
  isRetrocession?: boolean
  setIsRetrocession?: (v: boolean) => void
  isFactureA4?: boolean
  setIsFactureA4?: (v: boolean) => void
  onScanOrdonnance?: () => void
  loading?: boolean
}

interface ActionButtonsProps extends BaseActionProps {
  onBonDeLivraison: () => void
  isSidebarStyle?: boolean
}

function SidebarActions({
  onPayment,
  onProforma,
  onSuspend,
  onCancel,
  isValid,
  isRetrocession = false,
  setIsRetrocession,
  isFactureA4 = false,
  setIsFactureA4,
  onScanOrdonnance,
  loading = false,
}: BaseActionProps) {
  const { t } = useTranslation(['facturation', 'common'])

  return (
    <div className="flex flex-col gap-3">
      {/* Modes Bar */}
      <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={isRetrocession}
              onChange={(e) => setIsRetrocession?.(e.target.checked)}
              className="size-4 rounded border-amber-300 text-amber-500 focus:ring-amber-500"
            />
            <span className="text-xs uppercase font-semibold text-slate-500 group-hover:text-amber-600 transition-colors">{t('facturation:actions.retrocession_mode')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={isFactureA4}
              onChange={(e) => setIsFactureA4?.(e.target.checked)}
              className="size-4 rounded border-blue-300 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-xs uppercase font-semibold text-slate-500 group-hover:text-blue-600 transition-colors">Format A4</span>
          </label>
      </div>

      {/* Action Grid (3 colonnes compactes) */}
      <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            onClick={onProforma}
            disabled={!isValid || loading}
            className="h-9 text-xs font-semibold uppercase tracking-wide border-slate-200 hover:border-slate-300 hover:bg-slate-50"
          >
            Proforma
          </Button>
          <Button
            variant="outline"
            onClick={onSuspend}
            disabled={!isValid || loading}
            className="h-9 text-xs font-semibold uppercase tracking-wide border-amber-200 text-amber-700 hover:bg-amber-50 hover:border-amber-300"
          >
            {t('facturation:actions.suspend_short')}
          </Button>
          <Button
            variant="outline"
            onClick={onScanOrdonnance}
            className="h-9 px-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300"
            title="Scanner Ordonnance"
          >
            <Camera className="size-4" />
          </Button>
      </div>

      {/* Primary Payment Action */}
      <Button
        onClick={onPayment}
        disabled={!isValid || loading}
        className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 relative"
      >
        <div className="flex items-center justify-center gap-2">
          {loading ? (
            <span className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <CreditCard className="size-5" />
          )}
          <span className="text-base font-bold uppercase tracking-wider">{t('facturation:actions.pay')}</span>
        </div>
        <kbd className="absolute right-4 px-2 py-0.5 bg-emerald-700 rounded text-[10px] font-mono text-white/80">F9</kbd>
      </Button>

      {/* Cancel Button */}
      <Button
        variant="ghost"
        onClick={onCancel}
        className="h-8 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 uppercase font-semibold tracking-wide"
      >
        {t('facturation:actions.cancel')} (Esc)
      </Button>
    </div>
  )
}

function FooterActions({
  onPayment,
  onProforma,
  onBonDeLivraison,
  onSuspend,
  onCancel,
  isValid,
  isRetrocession = false,
  setIsRetrocession,
  isFactureA4 = false,
  setIsFactureA4,
  onScanOrdonnance,
  loading = false,
}: ActionButtonsProps) {
  const { t } = useTranslation(['facturation', 'common'])

  return (
    <div className="bg-white border-t border-slate-200 p-3 sm:p-4 shadow-sm shrink-0">
      <div className="flex flex-row gap-2 justify-between items-center">
        
        {/* ACTION DROPDOWN FOR SECONDARY ACTIONS */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 h-10 sm:h-11 border-slate-200">
              <Menu className="size-4 sm:size-5" />
              <span className="hidden sm:inline uppercase text-xs font-semibold tracking-wider">{t('common:actions_title')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-64 mb-2">
            {/* MODES SECTION */}
            <div className="px-2 py-1.5 text-xs uppercase text-slate-400 font-semibold">Modes</div>
            <DropdownMenuItem className="flex items-center justify-between py-2">
                <span className="text-xs font-medium uppercase">{t('facturation:actions.retrocession_mode')}</span>
                <input
                    type="checkbox"
                    checked={isRetrocession}
                    onChange={(e) => setIsRetrocession?.(e.target.checked)}
                    className="size-4 rounded border-amber-300 text-amber-500"
                />
            </DropdownMenuItem>
            <DropdownMenuItem className="flex items-center justify-between py-2">
                <span className="text-xs font-medium uppercase">{t('facturation:actions.facture_a4')}</span>
                <input
                    type="checkbox"
                    checked={isFactureA4}
                    onChange={(e) => setIsFactureA4?.(e.target.checked)}
                    className="size-4 rounded border-blue-300 text-blue-500"
                />
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* DOCUMENTS SECTION */}
            <div className="px-2 py-1.5 text-xs uppercase text-slate-400 font-semibold">Documents</div>
            <DropdownMenuItem onClick={onScanOrdonnance} className="gap-2 py-2 text-emerald-600 focus:text-emerald-700">
              <Camera className="size-4" />
              <span className="text-xs uppercase font-semibold">Scanner Ordonnance</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onProforma} disabled={!isValid || loading} className="gap-2 py-2">
              <FileText className="size-4 text-blue-500" />
              <span className="text-xs uppercase font-semibold">{t('facturation:actions.proforma')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onBonDeLivraison} disabled={!isValid || loading} className="gap-2 py-2">
              <Truck className="size-4 text-blue-500" />
              <span className="text-xs uppercase font-semibold">{t('facturation:actions.delivery_note')}</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* SALES MANAGEMENT */}
            <div className="px-2 py-1.5 text-xs uppercase text-slate-400 font-semibold">Gestion Vente</div>
            <DropdownMenuItem
              onClick={onSuspend}
              disabled={!isValid || loading}
              className="gap-2 py-2 text-amber-600 focus:text-amber-700"
            >
              <Pause className="size-4" />
              <span className="text-xs uppercase font-semibold">{t('facturation:actions.suspend_short')}</span>
              <div className="ml-auto flex gap-1">
                  <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-mono text-slate-600">F7</kbd>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onCancel}
              className="gap-2 py-2 text-red-600 focus:text-red-700 focus:bg-red-50"
            >
              <X className="size-4" />
              <span className="text-xs uppercase font-semibold">{t('facturation:actions.cancel')}</span>
              <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-mono text-slate-600 ml-auto">Esc</kbd>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* PRIMARY ACTION: PAYMENT */}
        <Button
          onClick={onPayment}
          disabled={!isValid || loading}
          className="flex-1 max-w-md h-10 sm:h-11 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all active:scale-95"
          title={t('facturation:actions.pay_tooltip')}
        >
          {loading ? (
            <span className="size-4 sm:size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <CreditCard className="size-4 sm:size-5" />
          )}
          <span className="font-bold text-xs sm:text-base uppercase tracking-wider">{t('facturation:actions.pay')}</span>
          <kbd className="hidden sm:flex px-2 py-0.5 bg-emerald-700 rounded text-[10px] font-mono text-white/80">F9</kbd>
        </Button>
      </div>
    </div>
  )
}

/**
 * ActionButtons Component
 * 
 * Refactored to separate Sidebar and Footer logic into distinct sub-components
 * to avoid prop-flag stacking and improve maintainability.
 */
export default function ActionButtons(props: ActionButtonsProps) {
  if (props.isSidebarStyle) {
    return <SidebarActions {...props} />
  }
  return <FooterActions {...props} />
}
