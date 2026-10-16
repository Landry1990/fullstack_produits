/**
 * Onglet "Sessions de caisse" de l'historique :
 * bannière des sessions actives, table paginée (frontend) des sessions.
 */
import { useState } from 'react'
import { Clock, Eye, Monitor, PlayCircle, StopCircle } from 'lucide-react'
import { Button } from '../../shadcn/button'
import { Badge } from '../../shadcn/badge'
import { cn } from '../../../lib/utils'
import PaginationControls from '../../ui/PaginationControls'
import type { useHistoriqueClotures } from '../../../hooks/caisse/useHistoriqueClotures'

const SESSION_PAGE_SIZE = 15

interface Props {
  state: ReturnType<typeof useHistoriqueClotures>
}

export default function SessionsPanel({ state }: Props) {
  const { t, sessions, sessionsLoading, setSelectedSession, formatDate, formatMoney } = state

  // Pagination sessions (côté frontend) — remise à 1 à chaque montage de l'onglet
  const [sessionPage, setSessionPage] = useState(1)
  const sessionsTotalPages = Math.ceil(sessions.length / SESSION_PAGE_SIZE)
  const sessionsPaged = sessions.slice((sessionPage - 1) * SESSION_PAGE_SIZE, sessionPage * SESSION_PAGE_SIZE)

  return (
    <div className="flex-1 px-3 sm:px-6 py-4 sm:py-6 overflow-hidden flex flex-col gap-4">
      {/* Active Sessions Banner */}
      {(() => { const activeSessions = sessions.filter(s => s.est_actif); return activeSessions.length > 0 ? (
        <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <h3 className="font-bold text-emerald-600 text-sm uppercase tracking-wider flex items-center gap-2 mb-3">
            <PlayCircle className="size-4 animate-pulse" />
            {t('sessions.active_title')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeSessions.map(session => (
              <div key={session.id} className="bg-white rounded-lg p-4 border border-emerald-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm">{session.poste_nom}</span>
                  <Badge className="bg-emerald-500 text-white gap-1 font-bold">
                    <span className="size-1.5 rounded-full bg-white animate-pulse"></span>
                    {t('sessions.status.open')}
                  </Badge>
                </div>
                <div className="text-xs text-slate-500 space-y-1">
                  <div>👤 {session.ouvert_par_name}</div>
                  <div>🕐 {t('sessions.opened_on', { date: formatDate(session.date_ouverture) })}</div>
                  {session.fond_de_caisse && <div>💰 {t('sessions.fund_label', { amount: formatMoney(session.fond_de_caisse) })}</div>}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedSession(session)}
                  className="w-full text-emerald-600 mt-2"
                >
                  <Eye className="size-3" /> {t('sessions.view_details')}
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null; })()}

      {/* Sessions Table */}
      <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-auto">
          <table className="min-w-full table-fixed divide-y divide-slate-200">
            <thead className="bg-slate-100 sticky top-0 z-10">
              <tr>
                <th className="w-20 py-2 px-3 text-caption lg:text-xs tracking-wide uppercase text-slate-500 font-semibold whitespace-nowrap">{t('sessions.table.status')}</th>
                <th className="w-20 py-2 px-3 text-caption lg:text-xs tracking-wide uppercase text-slate-500 font-semibold whitespace-nowrap">{t('sessions.table.post')}</th>
                <th className="w-28 py-2 px-3 text-caption lg:text-xs tracking-wide uppercase text-slate-500 font-semibold whitespace-nowrap">{t('sessions.table.cashier')}</th>
                <th className="w-32 py-2 px-3 text-caption lg:text-xs tracking-wide uppercase text-slate-500 font-semibold whitespace-nowrap">{t('sessions.table.opening')}</th>
                <th className="w-32 py-2 px-3 text-caption lg:text-xs tracking-wide uppercase text-slate-500 font-semibold whitespace-nowrap">{t('sessions.table.closing')}</th>
                <th className="w-28 text-right py-2 px-3 text-caption lg:text-xs tracking-wide uppercase text-slate-500 font-semibold whitespace-nowrap">{t('sessions.table.fund')}</th>
                <th className="w-28 text-right py-2 px-3 text-caption lg:text-xs tracking-wide uppercase text-slate-500 font-semibold whitespace-nowrap">{t('sessions.table.total_collected')}</th>
                <th className="w-24 text-center py-2 px-3 text-caption lg:text-xs tracking-wide uppercase text-slate-500 font-semibold whitespace-nowrap">{t('sessions.table.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {sessionsLoading ? (
                <tr>
                  <td colSpan={8} className="h-64 text-center">
                    <div className="animate-spin rounded-full size-8 border-b-2 border-emerald-600 mx-auto"></div>
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="h-64 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Clock className="size-12 text-slate-300" />
                      <p className="text-lg">{t('sessions.empty.title')}</p>
                      <p className="text-sm">{t('sessions.empty.description')}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sessionsPaged.map(session => {
                  const totalVentilation = Object.values(session.ventilation_paiements || {}).reduce((s, v) => s + v, 0)
                  return (
                    <tr key={session.id} className={cn("hover:bg-slate-50 transition-colors", session.est_actif ? 'bg-emerald-50/50' : '')}>
                      <td className="py-2 px-3">
                        {session.est_actif ? (
                          <Badge className="bg-emerald-500 text-white gap-1 font-bold text-caption">
                            <PlayCircle className="size-3" />
                            {t('sessions.status.active')}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 font-bold text-slate-600 border-slate-200 text-caption">
                            <StopCircle className="size-3" />
                            {t('sessions.status.closed')}
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <Monitor className="size-4 text-slate-400" />
                          <span className="font-bold text-sm">{session.poste_nom}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 font-medium text-sm">{session.ouvert_par_name}</td>
                      <td className="py-2 px-3">
                        <div className="font-semibold text-sm">{formatDate(session.date_ouverture)}</div>
                      </td>
                      <td className="py-2 px-3">
                        {session.date_fermeture ? (
                          <div className="font-semibold text-sm">{formatDate(session.date_fermeture)}</div>
                        ) : session.est_actif ? (
                          <span className="text-emerald-600 font-bold text-xs animate-pulse">{t('sessions.status.in_progress')}</span>
                        ) : (
                          <span className="text-slate-400 font-medium text-xs">{t('sessions.status.not_opened', { defaultValue: 'Non ouvert' })}</span>
                        )}
                      </td>
                      <td className="text-right py-2 px-3 font-medium text-slate-700 text-sm">
                        {session.fond_de_caisse ? formatMoney(session.fond_de_caisse) : '-'}
                      </td>
                      <td className="text-right py-2 px-3 font-bold text-emerald-600 text-sm">
                        {formatMoney(totalVentilation)}
                      </td>
                      <td className="text-center py-2 px-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedSession(session)}
                          className="text-emerald-600 h-8 w-8 p-0"
                          title={t('sessions.view_detail')}
                          aria-label={t('sessions.view_detail')}
                        >
                          <Eye className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination sessions */}
        {sessions.length > SESSION_PAGE_SIZE && (
          <div className="bg-white border-t border-slate-200 p-3 flex items-center justify-between shrink-0">
            <span className="text-sm text-slate-500">
              {t('sessions.pagination.showing', { start: (sessionPage - 1) * SESSION_PAGE_SIZE + 1, end: Math.min(sessionPage * SESSION_PAGE_SIZE, sessions.length), total: sessions.length })}
            </span>
            <div className="flex gap-1.5 items-center">
              <span className="px-3 py-1.5 text-xs font-bold bg-slate-100 rounded-md flex items-center">{t('pagination.page', { current: sessionPage, total: sessionsTotalPages })}</span>
              <PaginationControls page={sessionPage} totalPages={sessionsTotalPages} onPageChange={setSessionPage} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
