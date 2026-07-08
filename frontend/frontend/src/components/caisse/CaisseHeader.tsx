import { useTranslation } from 'react-i18next'
import { RefreshCw, Ticket, Monitor, Unlock, Lock, Trash2 } from 'lucide-react'
import type { PosteCaisse } from '../../types'

interface CaisseHeaderProps {
  isMultiCaisse: boolean
  selectedPosteCaisseId: string
  onPosteCaisseChange: (id: string) => void
  postesCaisses: any[]
  myActivePoste: PosteCaisse | null
  hideAmounts: boolean
  onHideAmountsChange: (val: boolean) => void
  onCloseSession: () => void
  onOpenSession: () => void
  isCouponPanelOpen: boolean
  onToggleCouponPanel: () => void
  activeCouponsCount: number
  appliedCouponsCount: number
  canBulkCancel: boolean
  facturesCount: number
  selectedFactureIds: Set<number>
  onBulkCancelClick: () => void
}

export function CaisseHeader({
  isMultiCaisse,
  selectedPosteCaisseId,
  onPosteCaisseChange,
  postesCaisses,
  myActivePoste,
  hideAmounts,
  onHideAmountsChange,
  onCloseSession,
  onOpenSession,
  isCouponPanelOpen,
  onToggleCouponPanel,
  activeCouponsCount,
  appliedCouponsCount,
  canBulkCancel,
  facturesCount,
  selectedFactureIds,
  onBulkCancelClick
}: CaisseHeaderProps) {
  const { t } = useTranslation('caisse')

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col">
      <div className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('title')}</h1>
          <p className="text-slate-500 text-sm mt-1">{t('subtitle')}</p>
        </div>

        {isMultiCaisse && (
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 px-3 text-slate-500">
              <Monitor className="size-4" />
              <span className="text-xs font-bold uppercase tracking-wider">{t('poste_label')}</span>
            </div>
            <select
              className="h-8 px-2 rounded-md bg-white border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-300"
              value={selectedPosteCaisseId}
              onChange={(e) => onPosteCaisseChange(e.target.value)}
            >
              <option value="all">{t('all_posts')}</option>
              {postesCaisses.map(p => (
                <option key={p.id} value={p.id}>{p.nom}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          {/* Toggle Mode Sécurité (masquer les montants) */}
          {myActivePoste && (
            <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors" title={t('cash_session.security_mode', { defaultValue: 'Mode sécurité: masquer les montants aux caissiers' })}>
              <input
                type="checkbox"
                checked={hideAmounts}
                onChange={(e) => onHideAmountsChange(e.target.checked)}
                className="size-4 accent-amber-500"
              />
              <span className="text-xs hidden sm:inline text-slate-600 font-medium">🔒 {t('cash_session.hide_amounts', { defaultValue: 'Masquer montants' })}</span>
            </label>
          )}

          {/* Session de caisse - Bouton principal pour la caissière */}
          {myActivePoste ? (
            <button
              onClick={onCloseSession}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold bg-amber-500 text-white shadow-sm hover:bg-amber-600 transition-colors"
              title={t('cash_session.close_title', { defaultValue: 'Fermer ma caisse' })}
            >
              <Lock className="size-4" />
              <span className="hidden sm:inline">🔴 {myActivePoste.nom} - {t('cash_session.close_short', { defaultValue: 'Fermer' })}</span>
              {myActivePoste.fond_de_caisse && (
                <span className="text-[10px] opacity-80">({Number(myActivePoste.fond_de_caisse).toLocaleString()} F)</span>
              )}
            </button>
          ) : (
            <button
              onClick={onOpenSession}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 transition-colors"
              title={t('cash_session.open_title', { defaultValue: 'Ouvrir ma caisse' })}
            >
              <Unlock className="size-4" />
              <span className="hidden sm:inline">{t('cash_session.open_short', { defaultValue: 'Ouvrir caisse' })}</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full font-medium">
            <RefreshCw className="size-3.5 animate-spin" />
            {t('auto_refresh')}
          </div>
          <button
            onClick={onToggleCouponPanel}
            className={`inline-flex items-center gap-2 h-9 px-3 rounded-lg text-xs font-semibold transition-all ${isCouponPanelOpen ? 'bg-emerald-600 text-white shadow-sm' : 'border-2 border-slate-200 bg-white text-emerald-600 hover:border-emerald-500'}`}
          >
            <Ticket className="size-4" />
            {t('coupons_active', { count: activeCouponsCount })}
          </button>
          {appliedCouponsCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full font-medium">
              <span>{t('coupons_applied', { count: appliedCouponsCount })}</span>
            </div>
          )}
          {canBulkCancel && facturesCount > 0 && (
            <button
              onClick={onBulkCancelClick}
              disabled={selectedFactureIds.size === 0 && facturesCount === 0}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold bg-red-600 text-white shadow-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={t('bulk_cancel_title', { defaultValue: 'Annuler les factures sélectionnées (ou toutes) avec réintégration stock' })}
            >
              <Trash2 className="size-4" />
              <span className="hidden sm:inline">
                {selectedFactureIds.size > 0
                  ? `${t('bulk_cancel_selected', { defaultValue: 'Vider' })} (${selectedFactureIds.size})`
                  : t('bulk_cancel_all', { defaultValue: 'Vider la caisse' })}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
