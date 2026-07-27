import { useState, useEffect, useMemo, useReducer, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCurrency, normalizeNumberInput } from '../utils/formatters';
import { formatDate } from '../utils/dateUtils';
import type { Fournisseur, PaiementFournisseur } from '../types';
import { useFinanceFournisseurs } from '../hooks/useFinanceFournisseurs';
import fournisseurService from '../services/fournisseurService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/Dialog';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { Select } from './ui/Select';
import { Textarea } from './ui/Textarea';
import { Badge } from './ui/Badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/Table';
import {
  Wallet,
  FileText,
  Trash2,
  Receipt,
  Loader2,
  AlertCircle,
  CalendarClock,
} from 'lucide-react';

interface EcheanceDetaillee {
  id?: number;
  numero_facture: string;
  date_echeance: string;
  montant_total: number;
  montant_paye: number;
  montant_reste: number;
  montant_alloue?: number;
  montant_apres?: number;
}

interface FinanceFournisseurModalProps {
  isOpen: boolean;
  onClose: () => void;
  fournisseur: Fournisseur;
  onSuccess?: () => void;
  prefilledMontant?: number;
  commandeIds?: number[];
}

const modeBadgeVariant = (mode: string) => {
  switch (mode) {
    case 'ESP':
      return 'warning' as const;
    case 'CHQ':
      return 'secondary' as const;
    case 'VIR':
      return 'primary' as const;
    case 'AVOIR':
      return 'accent' as const;
    default:
      return 'ghost' as const;
  }
};

// ── Payment form reducer ──────────────────────────────────────────────────
interface PaymentFormState {
  montant: string;
  modePaiement: string;
  reference: string;
  notes: string;
}
type PaymentFormAction =
  | { type: 'SET_FIELD'; field: keyof PaymentFormState; value: string }
  | { type: 'INIT'; montant: string; notes: string }
  | { type: 'RESET' };
const initialPaymentForm: PaymentFormState = { montant: '', modePaiement: 'ESP', reference: '', notes: '' };
function paymentFormReducer(state: PaymentFormState, action: PaymentFormAction): PaymentFormState {
  switch (action.type) {
    case 'SET_FIELD': return { ...state, [action.field]: action.value };
    case 'INIT': return { montant: action.montant, modePaiement: 'ESP', reference: '', notes: action.notes };
    case 'RESET': return { ...initialPaymentForm };
    default: return state;
  }
}
// ────────────────────────────────────────────────────────────────────────────

