import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Package, User, Building2, FileText, Loader2 } from 'lucide-react';
import type { Avoir } from '../../../types';
import avoirService from '../../../services/avoirService';
import { formatCurrency } from '../../../utils/formatters';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../shadcn/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '../../shadcn/card';
import { Button } from '../../shadcn/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../ui/Table';

interface AvoirDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  avoirId: number | null;
}

const formatAvoirDate = (date: string | undefined, language: string) => {
  if (!date) return '-';
  return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: language === 'fr' ? fr : enUS });
};

export const AvoirDetailsModal: React.FC<AvoirDetailsModalProps> = ({
  isOpen,
  onClose,
  avoirId
}) => {
  const { t, i18n } = useTranslation(['stock', 'common']);
  const [avoir, setAvoir] = useState<Avoir | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !avoirId) {
      setAvoir(null);
      return;
    }

    const fetchAvoir = async () => {
      setLoading(true);
      try {
        const data = await avoirService.getById(avoirId);
        setAvoir(data);
      } catch {
        setAvoir(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAvoir();
  }, [isOpen, avoirId]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>
            {t('stock:avoirs.details.title', { numero: avoir?.numero || '—', defaultValue: `Avoir N° ${avoir?.numero || '—'}` })}
          </DialogTitle>
          <DialogDescription>
            {t('stock:avoirs.details.subtitle', { defaultValue: 'Détails du retour fournisseur' })}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <Loader2 className="size-6 animate-spin mr-2" />
              {t('common:loading', { defaultValue: 'Chargement...' })}
            </div>
          )}

          {!loading && !avoir && (
            <p className="text-center text-slate-500 py-8">
              {t('stock:avoirs.details.not_found', { defaultValue: 'Avoir introuvable' })}
            </p>
          )}

          {!loading && avoir && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <FileText className="size-5 text-emerald-600" />
                    <div>
                      <p className="text-xs text-slate-500">{t('stock:avoirs.details.numero_label', { defaultValue: 'N° Avoir' })}</p>
                      <p className="font-bold text-slate-900 font-mono">{avoir.numero}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="size-5 text-emerald-600" />
                    <div>
                      <p className="text-xs text-slate-500">{t('stock:avoirs.details.date_label', { defaultValue: 'Date' })}</p>
                      <p className="font-bold text-slate-900">{formatAvoirDate(avoir.date, i18n.language)}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <Building2 className="size-5 text-emerald-600" />
                    <div>
                      <p className="text-xs text-slate-500">{t('stock:avoirs.details.fournisseur_label', { defaultValue: 'Fournisseur' })}</p>
                      <p className="font-bold text-slate-900">{avoir.fournisseur_name || '—'}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <Package className="size-5 text-emerald-600" />
                    <div>
                      <p className="text-xs text-slate-500">{t('stock:avoirs.details.type_label', { defaultValue: 'Type' })}</p>
                      <p className="font-bold text-slate-900">{avoir.type_avoir_display || avoir.type_avoir || '—'}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <User className="size-5 text-emerald-600" />
                    <div>
                      <p className="text-xs text-slate-500">{t('stock:avoirs.details.status_label', { defaultValue: 'Statut' })}</p>
                      <p className="font-bold text-slate-900">{avoir.status_display || avoir.status || '—'}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <FileText className="size-5 text-emerald-600" />
                    <div>
                      <p className="text-xs text-slate-500">{t('stock:avoirs.details.total_label', { defaultValue: 'Total HT' })}</p>
                      <p className="font-bold text-slate-900">{formatCurrency(Number(avoir.total_ht || 0))}</p>
                    </div>
                  </div>
                </Card>
              </div>

              {avoir.observations && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">{t('stock:avoirs.details.observations_label', { defaultValue: 'Observations' })}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{avoir.observations}</p>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    {t('stock:avoirs.details.lines_title', { defaultValue: 'Lignes' })}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('stock:avoirs.details.product', { defaultValue: 'Produit' })}</TableHead>
                        <TableHead>{t('stock:avoirs.details.lot', { defaultValue: 'Lot' })}</TableHead>
                        <TableHead>{t('stock:avoirs.details.motif', { defaultValue: 'Motif' })}</TableHead>
                        <TableHead className="text-right">{t('stock:avoirs.details.qty', { defaultValue: 'Qté' })}</TableHead>
                        <TableHead className="text-right">{t('stock:avoirs.details.price', { defaultValue: 'Prix' })}</TableHead>
                        <TableHead className="text-right">{t('stock:avoirs.details.total', { defaultValue: 'Total' })}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {avoir.produits && avoir.produits.length > 0 ? (
                        avoir.produits.map((ligne) => (
                          <TableRow key={ligne.id}>
                            <TableCell className="font-medium text-slate-900">{ligne.produit_nom}</TableCell>
                            <TableCell className="text-slate-600 font-mono text-xs">{ligne.lot || '—'}</TableCell>
                            <TableCell className="text-slate-600 text-xs">{ligne.motif || '—'}</TableCell>
                            <TableCell className="text-right font-bold text-slate-700">{ligne.quantity}</TableCell>
                            <TableCell className="text-right font-mono text-slate-600">{formatCurrency(Number(ligne.price || 0))}</TableCell>
                            <TableCell className="text-right font-mono font-bold text-slate-700">{formatCurrency(Number(ligne.total || (ligne.quantity * Number(ligne.price))))}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-slate-400 py-6">
                            {t('stock:avoirs.details.no_lines', { defaultValue: 'Aucune ligne' })}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button type="button" onClick={onClose}>
                  {t('common:actions.close', { defaultValue: 'Fermer' })}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
