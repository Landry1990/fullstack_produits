import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import {
  Trash2, Download, Eye, ShieldAlert, AlertTriangle,
  CheckSquare, Square, Calendar, Loader2,
  Wrench, ChevronDown, ChevronUp, Database, Clock, Save, Upload,
  Package, FileUp, FileDown, RefreshCw, Rocket, ScrollText
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../utils/formatters';
import { getLocale } from '../utils/dateUtils';
import { getApiErrorDetail } from '../utils/errorHandling';
import { Button } from './shadcn/button';
import { Input } from './shadcn/input';
import { Checkbox } from './shadcn/checkbox';
import { Badge } from './shadcn/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/Table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './shadcn/dialog';

interface PurgeTable {
  key: string;
  label: string;
  children: string[];
}

interface PreviewResult {
  key: string;
  label: string;
  count: number;
  children: { label: string; count: number }[];
}

interface PurgeResult {
  key: string;
  label: string;
  deleted: number;
}

interface ImportResult {
  created: number;
  updated: number;
  errors: number;
  rapport_xlsx?: string;
  rapport_txt?: string;
}

interface ProductPurgeResult {
  deleted: number;
  conserves: number;
}

interface PharmacySettings {
  backup_enabled?: boolean;
  backup_time?: string;
  secondary_backup_path?: string;
}

// Group tables by category for display
const getTableCategories = (t: (key: string) => string) => ({
  ventes: {
    label: t('categories.ventes'),
    icon: '💰',
    keys: ['factures', 'caisse', 'releves', 'coupons', 'promis'],
  },
  achats: {
    label: t('categories.achats'),
    icon: '📦',
    keys: ['commandes', 'avoirs', 'paiements_fournisseur'],
  },
  stock: {
    label: t('categories.stock'),
    icon: '📊',
    keys: ['mouvements_stock', 'ajustements_stock'],
  },
  caisse: {
    label: t('categories.caisse'),
    icon: '🏦',
    keys: ['clotures_caisse', 'mouvements_caisse'],
  },
  audit: {
    label: t('categories.audit'),
    icon: '📋',
    keys: ['ordonnancier', 'audit_logs', 'activity_logs', 'sms_logs'],
  },
  objectifs: {
    label: t('categories.objectifs'),
    icon: '🎯',
    keys: ['objectifs'],
  },
});

const downloadRapport = (filename: string) => {
  api.get(`maintenance/download_rapport/?file=${filename}`, { responseType: 'blob' })
    .then(res => {
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url;
      a.setAttribute('download', filename);
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    })
    .catch(() => toast.error('Erreur téléchargement rapport'));
};

export default function Maintenance() {
  const { t } = useTranslation(['maintenance', 'common']);
  const TABLE_CATEGORIES = getTableCategories(t);
  const [tables, setTables] = useState<PurgeTable[]>([]);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [preview, setPreview] = useState<PreviewResult[] | null>(null);
  const [purgeResults, setPurgeResults] = useState<PurgeResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [password, setPassword] = useState('');
  const [purging, setPurging] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(Object.keys(TABLE_CATEGORIES)));
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [backupStep, setBackupStep] = useState('');
  const [pharmacySettings, setPharmacySettings] = useState<PharmacySettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePassword, setRestorePassword] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restoreStep, setRestoreStep] = useState('');
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  
  // Produits States
  const [produitsCount, setProduitsCount] = useState<number | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importMessage, setImportMessage] = useState('');
  const importJobIdRef = useRef<string | null>(null);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgePassword, setPurgePassword] = useState('');
  const [activeRightTab, setActiveRightTab] = useState<'nettoyage' | 'sauvegardes'>('nettoyage');
  const [purgeSansVentes, setPurgeSansVentes] = useState(true);
  const [purging2, setPurging2] = useState(false);
  const [purgeResult, setPurgeResult] = useState<ProductPurgeResult | null>(null);

  // Code Source States
  const [codeBackupLoading, setCodeBackupLoading] = useState(false);
  const [codeRestoreFile, setCodeRestoreFile] = useState<File | null>(null);
  const [codeRestoring, setCodeRestoring] = useState(false);

  // Manual Update States
  const [changelog, setChangelog] = useState<string>('');
  const [updateRunning, setUpdateRunning] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateStep, setUpdateStep] = useState('');
  const [updateLog, setUpdateLog] = useState<string[]>([]);
  const [updatePassword, setUpdatePassword] = useState('');
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false);
  const [updateError, setUpdateError] = useState('');

  // Fetch available tables and pharmacy settings
  useEffect(() => {
    api.get('maintenance/tables/')
      .then(res => setTables(res.data))
      .catch(() => toast.error(t('common:error_loading_data')));

    api.get('pharmacy-settings/')
      .then(res => setPharmacySettings(res.data))
      .catch(() => console.error('Error loading pharmacy settings'));

    api.get('maintenance/produits_count/')
      .then(res => setProduitsCount(res.data.count))
      .catch(() => {});

    api.get('maintenance/changelog/')
      .then(res => setChangelog(res.data.latest || ''))
      .catch(() => {});

    // Check if a manual update is already running
    api.get('maintenance/update_status/')
      .then(res => {
        if (res.data.status === 'running') {
          setUpdateRunning(true);
          setUpdateProgress(res.data.progress || 0);
          setUpdateStep(res.data.step || '');
          setUpdateLog(res.data.log || []);
        }
      })
      .catch(() => {});
  }, []);

  // Poll manual update progress
  useEffect(() => {
    if (!updateRunning) return;
    const poll = setInterval(async () => {
      try {
        const res = await api.get('maintenance/update_status/');
        const d = res.data;
        setUpdateProgress(d.progress || 0);
        setUpdateStep(d.step || '');
        setUpdateLog(d.log || []);
        if (d.status !== 'running') {
          setUpdateRunning(false);
          if (d.status === 'done') {
            toast.success('Mise à jour terminée avec succès.');
          } else if (d.status === 'error') {
            toast.error(`Mise à jour échouée : ${d.step || 'Erreur inconnue'}`);
            setUpdateError(d.step || 'Erreur inconnue');
          }
        }
      } catch {
        clearInterval(poll);
        setUpdateRunning(false);
      }
    }, 2000);
    return () => clearInterval(poll);
  }, [updateRunning]);

  const handleRunUpdate = async () => {
    if (!updatePassword) { toast.error('Mot de passe requis'); return; }
    setUpdateRunning(true);
    setUpdateProgress(0);
    setUpdateStep('Démarrage...');
    setUpdateLog([]);
    setUpdateError('');
    try {
      const res = await api.post('maintenance/run_update/', { password: updatePassword });
      setUpdatePassword('');
      setShowUpdateConfirm(false);
      toast.success(res.data.message || 'Mise à jour démarrée.');
    } catch (err) {
      setUpdateRunning(false);
      toast.error(getApiErrorDetail(err, 'Erreur lors du lancement de la mise à jour'));
    }
  };

  const handleImportProduits = async () => {
    if (!importFile) { toast.error('Sélectionnez un fichier Excel'); return; }
    setImporting(true);
    setImportResult(null);
    setImportProgress(0);
    setImportMessage('Envoi du fichier...');
    const formData = new FormData();
    formData.append('file', importFile);
    try {
      const res = await api.post('maintenance/import_produits/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });
      const jobId = res.data.job_id;
      importJobIdRef.current = jobId;
      setImportMessage('Import démarré en arrière-plan...');

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
            toast.success(d.message);
            api.get('maintenance/produits_count/').then(r => setProduitsCount(r.data.count)).catch(() => {});
          } else if (d.status === 'error') {
            clearInterval(poll);
            setImporting(false);
            importJobIdRef.current = null;
            toast.error(d.message);
          }
        } catch {
          clearInterval(poll);
          setImporting(false);
          importJobIdRef.current = null;
        }
      }, 2000);

    } catch (err) {
      toast.error(getApiErrorDetail(err, 'Erreur lors du lancement de l\'import'));
      setImporting(false);
    }
  };

  const handlePurgeProduits = async () => {
    if (!purgePassword) { toast.error('Mot de passe requis'); return; }
    setPurging2(true);
    try {
      const res = await api.post('maintenance/purge_produits/', {
        password: purgePassword,
        sans_ventes: purgeSansVentes,
      });
      setPurgeResult(res.data);
      setShowPurgeModal(false);
      setPurgePassword('');
      toast.success(res.data.message);
      api.get('maintenance/produits_count/').then(r => setProduitsCount(r.data.count)).catch(() => {});
    } catch (err) {
      toast.error(getApiErrorDetail(err, 'Erreur lors de la purge'));
    } finally {
      setPurging2(false);
    }
  };

  const toggleTable = (key: string) => {
    setSelectedTables(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setPreview(null);
    setPurgeResults(null);
  };

  const toggleCategory = (catKeys: string[]) => {
    const allSelected = catKeys.every(k => selectedTables.has(k));
    setSelectedTables(prev => {
      const next = new Set(prev);
      catKeys.forEach(k => {
        if (allSelected) next.delete(k);
        else next.add(k);
      });
      return next;
    });
    setPreview(null);
    setPurgeResults(null);
  };

  const toggleExpandCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedTables(new Set(tables.map(t => t.key)));
    setPreview(null);
    setPurgeResults(null);
  };

  const deselectAll = () => {
    setSelectedTables(new Set());
    setPreview(null);
    setPurgeResults(null);
  };

  const handlePreview = async () => {
    if (selectedTables.size === 0) {
      toast.error(t('toasts.select_table'));
      return;
    }
    setLoading(true);
    setPurgeResults(null);
    try {
      const res = await api.post('maintenance/preview/', {
        tables: Array.from(selectedTables),
        date_from: dateFrom || null,
        date_to: dateTo || null,
      });
      setPreview(res.data);
    } catch {
      toast.error(t('toasts.preview_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (selectedTables.size === 0) {
      toast.error(t('toasts.select_table'));
      return;
    }
    setExporting(true);
    try {
      const res = await api.post('maintenance/export/', {
        tables: Array.from(selectedTables),
        date_from: dateFrom || null,
        date_to: dateTo || null,
      }, { responseType: 'blob' });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `purge_backup_${new Date().toISOString().slice(0, 10)}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(t('toasts.export_success'));
    } catch {
      toast.error(t('toasts.export_error'));
    } finally {
      setExporting(false);
    }
  };

  const handlePurge = async () => {
    if (!password) {
      toast.error(t('toasts.password_required'));
      return;
    }
    setPurging(true);
    try {
      const res = await api.post('maintenance/purge/', {
        tables: Array.from(selectedTables),
        date_from: dateFrom || null,
        date_to: dateTo || null,
        password,
      });
      setPurgeResults(res.data.results);
      setPreview(null);
      setShowConfirmModal(false);
      setPassword('');
      toast.success(t('toasts.purge_success'));
    } catch (err) {
      toast.error(getApiErrorDetail(err, t('toasts.purge_error')));
    } finally {
      setPurging(false);
    }
  };

  const handleManualBackup = async () => {
    setBackupLoading(true);
    setBackupProgress(0);
    setBackupStep('Initialisation...');
    
    // Simulation logic
    const progressInterval = setInterval(() => {
      setBackupProgress(prev => {
        if (prev >= 95) return prev;
        const inc = Math.random() * (prev < 50 ? 15 : prev < 80 ? 5 : 1);
        return Math.min(prev + inc, 95);
      });
    }, 400);

    const steps = [
      { p: 10, s: 'Analyse de la base de données...' },
      { p: 30, s: 'Extraction des tables...' },
      { p: 60, s: 'Génération du fichier SQL...' },
      { p: 85, s: 'Compression GZip...' },
    ];

    steps.forEach((step, idx) => {
      setTimeout(() => setBackupStep(step.s), (idx + 1) * 1500);
    });

    try {
      const res = await api.post('maintenance/backup/');
      clearInterval(progressInterval);
      setBackupProgress(100);
      toast.success(t('toasts.backup_success'));
      toast.success(res.data.message || t('toasts.backup_finished'));
      
      // Reset after success
      setTimeout(() => {
        setBackupLoading(false);
        setBackupProgress(0);
        setBackupStep('');
      }, 3000);
    } catch (err) {
      clearInterval(progressInterval);
      setBackupLoading(false);
      setBackupProgress(0);
      setBackupStep('');
      toast.error(getApiErrorDetail(err, t('toasts.backup_error')));
    }
  };

  const saveBackupSettings = async () => {
    if (!pharmacySettings) return;
    setSavingSettings(true);
    try {
      await api.put('pharmacy-settings/', {
        backup_enabled: pharmacySettings.backup_enabled,
        backup_time: pharmacySettings.backup_time,
        secondary_backup_path: pharmacySettings.secondary_backup_path,
      });
      toast.success(t('toasts.settings_saved'));
    } catch {
      toast.error(t('toasts.save_error'));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreFile || !restorePassword) {
      toast.error(t('toasts.restore_input_required'));
      return;
    }

    setRestoring(true);
    setRestoreProgress(0);
    setRestoreStep('Initialisation...');

    // Simulation de progression
    const progressInterval = setInterval(() => {
      setRestoreProgress(prev => {
        if (prev >= 98) return prev;
        const inc = Math.random() * (prev < 30 ? 20 : prev < 70 ? 5 : 1);
        return Math.min(prev + inc, 98);
      });
    }, 500);

    const steps = [
      { p: 15, s: 'Vérification du fichier...' },
      { p: 40, s: 'Décompression GZip...' },
      { p: 70, s: 'Restauration PostgreSQL (psql)...' },
      { p: 90, s: 'Synchronisation des séquences...' },
    ];

    steps.forEach((step, idx) => {
      setTimeout(() => setRestoreStep(step.s), (idx + 1) * 3000);
    });

    const formData = new FormData();
    formData.append('file', restoreFile);
    formData.append('password', restorePassword);

    try {
      await api.post('maintenance/restore/', formData);
      clearInterval(progressInterval);
      setRestoreProgress(100);
      setRestoreStep('Restauration terminée !');
      toast.success(t('toasts.restore_success'));
      setShowRestoreConfirm(false);
      setRestoreFile(null);
      setRestorePassword('');
       
       // Rechargement après succès car la DB a changé
       setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      clearInterval(progressInterval);
      setRestoring(false);
      setRestoreProgress(0);
      setRestoreStep('');
      toast.error(getApiErrorDetail(err, t('toasts.restore_error')));
    }
  };

  const handleCodeBackup = async () => {
    setCodeBackupLoading(true);
    try {
      const res = await api.get('code-backup/backup/', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `source_code_backup_${new Date().toISOString().slice(0, 10)}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(t('code_management.backup_success'));
    } catch {
      toast.error(t('common:error_occurred'));
    } finally {
      setCodeBackupLoading(false);
    }
  };

  const handleCodeRestore = async () => {
    if (!codeRestoreFile) {
      toast.error(t('common:select_file'));
      return;
    }
    setCodeRestoring(true);
    const formData = new FormData();
    formData.append('file', codeRestoreFile);
    try {
      await api.post('code-backup/restore/', formData);
      toast.success(t('code_management.restore_success'));
      setCodeRestoreFile(null);
    } catch (err) {
      toast.error(getApiErrorDetail(err, t('common:error_occurred')));
    } finally {
      setCodeRestoring(false);
    }
  };

  const totalPreviewCount = preview?.reduce((sum, p) => {
    const childTotal = p.children.reduce((cs, c) => cs + c.count, 0);
    return sum + p.count + childTotal;
  }, 0) ?? 0;

  const tableMap = new Map(tables.map(t => [t.key, t]));

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20">
          <Wrench className="size-7 text-red-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-slate-500">{t('subtitle')}</p>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="flex items-center gap-3 mb-6 shadow-lg bg-amber-50 border border-amber-200 rounded-xl p-4">
        <AlertTriangle className="size-5 text-amber-600 shrink-0" />
        <div>
          <h3 className="font-bold text-amber-800">{t('irreversible')}</h3>
          <p className="text-sm text-amber-700">{t('warning_msg')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Table Selection */}
        <div className="lg:col-span-2">
          <div className="bg-white shadow-xl rounded-2xl border border-slate-200">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <CheckSquare className="size-5 text-indigo-600" />
                  {t('tables_title')}
                </h2>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={selectAll}>{t('select_all')}</Button>
                  <Button variant="ghost" size="sm" onClick={deselectAll}>{t('deselect_all')}</Button>
                </div>
              </div>

              <div className="space-y-2">
                {Object.entries(TABLE_CATEGORIES).map(([catKey, cat]) => {
                  const availableKeys = cat.keys.filter(k => tableMap.has(k));
                  if (availableKeys.length === 0) return null;
                  const allCatSelected = availableKeys.every(k => selectedTables.has(k));
                  const someCatSelected = availableKeys.some(k => selectedTables.has(k));
                  const isExpanded = expandedCategories.has(catKey);

                  return (
                    <div key={catKey} className="border border-slate-200 rounded-lg overflow-hidden">
                      {/* Category header */}
                      <div
                        className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${someCatSelected ? 'bg-indigo-50' : 'bg-slate-100/50 hover:bg-slate-100'}`}
                        onClick={() => toggleExpandCategory(catKey)}
                      >
                        <div className="flex items-center gap-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0"
                            onClick={(e) => { e.stopPropagation(); toggleCategory(availableKeys); }}
                          >
                            {allCatSelected ? (
                              <CheckSquare className="size-4 text-indigo-600" />
                            ) : someCatSelected ? (
                              <CheckSquare className="size-4 text-indigo-600/50" />
                            ) : (
                              <Square className="size-4 text-slate-400" />
                            )}
                          </Button>
                          <span className="font-semibold text-sm">{cat.label}</span>
                          <Badge variant="secondary" className="text-xs">{availableKeys.length}</Badge>
                        </div>
                        {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                      </div>

                      {/* Category items */}
                      {isExpanded && (
                        <div className="divide-y divide-slate-200">
                          {availableKeys.map(key => {
                            const table = tableMap.get(key)!;
                            const isSelected = selectedTables.has(key);
                            return (
                              <label
                                key={key}
                                className={`flex items-center gap-3 px-6 py-2.5 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50/50' : 'hover:bg-slate-100/30'}`}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleTable(key)}
                                />
                                  <span className="text-sm flex-1">{t('tables.' + table.key, table.label)}</span>
                                {table.children.length > 0 && (
                                  <span className="text-xs text-slate-400">
                                    +{table.children.length} {t('common:sub_table', { count: table.children.length })}
                                  </span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Controls */}
        <div className="space-y-4">
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => setActiveRightTab('nettoyage')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeRightTab === 'nettoyage'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Wrench className="size-4" />
              Nettoyage
            </button>
            <button
              type="button"
              onClick={() => setActiveRightTab('sauvegardes')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeRightTab === 'sauvegardes'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Database className="size-4" />
              Sauvegardes & Code
            </button>
          </div>

          {activeRightTab === 'nettoyage' && (
            <div className="space-y-4">
          {/* Date Range */}
          <div className="bg-white shadow-xl rounded-2xl border border-slate-200">
            <div className="p-6">
              <h2 className="text-lg font-bold flex items-center gap-2 mb-2">
                <Calendar className="size-5 text-slate-600" />
                {t('period_title')}
              </h2>
              <div className="mb-2">
                <label className="block"><span className="text-xs text-slate-600">{t('date_from')}</span></label>
                <Input
                  type="date"
                  lang={getLocale()}
                  className="h-9 text-sm"
                  value={dateFrom}
                  onChange={e => { setDateFrom(e.target.value); setPreview(null); setPurgeResults(null); }}
                />
              </div>
              <div>
                <label className="block"><span className="text-xs text-slate-600">{t('date_to')}</span></label>
                <Input
                  type="date"
                  lang={getLocale()}
                  className="h-9 text-sm"
                  value={dateTo}
                  onChange={e => { setDateTo(e.target.value); setPreview(null); setPurgeResults(null); }}
                />
              </div>
              {!dateFrom && !dateTo && (
                <p className="text-xs text-amber-600 mt-2">{t('date_warning')}</p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="bg-white shadow-xl rounded-2xl border border-slate-200">
            <div className="p-6 space-y-3">
              <h2 className="text-lg font-bold">{t('actions')}</h2>

              <Button
                variant="default"
                size="sm"
                className="w-full gap-2 !whitespace-normal"
                onClick={handlePreview}
                disabled={loading || selectedTables.size === 0}
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
                {t('preview_btn')}
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 border-blue-500 text-blue-600 hover:bg-blue-50"
                onClick={handleExport}
                disabled={exporting || selectedTables.size === 0}
              >
                {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                {t('export_btn')}
              </Button>

              <div className="border-t border-slate-200 my-0"></div>

              <Button
                variant="destructive"
                size="sm"
                className="w-full gap-2 !whitespace-normal"
                onClick={() => { if (selectedTables.size > 0) setShowConfirmModal(true); else toast.error(t('common:select_tables')); }}
                disabled={selectedTables.size === 0}
              >
                <Trash2 className="size-4" />
                {t('purge_btn')}
              </Button>
            </div>
          </div>

          {/* Gestion des Produits */}
          <div className="bg-white shadow-xl rounded-2xl border border-indigo-500/20">
            <div className="p-6 space-y-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Package className="size-5 text-indigo-500" />
                Gestion des Produits
              </h2>

              {/* Compteur */}
              <div className="flex items-center justify-between bg-slate-100/50 rounded-lg px-4 py-2">
                <span className="text-sm text-slate-500">Produits en base</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-indigo-500">
                    {produitsCount === null ? '...' : produitsCount.toLocaleString()}
                  </span>
                  <Button variant="ghost" size="sm" className="h-auto p-1" onClick={() => api.get('maintenance/produits_count/').then(r => setProduitsCount(r.data.count)).catch(() => {})}>
                    <RefreshCw className="size-3" />
                  </Button>
                </div>
              </div>

              <div className="border-t border-slate-200 my-0 text-xs text-center text-slate-400 py-1">IMPORT</div>

              {/* Import Excel */}
              <div className="space-y-2">
                <p className="text-xs text-slate-500">Importez un fichier Excel (.xlsx) ou CSV pour créer/mettre à jour les produits.</p>
                <div className="w-full">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="block w-full text-sm text-slate-500 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                    onChange={e => { setImportFile(e.target.files?.[0] || null); setImportResult(null); }}
                  />
                </div>
                <Button
                  variant="default"
                  size="sm"
                  className="w-full gap-2 !whitespace-normal"
                  onClick={handleImportProduits}
                  disabled={importing || !importFile}
                >
                  {importing ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
                  {importing ? 'Import en cours...' : 'Importer'}
                </Button>

                {importing && (
                  <div className="space-y-1 animate-in fade-in duration-300">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span className="italic">{importMessage}</span>
                      <span className="font-bold text-indigo-500">{importProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-600 rounded-full transition-all" style={{ width: `${importProgress}%` }} />
                    </div>
                  </div>
                )}

                {/* Résultat import */}
                {importResult && (
                  <div className="bg-slate-100 rounded-lg p-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Créés</span>
                      <span className="font-bold text-emerald-600">{importResult.created}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Mis à jour</span>
                      <span className="font-bold text-blue-600">{importResult.updated}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Erreurs</span>
                      <span className={`font-bold ${importResult.errors > 0 ? 'text-red-600' : 'text-slate-400'}`}>{importResult.errors}</span>
                    </div>
                    {importResult.rapport_xlsx && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1 mt-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                        onClick={() => downloadRapport(importResult.rapport_xlsx as string)}
                      >
                        <FileDown className="size-3" /> Télécharger le rapport Excel
                      </Button>
                    )}
                    {importResult.rapport_txt && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1"
                        onClick={() => downloadRapport(importResult.rapport_txt as string)}
                      >
                        <FileDown className="size-3" /> Télécharger le rapport texte
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 my-0 text-xs text-center text-slate-400 py-1">PURGE</div>

              {/* Purge */}
              {purgeResult && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
                  <p className="font-bold text-emerald-600">✅ {purgeResult.deleted} produit(s) supprimé(s)</p>
                  {purgeResult.conserves > 0 && (
                    <p className="text-xs text-slate-500">{purgeResult.conserves} conservé(s) car liés à des ventes</p>
                  )}
                </div>
              )}
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Supprime tous les produits (utile si mauvais fichier importé).</p>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={purgeSansVentes}
                    onCheckedChange={(checked) => setPurgeSansVentes(!!checked)}
                  />
                  Conserver les produits liés à des ventes
                </label>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full gap-2 !whitespace-normal"
                  onClick={() => { setPurgeResult(null); setShowPurgeModal(true); }}
                >
                  <Trash2 className="size-4" />
                  Purger les produits
                </Button>
              </div>
            </div>
          </div>

          {/* Selection Summary */}
          <div className="bg-slate-100/50 rounded-2xl">
            <div className="p-3">
              <p className="text-sm">
                <span className="font-bold text-indigo-600">{selectedTables.size}</span> {t('selection_summary', { count: selectedTables.size })}
              </p>
              {dateFrom && <p className="text-xs text-slate-500">{t('from')}: {dateFrom}</p>}
              {dateTo && <p className="text-xs text-slate-500">{t('to')}: {dateTo}</p>}
            </div>
          </div>
          </div>
          )}

          {activeRightTab === 'sauvegardes' && (
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory">
          {/* Backup Section */}
          <div className="bg-white shadow-xl rounded-2xl border border-indigo-500/20 min-w-[280px] max-w-[320px] flex-shrink-0 snap-start break-words">
            <div className="p-6 space-y-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Database className="size-5 text-indigo-600" />
                {t('backup_title')}
              </h2>

              <div className="space-y-4">
                {/* Manual Backup */}
                <div>
                  <p className="text-xs text-slate-500 mb-2">{t('backup_desc')}</p>
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full gap-2 !whitespace-normal"
                    onClick={handleManualBackup}
                    disabled={backupLoading}
                  >
                    {backupLoading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                    {t('backup_now')}
                  </Button>

                  {backupLoading && (
                    <div className="mt-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-indigo-600">
                        <span>{backupStep}</span>
                        <span>{Math.round(backupProgress)}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                        <div className="h-full bg-indigo-600 rounded-full transition-all" style={{ width: `${backupProgress}%` }} />
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200 my-0"></div>

                {/* Scheduled Backup */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <Clock className="size-4" />
                    {t('automatic')}
                  </h3>
                  
                  <div>
                    <label className="flex items-center gap-3 cursor-pointer p-0">
                      <Checkbox 
                        checked={pharmacySettings?.backup_enabled || false}
                        onCheckedChange={(checked) => setPharmacySettings({...pharmacySettings, backup_enabled: !!checked})}
                      />
                      <span className="text-sm text-slate-700">{t('enable_auto')}</span>
                    </label>
                  </div>

                  <div>
                    <label className="block py-1">
                      <span className="text-xs text-slate-600">{t('scheduled_time')}</span>
                    </label>
                    <Input 
                      type="time"
                      lang={getLocale()}
                      className="h-9 text-sm w-full" 
                      value={pharmacySettings?.backup_time?.substring(0, 5) || "02:00"}
                      onChange={e => setPharmacySettings({...pharmacySettings, backup_time: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block py-1">
                      <span className="text-xs text-slate-600">{t('secondary_path')}</span>
                    </label>
                    <Input 
                      type="text" 
                      className="h-9 text-sm w-full"
                      disableUppercase
                      placeholder="/mnt/backups"
                      value={pharmacySettings?.secondary_backup_path || ""}
                      onChange={e => setPharmacySettings({...pharmacySettings, secondary_backup_path: e.target.value})}
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Chemin Linux dans le conteneur (ex: /mnt/backups). Le volume doit être monté dans docker-compose.
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 mt-2 !whitespace-normal"
                    onClick={saveBackupSettings}
                    disabled={savingSettings || !pharmacySettings}
                  >
                    {savingSettings ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                    {t('save_settings')}
                  </Button>
                </div>
              </div>
            </div>
          </div>


          {/* Restoration Section */}
          <div className="bg-white shadow-xl rounded-2xl border border-red-500/20 min-w-[280px] max-w-[320px] flex-shrink-0 snap-start break-words">
            <div className="p-6 space-y-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Upload className="size-5 text-red-600" />
                {t('restore_title')}
              </h2>

              <div className="space-y-4">
                <p className="text-xs text-slate-500">{t('restore_desc')}</p>
                
                <div className="w-full">
                  <input 
                    type="file" 
                    accept=".sql.gz"
                    className="block w-full text-sm text-slate-500 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-red-50 file:text-red-700 hover:file:bg-red-100 cursor-pointer" 
                    onChange={e => setRestoreFile(e.target.files?.[0] || null)}
                  />
                </div>

                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full gap-2 !whitespace-normal"
                  onClick={() => { if (restoreFile) setShowRestoreConfirm(true); else toast.error(t('common:select_file')); }}
                  disabled={restoring || !restoreFile}
                >
                  {restoring ? <Loader2 className="size-4 animate-spin" /> : <ShieldAlert className="size-4" />}
                  {t('restore_now')}
                </Button>
                
                {restoring && (
                  <div className="mt-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-red-600">
                      <span>{restoreStep}</span>
                      <span>{Math.round(restoreProgress)}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                      <div className="h-full bg-red-600 rounded-full transition-all" style={{ width: `${restoreProgress}%` }} />
                    </div>
                    <p className="text-[10px] text-center text-red-600/60 italic">{t('restore_restart_msg')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>


          {/* Source Code Management Section */}
          <div className="bg-white shadow-xl rounded-2xl border border-slate-400/20 min-w-[280px] max-w-[320px] flex-shrink-0 snap-start break-words">
            <div className="p-6 space-y-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ShieldAlert className="size-5 text-slate-600" />
                {t('code_management.title')}
              </h2>

              <div className="space-y-4">
                {/* Code Backup */}
                <div>
                  <p className="text-xs text-slate-500 mb-2">{t('code_management.desc')}</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full gap-2 !whitespace-normal"
                    onClick={handleCodeBackup}
                    disabled={codeBackupLoading}
                  >
                    {codeBackupLoading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                    {t('code_management.backup_now')}
                  </Button>
                </div>

                <div className="border-t border-slate-200 my-0"></div>

                {/* Code Restore */}
                <div>
                  <p className="text-xs text-slate-500 mb-2">{t('code_management.restore_desc')}</p>
                  <div className="w-full mb-2">
                    <input 
                      type="file" 
                      accept=".zip"
                      className="block w-full text-sm text-slate-500 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer" 
                      onChange={e => setCodeRestoreFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 !whitespace-normal"
                    onClick={handleCodeRestore}
                    disabled={codeRestoring || !codeRestoreFile}
                  >
                    {codeRestoring ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                    {t('code_management.restore_now')}
                  </Button>
                </div>
              </div>
            </div>
          </div>


          {/* Mise à jour manuelle */}
          <div className="bg-white shadow-xl rounded-2xl border border-emerald-500/20 min-w-[280px] max-w-[320px] flex-shrink-0 snap-start break-words">
            <div className="p-6 space-y-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Rocket className="size-5 text-emerald-600" />
                Mise à jour manuelle
              </h2>

              <div className="space-y-4">
                <p className="text-xs text-slate-500">
                  Lance la mise à jour nocturne (git pull + build Docker + migrations) à la demande.
                </p>

                <Button
                  variant="default"
                  size="sm"
                  className="w-full gap-2 !whitespace-normal"
                  onClick={() => { setUpdateError(''); setShowUpdateConfirm(true); }}
                  disabled={updateRunning}
                >
                  {updateRunning ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  {updateRunning ? 'Mise à jour en cours...' : 'Lancer la mise à jour'}
                </Button>

                {updateRunning && (
                  <div className="mt-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                      <span>{updateStep}</span>
                      <span>{Math.round(updateProgress)}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                      <div className="h-full bg-emerald-600 rounded-full transition-all" style={{ width: `${updateProgress}%` }} />
                    </div>
                    <div className="max-h-32 overflow-y-auto rounded-lg bg-slate-900 p-2 text-[10px] font-mono text-emerald-400">
                      {updateLog.length === 0 ? 'En attente de logs...' : (
                        updateLog.slice(-20).map((line) => (
                          <div key={`log-${line}`} className="truncate">{line}</div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {updateError && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
                    {updateError}
                  </div>
                )}

                <div className="border-t border-slate-200 my-0"></div>

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2 mb-2">
                    <ScrollText className="size-4" />
                    Derniers changements
                  </h3>
                  <div className="max-h-48 overflow-y-auto rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700 whitespace-pre-wrap">
                    {changelog || 'Changelog non disponible.'}
                  </div>
                </div>
              </div>
            </div>
          </div>


          </div>
          )}
        </div>
      </div>

      {/* Preview Results */}
      {preview && (
        <div className="bg-white shadow-xl rounded-2xl border border-slate-200 mt-6">
          <div className="p-6">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
              <Eye className="size-5 text-blue-600" />
              {t('preview_title', { count: totalPreviewCount })}
            </h2>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common:table')}</TableHead>
                    <TableHead className="text-right">{t('common:rows')}</TableHead>
                    <TableHead>{t('common:sub_tables')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                   {preview.map(p => (
                     <TableRow key={p.key}>
                       <TableCell className="font-medium">{t('tables.' + p.key, p.label)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={p.count > 0 ? 'destructive' : 'secondary'} className="text-xs">
                          {formatNumber(p.count)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {p.children.length > 0 ? (
                          <div className="flex gap-2 flex-wrap">
                             {p.children.map((c) => (
                               <Badge key={c.label} variant="outline" className="text-xs">
                                 {t('tables.children.' + c.label.toLowerCase().replace(/ /g, '_').normalize("NFD").replace(/[\u0300-\u036f]/g, ""), c.label)}: {formatNumber(c.count)}
                               </Badge>
                             ))}
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* Purge Results */}
      {purgeResults && (
        <div className="bg-emerald-50 border border-emerald-200 shadow-xl rounded-2xl mt-6">
          <div className="p-6">
            <h2 className="text-lg font-bold text-emerald-600 flex items-center gap-2 mb-4">
              <Trash2 className="size-5" />
              {t('purge_finished')}
            </h2>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common:table')}</TableHead>
                    <TableHead className="text-right">{t('common:rows_deleted')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                   {purgeResults.map(r => (
                     <TableRow key={r.key}>
                       <TableCell>{t('tables.' + r.key, r.label)}</TableCell>
                      <TableCell className="text-right font-bold text-emerald-600">{formatNumber(r.deleted)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <Dialog open={showConfirmModal} onOpenChange={(open) => { if (!open) { setShowConfirmModal(false); setPassword(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-100">
                <ShieldAlert className="size-6 text-red-600" />
              </div>
              {t('confirm_title')}
            </DialogTitle>
            <DialogDescription>
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
                <AlertTriangle className="size-5 text-red-600 shrink-0" />
                <span className="text-sm text-red-700">
                  {t('confirm_msg')}
                </span>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="bg-slate-100 rounded-lg p-3 mb-4 max-h-32 overflow-y-auto">
            <p className="text-xs font-semibold mb-1">{t('common:concerned_tables')} :</p>
            <ul className="text-xs space-y-0.5">
               {Array.from(selectedTables).map(key => {
                 const tbl = tableMap.get(key);
                 return <li key={key}>• {t('tables.' + key, tbl?.label || key)}</li>;
               })}
            </ul>
            {(dateFrom || dateTo) && (
              <p className="text-xs mt-2 text-slate-500">
                {t('period')} : {dateFrom || '...'} → {dateTo || '...'}
              </p>
            )}
          </div>

          <div className="mb-4">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">{t('password_label')}</span>
            </label>
            <Input
              type="password"
              placeholder={t('placeholders.enter_password')}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handlePurge(); }}
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setShowConfirmModal(false); setPassword(''); }}>
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              className="gap-2"
              onClick={handlePurge}
              disabled={purging || !password}
            >
              {purging ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              {t('confirm_purge')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Modal */}
      <Dialog open={showRestoreConfirm} onOpenChange={(open) => { if (!open) { setShowRestoreConfirm(false); setRestorePassword(''); } }}>
        <DialogContent className="border-2 border-red-500/50 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-red-600">
              <div className="p-2 rounded-full bg-red-100">
                <AlertTriangle className="size-6 text-red-600" />
              </div>
              {t('restore_title')}
            </DialogTitle>
            <DialogDescription>
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-3 mt-2 shadow-sm">
                <ShieldAlert className="size-5 text-red-600 shrink-0" />
                <span className="text-sm text-red-700">
                  {t('confirm_msg')}
                  <div className="font-mono mt-1 font-bold text-xs">{restoreFile?.name}</div>
                </span>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="mb-4">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">{t('password_label')}</span>
            </label>
            <Input
              type="password"
              className="border-red-300"
              placeholder={t('placeholders.password_required')}
              value={restorePassword}
              onChange={e => setRestorePassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRestore(); }}
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setShowRestoreConfirm(false); setRestorePassword(''); }}>
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              className="gap-2 px-8"
              onClick={handleRestore}
              disabled={restoring || !restorePassword}
            >
              {restoring ? <Loader2 className="size-4 animate-spin" /> : <Database className="size-4" />}
              {t('restore_now')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Purge Produits */}
      <Dialog open={showPurgeModal} onOpenChange={(open) => { if (!open) { setShowPurgeModal(false); setPurgePassword(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-100">
                <Trash2 className="size-6 text-red-600" />
              </div>
              Purger les produits
            </DialogTitle>
            <DialogDescription>
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
                <AlertTriangle className="size-5 text-red-600 shrink-0" />
                <div>
                  <p className="font-bold text-red-800">Opération irréversible</p>
                  <p className="text-sm text-red-700">
                    {purgeSansVentes
                      ? 'Tous les produits NON liés à des ventes seront supprimés.'
                      : 'TOUS les produits seront supprimés.'}
                  </p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="mb-4">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Confirmez votre mot de passe</span>
            </label>
            <Input
              type="password"
              placeholder="Mot de passe admin"
              value={purgePassword}
              onChange={e => setPurgePassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handlePurgeProduits(); }}
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setShowPurgeModal(false); setPurgePassword(''); }}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              className="gap-2"
              onClick={handlePurgeProduits}
              disabled={purging2 || !purgePassword}
            >
              {purging2 ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Confirmer la purge
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Mise à jour manuelle */}
      <Dialog open={showUpdateConfirm} onOpenChange={(open) => { if (!open) { setShowUpdateConfirm(false); setUpdatePassword(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-emerald-100">
                <Rocket className="size-6 text-emerald-600" />
              </div>
              Lancer la mise à jour
            </DialogTitle>
            <DialogDescription>
              <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
                <AlertTriangle className="size-5 text-amber-600 shrink-0" />
                <div>
                  <p className="font-bold text-amber-800">Opération sensible</p>
                  <p className="text-sm text-amber-700">
                    Cette action va télécharger la dernière version, reconstruire les images Docker et redémarrer les conteneurs. L'application sera brièvement indisponible.
                  </p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="mb-4">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Confirmez votre mot de passe admin</span>
            </label>
            <Input
              type="password"
              placeholder="Mot de passe admin"
              value={updatePassword}
              onChange={e => setUpdatePassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRunUpdate(); }}
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setShowUpdateConfirm(false); setUpdatePassword(''); }}>
              Annuler
            </Button>
            <Button
              variant="default"
              className="gap-2"
              onClick={handleRunUpdate}
              disabled={!updatePassword}
            >
              <Rocket className="size-4" />
              Confirmer la mise à jour
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

