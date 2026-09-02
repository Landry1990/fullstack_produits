import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Package, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Input } from '../ui/Input';
import api from '../../services/api';
import { getApiErrorDetail } from '../../utils/errorHandling';
import type { TransformationDisponible } from '../../services/commandeService';

interface ReconditionnementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commandeId: number;
  commandeNumero: string;
  transformations: TransformationDisponible[];
  onDone: () => void;
}

interface SelectedState {
  selected: boolean;
  quantite: number;
}

interface LineResult {
  relation_id: number;
  source_name: string;
  destination_name: string;
  quantite_source: number;
  quantite_destination: number;
  ok: boolean;
  error?: string;
}

const ReconditionnementModal: React.FC<ReconditionnementModalProps> = ({
  open,
  onOpenChange,
  commandeId,
  commandeNumero,
  transformations,
  onDone,
}) => {
  const { t } = useTranslation(['orders', 'common']);
  const [states, setStates] = useState<Record<number, SelectedState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<LineResult[] | null>(null);

  // Initialiser les états quand les transformations changent
  useEffect(() => {
    if (open && transformations.length > 0) {
      const initial: Record<number, SelectedState> = {};
      for (const tr of transformations) {
        initial[tr.relation_id] = {
          selected: true,
          quantite: tr.qty_transformable,
        };
      }
      setStates(initial);
      setResults(null);
    }
  }, [open, transformations]);

  const selectedItems = useMemo(() => {
    return transformations.filter((tr) => states[tr.relation_id]?.selected);
  }, [transformations, states]);

  const totalDestObtained = useMemo(() => {
    return selectedItems.reduce((sum, tr) => {
      const qte = states[tr.relation_id]?.quantite ?? 0;
      return sum + Math.floor(qte * tr.ratio);
    }, 0);
  }, [selectedItems, states]);

  const toggleSelected = (relationId: number) => {
    setStates((prev) => ({
      ...prev,
      [relationId]: {
        ...prev[relationId],
        selected: !prev[relationId]?.selected,
      },
    }));
  };

  const updateQuantite = (relationId: number, quantite: number, max: number) => {
    const clamped = Math.max(0, Math.min(quantite, max));
    setStates((prev) => ({
      ...prev,
      [relationId]: { ...prev[relationId], quantite: clamped },
    }));
  };

  const handleConfirm = async () => {
    const payload: { relation_id: number; quantite: number; source_name: string; destination_name: string }[] = [];
    for (const tr of selectedItems) {
      const quantite = states[tr.relation_id]?.quantite ?? 0;
      if (quantite > 0) {
        payload.push({
          relation_id: tr.relation_id,
          quantite,
          source_name: tr.source_name,
          destination_name: tr.destination_name,
        });
      }
    }

    if (payload.length === 0) return;

    setSubmitting(true);
    const note = `Reconditionnement auto après clôture commande #${commandeNumero}`;

    const lineResults: LineResult[] = await Promise.all(
      payload.map(async (item) => {
        try {
          const res = await api.post(`relations-transformation/${item.relation_id}/transformer/`, {
            quantite: item.quantite,
            notes: note,
          });
          return {
            relation_id: item.relation_id,
            source_name: item.source_name,
            destination_name: item.destination_name,
            quantite_source: item.quantite,
            quantite_destination: res.data?.message ? item.quantite * 1 : item.quantite,
            ok: true,
          } as LineResult;
        } catch (err) {
          return {
            relation_id: item.relation_id,
            source_name: item.source_name,
            destination_name: item.destination_name,
            quantite_source: item.quantite,
            quantite_destination: 0,
            ok: false,
            error: getApiErrorDetail(err, t('common:error')),
          } as LineResult;
        }
      }),
    );

    setResults(lineResults);
    setSubmitting(false);

    const okCount = lineResults.filter((r) => r.ok).length;
    const errCount = lineResults.filter((r) => !r.ok).length;
    if (errCount === 0) {
      setTimeout(() => {
        onOpenChange(false);
        onDone();
      }, 1500);
    }
  };

  const successCount = results?.filter((r) => r.ok).length ?? 0;
  const errorCount = results?.filter((r) => !r.ok).length ?? 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto overflow-x-hidden w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <Package className="size-5 text-emerald-600" />
            {t('orders:reconditionnement.title', { defaultValue: 'Reconditionnement automatique' })}
          </DialogTitle>
          <DialogDescription>
            {t('orders:reconditionnement.subtitle', {
              defaultValue: `Commande #${commandeNumero} — produits reçus pouvant être reconditionnés`,
            })}
          </DialogDescription>
        </DialogHeader>

        {results ? (
          /* --- Vue résultat --- */
          <div className="space-y-3 py-2">
            <div
              className={`rounded-lg p-4 border ${
                errorCount === 0
                  ? 'bg-emerald-50 border-emerald-200'
                  : successCount > 0
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                {errorCount === 0 ? (
                  <CheckCircle2 className="size-5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="size-5 text-amber-600" />
                )}
                {successCount} {t('orders:reconditionnement.results', { defaultValue: 'transformation(s) réussie(s)' })}
                {errorCount > 0 && ` — ${errorCount} ${t('orders:reconditionnement.errors', { defaultValue: 'erreur(s)' })}`}
              </div>
            </div>

            {results.map((r, i) => (
              <div
                key={r.relation_id}
                className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 border ${
                  r.ok
                    ? 'bg-emerald-50/50 border-emerald-100'
                    : 'bg-red-50 border-red-100'
                }`}
              >
                {r.ok ? (
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="size-4 text-red-500 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700 truncate">{r.source_name}</span>
                    <ArrowRight className="size-3.5 text-slate-400 shrink-0" />
                    <span className="font-semibold text-emerald-700 truncate">{r.destination_name}</span>
                  </div>
                  {!r.ok && r.error && (
                    <div className="text-xs text-red-600 mt-0.5">{r.error}</div>
                  )}
                </div>
                {r.ok && (
                  <span className="font-mono text-xs text-slate-500 shrink-0">
                    {r.quantite_source} → +
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* --- Vue sélection --- */
          <>
            <div className="space-y-2 py-1">
              {transformations.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm italic">
                  {t('orders:reconditionnement.no_transformations', {
                    defaultValue: 'Aucun produit de cette commande n\'a de relation de reconditionnement configurée.',
                  })}
                </div>
              ) : (
                transformations.map((tr) => {
                  const state = states[tr.relation_id];
                  if (!state) return null;
                  const destQty = Math.floor(state.quantite * tr.ratio);
                  return (
                    <div
                      key={tr.relation_id}
                      className={`rounded-lg border p-3 transition-colors ${
                        state.selected
                          ? 'border-emerald-200 bg-emerald-50/40'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={state.selected}
                          onChange={() => toggleSelected(tr.relation_id)}
                          className="mt-1 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-bold text-slate-800 truncate">{tr.source_name}</span>
                            <ArrowRight className="size-3.5 text-slate-400 shrink-0" />
                            <span className="font-bold text-emerald-600 truncate">{tr.destination_name}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                            <span>
                              {t('orders:reconditionnement.received', { defaultValue: 'Reçu' })}: {tr.qty_recue}
                            </span>
                            <span>
                              {t('common:stock', { defaultValue: 'Stock' })}: {tr.source_stock}
                            </span>
                            <span>
                              {t('orders:reconditionnement.ratio', { defaultValue: 'Ratio' })}: 1:{tr.ratio}
                            </span>
                          </div>
                        </div>
                        {state.selected && (
                          <div className="flex items-center gap-2 shrink-0">
                            <Input
                              type="number"
                              min={0}
                              max={tr.qty_transformable}
                              value={state.quantite}
                              onChange={(e) =>
                                updateQuantite(
                                  tr.relation_id,
                                  parseInt(e.target.value) || 0,
                                  tr.qty_transformable,
                                )
                              }
                              className="w-20 h-8 text-center text-sm"
                            />
                            <span className="text-xs text-slate-400 whitespace-nowrap">
                              → +{destQty}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {transformations.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 flex items-center justify-between text-sm">
                <span className="text-slate-500 font-medium">
                  {t('orders:reconditionnement.selected_count', {
                    defaultValue: '{{count}} produit(s) sélectionné(s)',
                    count: selectedItems.length,
                  })}
                </span>
                <span className="font-bold text-emerald-700">
                  +{totalDestObtained} {t('orders:reconditionnement.units', { defaultValue: 'unités' })}
                </span>
              </div>
            )}
          </>
        )}

        <DialogFooter>
          {results ? (
            <Button
              variant="outline"
              onClick={() => { onOpenChange(false); onDone(); }}
              disabled={submitting}
            >
              {t('common:close', { defaultValue: 'Fermer' })}
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => { onOpenChange(false); onDone(); }}
                disabled={submitting}
              >
                {t('orders:reconditionnement.skip', { defaultValue: 'Passer' })}
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={submitting || selectedItems.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {t('common:loading', { defaultValue: 'Traitement...' })}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" />
                    {t('orders:reconditionnement.confirm', { defaultValue: 'Reconditionner' })}
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReconditionnementModal;
