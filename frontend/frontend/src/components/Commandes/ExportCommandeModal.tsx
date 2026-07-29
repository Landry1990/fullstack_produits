import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import {
  Download,
  FileText,
  AlertTriangle,
  CheckCircle,
  Loader2,
  FileSpreadsheet,
  AlertCircle,
} from 'lucide-react';
import api from '../../services/api';
import type { Commande } from '../../types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../shadcn/dialog';
import { Button } from '../shadcn/button';
import { Badge } from '../shadcn/badge';
import { cn } from '../../lib/utils';

interface ExportCommandeModalProps {
  isOpen: boolean;
  onClose: () => void;
  commande: Commande | null;
}

interface ExportPreview {
  commande_id: number;
  fournisseur: string;
  cip_field: string;
  cip_label: string;
  stats: {
    total_produits: number;
    avec_cip: number;
    sans_cip: number;
  };
  produits_avec_cip: Array<{
    id: number;
    cip: string;
    libelle: string;
    quantite: number;
    unites_gratuites: number;
  }>;
  produits_sans_cip: Array<{
    id: number;
    libelle: string;
    quantite: number;
    unites_gratuites: number;
  }>;
}

function downloadBlob(blob: Blob, fallbackFilename: string, contentDisposition?: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
  link.setAttribute('download', filenameMatch ? filenameMatch[1] : fallbackFilename);
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export const ExportCommandeModal: React.FC<ExportCommandeModalProps> = ({
  isOpen,
  onClose,
  commande,
}) => {
  const { t } = useTranslation('export');
  const [selectedCip, setSelectedCip] = useState<'cip1' | 'cip3'>('cip1');
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (isOpen && commande) {
      loadPreview();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, commande, selectedCip]);

  const loadPreview = async () => {
    if (!commande) return;

    try {
      setLoading(true);
      const response = await api.get(
        `commandes/${commande.id}/export-preview/?cip_field=${selectedCip}`
      );
      setPreview(response.data);
    } catch (err: unknown) {
      toast.error(err.response?.data?.error || t('errors.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    if (!commande) return;

    try {
      setExporting(true);
      const response = await api.get(
        `commandes/${commande.id}/export/?cip_field=${selectedCip}&export_format=csv`,
        { responseType: 'blob' }
      );
      downloadBlob(response.data, `commande_${commande.id}.csv`, response.headers['content-disposition']);
      toast.success(t('messages.export_success'));
    } catch {
      toast.error(t('errors.export_failed'));
    } finally {
      setExporting(false);
    }
  };

  const handleExportSansCipTxt = async () => {
    if (!commande || !preview?.produits_sans_cip.length) return;

    try {
      setExporting(true);
      const response = await api.get(
        `commandes/${commande.id}/export/?cip_field=${selectedCip}&export_format=txt`,
        { responseType: 'blob' }
      );
      downloadBlob(response.data, `commande_${commande.id}_sans_cip.txt`, response.headers['content-disposition']);
      toast.success(t('messages.txt_export_success'));
    } catch {
      toast.error(t('errors.export_failed'));
    } finally {
      setExporting(false);
    }
  };

  if (!commande) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <FileSpreadsheet className="size-5 text-emerald-600" />
            </div>
            <div>
              <DialogTitle>{t('title')}</DialogTitle>
              <DialogDescription>{commande.fournisseur_nom || t('subtitle')}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Sélection du CIP */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              {t('select_cip')}
            </div>
            <div className="flex gap-2">
              {(['cip1', 'cip3'] as const).map((cip) => (
                <button
                  key={cip}
                  type="button"
                  onClick={() => setSelectedCip(cip)}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-0.5 rounded-lg border px-3 py-2 text-sm transition-all",
                    selectedCip === cip
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                      : "bg-white border-slate-200 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
                  )}
                >
                  <span className="font-semibold">{cip.toUpperCase()}</span>
                  <span className={cn("text-[10px]", selectedCip === cip ? "text-emerald-100" : "text-slate-500")}>
                    {t(`${cip}_desc`)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-8 animate-spin text-emerald-600" />
            </div>
          ) : preview ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-sm">
                  <div className="text-xl font-bold text-slate-800">{preview.stats.total_produits}</div>
                  <div className="text-xs text-slate-500">{t('stats.total')}</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center shadow-sm">
                  <div className="text-xl font-bold text-emerald-600">{preview.stats.avec_cip}</div>
                  <div className="text-xs text-emerald-600/80">{t('stats.avec_cip')}</div>
                </div>
                <div className={cn(
                  "border rounded-xl p-3 text-center shadow-sm",
                  preview.stats.sans_cip > 0 ? "bg-amber-50 border-amber-100" : "bg-white border-slate-200"
                )}>
                  <div className={cn("text-xl font-bold", preview.stats.sans_cip > 0 ? "text-amber-600" : "text-slate-800")}>
                    {preview.stats.sans_cip}
                  </div>
                  <div className={cn("text-xs", preview.stats.sans_cip > 0 ? "text-amber-600/80" : "text-slate-500")}>
                    {t('stats.sans_cip')}
                  </div>
                </div>
              </div>

              {/* Alerte si produits sans CIP */}
              {preview.stats.sans_cip > 0 && (
                <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold text-amber-800">{t('alert.sans_cip_title')}</div>
                    <div className="text-xs text-amber-700">{t('alert.sans_cip_desc')}</div>
                  </div>
                </div>
              )}

              {/* Liste des produits avec CIP */}
              {preview.produits_avec_cip.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <div className="bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 flex items-center gap-2 border-b border-slate-200">
                    <CheckCircle className="size-4 text-emerald-600" />
                    {t('list.avec_cip')} <Badge variant="default" className="text-[10px] h-4 px-1.5">{preview.produits_avec_cip.length}</Badge>
                  </div>
                  <div className="max-h-40 overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-500 text-xs sticky top-0">
                        <tr>
                          <th className="text-left px-4 py-1.5 font-medium">{selectedCip.toUpperCase()}</th>
                          <th className="text-left px-4 py-1.5 font-medium">{t('table.libelle')}</th>
                          <th className="text-right px-4 py-1.5 font-medium">{t('table.qte')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {preview.produits_avec_cip.slice(0, 5).map((p) => (
                          <tr key={p.id}>
                            <td className="px-4 py-1.5 font-mono text-xs text-slate-600">{p.cip}</td>
                            <td className="px-4 py-1.5 truncate max-w-[200px]" title={p.libelle}>{p.libelle}</td>
                            <td className="px-4 py-1.5 text-right font-medium">{p.quantite}</td>
                          </tr>
                        ))}
                        {preview.produits_avec_cip.length > 5 && (
                          <tr>
                            <td colSpan={3} className="px-4 py-2 text-center text-xs text-slate-500">
                              +{preview.produits_avec_cip.length - 5} {t('more')}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Liste des produits sans CIP */}
              {preview.produits_sans_cip.length > 0 && (
                <div className="border border-amber-200 rounded-xl overflow-hidden bg-white">
                  <div className="bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 flex items-center gap-2 border-b border-amber-100">
                    <AlertCircle className="size-4 text-amber-600" />
                    {t('list.sans_cip')} <Badge variant="destructive" className="text-[10px] h-4 px-1.5">{preview.produits_sans_cip.length}</Badge>
                  </div>
                  <div className="max-h-40 overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-amber-50 text-amber-700 text-xs sticky top-0">
                        <tr>
                          <th className="text-left px-4 py-1.5 font-medium">{t('table.libelle')}</th>
                          <th className="text-right px-4 py-1.5 font-medium">{t('table.qte')}</th>
                          <th className="text-right px-4 py-1.5 font-medium">UG</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100">
                        {preview.produits_sans_cip.map((p) => (
                          <tr key={p.id} className="bg-amber-50/30">
                            <td className="px-4 py-1.5 truncate max-w-[200px]" title={p.libelle}>{p.libelle}</td>
                            <td className="px-4 py-1.5 text-right font-medium">{p.quantite}</td>
                            <td className="px-4 py-1.5 text-right text-slate-500">{p.unites_gratuites || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <Button variant="ghost" onClick={onClose} disabled={exporting}>
            {t('buttons.cancel')}
          </Button>
          {preview && preview.produits_sans_cip.length > 0 && (
            <Button
              variant="outline"
              onClick={handleExportSansCipTxt}
              disabled={exporting}
              className="border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
            >
              {exporting ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
              {t('buttons.export_sans_cip')}
            </Button>
          )}
          <Button
            onClick={handleExportCSV}
            disabled={exporting || preview?.produits_avec_cip.length === 0}
          >
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {t('buttons.export_csv')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExportCommandeModal;
