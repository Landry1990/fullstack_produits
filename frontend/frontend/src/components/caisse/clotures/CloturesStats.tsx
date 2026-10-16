/**
 * Sections statistiques de l'onglet Clôtures :
 * barre compacte (sections repliées), classement meilleur caissier,
 * cartes de totaux globaux de la période.
 */
import { Banknote, CheckCircle, ChevronDown, XCircle } from 'lucide-react'
import { Button } from '../../shadcn/button'
import { cn } from '../../../lib/utils'
import { normalizeNumberInput } from '../../../utils/formatters'
import BestCashierMetric from '../../BestCashierMetric'
import type { useHistoriqueClotures } from '../../../hooks/caisse/useHistoriqueClotures'

interface Props {
  state: ReturnType<typeof useHistoriqueClotures>
}

export default function CloturesStats({ state }: Props) {
  const {
    t, globalTotals, formatMoney,
    showPerfSection, togglePerfSection, showTotalsSection, toggleTotalsSection,
    metricMonth, setMetricMonth, metricYear, setMetricYear,
    showMetric, setShowMetric,
    selectedUser, setDateDebut, setDateFin,
  } = state

  return (
    <>
      {/* Barre compacte commune pour les sections repliées */}
      {(!showPerfSection || (globalTotals && !showTotalsSection)) && (
        <div className="px-3 sm:px-6 pt-4 shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-wrap items-stretch divide-x divide-slate-200">
            {!showPerfSection && (
              <button
                type="button"
                onClick={togglePerfSection}
                className="px-4 py-2.5 flex items-center gap-2 font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
                {t('performance.title')}
                <ChevronDown className="size-4" />
              </button>
            )}
            {globalTotals && !showTotalsSection && (
              <button
                type="button"
                onClick={toggleTotalsSection}
                className="flex-1 min-w-0 px-4 py-2.5 flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <span className="font-black uppercase tracking-widest flex items-center gap-1.5 shrink-0">
                  <Banknote className="size-4 text-emerald-600" />
                  {t('stats.section_title')}
                  <ChevronDown className="size-4" />
                </span>
                <span className="truncate">
                  {t('stats.theoretical_total')} <b className="text-slate-700">{formatMoney(globalTotals.montant_theorique)}</b>
                  {' · '}{t('stats.real_total')} <b className="text-emerald-600">{formatMoney(globalTotals.montant_reel)}</b>
                  {' · '}{t('stats.global_gap')} <b className={cn(normalizeNumberInput(globalTotals.ecart_caisse) < 0 ? 'text-red-600' : normalizeNumberInput(globalTotals.ecart_caisse) > 0 ? 'text-emerald-600' : 'text-slate-400')}>
                    {normalizeNumberInput(globalTotals.ecart_caisse) > 0 ? '+' : ''}{formatMoney(globalTotals.ecart_caisse)}
                  </b>
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Best Cashier Ranking Section — visible uniquement dépliée */}
      {showPerfSection && (
      <div className="px-3 sm:px-6 pt-4 sm:pt-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className={cn("p-4 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center bg-white", showPerfSection && "border-b border-slate-200")}>
            <button
              type="button"
              onClick={togglePerfSection}
              className="font-black text-sm uppercase tracking-widest text-slate-500 flex items-center gap-2 hover:text-slate-700 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
              {t('performance.title')}
              <ChevronDown className={cn("size-4 transition-transform", showPerfSection && "rotate-180")} />
            </button>
            {showPerfSection && (
            <div className="flex flex-wrap gap-2 items-center justify-end w-full sm:w-auto">
              <select
                aria-label={t('performance.month_label', { defaultValue: 'Mois' })}
                className="h-8 px-2 rounded-md bg-slate-100 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-emerald-300 font-bold"
                value={metricMonth}
                onChange={(e) => {
                  const m = e.target.value
                  setMetricMonth(m)
                  const y = parseInt(metricYear)
                  const mo = parseInt(m) - 1
                  setDateDebut(new Date(y, mo, 1))
                  setDateFin(new Date(y, mo + 1, 0))
                }}
              >
                <option value="01">{t('performance.months.01')}</option>
                <option value="02">{t('performance.months.02')}</option>
                <option value="03">{t('performance.months.03')}</option>
                <option value="04">{t('performance.months.04')}</option>
                <option value="05">{t('performance.months.05')}</option>
                <option value="06">{t('performance.months.06')}</option>
                <option value="07">{t('performance.months.07')}</option>
                <option value="08">{t('performance.months.08')}</option>
                <option value="09">{t('performance.months.09')}</option>
                <option value="10">{t('performance.months.10')}</option>
                <option value="11">{t('performance.months.11')}</option>
                <option value="12">{t('performance.months.12')}</option>
              </select>
              <select
                aria-label={t('performance.year_label', { defaultValue: 'Année' })}
                className="h-8 px-2 rounded-md bg-slate-100 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-emerald-300 font-bold"
                value={metricYear}
                onChange={(e) => {
                  const y = e.target.value
                  setMetricYear(y)
                  const mo = parseInt(metricMonth) - 1
                  setDateDebut(new Date(parseInt(y), mo, 1))
                  setDateFin(new Date(parseInt(y), mo + 1, 0))
                }}
              >
                {[2024, 2025, 2026, 2027].map(y => (
                    <option key={y} value={y.toString()}>{y}</option>
                ))}
              </select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMetric(!showMetric)}
                className="h-8 px-3 font-bold"
              >
                {showMetric ? t('performance.hide') : t('performance.show')}
              </Button>
            </div>
            )}
          </div>
          {showPerfSection && showMetric && (
            <div className="p-3 bg-slate-50/50">
              <BestCashierMetric month={metricMonth} year={metricYear} userId={selectedUser || undefined} />
            </div>
          )}
        </div>
      </div>
      )}

      {/* Global Stats Cards — visible uniquement dépliée */}
      {globalTotals && showTotalsSection && (
        <div className="px-3 sm:px-6 pt-4 shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={toggleTotalsSection}
              className="w-full px-4 py-3 flex items-center justify-between gap-4 bg-white hover:bg-slate-50 transition-colors"
            >
              <h2 className="font-black text-sm uppercase tracking-widest text-slate-500 flex items-center gap-2 shrink-0">
                <Banknote className="size-4 text-emerald-600" />
                {t('stats.section_title')}
                <ChevronDown className="size-4 rotate-180 transition-transform" />
              </h2>
            </button>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border-t border-slate-100">
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-center">
             <div className="flex justify-between items-start">
               <div>
                  <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">{t('stats.theoretical_total')}</h3>
                  <p className="text-2xl font-bold mt-1">{formatMoney(globalTotals.montant_theorique)}</p>
               </div>
               <div className="p-3 bg-slate-100 rounded-lg text-slate-600">
                 <Banknote className="size-6" />
               </div>
             </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-center">
             <div className="flex justify-between items-start">
               <div>
                  <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">{t('stats.real_total')}</h3>
                  <p className="text-2xl font-bold mt-1 text-emerald-600">{formatMoney(globalTotals.montant_reel)}</p>
               </div>
               <div className="p-3 bg-emerald-100 rounded-lg text-emerald-600">
                 <CheckCircle className="size-6" />
               </div>
             </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-center">
             <div className="flex justify-between items-start">
               <div>
                  <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">{t('stats.global_gap')}</h3>
                  <p className={cn("text-2xl font-bold mt-1", normalizeNumberInput(globalTotals.ecart_caisse) < 0 ? 'text-red-600' : normalizeNumberInput(globalTotals.ecart_caisse) > 0 ? 'text-emerald-600' : 'text-slate-400')}>
                    {normalizeNumberInput(globalTotals.ecart_caisse) > 0 ? '+' : ''}{formatMoney(globalTotals.ecart_caisse)}
                  </p>
               </div>
                <div className={cn("p-3 rounded-lg", normalizeNumberInput(globalTotals.ecart_caisse) < 0 ? 'bg-red-50 text-red-600' : normalizeNumberInput(globalTotals.ecart_caisse) > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500')}>
                 <XCircle className="size-6" />
               </div>
             </div>
          </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
