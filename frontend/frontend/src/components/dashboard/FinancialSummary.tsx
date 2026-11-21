import { 
  ShoppingBag,
  Clock,
  CalendarX2,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import type { Echeance, DashboardStats, UgStatsResponse, UgStatItem } from '../../hooks/useDashboard';
import { formatDate } from '../../utils/dateUtils';
import { m } from 'framer-motion';
import { fadeInUp, staggerContainer, staggerFadeContainer } from '../../lib/motion';
import type { TFunction } from 'i18next';
import { useDashboardPrefs } from '../../hooks/useDashboardPrefs';

interface FinancialSummaryProps {
  stats: DashboardStats | undefined;
  ugStats: UgStatsResponse | null | undefined;
  echeances: Echeance[];
  t: TFunction;
  formatCurrencyLocal: (val: number) => string;
}

export default function FinancialSummary({
  stats,
  ugStats,
  echeances,
  t,
  formatCurrencyLocal
}: FinancialSummaryProps) {
  const formatCurrency = (val: number) => formatCurrencyLocal(val);
  const { isVisible } = useDashboardPrefs();

  const showUG = isVisible('finance.ug') && ugStats && ugStats.results && stats?.role !== 'VENDEUR' && stats?.role !== 'CAISSIER';

  return (
    <m.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      {/* Row: UG (left) + Echéances (right) */}
      <m.div variants={staggerFadeContainer} className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
        {/* Section Unités Gratuites (UG) */}
        {showUG && (
          <m.div variants={fadeInUp} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 sm:px-5 pt-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                  <ShoppingBag className="size-5" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-slate-700 tracking-tight uppercase">{t('ug.title')}</h2>
                  <p className="text-caption font-bold text-slate-400 uppercase tracking-widest">{t('ug.subtitle')}</p>
                </div>
              </div>
              <div className="inline-flex items-center px-3 h-6 rounded-full text-xs font-bold bg-purple-100 text-purple-700">
                UG
              </div>
            </div>
            <div className="p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <th scope="col" className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-400 py-2 pl-4 rounded-l-xl">{t('ug.provider')}</th>
                      <th scope="col" className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-400 text-right py-2">{t('ug.acquired')}</th>
                      <th scope="col" className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-400 text-right py-2">{t('ug.sold')}</th>
                      <th scope="col" className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-400 text-right py-2 pr-4 rounded-r-xl">{t('ug.remaining')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ugStats.results.map((stat: UgStatItem, _index: number) => (
                      <tr key={stat.fournisseur_id || stat.fournisseur_nom} className="hover:bg-slate-50 transition-all group">
                        <td className="py-2 pl-4 font-bold text-sm text-slate-700 group-hover:text-indigo-600 transition-colors">{stat.fournisseur_nom}</td>
                        <td className="text-right py-2 font-mono font-bold text-sm text-purple-600">
                          {formatCurrencyLocal(stat.valeur_acquise)}
                        </td>
                        <td className="text-right py-2 font-mono font-bold text-sm text-emerald-600">
                          {formatCurrencyLocal(stat.valeur_vendue)}
                        </td>
                        <td className="text-right py-2 pr-4">
                          <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-lg font-mono font-bold text-sm border border-blue-200 group-hover:bg-blue-100 transition-colors">
                            {formatCurrencyLocal(stat.valeur_restante)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {ugStats.results.length > 0 && (
                      <tr className="bg-slate-50 font-bold border-t border-slate-200">
                        <td className="py-2 pl-4 uppercase tracking-wider text-caption text-slate-400">{t('ug.total')}</td>
                        <td className="text-right py-2 font-mono font-bold text-sm text-purple-700">
                          {formatCurrency(ugStats.results.reduce((sum: number, r: UgStatItem) => sum + r.valeur_acquise, 0))}
                        </td>
                        <td className="text-right py-2 font-mono font-bold text-sm text-emerald-600">
                          {formatCurrency(ugStats.results.reduce((sum: number, r: UgStatItem) => sum + r.valeur_vendue, 0))}
                        </td>
                        <td className="text-right py-2 pr-4">
                          <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-lg font-mono font-bold text-sm border border-blue-200">
                            {formatCurrency(ugStats.results.reduce((sum: number, r: UgStatItem) => sum + r.valeur_restante, 0))}
                          </span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </m.div>
        )}

        {/* Echéances Widget */}
        {isVisible('finance.echeances') && echeances.length > 0 && (
          <m.div variants={fadeInUp} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 sm:px-5 pt-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                  <CalendarX2 className="size-5" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-slate-700 tracking-tight uppercase">{t('debts.echeances_title')}</h2>
                  <p className="text-caption font-bold text-slate-400 uppercase tracking-widest">{t('debts.echeances_subtitle')}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {echeances.filter(e => e.status === 'EN RETARD').length > 0 && (
                  <div className="bg-red-100 text-red-600 px-3 py-1 rounded-full font-black text-xs border border-red-200 animate-pulse">
                    {echeances.filter(e => e.status === 'EN RETARD').length} {t('debts.overdue_status')}
                  </div>
                )}
                {echeances.filter(e => e.status === "AUJOURD'HUI").length > 0 && (
                  <div className="bg-amber-100 text-amber-600 px-3 py-1 rounded-full font-black text-xs border border-amber-200">
                    {echeances.filter(e => e.status === "AUJOURD'HUI").length} {t('debts.today_status')}
                  </div>
                )}
              </div>
            </div>
            <div className="p-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th scope="col" className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-400 py-2 pl-4 rounded-l-xl text-left">{t('debts.supplier')}</th>
                      <th scope="col" className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-400 py-2 text-left">{t('debts.invoice')}</th>
                      <th scope="col" className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-400 py-2 text-right">{t('debts.amount_due')}</th>
                      <th scope="col" className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-400 py-2 text-center">{t('debts.due_date')}</th>
                      <th scope="col" className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-400 py-2 pr-4 rounded-r-xl text-center">{t('debts.status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {echeances.slice(0, 10).map((e, _i) => {
                      const isRetard = e.status === 'EN RETARD';
                      const isAujourdhui = e.status === "AUJOURD'HUI";
                      return (
                        <tr key={e.numero_facture} className={`transition-all group ${
                          isRetard ? 'hover:bg-red-50' : isAujourdhui ? 'hover:bg-amber-50' : 'hover:bg-slate-50'
                        }`}>
                          <td className="py-2 pl-4 font-bold text-sm text-slate-700">{e.fournisseur_nom}</td>
                          <td className="py-2 text-xs font-mono text-slate-500">{e.numero_facture}</td>
                          <td className="py-2 text-right font-mono font-black text-sm text-slate-800">
                            {formatCurrencyLocal(e.montant_du)}
                          </td>
                          <td className="py-2 text-center text-xs font-bold text-slate-500">
                            {formatDate(e.date_echeance)}
                          </td>
                          <td className="py-2 pr-4 text-center">
                            {isRetard ? (
                              <span className="inline-flex items-center gap-1 bg-red-100 text-red-600 px-2.5 py-1 rounded-full text-caption font-black uppercase tracking-wider border border-red-200">
                                <Clock className="size-3" />
                                {Math.abs(e.jours_restants)}{t('debts.days_overdue')}
                              </span>
                            ) : isAujourdhui ? (
                              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-600 px-2.5 py-1 rounded-full text-caption font-black uppercase tracking-wider border border-amber-200 animate-pulse">
                                <AlertTriangle className="size-3" />
                                {t('debts.today_badge')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-600 px-2.5 py-1 rounded-full text-caption font-black uppercase tracking-wider border border-emerald-200">
                                <CheckCircle2 className="size-3" />
                                {e.jours_restants}{t('debts.days_remaining')}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </m.div>
        )}
      </m.div>
    </m.div>
  );
}
