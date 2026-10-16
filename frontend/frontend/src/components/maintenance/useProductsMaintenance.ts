import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { gooeyToast } from 'goey-toast';
import api from '../../services/api';
import { getApiErrorDetail } from '../../utils/errorHandling';
import type { ImportResult, ProductPurgeResult } from './types';

/**
 * Gestion des produits côté maintenance : compteur, import Excel (job + polling),
 * export Excel, purge des produits.
 */
export function useProductsMaintenance() {
  const { t } = useTranslation(['maintenance', 'common']);
  const [produitsCount, setProduitsCount] = useState<number | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importMessage, setImportMessage] = useState('');
  const importJobIdRef = useRef<string | null>(null);
  const [exportingProduits, setExportingProduits] = useState(false);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgePassword, setPurgePassword] = useState('');
  const [purgeSansVentes, setPurgeSansVentes] = useState(true);
  const [purging2, setPurging2] = useState(false);
  const [purgeResult, setPurgeResult] = useState<ProductPurgeResult | null>(null);

  const refreshProduitsCount = () => {
    api.get('maintenance/produits_count/')
      .then(r => setProduitsCount(r.data.count))
      .catch(() => {});
  };

  useEffect(() => {
    refreshProduitsCount();
  }, []);

  const handleImportProduits = async () => {
    if (!importFile) { gooeyToast.error(t('toasts.select_excel_file')); return; }
    setImporting(true);
    setImportResult(null);
    setImportProgress(0);
    setImportMessage(t('toasts.import_uploading'));
    const formData = new FormData();
    formData.append('file', importFile);
    try {
      const res = await api.post('maintenance/import_produits/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });
      const jobId = res.data.job_id;
      importJobIdRef.current = jobId;
      setImportMessage(t('toasts.import_started'));

      // Polling toutes les 2 secondes
      const poll = setInterval(async () => {
        try {
          const status = await api.get(`maintenance/import_status/?job_id=${jobId}`);
          const d = status.data;
          setImportProgress(d.progress || 0);
          setImportMessage(d.message || '');

          if (d.status === 'done') {
            clearInterval(poll);
            setImporting(false);
            setImportResult(d);
            importJobIdRef.current = null;
            gooeyToast.success(d.message);
            refreshProduitsCount();
          } else if (d.status === 'error') {
            clearInterval(poll);
            setImporting(false);
            importJobIdRef.current = null;
            gooeyToast.error(d.message);
          }
        } catch {
          clearInterval(poll);
          setImporting(false);
          importJobIdRef.current = null;
        }
      }, 2000);

    } catch (err) {
      gooeyToast.error(getApiErrorDetail(err, t('toasts.import_launch_error')));
      setImporting(false);
    }
  };

  const handleExportProduits = async () => {
    setExportingProduits(true);
    try {
      const res = await api.get('maintenance/export_produits/', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      const now = new Date();
      const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      a.download = `export_produits_${ts}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      gooeyToast.success(t('maintenance:export_success'));
    } catch (err) {
      gooeyToast.error(getApiErrorDetail(err, t('maintenance:export_error')));
    } finally {
      setExportingProduits(false);
    }
  };

  const handlePurgeProduits = async () => {
    if (!purgePassword) { gooeyToast.error(t('toasts.password_required')); return; }
    setPurging2(true);
    try {
      const res = await api.post('maintenance/purge_produits/', {
        password: purgePassword,
        sans_ventes: purgeSansVentes,
      });
      setPurgeResult(res.data);
      setShowPurgeModal(false);
      setPurgePassword('');
      gooeyToast.success(res.data.message);
      refreshProduitsCount();
    } catch (err) {
      gooeyToast.error(getApiErrorDetail(err, t('toasts.purge_launch_error')));
    } finally {
      setPurging2(false);
    }
  };

  const handleImportFileChange = (file: File | null) => {
    setImportFile(file);
    setImportResult(null);
  };

  const openPurgeModal = () => {
    setPurgeResult(null);
    setShowPurgeModal(true);
  };

  const closePurgeModal = () => {
    setShowPurgeModal(false);
    setPurgePassword('');
  };

  return {
    produitsCount,
    importFile,
    importing,
    importResult,
    importProgress,
    importMessage,
    exportingProduits,
    showPurgeModal,
    purgePassword,
    purgeSansVentes,
    purging2,
    purgeResult,
    setPurgePassword,
    setPurgeSansVentes,
    refreshProduitsCount,
    handleImportProduits,
    handleExportProduits,
    handlePurgeProduits,
    handleImportFileChange,
    openPurgeModal,
    closePurgeModal,
  };
}

export type UseProductsMaintenanceReturn = ReturnType<typeof useProductsMaintenance>;
