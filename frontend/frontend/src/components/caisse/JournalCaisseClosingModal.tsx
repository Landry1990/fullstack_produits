import React, { useState, useMemo } from 'react';
import { Printer, Plus, Trash2 } from 'lucide-react';
import { normalizeNumberInput } from '../../utils/formatters';
import type { useJournalCaisse } from '../../hooks/useJournalCaisse';

interface Props {
  state: ReturnType<typeof useJournalCaisse>;
}

let nextManualId = 1;

export default function JournalCaisseClosingModal({ state }: Props) {
  const {
    t, isClosingModalOpen, closingTotals, actualAmount, setActualAmount,
    handleCloseCaisse, loading, handleImprimerCloture, setIsClosingModalOpen,
    formatCurrencyLocal, manualMovements, setManualMovements, fondDeCaisse
  } = state;

  const [newMotif, setNewMotif] = useState('');
  const [newMontant, setNewMontant] = useState('');
  const [newType, setNewType] = useState<'ENTREE' | 'SORTIE'>('SORTIE');

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

  const computed = useMemo(() => {
    if (!closingTotals) return null;
    const manualEntrees = manualMovements.filter(m => m.type === 'ENTREE').reduce((s, m) => s + m.montant, 0);
    const manualSorties = manualMovements.filter(m => m.type === 'SORTIE').reduce((s, m) => s + m.montant, 0);
    const baseTheorique = closingTotals.total_theorique || 0;
    const totalTheorique = baseTheorique + fondDeCaisse + manualEntrees - manualSorties;
    const gap = actualAmount ? normalizeNumberInput(actualAmount) - totalTheorique : null;
    return { manualEntrees, manualSorties, totalTheorique, gap };
  }, [closingTotals, manualMovements, fondDeCaisse, actualAmount]);

  const handleAddMovement = () => {
    const montant = normalizeNumberInput(newMontant);
    if (!montant || !newMotif.trim()) return;
    setManualMovements(prev => [...prev, { id: nextManualId++, motif: newMotif.trim(), montant, type: newType }]);
    setNewMotif('');
    setNewMontant('');
  };

  const handleRemoveMovement = (id: number) => {
    setManualMovements(prev => prev.filter(m => m.id !== id));
  };

  if (!isClosingModalOpen) return null;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-full max-w-lg p-0 overflow-hidden rounded-2xl border border-base-300 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-primary p-5 text-white shrink-0">
          <h3 className="font-black text-xl tracking-tight">{t('closing.title')}</h3>
          <p className="text-primary-content/80 text-xs mt-1 font-bold uppercase tracking-widest">{t('closing.security')}</p>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {closingTotals && (
            <>
              {/* === VENTES PAR MODE === */}
              <div className="bg-base-100 border border-base-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2 bg-base-200/50 text-xs font-bold uppercase tracking-wider text-base-content/60">
                  Ventes par mode de paiement
                </div>
                <div className="p-3 space-y-1">
                  {Object.entries(closingTotals.details)
                    .filter(([k, v]) => !k.startsWith('__') && k !== 'mouvements_audit' && (v as number) !== 0)
                    .map(([mode, montant]) => (
                      <div key={mode} className="flex justify-between text-xs">
                        <span className="text-base-content/60 capitalize">{modeLabels[mode] || mode}</span>
                        <span className="font-bold">{formatCurrencyLocal(Math.round(montant as number))}</span>
                      </div>
                    ))}
                  {(!closingTotals.details || Object.keys(closingTotals.details).filter(k => !k.startsWith('__')).length === 0) && (
                    <div className="text-xs text-base-content/40 italic text-center py-1">Aucune vente</div>
                  )}
                </div>
              </div>

              {/* === FOND DE CAISSE === */}
              {fondDeCaisse > 0 && (
                <div className="flex justify-between items-center p-3 bg-info/5 border border-info/20 rounded-xl">
                  <span className="text-xs font-bold text-info/70 uppercase">Fond de caisse initial</span>
                  <span className="text-sm font-black text-info">+{formatCurrencyLocal(Math.round(fondDeCaisse))}</span>
                </div>
              )}

              {/* === MOUVEMENTS DÉJÀ ENREGISTRÉS === */}
              {(closingTotals.total_entrees > 0 || closingTotals.total_sorties > 0) && (
                <div className="flex gap-2 text-xs">
                  {closingTotals.total_entrees > 0 && (
                    <div className="flex-1 p-2 bg-success/5 border border-success/20 rounded-lg text-center">
                      <div className="text-success/60 uppercase font-bold">Entrées (DB)</div>
                      <div className="font-black text-success">+{formatCurrencyLocal(Math.round(closingTotals.total_entrees))}</div>
                    </div>
                  )}
                  {closingTotals.total_sorties > 0 && (
                    <div className="flex-1 p-2 bg-error/5 border border-error/20 rounded-lg text-center">
                      <div className="text-error/60 uppercase font-bold">Sorties (DB)</div>
                      <div className="font-black text-error">-{formatCurrencyLocal(Math.round(closingTotals.total_sorties))}</div>
                    </div>
                  )}
                </div>
              )}

              {/* === AJOUTER MOUVEMENT MANUEL === */}
              <div className="bg-base-100 border border-base-200 rounded-xl p-3 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-base-content/50">Ajouter une dépense / entrée</div>
                <div className="flex gap-2">
                  <select
                    className="select select-bordered select-sm w-28 text-xs"
                    value={newType}
                    onChange={e => setNewType(e.target.value as 'ENTREE' | 'SORTIE')}
                  >
                    <option value="SORTIE">Sortie</option>
                    <option value="ENTREE">Entrée</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Motif (ex: Carburant)"
                    className="input input-bordered input-sm flex-1 text-xs"
                    value={newMotif}
                    onChange={e => setNewMotif(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddMovement()}
                  />
                  <input
                    type="number"
                    placeholder="Montant"
                    className="input input-bordered input-sm w-24 text-xs text-right"
                    value={newMontant}
                    onChange={e => setNewMontant(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddMovement()}
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={handleAddMovement}
                    disabled={!newMotif.trim() || !newMontant}
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>

              {/* === LISTE MOUVEMENTS MANUELS === */}
              {manualMovements.length > 0 && (
                <div className="bg-base-100 border border-base-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-2 bg-base-200/50 text-xs font-bold uppercase tracking-wider text-base-content/60">
                    Mouvements ajoutés ({manualMovements.length})
                  </div>
                  <div className="divide-y divide-base-200">
                    {manualMovements.map(m => (
                      <div key={m.id} className="flex justify-between items-center px-4 py-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`badge badge-xs ${m.type === 'ENTREE' ? 'badge-success' : 'badge-error'}`}>
                            {m.type === 'ENTREE' ? '+' : '-'}
                          </span>
                          <span className="text-base-content/80">{m.motif}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${m.type === 'ENTREE' ? 'text-success' : 'text-error'}`}>
                            {m.type === 'ENTREE' ? '+' : '-'}{formatCurrencyLocal(Math.round(m.montant))}
                          </span>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs btn-square text-error h-5 w-5 min-h-0"
                            onClick={() => handleRemoveMovement(m.id)}
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* === TOTAL THÉORIQUE CALCULÉ === */}
              {computed && (
                <div className="p-4 bg-success/5 border border-success/20 rounded-xl text-center">
                  <div className="text-[10px] font-black text-success/60 uppercase tracking-widest">Montant théorique</div>
                  <div className="text-2xl font-black text-success">{formatCurrencyLocal(Math.round(computed.totalTheorique))}</div>
                  <div className="text-[10px] text-success/40 mt-1 font-mono">
                    Ventes espèces + Recouv. + Entrées - Sorties + Fond
                  </div>
                </div>
              )}

              {/* === MONTANT RÉEL === */}
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
                {computed && computed.gap !== null && (
                  <div className="mt-3 flex items-center justify-between p-3 bg-base-200 rounded-lg">
                    <span className="text-xs font-bold text-base-content/60 uppercase">{t('closing.cash_gap')}</span>
                    <span className={`text-sm font-black ${computed.gap >= 0 ? 'text-success' : 'text-error'}`}>
                      {computed.gap >= 0 ? '+' : ''}{formatCurrencyLocal(Math.round(computed.gap))}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-base-200 bg-base-100 shrink-0 space-y-3">
          <button
            className="btn btn-primary btn-lg w-full rounded-xl font-black shadow-lg shadow-primary/20"
            onClick={handleCloseCaisse}
            disabled={loading || !actualAmount}
          >
            {loading ? <span className="loading loading-spinner"></span> : t('closing.confirm')}
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button className="btn btn-outline border-base-300 font-bold flex items-center justify-center gap-2" onClick={() => handleImprimerCloture()}>
              <Printer className="size-5" /> {t('closing.ticket')}
            </button>
            <button className="btn btn-ghost font-bold text-base-content/50" onClick={() => { setIsClosingModalOpen(false); setManualMovements([]); }}>
              {t('common:cancel')}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
