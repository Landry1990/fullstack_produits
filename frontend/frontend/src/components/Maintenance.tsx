import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Trash2, Download, Eye, ShieldAlert, AlertTriangle,
  CheckSquare, Square, Calendar, Loader2,
  Wrench, ChevronDown, ChevronUp, Database, Clock, Save, Upload
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../utils/formatters';

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

// Group tables by category for display
const getTableCategories = (t: any) => ({
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
  const [pharmacySettings, setPharmacySettings] = useState<any>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePassword, setRestorePassword] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restoreStep, setRestoreStep] = useState('');
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  
  // Code Source States
  const [codeBackupLoading, setCodeBackupLoading] = useState(false);
  const [codeRestoreFile, setCodeRestoreFile] = useState<File | null>(null);
  const [codeRestoring, setCodeRestoring] = useState(false);

  // Fetch available tables and pharmacy settings
  useEffect(() => {
    axios.get('/api/maintenance/tables/')
      .then(res => setTables(res.data))
      .catch(() => toast.error(t('common:error_loading_data')));

    axios.get('/api/pharmacy-settings/')
      .then(res => setPharmacySettings(res.data))
      .catch(() => console.error('Error loading pharmacy settings'));
  }, []);

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
      const res = await axios.post('/api/maintenance/preview/', {
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
      const res = await axios.post('/api/maintenance/export/', {
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
      const res = await axios.post('/api/maintenance/purge/', {
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
    } catch (err: any) {
      const msg = err.response?.data?.detail || t('toasts.purge_error');
      toast.error(msg);
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
      const res = await axios.post('/api/maintenance/backup/');
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
    } catch (err: any) {
      clearInterval(progressInterval);
      setBackupLoading(false);
      setBackupProgress(0);
      setBackupStep('');
      toast.error(err.response?.data?.detail || t('toasts.backup_error'));
    }
  };

  const saveBackupSettings = async () => {
    if (!pharmacySettings) return;
    setSavingSettings(true);
    try {
      await axios.put('/api/pharmacy-settings/', {
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
      await axios.post('/api/maintenance/restore/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      clearInterval(progressInterval);
      setRestoreProgress(100);
      setRestoreStep('Restauration terminée !');
      toast.success(t('toasts.restore_success'));
      setShowRestoreConfirm(false);
      setRestoreFile(null);
      setRestorePassword('');
       
       // Rechargement après succès car la DB a changé
       setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      clearInterval(progressInterval);
      setRestoring(false);
      setRestoreProgress(0);
      setRestoreStep('');
      toast.error(err.response?.data?.detail || t('toasts.restore_error'));
    }
  };

  const handleCodeBackup = async () => {
    setCodeBackupLoading(true);
    try {
      const res = await axios.get('/api/code-backup/backup/', { responseType: 'blob' });
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
      await axios.post('/api/code-backup/restore/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(t('code_management.restore_success'));
      setCodeRestoreFile(null);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('common:error_occurred'));
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
          <Wrench className="w-7 h-7 text-red-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-base-content/60">{t('subtitle')}</p>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="alert alert-warning mb-6 shadow-lg">
        <AlertTriangle className="w-5 h-5" />
        <div>
          <h3 className="font-bold">{t('irreversible')}</h3>
          <p className="text-sm">{t('warning_msg')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Table Selection */}
        <div className="lg:col-span-2">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <div className="flex items-center justify-between mb-4">
                <h2 className="card-title text-lg">
                  <CheckSquare className="w-5 h-5 text-primary" />
                  {t('tables_title')}
                </h2>
                <div className="flex gap-2">
                  <button className="btn btn-xs btn-ghost" onClick={selectAll}>{t('select_all')}</button>
                  <button className="btn btn-xs btn-ghost" onClick={deselectAll}>{t('deselect_all')}</button>
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
                    <div key={catKey} className="border border-base-300 rounded-lg overflow-hidden">
                      {/* Category header */}
                      <div
                        className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${someCatSelected ? 'bg-primary/10' : 'bg-base-200/50 hover:bg-base-200'}`}
                        onClick={() => toggleExpandCategory(catKey)}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            className="btn btn-xs btn-ghost p-0"
                            onClick={(e) => { e.stopPropagation(); toggleCategory(availableKeys); }}
                          >
                            {allCatSelected ? (
                              <CheckSquare className="w-4 h-4 text-primary" />
                            ) : someCatSelected ? (
                              <CheckSquare className="w-4 h-4 text-primary/50" />
                            ) : (
                              <Square className="w-4 h-4 text-base-content/40" />
                            )}
                          </button>
                          <span className="font-semibold text-sm">{cat.label}</span>
                          <span className="badge badge-sm badge-ghost">{availableKeys.length}</span>
                        </div>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>

                      {/* Category items */}
                      {isExpanded && (
                        <div className="divide-y divide-base-200">
                          {availableKeys.map(key => {
                            const table = tableMap.get(key)!;
                            const isSelected = selectedTables.has(key);
                            return (
                              <label
                                key={key}
                                className={`flex items-center gap-3 px-6 py-2.5 cursor-pointer transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-base-200/30'}`}
                              >
                                <input
                                  type="checkbox"
                                  className="checkbox checkbox-sm checkbox-primary"
                                  checked={isSelected}
                                  onChange={() => toggleTable(key)}
                                />
                                  <span className="text-sm flex-1">{t('tables.' + table.key, table.label)}</span>
                                {table.children.length > 0 && (
                                  <span className="text-xs text-base-content/50">
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
          {/* Date Range */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-lg mb-2">
                <Calendar className="w-5 h-5 text-secondary" />
                {t('period_title')}
              </h2>
              <div className="form-control mb-2">
                <label className="label"><span className="label-text text-xs">{t('date_from')}</span></label>
                <input
                  type="date"
                  className="input input-bordered input-sm"
                  value={dateFrom}
                  onChange={e => { setDateFrom(e.target.value); setPreview(null); setPurgeResults(null); }}
                />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">{t('date_to')}</span></label>
                <input
                  type="date"
                  className="input input-bordered input-sm"
                  value={dateTo}
                  onChange={e => { setDateTo(e.target.value); setPreview(null); setPurgeResults(null); }}
                />
              </div>
              {!dateFrom && !dateTo && (
                <p className="text-xs text-warning mt-2">{t('date_warning')}</p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body gap-3">
              <h2 className="card-title text-lg">{t('actions')}</h2>

              <button
                className="btn btn-primary btn-sm w-full gap-2"
                onClick={handlePreview}
                disabled={loading || selectedTables.size === 0}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                {t('preview_btn')}
              </button>

              <button
                className="btn btn-info btn-sm btn-outline w-full gap-2"
                onClick={handleExport}
                disabled={exporting || selectedTables.size === 0}
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {t('export_btn')}
              </button>

              <div className="divider my-0"></div>

              <button
                className="btn btn-error btn-sm w-full gap-2"
                onClick={() => { if (selectedTables.size > 0) setShowConfirmModal(true); else toast.error(t('common:select_tables')); }}
                disabled={selectedTables.size === 0}
              >
                <Trash2 className="w-4 h-4" />
                {t('purge_btn')}
              </button>
            </div>
          </div>

          {/* Backup Section */}
          <div className="card bg-base-100 shadow-xl border border-primary/20">
            <div className="card-body gap-4">
              <h2 className="card-title text-lg flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                {t('backup_title')}
              </h2>

              <div className="space-y-4">
                {/* Manual Backup */}
                <div>
                  <p className="text-xs text-base-content/60 mb-2">{t('backup_desc')}</p>
                  <button
                    className="btn btn-primary btn-sm w-full gap-2"
                    onClick={handleManualBackup}
                    disabled={backupLoading}
                  >
                    {backupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {t('backup_now')}
                  </button>

                  {backupLoading && (
                    <div className="mt-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-primary">
                        <span>{backupStep}</span>
                        <span>{Math.round(backupProgress)}%</span>
                      </div>
                      <progress 
                        className="progress progress-primary w-full h-2 shadow-inner" 
                        value={backupProgress} 
                        max="100"
                      ></progress>
                    </div>
                  )}
                </div>

                <div className="divider my-0"></div>

                {/* Scheduled Backup */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/50 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {t('automatic')}
                  </h3>
                  
                  <div className="form-control">
                    <label className="label cursor-pointer justify-start gap-3 p-0">
                      <input 
                        type="checkbox" 
                        className="toggle toggle-primary toggle-sm" 
                        checked={pharmacySettings?.backup_enabled || false}
                        onChange={e => setPharmacySettings({...pharmacySettings, backup_enabled: e.target.checked})}
                      />
                      <span className="label-text">{t('enable_auto')}</span>
                    </label>
                  </div>

                  <div className="form-control">
                    <label className="label p-0 py-1">
                      <span className="label-text text-xs">{t('scheduled_time')}</span>
                    </label>
                    <input 
                      type="time" 
                      className="input input-bordered input-sm w-full" 
                      value={pharmacySettings?.backup_time?.substring(0, 5) || "02:00"}
                      onChange={e => setPharmacySettings({...pharmacySettings, backup_time: e.target.value})}
                    />
                  </div>

                  <div className="form-control">
                    <label className="label p-0 py-1">
                      <span className="label-text text-xs">{t('secondary_path')}</span>
                    </label>
                    <input 
                      type="text" 
                      className="input input-bordered input-sm w-full" 
                      placeholder="Ex: E:\Backups_Pharma"
                      value={pharmacySettings?.secondary_backup_path || ""}
                      onChange={e => setPharmacySettings({...pharmacySettings, secondary_backup_path: e.target.value})}
                    />
                  </div>

                  <button
                    className="btn btn-outline btn-primary btn-xs w-full gap-2 mt-2"
                    onClick={saveBackupSettings}
                    disabled={savingSettings || !pharmacySettings}
                  >
                    {savingSettings ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    {t('save_settings')}
                  </button>
                </div>
              </div>
            </div>
          </div>


          {/* Restoration Section */}
          <div className="card bg-base-100 shadow-xl border border-error/20">
            <div className="card-body gap-4">
              <h2 className="card-title text-lg flex items-center gap-2">
                <Upload className="w-5 h-5 text-error" />
                {t('restore_title')}
              </h2>

              <div className="space-y-4">
                <p className="text-xs text-base-content/60">{t('restore_desc')}</p>
                
                <div className="form-control w-full">
                  <input 
                    type="file" 
                    accept=".sql.gz"
                    className="file-input file-input-bordered file-input-sm w-full" 
                    onChange={e => setRestoreFile(e.target.files?.[0] || null)}
                  />
                </div>

                <button
                  className="btn btn-error btn-outline btn-sm w-full gap-2"
                  onClick={() => { if (restoreFile) setShowRestoreConfirm(true); else toast.error(t('common:select_file')); }}
                  disabled={restoring || !restoreFile}
                >
                  {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                  {t('restore_now')}
                </button>
                
                {restoring && (
                  <div className="mt-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-error">
                      <span>{restoreStep}</span>
                      <span>{Math.round(restoreProgress)}%</span>
                    </div>
                    <progress 
                      className="progress progress-error w-full h-2 shadow-inner" 
                      value={restoreProgress} 
                      max="100"
                    ></progress>
                    <p className="text-[10px] text-center text-error/60 italic">{t('restore_restart_msg')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>


          {/* Source Code Management Section */}
          <div className="card bg-base-100 shadow-xl border border-secondary/20">
            <div className="card-body gap-4">
              <h2 className="card-title text-lg flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-secondary" />
                {t('code_management.title')}
              </h2>

              <div className="space-y-4">
                {/* Code Backup */}
                <div>
                  <p className="text-xs text-base-content/60 mb-2">{t('code_management.desc')}</p>
                  <button
                    className="btn btn-secondary btn-sm w-full gap-2"
                    onClick={handleCodeBackup}
                    disabled={codeBackupLoading}
                  >
                    {codeBackupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {t('code_management.backup_now')}
                  </button>
                </div>

                <div className="divider my-0"></div>

                {/* Code Restore */}
                <div>
                  <p className="text-xs text-base-content/60 mb-2">{t('code_management.restore_desc')}</p>
                  <div className="form-control w-full mb-2">
                    <input 
                      type="file" 
                      accept=".zip"
                      className="file-input file-input-bordered file-input-sm w-full" 
                      onChange={e => setCodeRestoreFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  <button
                    className="btn btn-outline btn-secondary btn-sm w-full gap-2"
                    onClick={handleCodeRestore}
                    disabled={codeRestoring || !codeRestoreFile}
                  >
                    {codeRestoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {t('code_management.restore_now')}
                  </button>
                </div>
              </div>
            </div>
          </div>


          {/* Selection Summary */}
          <div className="card bg-base-200/50">
            <div className="card-body py-3">
              <p className="text-sm">
                <span className="font-bold text-primary">{selectedTables.size}</span> {t('selection_summary', { count: selectedTables.size })}
              </p>
              {dateFrom && <p className="text-xs text-base-content/60">{t('from')}: {dateFrom}</p>}
              {dateTo && <p className="text-xs text-base-content/60">{t('to')}: {dateTo}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Preview Results */}
      {preview && (
        <div className="card bg-base-100 shadow-xl mt-6">
          <div className="card-body">
            <h2 className="card-title text-lg mb-4">
              <Eye className="w-5 h-5 text-info" />
              {t('preview_title', { count: totalPreviewCount })}
            </h2>
            <div className="overflow-x-auto">
              <table className="table table-sm table-zebra">
                <thead>
                  <tr>
                    <th>{t('common:table')}</th>
                    <th className="text-right">{t('common:rows')}</th>
                    <th>{t('common:sub_tables')}</th>
                  </tr>
                </thead>
                <tbody>
                   {preview.map(p => (
                     <tr key={p.key}>
                       <td className="font-medium">{t('tables.' + p.key, p.label)}</td>
                      <td className="text-right">
                        <span className={`badge ${p.count > 0 ? 'badge-error' : 'badge-ghost'} badge-sm`}>
                          {formatNumber(p.count)}
                        </span>
                      </td>
                      <td>
                        {p.children.length > 0 ? (
                          <div className="flex gap-2 flex-wrap">
                             {p.children.map((c, i) => (
                               <span key={i} className="badge badge-sm badge-outline">
                                 {t('tables.children.' + c.label.toLowerCase().replace(/ /g, '_').normalize("NFD").replace(/[\u0300-\u036f]/g, ""), c.label)}: {formatNumber(c.count)}
                               </span>
                             ))}
                          </div>
                        ) : (
                          <span className="text-base-content/30 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Purge Results */}
      {purgeResults && (
        <div className="card bg-success/10 border border-success/30 shadow-xl mt-6">
          <div className="card-body">
            <h2 className="card-title text-lg text-success mb-4">
              <Trash2 className="w-5 h-5" />
              {t('purge_finished')}
            </h2>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>{t('common:table')}</th>
                    <th className="text-right">{t('common:rows_deleted')}</th>
                  </tr>
                </thead>
                <tbody>
                   {purgeResults.map(r => (
                     <tr key={r.key}>
                       <td>{t('tables.' + r.key, r.label)}</td>
                      <td className="text-right font-bold text-success">{formatNumber(r.deleted)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-error/20">
                <ShieldAlert className="w-6 h-6 text-error" />
              </div>
              <h3 className="font-bold text-lg">{t('confirm_title')}</h3>
            </div>

            <div className="alert alert-error mb-4">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-sm">
                {t('confirm_msg')}
              </span>
            </div>

            <div className="bg-base-200 rounded-lg p-3 mb-4 max-h-32 overflow-y-auto">
              <p className="text-xs font-semibold mb-1">{t('common:concerned_tables')} :</p>
              <ul className="text-xs space-y-0.5">
                 {Array.from(selectedTables).map(key => {
                   const tbl = tableMap.get(key);
                   return <li key={key}>• {t('tables.' + key, tbl?.label || key)}</li>;
                 })}
              </ul>
              {(dateFrom || dateTo) && (
                <p className="text-xs mt-2 text-base-content/60">
                  {t('period')} : {dateFrom || '...'} → {dateTo || '...'}
                </p>
              )}
            </div>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text text-sm font-semibold">{t('password_label')}</span>
              </label>
              <input
                type="password"
                className="input input-bordered"
                placeholder={t('placeholders.enter_password')}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handlePurge(); }}
                autoFocus
              />
            </div>

            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => { setShowConfirmModal(false); setPassword(''); }}>
                {t('cancel')}
              </button>
              <button
                className="btn btn-error gap-2"
                onClick={handlePurge}
                disabled={purging || !password}
              >
                {purging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {t('confirm_purge')}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => { setShowConfirmModal(false); setPassword(''); }}></div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {showRestoreConfirm && (
        <div className="modal modal-open">
          <div className="modal-box border-2 border-error/50 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-error/20">
                <AlertTriangle className="w-6 h-6 text-error" />
              </div>
              <h3 className="font-bold text-lg text-error">{t('restore_title')}</h3>
            </div>

            <div className="alert alert-error mb-4 shadow-sm">
              <ShieldAlert className="w-5 h-5" />
              <span className="text-sm">
                {t('confirm_msg')}
                <div className="font-mono mt-1 font-bold text-xs">{restoreFile?.name}</div>
              </span>
            </div>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text text-sm font-semibold">{t('password_label')}</span>
              </label>
              <input
                type="password"
                className="input input-bordered border-error"
                placeholder={t('placeholders.password_required')}
                value={restorePassword}
                onChange={e => setRestorePassword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleRestore(); }}
                autoFocus
              />
            </div>

            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => { setShowRestoreConfirm(false); setRestorePassword(''); }}>
                {t('cancel')}
              </button>
              <button
                className="btn btn-error gap-2 px-8"
                onClick={handleRestore}
                disabled={restoring || !restorePassword}
              >
                {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                {t('restore_now')}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => { setShowRestoreConfirm(false); setRestorePassword(''); }}></div>
        </div>
      )}
    </div>
  );
}

