import { useTranslation } from 'react-i18next'
import { TrendingUp, RefreshCw } from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'
import { getPaymentMode, getPaymentModeWithIcon } from '../../config/paymentModes'

interface SessionRecapBarProps {
  sessionRecap: {
    has_session: boolean
    poste_nom?: string
    date_ouverture?: string
    fond_de_caisse?: number
    total_encaisse?: number
    total_avec_fond?: number
    nb_transactions?: number
    details_par_mode?: Record<string, number>
  }
}

export function SessionRecapBar({ sessionRecap }: SessionRecapBarProps) {
  const { t, i18n } = useTranslation('caisse')

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-emerald-200 overflow-hidden">
      <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-emerald-600" />
          <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">
            {t('recap.title', { defaultValue: 'Récap caisse' })} — {sessionRecap.poste_nom}
          </span>
          {sessionRecap.date_ouverture && (
            <span className="text-[10px] text-slate-400 font-mono">
              {t('recap.since', { defaultValue: 'depuis' })} {new Date(sessionRecap.date_ouverture).toLocaleTimeString(i18n.language === 'en' ? 'en-GB' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[10px] text-emerald-500">
            <RefreshCw className="size-3 animate-spin" />
            live
          </div>
        </div>
      </div>
      <div className="p-4 flex flex-wrap gap-3 items-center">
        {(sessionRecap.fond_de_caisse ?? 0) > 0 && (
          <div className="flex flex-col items-center px-4 py-2 bg-blue-50 border border-blue-100 rounded-xl min-w-[100px]">
            <span className="text-[10px] font-bold text-blue-500/70 uppercase tracking-wider">{t('recap.fond', { defaultValue: 'Fond' })}</span>
            <span className="text-base font-black text-blue-600">+{formatCurrency(Math.round(sessionRecap.fond_de_caisse ?? 0))}</span>
          </div>
        )}
        {Object.entries(sessionRecap.details_par_mode ?? {})
          .filter(([, v]) => v > 0)
          .sort(([, a], [, b]) => b - a)
          .map(([mode, montant]) => {
const _modeConfig = getPaymentMode(mode)
            const label = mode === 'coupon'
              ? `🎫 ${t('recap.coupons', { defaultValue: 'Coupons' })}`
              : getPaymentModeWithIcon(mode, t)
            const isNegative = mode === 'coupon'
            return (
              <div key={mode} className={`flex flex-col items-center px-4 py-2 rounded-xl min-w-[100px] border ${isNegative ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isNegative ? 'text-red-400' : 'text-emerald-500'}`}>
                  {label}
                </span>
                <span className={`text-base font-black ${isNegative ? 'text-red-600' : 'text-emerald-600'}`}>
                  {isNegative ? '-' : ''}{formatCurrency(Math.round(montant))}
                </span>
              </div>
            )
          })
        }
        <div className="ml-auto flex flex-col items-end gap-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {sessionRecap.nb_transactions} {t('recap.sales', { defaultValue: 'vente(s)', count: sessionRecap.nb_transactions ?? 0 })}
          </div>
          <div className="text-2xl font-black text-emerald-600">
            {formatCurrency(Math.round(sessionRecap.total_avec_fond ?? 0))}
          </div>
          <div className="text-[10px] text-slate-400">{t('recap.total_register', { defaultValue: 'total caisse' })}</div>
        </div>
      </div>
    </div>
  )
}