export default function FinanceFournisseurModal({
  isOpen,
  onClose,
  fournisseur,
  onSuccess,
  prefilledMontant,
  commandeIds,
}: FinanceFournisseurModalProps) {
  const { t } = useTranslation(['providers', 'common']);
  const {
    paiements,
    loading,
    fetchPaiements,
    createPaiement,
    deletePaiement,
  } = useFinanceFournisseurs();

  const [paymentForm, dispatchPaymentForm] = useReducer(paymentFormReducer, initialPaymentForm);
  const { montant, modePaiement, reference, notes } = paymentForm;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [justPaid, setJustPaid] = useState(false);
  const [echeances, setEcheances] = useState<EcheanceDetaillee[]>([]);
  const [echeancesLoading, setEcheancesLoading] = useState(false);
  const prevIsOpenRef = useRef(false);

  useEffect(() => {
    const wasOpen = prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (isOpen && fournisseur) {
      // Refresh paiements + echeances on every dependency change
      fetchPaiements(fournisseur.id);
      setEcheancesLoading(true);
      fournisseurService.getEcheancesDetaillees(fournisseur.id)
        .then(data => setEcheances((data as EcheanceDetaillee[]) || []))
        .catch(() => setEcheances([]))
        .finally(() => setEcheancesLoading(false));

      // Only reset form + justPaid when the modal just opened (not on every re-render)
      if (!wasOpen) {
        dispatchPaymentForm({
          type: 'INIT',
          montant: prefilledMontant ? prefilledMontant.toString() : '',
          notes: commandeIds && commandeIds.length > 0
            ? t('providers:finance.pointage_note', { count: commandeIds.length })
            : '',
        });
        setJustPaid(false);
      }
    }
  }, [isOpen, fournisseur, fetchPaiements, prefilledMontant, commandeIds, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!montant || isNaN(normalizeNumberInput(montant))) return;

    setIsSubmitting(true);
    try {
      const payload: Partial<PaiementFournisseur> & { commande_ids?: number[] } = {
        fournisseur: fournisseur.id,
        montant: normalizeNumberInput(montant).toFixed(0),
        mode_paiement: modePaiement as PaiementFournisseur['mode_paiement'],
        reference: reference,
        notes: notes,
      };

      if (commandeIds && commandeIds.length > 0) {
        payload.commande_ids = commandeIds;
      }

      await createPaiement(payload);
      dispatchPaymentForm({ type: 'SET_FIELD', field: 'montant', value: '0' });
      setJustPaid(true);
      if (onSuccess) onSuccess();
    } catch {
      // Error handling is done in hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm(t('providers:finance.delete_confirm'))) {
      await deletePaiement(id);
      if (onSuccess) onSuccess();
    }
  };

  // Calcule la répartition d'un nouveau paiement sur les échéances existantes
  const computeDistribution = () => {
    const amount = normalizeNumberInput(montant);
    if (!amount || amount <= 0 || echeances.length === 0) return [];

    let remaining = amount;
    return echeances.map((ech) => {
      const reste = ech.montant_reste || 0;
      if (remaining <= 0 || reste <= 0) {
        return { ...ech, montant_alloue: 0, montant_apres: reste };
      }
      const alloue = Math.min(remaining, reste);
      remaining -= alloue;
      return { ...ech, montant_alloue: alloue, montant_apres: reste - alloue };
    });
  };

  const soldeRestant = Math.max(0, normalizeNumberInput(fournisseur.solde_dette || 0));
  const totalPaye = useMemo(
    () => paiements.reduce((acc, p) => acc + normalizeNumberInput(p.montant), 0),
    [paiements]
  );
  const totalDu = soldeRestant + totalPaye;

  const modeLabel = (mode: string) => {
    switch (mode) {
      case 'ESP':
        return t('providers:finance.modes.cash');
      case 'CHQ':
        return t('providers:finance.modes.check');
      case 'VIR':
        return t('providers:finance.modes.transfer');
      case 'AVOIR':
        return t('providers:finance.modes.credit');
      default:
        return mode;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden max-h-[90vh]">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <DialogTitle className="text-lg">{t('providers:finance.title')}</DialogTitle>
              <DialogDescription className="text-xs">{fournisseur.name}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Debt Banner */}
        <div className="px-6">
          <Card
            variant="bordered"
            padding="sm"
            className="flex items-center justify-between py-3"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-base-content/40" />
              <div>
                <span className="text-xs font-semibold text-base-content/70 block">
                  {t('providers:details.debt_balance')} (restant)
                </span>
                {totalPaye > 0 && totalDu > 0 && (
                  <span className="text-[10px] text-base-content/40">
                    {formatCurrency(totalPaye)} payé sur {formatCurrency(totalDu)} dû
                  </span>
                )}
              </div>
            </div>
            <span
              className={`text-lg font-black font-mono ${
                soldeRestant > 0 ? 'text-red-500' : 'text-emerald-500'
              }`}
            >
              {formatCurrency(soldeRestant)}
            </span>
          </Card>
        </div>

        {/* Content */}
        <div className="flex flex-col md:flex-row max-h-[65vh] min-h-0">
          {/* Left Panel: Payment Form */}
          <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-base-200 bg-base-100 p-5 overflow-y-auto shrink-0 h-full">
            <h4 className="font-bold text-sm mb-4 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              {t('providers:finance.new_payment')}
            </h4>
            <form onSubmit={handleSubmit} className="space-y-4 flex flex-col h-[calc(100%-1.75rem)]">
              <div className="space-y-2">
                <Label htmlFor="montant" className="text-xs">{t('providers:finance.amount')}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 font-bold text-sm">
                    {t('common:currency')}
                  </span>
                  <Input
                    id="montant"
                    type="number"
                    min="0"
                    step="0.01"
                    size="sm"
                    value={montant}
                    onChange={(e) => { dispatchPaymentForm({ type: 'SET_FIELD', field: 'montant', value: e.target.value }); setJustPaid(false); }}
                    placeholder="0.00"
                    className={`pl-8 font-mono font-bold text-base ${
                      prefilledMontant
                        ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800'
                        : ''
                    }`}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mode" className="text-xs">
                  {t('providers:finance.payment_mode')}
                </Label>
                <Select
                  id="mode"
                  size="sm"
                  value={modePaiement}
                  onChange={(e) => dispatchPaymentForm({ type: 'SET_FIELD', field: 'modePaiement', value: e.target.value })}
                >
                  <option value="ESP">{t('providers:finance.modes.cash')}</option>
                  <option value="CHQ">{t('providers:finance.modes.check')}</option>
                  <option value="VIR">{t('providers:finance.modes.transfer')}</option>
                  <option value="AVOIR">{t('providers:finance.modes.credit')}</option>
                  <option value="AUTRE">{t('providers:finance.modes.other')}</option>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reference" className="text-xs">
                  {t('providers:finance.reference')}
                </Label>
                <Input
                  id="reference"
                  type="text"
                  size="sm"
                  placeholder={t('providers:finance.reference_placeholder')}
                  value={reference}
                  onChange={(e) => dispatchPaymentForm({ type: 'SET_FIELD', field: 'reference', value: e.target.value })}
                />
              </div>

              <div className="space-y-2 flex-1 flex flex-col min-h-0">
                <Label htmlFor="notes" className="text-xs">
                  {t('providers:finance.notes')}
                </Label>
                <Textarea
                  id="notes"
                  placeholder={t('providers:finance.notes_placeholder')}
                  value={notes}
                  onChange={(e) => dispatchPaymentForm({ type: 'SET_FIELD', field: 'notes', value: e.target.value })}
                  className="flex-1 min-h-0 text-sm"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="sm"
                fullWidth
                isLoading={isSubmitting}
                disabled={isSubmitting || justPaid || !montant || normalizeNumberInput(montant) <= 0}
                leftIcon={<Receipt className="h-4 w-4" />}
                className="mt-auto shrink-0"
              >
                {justPaid ? t('providers:finance.payment_saved', { defaultValue: 'Règlement enregistré' }) : t('providers:finance.save_payment')}
              </Button>
            </form>
          </div>

          {/* Right Panel: Échéances + History */}
          <div className="flex-1 bg-base-200/30 flex flex-col overflow-hidden min-h-0">
            {/* Échéances */}
            <div className="shrink-0 border-b border-base-200">
              <div className="px-5 py-2.5 bg-base-100/60 backdrop-blur flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-base-content/60" />
                <h4 className="font-semibold text-sm text-base-content/90">
                  Échéancier — {echeances.length} échéance(s)
                </h4>
                {normalizeNumberInput(montant) > 0 && (
                  <Badge variant="success" size="sm" className="ml-auto">
                    Aperçu répartition
                  </Badge>
                )}
              </div>
              <div className="max-h-[170px] overflow-y-auto">
                {echeancesLoading ? (
                  <div className="flex justify-center items-center py-3">
                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  </div>
                ) : echeances.length === 0 ? (
                  <div className="text-center py-2.5 text-xs text-base-content/40">
                    Aucune échéance en attente
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs py-1.5">Facture</TableHead>
                        <TableHead className="text-xs py-1.5 text-right">Total</TableHead>
                        <TableHead className="text-xs py-1.5 text-right">Payé</TableHead>
                        <TableHead className="text-xs py-1.5 text-right">Reste</TableHead>
                        {normalizeNumberInput(montant) > 0 && (
                          <TableHead className="text-xs py-1.5 text-right text-emerald-600">Alloué</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {computeDistribution().map((ech) => (
                        <TableRow key={ech.id || ech.numero_facture} className={ech.montant_alloue ? 'bg-emerald-50/50' : ''}>
                          <TableCell className="py-1.5">
                            <div className="font-medium text-xs truncate max-w-[140px]" title={ech.numero_facture}>
                              {ech.numero_facture}
                            </div>
                            <div className="text-[10px] text-base-content/40">
                              {formatDate(ech.date_echeance)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-1.5 font-mono text-xs">
                            {formatCurrency(ech.montant_total)}
                          </TableCell>
                          <TableCell className="text-right py-1.5 font-mono text-xs text-base-content/50">
                            {formatCurrency(ech.montant_paye)}
                          </TableCell>
                          <TableCell className="text-right py-1.5 font-mono text-xs font-medium">
                            {formatCurrency(ech.montant_reste)}
                          </TableCell>
                          {normalizeNumberInput(montant) > 0 && (
                            <TableCell className="text-right py-1.5 font-mono text-xs font-bold text-emerald-600">
                              {ech.montant_alloue && ech.montant_alloue > 0 ? formatCurrency(ech.montant_alloue) : '-'}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>

            {/* History */}
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              <div className="px-5 py-2.5 border-b border-base-200 bg-base-100/60 backdrop-blur shrink-0">
                <h4 className="font-semibold text-sm text-base-content/90 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {t('providers:finance.history')}
                </h4>
              </div>
              <div className="flex-1 overflow-y-auto p-2 min-h-0">
                {loading ? (
                  <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  </div>
                ) : paiements.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-base-content/40 gap-2 py-10">
                    <div className="h-12 w-12 rounded-2xl bg-base-200 flex items-center justify-center">
                      <FileText className="h-6 w-6 text-base-content/30" />
                    </div>
                    <p className="text-sm font-medium">
                      {t('providers:finance.no_payments')}
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">{t('providers:finance.table.date')}</TableHead>
                        <TableHead className="text-xs">{t('providers:finance.table.mode')}</TableHead>
                        <TableHead className="text-xs">{t('providers:finance.table.reference')}</TableHead>
                        <TableHead className="text-xs text-right">
                          {t('providers:finance.table.amount')}
                        </TableHead>
                        <TableHead className="text-xs text-center w-16">
                          {t('providers:finance.table.action')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paiements.map((paiement) => (
                        <TableRow key={paiement.id}>
                          <TableCell className="font-mono text-xs py-2">
                            {formatDate(paiement.date_paiement)}
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge
                              variant={modeBadgeVariant(paiement.mode_paiement)}
                              size="sm"
                            >
                              {modeLabel(paiement.mode_paiement)}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="text-xs text-base-content/80">
                              {paiement.reference || '-'}
                            </div>
                            {paiement.notes && (
                              <div
                                className="text-[10px] text-base-content/40 truncate max-w-[160px]"
                                title={paiement.notes}
                              >
                                {paiement.notes}
                              </div>
                            )}
                            {paiement.commandes_liees &&
                              paiement.commandes_liees.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {paiement.commandes_liees.map((cmd) => (
                                    <Badge
                                      key={cmd}
                                      variant="ghost"
                                      size="sm"
                                      className="font-mono text-[10px]"
                                    >
                                      #{cmd}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                          </TableCell>
                          <TableCell className="text-right font-bold font-mono text-xs py-2">
                            {formatCurrency(normalizeNumberInput(paiement.montant))}
                          </TableCell>
                          <TableCell className="text-center py-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(paiement.id)}
                              className="text-error hover:bg-red-50 hover:text-red-600 h-8 w-8 p-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
