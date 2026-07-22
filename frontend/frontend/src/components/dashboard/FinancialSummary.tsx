import { 
  ShoppingBag,
  Clock,
  CalendarX2,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import type { Echeance, DashboardStats, UgStatsResponse, UgStatItem } from '../../hooks/useDashboard';
import { formatDate } from '../../utils/dateUtils';
import type { TFunction } from 'i18next';

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

  const showUG = ugStats && ugStats.results && stats?.role !== 'VENDEUR' && stats?.role !== 'CAISSIER';

  return (
    <div className="space-y-6">
      {/* Row: UG (left) + Echéances (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section Unités Gratuites (UG) */}
        {showUG && (
          <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 overflow-hidden">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-secondary/10 text-purple-600 rounded-lg">
                    <ShoppingBag className="size-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-base-content tracking-tight uppercase">{t('ug.title')}</h2>
                    <p className="text-[10px] font-bold text-base-content/50 uppercase tracking-widest">{t('ug.subtitle')}</p>
                  </div>
                </div>
                <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-secondary/20 text-purple-700 h-6 px-3">
                  UG
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <th className="bg-base-200 text-xs font-semibold uppercase tracking-wider text-base-content/60 py-2 pl-4 rounded-l-xl">{t('ug.provider')}</th>
                      <th className="bg-base-200 text-xs font-semibold uppercase tracking-wider text-base-content/60 text-right py-2">{t('ug.acquired')}</th>
                      <th className="bg-base-200 text-xs font-semibold uppercase tracking-wider text-base-content/60 text-right py-2">{t('ug.sold')}</th>
                      <th className="bg-base-200 text-xs font-semibold uppercase tracking-wider text-base-content/60 text-right py-2 pr-4 rounded-r-xl">{t('ug.remaining')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base-200">
                    {ugStats.results.map((stat: UgStatItem, _index: number) => (
                      <tr key={stat.fournisseur_id || stat.fournisseur_nom} className="hover:bg-base-200 transition-all group">
                        <td className="py-2 pl-4 font-bold text-sm text-base-content group-hover:text-primary transition-colors">{stat.fournisseur_nom}</td>
                        <td className="text-right py-2 font-mono font-bold text-sm text-purple-600">
                          {formatCurrencyLocal(stat.valeur_acquise)}
                        </td>
                        <td className="text-right py-2 font-mono font-bold text-sm text-success">
                          {formatCurrencyLocal(stat.valeur_vendue)}
                        </td>
                        <td className="text-right py-2 pr-4">
                          <span className="bg-info/10 text-info px-2 py-1 rounded-lg font-mono font-bold text-sm border border-blue-100 group-hover:bg-info/20 transition-colors">
                            {formatCurrencyLocal(stat.valeur_restante)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {ugStats.results.length > 0 && (
                      <tr className="bg-base-200 font-bold border-t border-base-200">
                        <td className="py-2 pl-4 uppercase tracking-wider text-[10px] text-base-content/50">{t('ug.total')}</td>
                        <td className="text-right py-2 text-purple-700 font-mono text-sm pr-2">
                          {formatCurrency(ugStats.results.reduce((sum: number, r: UgStatItem) => sum + r.valeur_acquise, 0))}
                        </td>
                        <td className="text-right py-2 text-success font-mono text-sm pr-2">
                          {formatCurrency(ugStats.results.reduce((sum: number, r: UgStatItem) => sum + r.valeur_vendue, 0))}
                        </td>
                        <td className="text-right py-2 text-info font-mono text-sm pr-4">
                          {formatCurrency(ugStats.results.reduce((sum: number, r: UgStatItem) => sum + r.valeur_restante, 0))}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Echéances Widget */}
        {echeances.length > 0 && (
          <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 overflow-hidden">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-warning/20 text-warning rounded-xl">
                    <CalendarX2 className="size-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-base-content tracking-tight uppercase">{t('debts.echeances_title')}</h2>
                    <p className="text-[10px] font-bold text-base-content/50 uppercase tracking-widest">{t('debts.echeances_subtitle')}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {echeances.filter(e => e.status === 'EN RETARD').length > 0 && (
                    <div className="bg-error/10 text-error px-3 py-1 rounded-xl font-black text-xs border border-red-100 animate-pulse">
                      {echeances.filter(e => e.status === 'EN RETARD').length} {t('debts.overdue_status')}
                    </div>
                  )}
                  {echeances.filter(e => e.status === "AUJOURD'HUI").length > 0 && (
                    <div className="bg-warning/10 text-warning px-3 py-1 rounded-xl font-black text-xs border border-orange-100">
                      {echeances.filter(e => e.status === "AUJOURD'HUI").length} {t('debts.today_status')}
                    </div>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="bg-base-200 text-xs font-semibold uppercase tracking-wider text-base-content/60 py-2 pl-4 rounded-l-xl text-left">{t('debts.supplier')}</th>
                      <th className="bg-base-200 text-xs font-semibold uppercase tracking-wider text-base-content/60 py-2 text-left">{t('debts.invoice')}</th>
                      <th className="bg-base-200 text-xs font-semibold uppercase tracking-wider text-base-content/60 py-2 text-right">{t('debts.amount_due')}</th>
                      <th className="bg-base-200 text-xs font-semibold uppercase tracking-wider text-base-content/60 py-2 text-center">{t('debts.due_date')}</th>
                      <th className="bg-base-200 text-xs font-semibold uppercase tracking-wider text-base-content/60 py-2 pr-4 rounded-r-xl text-center">{t('debts.status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base-200">
                    {echeances.slice(0, 10).map((e, _i) => {
                      const isRetard = e.status === 'EN RETARD';
                      const isAujourdhui = e.status === "AUJOURD'HUI";
                      return (
                        <tr key={e.numero_facture} className={`transition-all group ${
                          isRetard ? 'hover:bg-error/10/50' : isAujourdhui ? 'hover:bg-warning/10/50' : 'hover:bg-base-200'
                        }`}>
                          <td className="py-2 pl-4 font-bold text-sm text-base-content">{e.fournisseur_nom}</td>
                          <td className="py-2 text-xs font-mono text-base-content/60">{e.numero_facture}</td>
                          <td className="py-2 text-right font-mono font-black text-sm text-base-content">
                            {formatCurrencyLocal(e.montant_du)}
                          </td>
                          <td className="py-2 text-center text-xs font-bold text-base-content/60">
                            {formatDate(e.date_echeance)}
                          </td>
                          <td className="py-2 pr-4 text-center">
                            {isRetard ? (
                              <span className="inline-flex items-center gap-1 bg-error/20 text-error px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-red-200">
                                <Clock className="size-3" />
                                {Math.abs(e.jours_restants)}{t('debts.days_overdue')}
                              </span>
                            ) : isAujourdhui ? (
                              <span className="inline-flex items-center gap-1 bg-warning/20 text-warning px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-orange-200 animate-pulse">
                                <AlertTriangle className="size-3" />
                                {t('debts.today_badge')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-success/10 text-success px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-100">
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
          </div>
        )}
      </div>
    </div>
  );
}
