/**
 * Modale "Détail de clôture" : date/période, montants, écart,
 * flux financiers, ventilation par mode, billetage repliable, observation.
 */
import { Banknote, Printer } from 'lucide-react'
import { Button } from '../../shadcn/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../shadcn/dialog'
import { cn } from '../../../lib/utils'
import { normalizeNumberInput } from '../../../utils/formatters'
import type { DetailsMeta } from './types'
import type { useHistoriqueClotures } from '../../../hooks/caisse/useHistoriqueClotures'

interface Props {
  state: ReturnType<typeof useHistoriqueClotures>
}

export default function ClotureDetailDialog({ state }: Props) {
  const {
    t, selectedCloture, setSelectedCloture, showBilletage, setShowBilletage,
    formatDate, formatMoney, getModeLabel, handlePrint,
  } = state

  return (
    <Dialog open={!!selectedCloture} onOpenChange={(open) => !open && setSelectedCloture(null)}>
    {selectedCloture && (
        <DialogContent hideCloseButton size="lg" className="p-0 gap-0 overflow-hidden rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col">
          <div className="bg-emerald-600 p-6 text-white shrink-0">
            <DialogTitle className="font-bold text-xl flex items-center gap-3">
              <Banknote className="size-6" />
              {t('modal.title')}
            </DialogTitle>
            <DialogDescription className="text-emerald-100 text-sm mt-1 pb-1">
              {t('modal.cash_of', { name: selectedCloture.user_name || selectedCloture.username || t('common:unknown') })}
              {selectedCloture.cloture_par_name && t('modal.closed_by', { name: selectedCloture.cloture_par_name })}
            </DialogDescription>
          </div>

          <div className="p-6 space-y-6 overflow-y-auto">
            {/* En-tête Date / Période */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-4">
               <div className="flex-1">
                 <p className="text-xs uppercase font-bold text-slate-500">{t('modal.date_label')}</p>
                 <p className="font-mono text-lg">{formatDate(selectedCloture.date)}</p>
               </div>
               <div className="w-px h-10 bg-slate-200"></div>
               <div className="flex-1 text-right">
                 <p className="text-xs uppercase font-bold text-slate-500">{t('modal.period_label')}</p>
                 <p className="text-sm">{t('modal.period_from', { date: selectedCloture.date_debut ? formatDate(selectedCloture.date_debut) : '...' })}</p>
                 <p className="text-sm">{t('modal.period_to', { date: selectedCloture.date_fin ? formatDate(selectedCloture.date_fin) : '...' })}</p>
               </div>
            </div>

            {/* Stats principales */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <div className="text-xs uppercase font-bold text-slate-500 mb-1">{t('modal.theoretical_label')}</div>
                <div className="text-2xl font-bold">{formatMoney(selectedCloture.montant_theorique)}</div>
              </div>
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                <div className="text-xs uppercase font-bold text-emerald-600 mb-1">{t('modal.real_label')}</div>
                <div className="text-2xl font-bold text-emerald-600">{formatMoney(selectedCloture.montant_reel)}</div>
              </div>
            </div>

            {/* Écart */}
            <div className={cn("p-4 rounded-xl flex items-center justify-between", normalizeNumberInput(selectedCloture.ecart_caisse) === 0 ? 'bg-emerald-50 text-emerald-600' : normalizeNumberInput(selectedCloture.ecart_caisse) > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600')}>
              <div className="font-bold uppercase tracking-wider text-sm">{t('modal.gap_label')}</div>
              <div className="font-bold text-xl">
                {normalizeNumberInput(selectedCloture.ecart_caisse) > 0 ? '+' : ''}{formatMoney(selectedCloture.ecart_caisse)}
              </div>
            </div>

            {/* Flux financiers */}
            <div className="space-y-3">
              <h4 className="font-bold uppercase tracking-wider text-xs text-slate-500 border-b border-slate-200 pb-2">{t('modal.flows_summary')}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white border border-slate-200 p-3 rounded-lg text-center flex flex-col justify-center relative">
                  <div className="text-xs opacity-60 font-bold">{t('modal.ventes')} : {formatMoney(selectedCloture.total_ventes)}</div>
                  <div className="text-caption mt-1 text-slate-500">{t('modal.pharmacy', { amount: formatMoney((selectedCloture.details_paiement?.__meta__ as DetailsMeta | undefined)?.total_ca_pharmacie ?? selectedCloture.total_ventes) })}</div>
                  {((selectedCloture.details_paiement?.__meta__ as DetailsMeta | undefined)?.total_ca_divers ?? 0) > 0 && (
                    <div className="text-caption text-slate-500">{t('modal.misc', { amount: formatMoney((selectedCloture.details_paiement?.__meta__ as DetailsMeta | undefined)?.total_ca_divers || 0) })}</div>
                  )}
                </div>
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-center">
                  <div className="text-xs opacity-60 text-emerald-600 uppercase">{t('modal.entries')}</div>
                  <div className="font-bold text-emerald-600">{formatMoney(selectedCloture.total_entrees)}</div>
                </div>
                <div className="bg-red-50 border border-red-200 p-3 rounded-lg text-center">
                  <div className="text-xs opacity-60 text-red-600 uppercase">{t('modal.exits')}</div>
                  <div className="font-bold text-red-600">{formatMoney(selectedCloture.total_sorties)}</div>
                </div>
              </div>
            </div>

            {/* Détails Paiement */}
            {selectedCloture.details_paiement && Object.keys(selectedCloture.details_paiement).length > 0 && (
              <div className="space-y-3">
                <h4 className="font-bold uppercase tracking-wider text-xs text-slate-500 border-b border-slate-200 pb-2">{t('modal.mode_details')}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(selectedCloture.details_paiement).flatMap(([mode, montant]) => mode !== '__meta__' ? [(
                    <div key={mode} className="flex justify-between p-2 bg-slate-50 rounded text-sm">
                      <span className="flex items-center gap-2">
                        {mode === 'especes' && '💵'}
                        {mode === 'carte' && '💳'}
                        {mode === 'cheque' && '📝'}
                        {mode === 'virement' && '🏦'}
                        {mode === 'coupon' && '🎟️'}
                        {(mode === 'om' || mode === 'momo') && '📱'}
                        {getModeLabel(mode)}
                      </span>
                      <span className="font-semibold">{formatMoney(montant ?? 0)}</span>
                    </div>
                  )] : [])}
                </div>
              </div>
            )}

            {/* Billetage (coupures comptées) */}
            {selectedCloture.billetage && Object.keys(selectedCloture.billetage).length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowBilletage(s => !s)}
                  className="w-full px-4 py-2 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between hover:bg-slate-100 transition-colors"
                  aria-expanded={showBilletage}
                >
                  <span className="flex items-center gap-2">
                    <Banknote className="size-4" />
                    {t('modal.billetage_title', { defaultValue: 'Billetage (coupures comptées)' })}
                  </span>
                  <span className="text-slate-400">{showBilletage ? '▲' : '▼'}</span>
                </button>
                {showBilletage && (
                  <div className="p-4 space-y-3">
                    {/* Billets */}
                    {selectedCloture.billetage.billets && Object.entries(selectedCloture.billetage.billets).filter(([, q]) => q > 0).length > 0 && (
                      <div>
                        <div className="text-caption font-bold uppercase text-slate-400 mb-1">{t('modal.billetage_billets', { defaultValue: 'Billets' })}</div>
                        {Object.entries(selectedCloture.billetage.billets).filter(([, q]) => q > 0).map(([valeur, qte]) => (
                          <div key={valeur} className="flex justify-between text-xs py-0.5">
                            <span>{qte} × {formatMoney(parseInt(valeur))}</span>
                            <span className="font-bold">{formatMoney(qte * parseInt(valeur))}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Pièces */}
                    {selectedCloture.billetage.pieces && Object.entries(selectedCloture.billetage.pieces).filter(([, q]) => q > 0).length > 0 && (
                      <div>
                        <div className="text-caption font-bold uppercase text-slate-400 mb-1">{t('modal.billetage_pieces', { defaultValue: 'Pièces' })}</div>
                        {Object.entries(selectedCloture.billetage.pieces).filter(([, q]) => q > 0).map(([valeur, qte]) => (
                          <div key={valeur} className="flex justify-between text-xs py-0.5">
                            <span>{qte} × {formatMoney(parseInt(valeur))}</span>
                            <span className="font-bold">{formatMoney(qte * parseInt(valeur))}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Mobile Money */}
                    {((selectedCloture.billetage.orange_money ?? 0) > 0 || (selectedCloture.billetage.mtn_momo ?? 0) > 0) && (
                      <div>
                        <div className="text-caption font-bold uppercase text-slate-400 mb-1">{t('modal.billetage_mobile_money', { defaultValue: 'Mobile Money' })}</div>
                        {(selectedCloture.billetage.orange_money ?? 0) > 0 && (
                          <div className="flex justify-between text-xs py-0.5">
                            <span>Orange Money</span>
                            <span className="font-bold">{formatMoney(selectedCloture.billetage.orange_money ?? 0)}</span>
                          </div>
                        )}
                        {(selectedCloture.billetage.mtn_momo ?? 0) > 0 && (
                          <div className="flex justify-between text-xs py-0.5">
                            <span>MTN MoMo</span>
                            <span className="font-bold">{formatMoney(selectedCloture.billetage.mtn_momo ?? 0)}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Total */}
                    {(selectedCloture.billetage.total ?? 0) > 0 && (
                      <div className="flex justify-between text-sm font-black pt-2 border-t border-slate-200">
                        <span>{t('modal.billetage_total', { defaultValue: 'Total billetage' })}</span>
                        <span>{formatMoney(selectedCloture.billetage.total ?? 0)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {selectedCloture.observation && (
              <div className="space-y-2">
                <h4 className="font-bold uppercase tracking-wider text-xs text-slate-500">{t('modal.observations')}</h4>
                <p className="text-sm bg-slate-50 p-3 rounded-lg border border-slate-200 italic">"{selectedCloture.observation}"</p>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 p-4 bg-slate-50 shrink-0 flex gap-2">
            <Button variant="outline" onClick={() => handlePrint(selectedCloture)} className="gap-2 mr-auto border-emerald-300 text-emerald-600 hover:bg-emerald-50">
              <Printer className="size-5" />
              {t('modal.print')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setSelectedCloture(null)}
            >
              {t('modal.close')}
            </Button>
          </div>
        </DialogContent>
    )}
    </Dialog>
  )
}
