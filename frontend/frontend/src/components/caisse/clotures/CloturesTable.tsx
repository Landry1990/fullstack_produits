/**
 * Table des clôtures (onglet Clôtures) :
 * toggle Liste / Par jour, table détaillée ou agrégée, totaux de période,
 * pagination serveur.
 */
import { Banknote, CalendarDays, Eye, List, Printer } from 'lucide-react'
import { Button } from '../../shadcn/button'
import { Badge } from '../../shadcn/badge'
import { cn } from '../../../lib/utils'
import { normalizeNumberInput } from '../../../utils/formatters'
import PaginationControls from '../../ui/PaginationControls'
import { formatDay } from './utils'
import type { useHistoriqueClotures } from '../../../hooks/caisse/useHistoriqueClotures'

interface Props {
  state: ReturnType<typeof useHistoriqueClotures>
}

export default function CloturesTable({ state }: Props) {
  const {
    t, viewMode, setViewMode, loading, clotures, isMultiCaisse,
    globalTotals, totalItems, pageSize, currentPage, setCurrentPage, totalPages,
    dailyData, formatDate, formatMoney, setSelectedCloture, handlePrint,
  } = state

  return (
    <div className="flex-1 px-3 sm:px-6 pb-4 sm:pb-6 overflow-hidden flex flex-col">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden">
        {/* Header + Toggle */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {viewMode === 'list' ? t('table.list_title', { defaultValue: 'Clôtures détaillées' }) : t('table.daily_title', { defaultValue: 'Récapitulatif journalier' })}
          </h3>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('list')}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all", viewMode === 'list' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
            >
              <List className="size-3.5" />
              {t('view_mode.list', { defaultValue: 'Liste' })}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('daily')}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all", viewMode === 'daily' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
            >
              <CalendarDays className="size-3.5" />
              {t('view_mode.daily', { defaultValue: 'Par jour' })}
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto flex-1">
          {viewMode === 'list' ? (
            <table className="min-w-full table-fixed divide-y divide-slate-200">
              <thead className="bg-slate-100 sticky top-0 z-10 opacity-100">
                <tr>
                  <th className="py-2 px-3 text-caption lg:text-xs tracking-wide uppercase text-slate-500 font-semibold whitespace-nowrap">{t('table.header_date')}</th>
                  {isMultiCaisse && <th className="py-2 px-3 text-left text-caption lg:text-xs tracking-wide uppercase text-slate-500 font-semibold whitespace-nowrap">{t('table.header_post')}</th>}
                  <th className="py-2 px-3 text-left text-caption lg:text-xs tracking-wide uppercase text-slate-500 font-semibold whitespace-nowrap">{t('table.header_cashier')}</th>
                  <th className="py-2 px-3 text-left text-caption lg:text-xs tracking-wide uppercase text-slate-500 font-semibold whitespace-nowrap">{t('table.header_done_by')}</th>
                  <th className="text-right py-2 px-3 text-caption lg:text-xs tracking-wide uppercase text-slate-500 font-semibold whitespace-nowrap">{t('table.header_theoretical')}</th>
                  <th className="text-right py-2 px-3 text-caption lg:text-xs tracking-wide uppercase text-slate-500 font-semibold whitespace-nowrap">{t('table.header_real')}</th>
                  <th className="text-right py-2 px-3 text-caption lg:text-xs tracking-wide uppercase text-slate-500 font-semibold whitespace-nowrap">{t('table.header_gap')}</th>
                  <th className="text-center py-2 px-3 text-caption lg:text-xs tracking-wide uppercase text-slate-500 font-semibold whitespace-nowrap">{t('table.header_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="h-64 text-center">
                      <div className="animate-spin rounded-full size-8 border-b-2 border-emerald-600 mx-auto"></div>
                    </td>
                  </tr>
                ) : clotures.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="h-64 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Banknote className="size-12 text-slate-300" />
                        <p className="text-lg">{t('table.no_cloture')}</p>
                        <p className="text-sm">{t('table.no_cloture_desc')}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  clotures.map((cloture) => (
                    <tr key={cloture.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3">
                        <div className="font-semibold text-sm whitespace-nowrap">{formatDate(cloture.date)}</div>
                        <div className="text-caption text-slate-500 mt-0.5 whitespace-nowrap">
                          {t('table.period_desc', {
                            start: cloture.date_debut ? formatDate(cloture.date_debut) : '...',
                            end: cloture.date_fin ? formatDate(cloture.date_fin) : '...'
                          })}
                        </div>
                      </td>
                      {isMultiCaisse && (
                         <td className="py-2 px-3 align-middle">
                           <span className="font-medium text-sm text-slate-700">
                             {cloture.poste_caisse_nom || '-'}
                           </span>
                         </td>
                      )}
                      <td className="py-2 px-3 align-middle">
                         <span className="font-medium text-sm text-slate-800">{cloture.user_name || cloture.username || t('common:not_available')}</span>
                      </td>
                      <td className="py-2 px-3 align-middle">
                         <span className="text-sm font-medium text-slate-500">{cloture.cloture_par_name || '-'}</span>
                      </td>
                      <td className="text-right py-2 px-3 text-slate-700 font-medium text-sm">
                        {formatMoney(cloture.montant_theorique)}
                      </td>
                      <td className="text-right py-2 px-3 font-bold text-emerald-600 text-sm">
                        {formatMoney(cloture.montant_reel)}
                      </td>
                      <td className="text-right py-2 px-3">
                        <Badge className={cn("font-bold px-2 py-0.5 text-caption", normalizeNumberInput(cloture.ecart_caisse) < 0 ? 'bg-red-500 text-white' : normalizeNumberInput(cloture.ecart_caisse) > 0 ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 border-slate-200')}>
                          {normalizeNumberInput(cloture.ecart_caisse) > 0 ? '+' : ''}{formatMoney(cloture.ecart_caisse)}
                        </Badge>
                      </td>
                      <td className="text-center py-2 px-3">
                        <div className="flex justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedCloture(cloture)}
                            className="text-emerald-600 h-8 w-8 p-0"
                            title={t('table.view_details')}
                            aria-label={t('table.view_details')}
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePrint(cloture)}
                            className="text-slate-500 h-8 w-8 p-0"
                            title={t('table.print')}
                            aria-label={t('table.print')}
                          >
                            <Printer className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {/* Footer Totaux Période */}
              {globalTotals && clotures.length > 0 && (
                <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                  <tr className="text-slate-700 font-bold">
                    <td className="py-2 px-3 whitespace-nowrap" colSpan={isMultiCaisse ? 4 : 3}>
                      <span className="uppercase text-caption tracking-tight">{t('table.period_total', { count: totalItems })}</span>
                    </td>
                    <td className="text-right py-2 px-3 text-slate-700 font-bold">{formatMoney(globalTotals.montant_theorique)}</td>
                    <td className="text-right py-2 px-3 text-emerald-600 font-bold">{formatMoney(globalTotals.montant_reel)}</td>
                    <td className={cn("text-right py-2 px-3 font-bold", normalizeNumberInput(globalTotals.ecart_caisse) < 0 ? 'text-red-600' : normalizeNumberInput(globalTotals.ecart_caisse) > 0 ? 'text-emerald-600' : '')}>
                      {normalizeNumberInput(globalTotals.ecart_caisse) > 0 ? '+' : ''}{formatMoney(globalTotals.ecart_caisse)}
                    </td>
                    <td className="px-3"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          ) : (
            <table className="min-w-full table-fixed divide-y divide-slate-200">
              <thead className="bg-slate-100 sticky top-0 z-10 opacity-100">
                <tr>
                  <th className="py-2 px-3 text-caption lg:text-xs tracking-wide uppercase text-slate-500 font-semibold whitespace-nowrap">{t('daily.header_date', { defaultValue: 'Date' })}</th>
                  <th className="text-center py-2 px-3 text-caption lg:text-xs tracking-wide uppercase text-slate-500 font-semibold whitespace-nowrap">{t('daily.header_count', { defaultValue: 'Clôtures' })}</th>
                  <th className="text-right py-2 px-3 text-caption lg:text-xs tracking-wide uppercase text-slate-500 font-semibold whitespace-nowrap">{t('daily.header_theoretical', { defaultValue: 'Théorique' })}</th>
                  <th className="text-right py-2 px-3 text-caption lg:text-xs tracking-wide uppercase text-slate-500 font-semibold whitespace-nowrap">{t('daily.header_real', { defaultValue: 'Réel' })}</th>
                  <th className="text-right py-2 px-3 text-caption lg:text-xs tracking-wide uppercase text-slate-500 font-semibold whitespace-nowrap">{t('daily.header_gap', { defaultValue: 'Écart' })}</th>
                  <th className="text-right py-2 px-3 text-caption lg:text-xs tracking-wide uppercase text-slate-500 font-semibold whitespace-nowrap">{t('daily.header_sales', { defaultValue: 'Ventes' })}</th>
                  <th className="text-right py-2 px-3 text-caption lg:text-xs tracking-wide uppercase text-slate-500 font-semibold whitespace-nowrap">{t('daily.header_entries', { defaultValue: 'Entrées' })}</th>
                  <th className="text-right py-2 px-3 text-caption lg:text-xs tracking-wide uppercase text-slate-500 font-semibold whitespace-nowrap">{t('daily.header_exits', { defaultValue: 'Sorties' })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="h-64 text-center">
                      <div className="animate-spin rounded-full size-8 border-b-2 border-emerald-600 mx-auto"></div>
                    </td>
                  </tr>
                ) : dailyData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="h-64 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Banknote className="size-12 text-slate-300" />
                        <p className="text-lg">{t('daily.no_data', { defaultValue: 'Aucune donnée journalière' })}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  dailyData.map((day) => (
                    <tr key={day.date} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3">
                        <div className="font-semibold text-sm">{formatDay(day.date)}</div>
                      </td>
                      <td className="text-center py-2 px-3">
                        <Badge variant="outline" className="font-bold text-slate-600 border-slate-200 text-caption">
                          {day.count}
                        </Badge>
                      </td>
                      <td className="text-right py-2 px-3 text-slate-700 font-medium text-sm">{formatMoney(day.montant_theorique)}</td>
                      <td className="text-right py-2 px-3 font-bold text-emerald-600 text-sm">{formatMoney(day.montant_reel)}</td>
                      <td className="text-right py-2 px-3">
                        <Badge className={cn("font-bold px-2 py-0.5 text-caption", day.ecart_caisse < 0 ? 'bg-red-500 text-white' : day.ecart_caisse > 0 ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 border-slate-200')}>
                          {day.ecart_caisse > 0 ? '+' : ''}{formatMoney(day.ecart_caisse)}
                        </Badge>
                      </td>
                      <td className="text-right py-2 px-3 font-medium text-slate-700 text-sm">{formatMoney(day.total_ventes)}</td>
                      <td className="text-right py-2 px-3 font-medium text-emerald-600 text-sm">{formatMoney(day.total_entrees)}</td>
                      <td className="text-right py-2 px-3 font-medium text-red-600 text-sm">{formatMoney(day.total_sorties)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {dailyData.length > 0 && (
                <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                  <tr className="text-slate-700 font-bold">
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="uppercase text-caption tracking-tight">{t('daily.footer_total', { defaultValue: 'Totaux' })}</span>
                    </td>
                    <td className="text-center py-2 px-3">{dailyData.reduce((s, d) => s + d.count, 0)}</td>
                    <td className="text-right py-2 px-3 text-slate-700 font-bold">{formatMoney(dailyData.reduce((s, d) => s + d.montant_theorique, 0))}</td>
                    <td className="text-right py-2 px-3 text-emerald-600 font-bold">{formatMoney(dailyData.reduce((s, d) => s + d.montant_reel, 0))}</td>
                    <td className={cn("text-right py-2 px-3 font-bold", dailyData.reduce((s, d) => s + d.ecart_caisse, 0) < 0 ? 'text-red-600' : dailyData.reduce((s, d) => s + d.ecart_caisse, 0) > 0 ? 'text-emerald-600' : '')}>
                      {dailyData.reduce((s, d) => s + d.ecart_caisse, 0) > 0 ? '+' : ''}{formatMoney(dailyData.reduce((s, d) => s + d.ecart_caisse, 0))}
                    </td>
                    <td className="text-right py-2 px-3 text-slate-700 font-bold">{formatMoney(dailyData.reduce((s, d) => s + d.total_ventes, 0))}</td>
                    <td className="text-right py-2 px-3 text-emerald-600 font-bold">{formatMoney(dailyData.reduce((s, d) => s + d.total_entrees, 0))}</td>
                    <td className="text-right py-2 px-3 text-red-600 font-bold">{formatMoney(dailyData.reduce((s, d) => s + d.total_sorties, 0))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>

        {/* Pagination Controls */}
        {viewMode === 'list' && (
          <div className="bg-white border-t border-slate-200 p-4 flex items-center justify-between shrink-0">
            <span className="text-sm text-slate-500">
              {t('pagination.showing', {
                start: totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0,
                end: Math.min(currentPage * pageSize, totalItems),
                total: totalItems
              })}
              <Badge variant="outline" className="ml-2 text-xs border-slate-200 text-slate-500">{pageSize} {t('pagination.per_page')}</Badge>
            </span>
            <div className="flex gap-1.5 items-center">
              <span className="px-3 py-1.5 text-xs font-bold bg-slate-100 rounded-md flex items-center">
                {totalPages > 0 ? t('pagination.page', { current: currentPage, total: totalPages }) : '-'}
              </span>
              <PaginationControls
                page={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                isLoading={loading}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
