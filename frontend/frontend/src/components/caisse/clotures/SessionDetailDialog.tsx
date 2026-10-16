/**
 * Modale "Détail de session de caisse" : dates ouverture/fermeture,
 * fond de caisse, ventilation des paiements par mode.
 */
import { Banknote, Clock } from 'lucide-react'
import { Button } from '../../shadcn/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../shadcn/dialog'
import { cn } from '../../../lib/utils'
import type { useHistoriqueClotures } from '../../../hooks/caisse/useHistoriqueClotures'

interface Props {
  state: ReturnType<typeof useHistoriqueClotures>
}

export default function SessionDetailDialog({ state }: Props) {
  const { t, selectedSession, setSelectedSession, formatDate, formatMoney, getModeLabel } = state

  return (
    <Dialog open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
    {selectedSession && (
        <DialogContent hideCloseButton size="md" className="p-0 gap-0 overflow-hidden rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col">
          <div className="p-6 shrink-0 bg-emerald-600 text-white">
            <DialogTitle className="font-bold text-xl flex items-center gap-3">
              <Clock className="size-6" />
              {t('sessions.modal.title')}
            </DialogTitle>
            <DialogDescription className="text-emerald-100 text-sm mt-1">
              {selectedSession.poste_nom} — {selectedSession.ouvert_par_name}
            </DialogDescription>
          </div>

          <div className="p-6 space-y-5 overflow-y-auto">
            {/* Infos session */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <div className="text-xs uppercase font-bold text-slate-500 mb-1">{t('sessions.modal.opening')}</div>
                <div className="font-mono text-sm font-bold">{formatDate(selectedSession.date_ouverture)}</div>
              </div>
              <div className={cn("p-4 rounded-xl border", selectedSession.est_actif ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200')}>
                <div className="text-xs uppercase font-bold text-slate-500 mb-1">{t('sessions.modal.closing')}</div>
                {selectedSession.date_fermeture ? (
                  <div className="font-mono text-sm font-bold">{formatDate(selectedSession.date_fermeture)}</div>
                ) : (
                  <div className="text-emerald-600 font-bold text-sm animate-pulse">{t('sessions.modal.in_progress')}</div>
                )}
              </div>
            </div>

            {selectedSession.fond_de_caisse && (
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center">
                <span className="text-xs uppercase font-bold text-slate-500">{t('sessions.modal.fund')}</span>
                <span className="font-bold text-lg">{formatMoney(selectedSession.fond_de_caisse)}</span>
              </div>
            )}

            {/* Ventilation paiements */}
            <div className="space-y-3">
              <h4 className="font-bold uppercase tracking-wider text-xs text-slate-500 border-b border-slate-200 pb-2">
                {t('sessions.modal.payment_breakdown')}
              </h4>
              {Object.keys(selectedSession.ventilation_paiements || {}).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(selectedSession.ventilation_paiements).map(([mode, montant]) => (
                    <div key={mode} className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-200 hover:border-emerald-300 transition-colors">
                      <span className="flex items-center gap-2 font-medium text-sm">
                        {mode === 'especes' && '💵'}
                        {mode === 'carte' && '💳'}
                        {mode === 'cheque' && '📝'}
                        {mode === 'virement' && '🏦'}
                        {mode === 'coupon' && '🎟️'}
                        {(mode === 'om' || mode === 'momo') && '📱'}
                        {getModeLabel(mode)}
                      </span>
                      <span className="font-bold text-emerald-600">{formatMoney(montant)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg border border-emerald-200 mt-2">
                    <span className="font-bold text-sm uppercase tracking-wider">{t('sessions.modal.total_collected')}</span>
                    <span className="font-bold text-xl text-emerald-600">
                      {formatMoney(Object.values(selectedSession.ventilation_paiements).reduce((s, v) => s + v, 0))}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <Banknote className="size-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{t('sessions.modal.no_payments')}</p>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-200 p-4 bg-slate-50 shrink-0">
            <Button
              variant="ghost"
              onClick={() => setSelectedSession(null)}
            >
              {t('modal.close')}
            </Button>
          </div>
        </DialogContent>
    )}
    </Dialog>
  )
}
