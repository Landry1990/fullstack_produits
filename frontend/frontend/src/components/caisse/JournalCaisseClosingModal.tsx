import React, { useState, useMemo, useEffect } from 'react';
import { Printer, Plus, Trash2 } from 'lucide-react';
import { normalizeNumberInput } from '../../utils/formatters';
import type { useJournalCaisse } from '../../hooks/useJournalCaisse';
import { Button } from '../shadcn/button';
import { cn } from '../../lib/utils';

interface Props {
  state: ReturnType<typeof useJournalCaisse>;
}

let nextManualId = 1;

export default function JournalCaisseClosingModal({ state }: Props) {
  const {
    t, isClosingModalOpen, closingTotals, actualAmount, setActualAmount,
    handleCloseCaisse, loading, handleImprimerCloture, setIsClosingModalOpen,
    formatCurrencyLocal, manualMovements, setManualMovements, fondDeCaisse,
    setTheorique
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
    const totalTheorique = baseTheorique + manualEntrees - manualSorties;
    const gap = actualAmount ? normalizeNumberInput(actualAmount) - totalTheorique : null;
    return { manualEntrees, manualSorties, totalTheorique, gap };
  }, [closingTotals, manualMovements, actualAmount]);

  useEffect(() => {
    if (computed) setTheorique(computed.totalTheorique);
  }, [computed?.totalTheorique]);

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
    <dialog open className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm w-full h-full p-0 m-0 border-none">
      <div className="w-full max-w-lg p-0 overflow-hidden rounded-2xl border border-slate-200 shadow-2xl max-h-[90vh] flex flex-col bg-white">
        {/* Header */}
        <div className="bg-emerald-600 p-5 text-white shrink-0">
          <h3 className="font-black text-xl tracking-tight">{t('closing.title')}</h3>
          <p className="text-emerald-100 text-xs mt-1 font-bold uppercase tracking-widest">{t('closing.security')}</p>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {closingTotals && (
            <>
              {/* === VENTES PAR MODE === */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Ventes par mode de paiement
                </div>
                <div className="p-3 space-y-1">
                  {Object.entries(closingTotals.details)
                    .filter(([k, v]) => !k.startsWith('__') && k !== 'mouvements_audit' && (v as number) !== 0)
                    .map(([mode, montant]) => (
                      <div key={mode} className="flex justify-between text-xs">
                        <span className="text-slate-500 capitalize">{modeLabels[mode] || mode}</span>
                        <span className="font-bold">{formatCurrencyLocal(Math.round(montant as number))}</span>
                      </div>
                    ))}
                  {(!closingTotals.details || Object.keys(closingTotals.details).filter(k => !k.startsWith('__')).length === 0) && (
                    <div className="text-xs text-slate-400 italic text-center py-1">Aucune vente</div>
                  )}
                </div>
              </div>

              {/* === FOND DE CAISSE === */}
              {fondDeCaisse > 0 && (
                <div className="flex justify-between items-center p-3 bg-sky-50 border border-sky-200 rounded-xl">
                  <span className="text-xs font-bold text-sky-600 uppercase">Fond de caisse initial</span>
                  <span className="text-sm font-black text-sky-600">+{formatCurrencyLocal(Math.round(fondDeCaisse))}</span>
                </div>
              )}

              {/* === MOUVEMENTS DÉJÀ ENREGISTRÉS === */}
              {(closingTotals.total_entrees > 0 || closingTotals.total_sorties > 0) && (
                <div className="flex gap-2 text-xs">
                  {closingTotals.total_entrees > 0 && (
                    <div className="flex-1 p-2 bg-emerald-50/50 border border-emerald-200 rounded-lg text-center">
                      <div className="text-emerald-600/60 uppercase font-bold">Entrées (DB)</div>
                      <div className="font-black text-emerald-600">+{formatCurrencyLocal(Math.round(closingTotals.total_entrees))}</div>
                    </div>
                  )}
                  {closingTotals.total_sorties > 0 && (
                    <div className="flex-1 p-2 bg-red-50/50 border border-red-200 rounded-lg text-center">
                      <div className="text-red-600/60 uppercase font-bold">Sorties (DB)</div>
                      <div className="font-black text-red-600">-{formatCurrencyLocal(Math.round(closingTotals.total_sorties))}</div>
                    </div>
                  )}
                </div>
              )}

              {/* === AJOUTER MOUVEMENT MANUEL === */}
              <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Ajouter une dépense / entrée</div>
                <div className="flex gap-2">
                  <select
                    className="h-8 px-2 rounded-md bg-slate-100 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-emerald-300 w-28"
                    value={newType}
                    onChange={e => setNewType(e.target.value as 'ENTREE' | 'SORTIE')}
                  >
                    <option value="SORTIE">Sortie</option>
                    <option value="ENTREE">Entrée</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Motif (ex: Carburant)"
                    className="flex-1 h-8 px-3 rounded-md bg-slate-100 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-emerald-300"
                    value={newMotif}
                    onChange={e => setNewMotif(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddMovement()}
                  />
                  <input
                    type="number"
                    placeholder="Montant"
                    className="h-8 w-24 px-3 rounded-md bg-slate-100 border border-slate-200 text-xs text-slate-700 text-right focus:outline-none focus:border-emerald-300"
                    value={newMontant}
                    onChange={e => setNewMontant(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddMovement()}
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 px-2"
                    onClick={handleAddMovement}
                    disabled={!newMotif.trim() || !newMontant}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>

              {/* === LISTE MOUVEMENTS MANUELS === */}
              {manualMovements.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-2 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Mouvements ajoutés ({manualMovements.length})
                  </div>
                  <div className="divide-y divide-slate-200">
                    {manualMovements.map(m => (
                      <div key={m.id} className="flex justify-between items-center px-4 py-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold", m.type === 'ENTREE' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white')}>
                            {m.type === 'ENTREE' ? '+' : '-'}
                          </span>
                          <span className="text-slate-700">{m.motif}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn("font-bold", m.type === 'ENTREE' ? 'text-emerald-600' : 'text-red-600')}>
                            {m.type === 'ENTREE' ? '+' : '-'}{formatCurrencyLocal(Math.round(m.montant))}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 text-red-600"
                            onClick={() => handleRemoveMovement(m.id)}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* === TOTAL THÉORIQUE CALCULÉ === */}
              {computed && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <div className="text-[10px] font-black text-emerald-600/60 uppercase tracking-widest">Montant théorique</div>
                  <div className="text-2xl font-black text-emerald-600">{formatCurrencyLocal(Math.round(computed.totalTheorique))}</div>
                  <div className="text-[10px] text-emerald-400 mt-1 font-mono">
                    Ventes espèces + Recouv. + Entrées - Sorties + Fond
                  </div>
                </div>
              )}

              {/* === MONTANT RÉEL === */}
              <div className="w-full">
                <label className="block py-1">
                  <span className="text-xs font-black text-slate-500 uppercase">{t('closing.real_amount')}</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="0"
                    className="w-full h-12 px-4 rounded-lg bg-slate-100 border border-slate-200 font-black text-2xl text-center text-slate-700 focus:outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all"
                    value={actualAmount}
                    onChange={(e) => setActualAmount(e.target.value)}
                    autoFocus
                  />
                  <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-slate-300">{t('common:currency')}</span>
                </div>
                {computed && computed.gap !== null && (
                  <div className="mt-3 flex items-center justify-between p-3 bg-slate-100 rounded-lg">
                    <span className="text-xs font-bold text-slate-600 uppercase">{t('closing.cash_gap')}</span>
                    <span className={cn("text-sm font-black", computed.gap >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                      {computed.gap >= 0 ? '+' : ''}{formatCurrencyLocal(Math.round(computed.gap))}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-200 bg-white shrink-0 space-y-3">
          <Button
            size="lg"
            className="w-full rounded-xl font-black shadow-lg shadow-emerald-200 bg-emerald-600 hover:bg-emerald-700"
            onClick={handleCloseCaisse}
            disabled={loading || !actualAmount}
          >
            {loading ? <div className="animate-spin rounded-full size-5 border-b-2 border-white" /> : t('closing.confirm')}
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="border-slate-300 font-bold flex items-center justify-center gap-2" onClick={() => handleImprimerCloture()}>
              <Printer className="size-5" /> {t('closing.ticket')}
            </Button>
            <Button variant="ghost" className="font-bold text-slate-500" onClick={() => { setIsClosingModalOpen(false); setManualMovements([]); }}>
              {t('common:cancel')}
            </Button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
