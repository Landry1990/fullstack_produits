import { useTranslation } from 'react-i18next'
import { Clock, Banknote, Ticket } from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'

interface CaisseStatsCardsProps {
  facturesCount: number
  totalMontantEnAttente: number
  activeCouponsCount: number
  appliedCouponsCount: number
}

export function CaisseStatsCards({
  facturesCount,
  totalMontantEnAttente,
  activeCouponsCount,
  appliedCouponsCount
}: CaisseStatsCardsProps) {
  const { t } = useTranslation('caisse')

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Pending Invoices */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-red-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Clock className="size-3" /> {t('stats_pending_title', { defaultValue: 'En Attente' })}
          </div>
          <div className="text-2xl font-bold text-slate-800">{facturesCount}</div>
          <div className="text-xs text-slate-500">{t('stats_pending_desc', { defaultValue: 'facture(s) à encaisser' })}</div>
        </div>
        <div className="p-3 bg-red-50 rounded-lg text-red-500">
          <Clock className="size-6" />
        </div>
      </div>

      {/* Total Amount */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Banknote className="size-3" /> {t('stats_total_title', { defaultValue: 'Montant Total' })}
          </div>
          <div className="text-2xl font-bold text-slate-800">{formatCurrency(Math.round(totalMontantEnAttente))}</div>
          <div className="text-xs text-slate-500">{t('stats_total_desc', { defaultValue: 'à encaisser' })}</div>
        </div>
        <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
          <Banknote className="size-6" />
        </div>
      </div>

      {/* Active Coupons */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Ticket className="size-3" /> {t('stats_coupons_title', { defaultValue: 'Coupons Actifs' })}
          </div>
          <div className="text-2xl font-bold text-slate-800">{activeCouponsCount}</div>
          <div className="text-xs text-slate-500">{appliedCouponsCount > 0 ? t('coupons_applied', { count: appliedCouponsCount }) : t('stats_coupons_desc', { defaultValue: 'coupon(s) disponible(s)' })}</div>
        </div>
        <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
          <Ticket className="size-6" />
        </div>
      </div>
    </div>
  )
}
