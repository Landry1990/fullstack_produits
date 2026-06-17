import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCurrency, normalizeNumberInput } from '../utils/formatters';
import { formatDate } from '../utils/dateUtils';
import type { Fournisseur } from '../types';
import { useFinanceFournisseurs } from '../hooks/useFinanceFournisseurs';
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
} from 'lucide-react';

interface FinanceFournisseurModalProps {
  isOpen: boolean;
  onClose: () => void;
  fournisseur: Fournisseur;
  onSuccess?: () => void;
  prefilledMontant?: number;
  commandeIds?: number[];
}

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

  const [montant, setMontant] = useState('');
  const [modePaiement, setModePaiement] = useState('ESP');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && fournisseur) {
      fetchPaiements(fournisseur.id);
      setMontant(prefilledMontant ? prefilledMontant.toString() : '');
      setModePaiement('ESP');
      setReference('');
      setNotes(
        commandeIds && commandeIds.length > 0
          ? t('providers:finance.pointage_note', { count: commandeIds.length })
          : ''
      );
    }
  }, [isOpen, fournisseur, fetchPaiements, prefilledMontant, commandeIds, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!montant || isNaN(normalizeNumberInput(montant))) return;

    setIsSubmitting(true);
    try {
      const payload: any = {
        fournisseur: fournisseur.id,
        montant: normalizeNumberInput(montant).toFixed(0),
        mode_paiement: modePaiement as any,
        reference: reference,
        notes: notes,
      };

      if (commandeIds && commandeIds.length > 0) {
        payload.commande_ids = commandeIds;
      }

      await createPaiement(payload);
      setMontant('');
      setReference('');
      setNotes('');
      if (onSuccess) onSuccess();
    } catch (error) {
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

  const solde = normalizeNumberInput(fournisseur.solde_dette || 0);

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
        <DialogHeader className="px-6 pt-6 pb-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <DialogTitle className="text-xl">{t('providers:finance.title')}</DialogTitle>
              <DialogDescription>{fournisseur.name}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Debt Banner */}
        <div className="px-6">
          <Card
            variant="bordered"
            padding="sm"
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-base-content/40" />
              <span className="text-sm font-medium text-base-content/70">
                {t('providers:details.debt_balance')}
              </span>
            </div>
            <span
              className={`text-xl font-black font-mono ${
                solde > 0 ? 'text-red-500' : 'text-emerald-500'
              }`}
            >
              {formatCurrency(solde)}
            </span>
          </Card>
        </div>

        {/* Content */}
        <div className="flex flex-col md:flex-row" style={{ height: '55vh' }}>
          {/* Left Panel: Payment Form */}
          <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-base-200 bg-base-100 p-6 overflow-y-auto shrink-0">
            <h4 className="font-bold text-base mb-5 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              {t('providers:finance.new_payment')}
            </h4>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="montant">{t('providers:finance.amount')}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 font-bold text-sm">
                    {t('common:currency')}
                  </span>
                  <Input
                    id="montant"
                    type="number"
                    min="0"
                    step="0.01"
                    value={montant}
                    onChange={(e) => setMontant(e.target.value)}
                    placeholder="0.00"
                    className={`pl-8 font-mono font-bold text-lg ${
                      prefilledMontant
                        ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800'
                        : ''
                    }`}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mode">
                  {t('providers:finance.payment_mode')}
                </Label>
                <select
                  id="mode"
                  className="flex h-10 w-full rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-sm text-base-content shadow-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 focus-visible:outline-none"
                  value={modePaiement}
                  onChange={(e) => setModePaiement(e.target.value)}
                >
                  <option value="ESP">{t('providers:finance.modes.cash')}</option>
                  <option value="CHQ">{t('providers:finance.modes.check')}</option>
                  <option value="VIR">{t('providers:finance.modes.transfer')}</option>
                  <option value="AVOIR">{t('providers:finance.modes.credit')}</option>
                  <option value="AUTRE">{t('providers:finance.modes.other')}</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reference">
                  {t('providers:finance.reference')}
                </Label>
                <Input
                  id="reference"
                  type="text"
                  placeholder={t('providers:finance.reference_placeholder')}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">
                  {t('providers:finance.notes')}
                </Label>
                <Textarea
                  id="notes"
                  placeholder={t('providers:finance.notes_placeholder')}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-24"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                fullWidth
                isLoading={isSubmitting}
                leftIcon={<Receipt className="h-4 w-4" />}
              >
                {t('providers:finance.save_payment')}
              </Button>
            </form>
          </div>

          {/* Right Panel: History */}
          <div className="flex-1 bg-base-200/30 flex flex-col overflow-hidden min-h-0">
            <div className="px-5 py-4 border-b border-base-200 bg-base-100/60 backdrop-blur shrink-0">
              <h4 className="font-semibold text-sm text-base-content/90 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {t('providers:finance.history')}
              </h4>
            </div>
            <div className="flex-1 overflow-y-auto p-0 min-h-0">
              {loading ? (
                <div className="flex justify-center items-center h-full">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
              ) : paiements.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-base-content/40 gap-3 py-12">
                  <div className="h-14 w-14 rounded-2xl bg-base-200 flex items-center justify-center">
                    <FileText className="h-7 w-7 text-base-content/30" />
                  </div>
                  <p className="text-sm font-medium">
                    {t('providers:finance.no_payments')}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('providers:finance.table.date')}</TableHead>
                      <TableHead>{t('providers:finance.table.mode')}</TableHead>
                      <TableHead>{t('providers:finance.table.reference')}</TableHead>
                      <TableHead className="text-right">
                        {t('providers:finance.table.amount')}
                      </TableHead>
                      <TableHead className="text-center w-16">
                        {t('providers:finance.table.action')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paiements.map((paiement) => (
                      <TableRow key={paiement.id}>
                        <TableCell className="font-mono text-xs">
                          {formatDate(paiement.date_paiement)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={modeBadgeVariant(paiement.mode_paiement)}
                            size="sm"
                          >
                            {modeLabel(paiement.mode_paiement)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-base-content/80">
                            {paiement.reference || '-'}
                          </div>
                          {paiement.notes && (
                            <div
                              className="text-xs text-base-content/40 truncate max-w-[180px]"
                              title={paiement.notes}
                            >
                              {paiement.notes}
                            </div>
                          )}
                          {paiement.commandes_liees &&
                            paiement.commandes_liees.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {paiement.commandes_liees.map((cmd: any) => (
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
                        <TableCell className="text-right font-bold font-mono">
                          {formatCurrency(normalizeNumberInput(paiement.montant))}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(paiement.id)}
                            className="text-error hover:bg-red-50 hover:text-red-600"
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
      </DialogContent>
    </Dialog>
  );
}
