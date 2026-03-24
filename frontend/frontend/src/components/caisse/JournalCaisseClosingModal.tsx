import React from 'react';
import { Printer } from 'lucide-react';
import { normalizeNumberInput } from '../../utils/formatters';
import type { useJournalCaisse } from '../../hooks/useJournalCaisse';

interface Props {
  state: ReturnType<typeof useJournalCaisse>;
}

export default function JournalCaisseClosingModal({ state }: Props) {
  const {
    t, isClosingModalOpen, closingTotals, actualAmount, setActualAmount,
    handleCloseCaisse, loading, handleImprimerCloture, setIsClosingModalOpen,
    formatCurrencyLocal
  } = state;

  return (
    <dialog className={`modal ${isClosingModalOpen ? 'modal-open' : ''}`}>
      <div className="modal-box max-w-md p-0 overflow-hidden rounded-2xl border border-base-300 shadow-2xl">
        <div className="bg-primary p-6 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-10 text-9xl">🔒</div>
          <h3 className="font-black text-2xl tracking-tight">{t('closing.title')}</h3>
          <p className="text-primary-content/80 text-xs mt-1 font-bold uppercase tracking-widest">{t('closing.security')}</p>
        </div>
        
        <div className="p-8 space-y-6">
          {closingTotals && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-3">
                <div className="p-5 bg-primary/5 border border-primary/20 rounded-xl shadow-sm text-center">
                  <div className="text-[10px] font-black text-primary/60 uppercase mb-1 tracking-widest">{t('stats.net_operational_balance')}</div>
                  <div className="text-3xl font-black text-primary">{formatCurrencyLocal(Math.round(closingTotals.total_ventes + closingTotals.total_entrees - closingTotals.total_sorties))}</div>
                  <div className="text-[10px] font-bold text-primary/40 mt-1 uppercase">{t('stats.cash_formula')}</div>
                </div>
                <div className="p-4 bg-success/5 border border-success/20 rounded-xl text-center">
                  <div className="text-[9px] font-black text-success/60 uppercase mb-1 tracking-widest">{t('stats.cash_to_justify')}</div>
                  <div className="text-2xl font-black text-success">{formatCurrencyLocal(Math.round(closingTotals.total_theorique))}</div>
                  <div className="text-[10px] font-bold text-success/40 mt-1 uppercase">{t('stats.cash_formula')}</div>
                </div>
              </div>

              <div className="form-control w-full">
                <label className="label py-1">
                  <span className="label-text text-xs font-black text-base-content/50 uppercase">{t('closing.real_amount')}</span>
                </label>
                <div className="relative">
                  <input 
                    type="number" 
                    placeholder="0" 
                    className="input input-bordered w-full input-lg font-black text-2xl text-center focus:ring-4 focus:ring-primary/10 transition-all" 
                    value={actualAmount}
                    onChange={(e) => setActualAmount(e.target.value)}
                    autoFocus
                  />
                  <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-base-content/20">{t('common:currency')}</span>
                </div>
                <div className="mt-4 flex items-center justify-between p-3 bg-base-200 rounded-lg">
                  <span className="text-xs font-bold text-base-content/60 uppercase">{t('closing.cash_gap')}</span>
                  <span className={`text-sm font-black ${
                    !actualAmount ? 'text-base-content/20' : 
                    (normalizeNumberInput(actualAmount) - closingTotals.total_theorique) >= 0 ? 'text-success' : 'text-error'
                  }`}>
                    {actualAmount ? formatCurrencyLocal(normalizeNumberInput(actualAmount) - closingTotals.total_theorique) : '---'}
                  </span>
                </div>
              </div>

              <div className="collapse collapse-arrow bg-base-100 border border-base-200 rounded-xl">
                <input type="checkbox" /> 
                <div className="collapse-title text-sm font-bold flex items-center gap-2">
                   📊 {t('closing.mode_details')}
                </div>
                <div className="collapse-content"> 
                  <div className="space-y-2 pt-2 border-t border-base-200 mt-2">
                    {Object.entries(closingTotals.details).filter(([,v]) => (v as number) !== 0).map(([mode, montant]) => {
                      const modeLabels: Record<string, string> = {
                        especes: t('common:payment_modes.especes'),
                        cheque: t('common:payment_modes.cheque'),
                        carte: t('common:payment_modes.carte'),
                        virement: t('common:payment_modes.virement'),
                        om: 'Orange Money',
                        momo: 'Mobile Money',
                        depot: t('common:payment_modes.depot'),
                        en_compte: t('common:payment_modes.en_compte'),
                        recouvrement: t('common:payment_modes.recouvrement'),
                      };
                      return (
                        <div key={mode} className="flex items-center justify-between text-xs">
                          <span className="font-medium text-base-content/60 capitalize ">{modeLabels[mode] || mode}</span>
                          <span className="font-black text-base-content">{formatCurrencyLocal(Math.round(montant as number))}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button 
              className="btn btn-primary btn-lg rounded-xl font-black shadow-lg shadow-primary/20" 
              onClick={handleCloseCaisse}
              disabled={loading || !actualAmount}
            >
              {loading ? <span className="loading loading-spinner"></span> : t('closing.confirm')}
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button className="btn btn-outline border-base-300 font-bold flex items-center justify-center gap-2" onClick={() => handleImprimerCloture()}>
                <Printer className="w-5 h-5" /> {t('closing.ticket')}
              </button>
              <button className="btn btn-ghost font-bold opacity-50" onClick={() => setIsClosingModalOpen(false)}>
                {t('common:cancel')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}
