import { useTranslation } from 'react-i18next'
import { RefreshCw, Ticket, Monitor, Unlock, Lock, Trash2 } from 'lucide-react'
import type { PosteCaisse, PosteVente } from '../../types'

interface CaisseHeaderProps {
  isMultiCaisse: boolean
  selectedPosteCaisseId: string
  onPosteCaisseChange: (id: string) => void
  postesCaisses: PosteCaisse[]
  myActivePoste: PosteVente | null
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
  canManageSecurity?: boolean
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
  onBulkCancelClick,
  canManageSecurity = false
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

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
          {/* Statut de la caisse */}
          <div
            className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-semibold border ${
              myActivePoste
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
            title={myActivePoste ? t('cash_session.status_open', { defaultValue: 'Caisse ouverte' }) : t('cash_session.status_closed', { defaultValue: 'Caisse fermée' })}
          >
            {myActivePoste ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
            <span className="hidden sm:inline">{myActivePoste ? t('cash_session.status_open', { defaultValue: 'Caisse ouverte' }) : t('cash_session.status_closed', { defaultValue: 'Caisse fermée' })}</span>
          </div>

          {/* Session de caisse - Bouton principal */}
          {myActivePoste ? (
            <button
              onClick={onCloseSession}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold bg-amber-500 text-white shadow-sm hover:bg-amber-600 transition-colors"
              title={t('cash_session.close_title', { defaultValue: 'Fermer ma caisse' })}
            >
              <Lock className="size-4" />
              <span className="hidden sm:inline">{myActivePoste.nom} - {t('cash_session.close_short', { defaultValue: 'Fermer' })}</span>
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

          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          {/* Actions secondaires */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Mode Sécurité */}
            {myActivePoste && canManageSecurity && (
              <button
                type="button"
                onClick={() => onHideAmountsChange(!hideAmounts)}
                aria-pressed={hideAmounts}
                className={`inline-flex items-center gap-2 h-9 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                  hideAmounts
                    ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
                title={t('cash_session.security_mode', { defaultValue: 'Mode sécurité : masquer les montants aux caissiers' })}
              >
                <Lock className="size-4" />
                <span className="hidden sm:inline">{t('cash_session.hide_amounts', { defaultValue: 'Masquer montants' })}</span>
              </button>
            )}

            <button
              onClick={onToggleCouponPanel}
              className={`inline-flex items-center gap-2 h-9 px-3 rounded-lg text-xs font-semibold transition-all ${isCouponPanelOpen ? 'bg-emerald-600 text-white shadow-sm' : 'border-2 border-slate-200 bg-white text-emerald-600 hover:border-emerald-500'}`}
              title={t('coupons.title', { defaultValue: 'Gestion des Coupons' })}
            >
              <Ticket className="size-4" />
              {t('coupons_active', { count: activeCouponsCount })}
            </button>
            {appliedCouponsCount > 0 && (
              <div className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full font-medium" title={t('coupons_applied', { count: appliedCouponsCount })}>
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

          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          <div className="inline-flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full font-medium" title={t('auto_refresh')}>
            <RefreshCw className="size-3.5 animate-spin" />
            {t('auto_refresh')}
          </div>
        </div>
      </div>

      {!myActivePoste && (
        <div className="px-4 pb-4 sm:px-6 sm:pb-6 -mt-2">
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium flex items-center gap-2" title={t('cash_session.open_to_cash_title', { defaultValue: 'Ouvrez une caisse pour encaisser' })}>
            <Lock className="size-4 shrink-0" />
            <span>{t('table.open_cash_register_first', { defaultValue: 'Veuillez d\'abord ouvrir votre caisse' })}</span>
          </div>
        </div>
      )}
    </div>
  )
}
