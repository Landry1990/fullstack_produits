import { Suspense } from 'react';
import { 
  PieChart as PieChartIcon,
  CreditCard,
  ShoppingBag,
  Clock,
  CalendarX2,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import type { Echeance } from '../../hooks/useDashboard';
import { formatDate } from '../../utils/dateUtils';
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

interface FinancialSummaryProps {
  stats: any;
  ugStats: any;
  echeances: Echeance[];
  t: any;
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
      {/* Section Unités Gratuites (UG) */}
      {showUG && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                  <ShoppingBag className="size-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900 tracking-tight uppercase">{t('ug.title')}</h2>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('ug.subtitle')}</p>
                </div>
              </div>
              <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700 h-6 px-3">
                UG
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500 py-2 pl-4 rounded-l-xl">{t('ug.provider')}</th>
                    <th className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500 text-right py-2">{t('ug.acquired')}</th>
                    <th className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500 text-right py-2">{t('ug.sold')}</th>
                    <th className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500 text-right py-2 pr-4 rounded-r-xl">{t('ug.remaining')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ugStats.results.map((stat: any, index: number) => (
                    <tr key={index} className="hover:bg-gray-50 transition-all group">
                      <td className="py-2 pl-4 font-bold text-sm text-gray-900 group-hover:text-indigo-600 transition-colors">{stat.fournisseur_nom}</td>
                      <td className="text-right py-2 font-mono font-bold text-sm text-purple-600">
                        {formatCurrencyLocal(stat.valeur_acquise)}
                      </td>
                      <td className="text-right py-2 font-mono font-bold text-sm text-emerald-600">
                        {formatCurrencyLocal(stat.valeur_vendue)}
                      </td>
                      <td className="text-right py-2 pr-4">
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg font-mono font-bold text-sm border border-blue-100 group-hover:bg-blue-100 transition-colors">
                          {formatCurrencyLocal(stat.valeur_restante)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {ugStats.results.length > 0 && (
                    <tr className="bg-gray-50 font-bold border-t border-gray-100">
                      <td className="py-2 pl-4 uppercase tracking-wider text-[10px] text-gray-400">{t('ug.total')}</td>
                      <td className="text-right py-2 text-purple-700 font-mono text-sm pr-2">
                        {formatCurrency(ugStats.results.reduce((sum: number, r: any) => sum + r.valeur_acquise, 0))}
                      </td>
                      <td className="text-right py-2 text-emerald-700 font-mono text-sm pr-2">
                        {formatCurrency(ugStats.results.reduce((sum: number, r: any) => sum + r.valeur_vendue, 0))}
                      </td>
                      <td className="text-right py-2 text-blue-700 font-mono text-sm pr-4">
                        {formatCurrency(ugStats.results.reduce((sum: number, r: any) => sum + r.valeur_restante, 0))}
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 text-orange-600 rounded-xl">
                  <CalendarX2 className="size-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-gray-900 tracking-tight uppercase">{t('debts.echeances_title')}</h2>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('debts.echeances_subtitle')}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {echeances.filter(e => e.status === 'EN RETARD').length > 0 && (
                  <div className="bg-red-50 text-red-700 px-3 py-1 rounded-xl font-black text-xs border border-red-100 animate-pulse">
                    {echeances.filter(e => e.status === 'EN RETARD').length} {t('debts.overdue_status')}
                  </div>
                )}
                {echeances.filter(e => e.status === "AUJOURD'HUI").length > 0 && (
                  <div className="bg-orange-50 text-orange-700 px-3 py-1 rounded-xl font-black text-xs border border-orange-100">
                    {echeances.filter(e => e.status === "AUJOURD'HUI").length} {t('debts.today_status')}
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500 py-3 pl-4 rounded-l-2xl text-left">{t('debts.supplier')}</th>
                    <th className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500 py-3 text-left">{t('debts.invoice')}</th>
                    <th className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500 py-3 text-right">{t('debts.amount_due')}</th>
                    <th className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500 py-3 text-center">{t('debts.due_date')}</th>
                    <th className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500 py-3 pr-4 rounded-r-2xl text-center">{t('debts.status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {echeances.slice(0, 10).map((e, i) => {
                    const isRetard = e.status === 'EN RETARD';
                    const isAujourdhui = e.status === "AUJOURD'HUI";
                    return (
                      <tr key={i} className={`transition-all group ${
                        isRetard ? 'hover:bg-red-50/50' : isAujourdhui ? 'hover:bg-orange-50/50' : 'hover:bg-gray-50'
                      }`}>
                        <td className="py-3 pl-4 font-bold text-sm text-gray-900">{e.fournisseur_nom}</td>
                        <td className="py-3 text-xs font-mono text-gray-500">{e.numero_facture}</td>
                        <td className="py-3 text-right font-mono font-black text-sm text-gray-900">
                          {formatCurrencyLocal(e.montant_du)}
                        </td>
                        <td className="py-3 text-center text-xs font-bold text-gray-500">
                          {formatDate(e.date_echeance)}
                        </td>
                        <td className="py-3 pr-4 text-center">
                          {isRetard ? (
                            <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-red-200">
                              <Clock className="size-3" />
                              {Math.abs(e.jours_restants)}{t('debts.days_overdue')}
                            </span>
                          ) : isAujourdhui ? (
                            <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-orange-200 animate-pulse">
                              <AlertTriangle className="size-3" />
                              {t('debts.today_badge')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-100">
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

      {/* Bottom Row: Payment Mix */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 rounded-xl overflow-hidden w-full">
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-6 shrink-0">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
              <PieChartIcon className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-gray-900 tracking-tight uppercase">{t('dashboard.charts.payment_mix', { defaultValue: 'Qualité du CA' })}</h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('dashboard.charts.today_payments', { defaultValue: 'Répartition des paiements du jour' })}</p>
            </div>
          </div>
          <div className="flex-grow h-[300px]">
            {stats?.payment_mix && stats.payment_mix.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.payment_mix.map((item: any) => ({ ...item, value: Math.abs(item.value) }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={5}
                    dataKey="value"
                    nameKey="label"
                  >
                    {stats.payment_mix.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444'][index % 6]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatCurrencyLocal(value)}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full opacity-20">
                <CreditCard className="size-12 mb-2" />
                <span className="text-[10px] font-black uppercase tracking-widest">{t('dashboard.charts.no_data', { defaultValue: 'Aucun paiement aujourd\'hui' })}</span>
              </div>
            )}
          </div>

          {/* Custom Aligned Legend with Amounts */}
          {stats?.payment_mix && stats.payment_mix.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-gray-100 pt-4 shrink-0">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {stats.payment_mix.map((item: any, index: number) => (
                  <div key={item.label} className="flex items-center justify-between group p-2 bg-gray-50 rounded-xl border border-gray-200/50">
                    <div className="flex items-center gap-2">
                       <div 
                        className="size-2.5 rounded-full shrink-0 shadow-sm" 
                        style={{ backgroundColor: ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444'][index % 6] }}
                      />
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider group-hover:text-indigo-600 transition-colors">
                        {item.label}
                      </span>
                    </div>
                    <span className="text-xs font-black text-gray-900 tracking-tight">
                      {formatCurrencyLocal(item.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
