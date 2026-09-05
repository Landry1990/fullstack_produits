import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Loader2, Power, RefreshCw, Store } from 'lucide-react';
import { gooeyToast } from 'goey-toast';
import { cashSessionService, type PosteVente } from '../../services/cashSessionService';
import { formatDateTime } from '../../utils/dateUtils';
import { Button } from '../shadcn/button';
import { Badge } from '../shadcn/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../shadcn/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../shadcn/dialog';

interface CashForceClosePanelProps {
  t: (key: string) => string;
}

export default function CashForceClosePanel({ t }: CashForceClosePanelProps) {
  const [postes, setPostes] = useState<PosteVente[]>([]);
  const [loading, setLoading] = useState(false);
  const [closingId, setClosingId] = useState<number | null>(null);
  const [confirmPoste, setConfirmPoste] = useState<PosteVente | null>(null);

  const fetchActive = useCallback(async () => {
    setLoading(true);
    try {
      const all = await cashSessionService.getPostesVente();
      setPostes(all.filter((p) => p.est_actif));
    } catch {
      gooeyToast.error(t('cash.force_close.load_error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchActive();
  }, [fetchActive]);

  const handleClose = async () => {
    if (!confirmPoste) return;
    setClosingId(confirmPoste.id);
    try {
      await cashSessionService.forcerFermeturePosteVente(confirmPoste.id);
      gooeyToast.success(t('cash.force_close.success'));
      await fetchActive();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      gooeyToast.error(detail || t('cash.force_close.error'));
    } finally {
      setClosingId(null);
      setConfirmPoste(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Store className="size-5 text-indigo-600" />
            {t('cash.force_close.title')}
          </h2>
          <p className="text-sm text-slate-500">{t('cash.force_close.subtitle')}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchActive}
          disabled={loading}
          className="gap-2"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          {t('cash.force_close.refresh')}
        </Button>
      </div>

      {postes.length === 0 && !loading ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3 text-emerald-700">
          <Store className="size-5" />
          {t('cash.force_close.no_active')}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('cash.force_close.name')}</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('cash.force_close.seller')}</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('cash.force_close.opened_at')}</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-500 text-right">{t('cash.force_close.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {postes.map((poste) => (
              <TableRow key={poste.id} className="border-b border-slate-100">
                <TableCell className="py-3">
                  <div className="font-semibold text-slate-800">{poste.nom}</div>
                  <div className="text-xs text-slate-500">
                    {poste.caisse_nom || poste.caisse_code || t('cash.force_close.pos_mode')}
                  </div>
                </TableCell>
                <TableCell className="py-3 text-sm text-slate-600">
                  {poste.vendeur_name || '—'}
                </TableCell>
                <TableCell className="py-3 text-sm text-slate-600">
                  {poste.date_ouverture ? formatDateTime(poste.date_ouverture) : '—'}
                </TableCell>
                <TableCell className="py-3 text-right">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-2"
                    disabled={closingId === poste.id}
                    onClick={() => setConfirmPoste(poste)}
                  >
                    {closingId === poste.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Power className="size-4" />
                    )}
                    {t('cash.force_close.close')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!confirmPoste} onOpenChange={() => setConfirmPoste(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="size-5" />
              {t('cash.force_close.confirm_title')}
            </DialogTitle>
            <DialogDescription>
              {t('cash.force_close.confirm_desc', { name: confirmPoste?.nom || '' })}
            </DialogDescription>
          </DialogHeader>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            {t('cash.force_close.confirm_warning')}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmPoste(null)}>
              {t('cash.force_close.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={!!closingId}
              onClick={handleClose}
              className="gap-2"
            >
              {closingId ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Power className="size-4" />
              )}
              {t('cash.force_close.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
