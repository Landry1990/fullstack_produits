import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import {
  Download,
  FileText,
  AlertTriangle,
  CheckCircle,
  X,
  Loader2,
  FileSpreadsheet,
  AlertCircle,
} from 'lucide-react';
import api from '../../services/api';
import PremiumModal from '../common/PremiumModal';
import type { Commande } from '../../types';

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

  // Charger le preview quand le modal s'ouvre ou le CIP change
  useEffect(() => {
    if (isOpen && commande) {
      loadPreview();
    }
  }, [isOpen, commande, selectedCip]);

  const loadPreview = async () => {
    if (!commande) return;
    
    try {
      setLoading(true);
      const response = await api.get(
        `commandes/${commande.id}/export-preview/?cip_field=${selectedCip}`
      );
      setPreview(response.data);
    } catch (err: any) {
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
        `commandes/${commande.id}/export/?cip_field=${selectedCip}&format=csv`,
        { responseType: 'blob' }
      );
      
      // Créer le lien de téléchargement
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // Extraire le nom du fichier du header
      const contentDisposition = response.headers['content-disposition'];
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `commande_${commande.id}.csv`;
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(t('messages.export_success'));
    } catch (err: any) {
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
        `commandes/${commande.id}/export/?cip_field=${selectedCip}&format=txt`,
        { responseType: 'blob' }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      const contentDisposition = response.headers['content-disposition'];
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `commande_${commande.id}_sans_cip.txt`;
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(t('messages.txt_export_success'));
    } catch (err: any) {
      toast.error(t('errors.export_failed'));
    } finally {
      setExporting(false);
    }
  };

  if (!commande) return null;

  return (
    <PremiumModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('title')}
      icon={<FileSpreadsheet className="size-6 text-primary" />}
      maxWidth="lg"
      footer={
        <div className="flex gap-2">
          <button onClick={onClose} className="btn btn-ghost">
            {t('buttons.cancel')}
          </button>
          {preview && preview.produits_sans_cip.length > 0 && (
            <button
              onClick={handleExportSansCipTxt}
              disabled={exporting}
              className="btn btn-warning gap-2"
            >
              {exporting ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
              {t('buttons.export_sans_cip')}
            </button>
          )}
          <button
            onClick={handleExportCSV}
            disabled={exporting || preview?.produits_avec_cip.length === 0}
            className="btn btn-primary gap-2"
          >
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {t('buttons.export_csv')}
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Sélection du CIP */}
        <div className="bg-base-200 p-4 rounded-lg">
          <label className="label font-medium">{t('select_cip')}</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="cip"
                value="cip1"
                checked={selectedCip === 'cip1'}
                onChange={() => setSelectedCip('cip1')}
                className="radio radio-primary"
              />
              <div>
                <div className="font-medium">CIP1</div>
                <div className="text-sm text-base-content/60">{t('cip1_desc')}</div>
              </div>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="cip"
                value="cip3"
                checked={selectedCip === 'cip3'}
                onChange={() => setSelectedCip('cip3')}
                className="radio radio-primary"
              />
              <div>
                <div className="font-medium">CIP3</div>
                <div className="text-sm text-base-content/60">{t('cip3_desc')}</div>
              </div>
            </label>
          </div>
        </div>

        {/* Stats */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-8 animate-spin" />
          </div>
        ) : preview ? (
          <>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-base-100 border border-base-300 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold">{preview.stats.total_produits}</div>
                <div className="text-sm text-base-content/60">{t('stats.total')}</div>
              </div>
              <div className="bg-success/10 border border-success/30 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-success">{preview.stats.avec_cip}</div>
                <div className="text-sm text-success/80">{t('stats.avec_cip')}</div>
              </div>
              <div className={`border p-4 rounded-lg text-center ${
                preview.stats.sans_cip > 0 ? 'bg-warning/10 border-warning/30' : 'bg-base-100 border-base-300'
              }`}>
                <div className={`text-2xl font-bold ${
                  preview.stats.sans_cip > 0 ? 'text-warning' : ''
                }`}>{preview.stats.sans_cip}</div>
                <div className={`text-sm ${
                  preview.stats.sans_cip > 0 ? 'text-warning/80' : 'text-base-content/60'
                }`}>{t('stats.sans_cip')}</div>
              </div>
            </div>

            {/* Alerte si produits sans CIP */}
            {preview.stats.sans_cip > 0 && (
              <div className="alert alert-warning">
                <AlertTriangle className="size-5" />
                <div>
                  <div className="font-bold">{t('alert.sans_cip_title')}</div>
                  <div className="text-sm">{t('alert.sans_cip_desc')}</div>
                </div>
              </div>
            )}

            {/* Liste des produits avec CIP */}
            {preview.produits_avec_cip.length > 0 && (
              <div className="border border-base-300 rounded-lg overflow-hidden">
                <div className="bg-base-200 px-4 py-2 font-medium flex items-center gap-2">
                  <CheckCircle className="size-4 text-success" />
                  {t('list.avec_cip')} ({preview.produits_avec_cip.length})
                </div>
                <div className="max-h-40 overflow-auto">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>{selectedCip.toUpperCase()}</th>
                        <th>{t('table.libelle')}</th>
                        <th className="text-right">{t('table.qte')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.produits_avec_cip.slice(0, 5).map((p) => (
                        <tr key={p.id}>
                          <td className="font-mono text-xs">{p.cip}</td>
                          <td className="truncate max-w-xs">{p.libelle}</td>
                          <td className="text-right">{p.quantite}</td>
                        </tr>
                      ))}
                      {preview.produits_avec_cip.length > 5 && (
                        <tr>
                          <td colSpan={3} className="text-center text-sm text-base-content/60">
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
              <div className="border border-warning/30 rounded-lg overflow-hidden">
                <div className="bg-warning/10 px-4 py-2 font-medium flex items-center gap-2 text-warning">
                  <AlertCircle className="size-4" />
                  {t('list.sans_cip')} ({preview.produits_sans_cip.length})
                </div>
                <div className="max-h-40 overflow-auto">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>{t('table.libelle')}</th>
                        <th className="text-right">{t('table.qte')}</th>
                        <th className="text-right">UG</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.produits_sans_cip.map((p) => (
                        <tr key={p.id} className="bg-warning/5">
                          <td className="truncate max-w-xs">{p.libelle}</td>
                          <td className="text-right">{p.quantite}</td>
                          <td className="text-right">{p.unites_gratuites || '-'}</td>
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
    </PremiumModal>
  );
};

export default ExportCommandeModal;
