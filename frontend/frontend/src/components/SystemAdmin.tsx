import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import {
  Server, Database, RefreshCw, Play, ShieldCheck, ShieldAlert,
  HardDrive, Clock, CheckCircle2, XCircle, AlertTriangle, Download,
  RotateCcw, Wifi, WifiOff, Upload, Trash2
} from 'lucide-react';

type TabId = 'sante' | 'sauvegardes';

interface DockerContainer {
  name: string;
  running: boolean;
  restart_policy: string;
  started_at: string | null;
  auto_restart: boolean;
  error?: string;
}

interface BackupInfo {
  filename: string;
  size_mb: number;
  created_at: string;
  has_checksum: boolean;
  checksum: string | null;
  age_hours: number;
}

interface LastBackup {
  filename: string;
  size_mb: number;
  age_hours: number;
  has_checksum: boolean;
  status: 'ok' | 'warning' | 'critical';
}

interface SystemStatus {
  docker: DockerContainer[];
  backup: {
    last: LastBackup | null;
    count: number;
    directory: string;
  };
}

interface BackupListData {
  backups: BackupInfo[];
  total: number;
}

export default function SystemAdmin() {
  const { t } = useTranslation('system_admin');
  const [activeTab, setActiveTab] = useState<TabId>('sante');
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [backupList, setBackupList] = useState<BackupListData | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [runningBackup, setRunningBackup] = useState(false);
  const [fixingRestart, setFixingRestart] = useState(false);
  const [backupOutput, setBackupOutput] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreOutput, setRestoreOutput] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);

  // Backup settings configuration
  const [backupSettings, setBackupSettings] = useState<{
    backup_enabled: boolean;
    backup_time: string;
    backup_interval_minutes: number;
    backup_retention_count: number;
    secondary_backup_path: string;
    cloud_backup_enabled: boolean;
    cloud_backup_endpoint: string;
    cloud_backup_bucket: string;
    cloud_backup_access_key: string;
    cloud_backup_secret_key: string;
    cloud_backup_region: string;
    cloud_backup_path_prefix: string;
  } | null>(null);
  const [loadingBackupSettings, setLoadingBackupSettings] = useState(false);
  const [savingBackupSettings, setSavingBackupSettings] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await api.get('/system-admin/status/');
      setSystemStatus(res.data);
    } catch {
      setSystemStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const fetchBackups = useCallback(async () => {
    setLoadingBackups(true);
    try {
      const res = await api.get('/system-admin/backups/');
      setBackupList(res.data);
    } catch {
      setBackupList(null);
    } finally {
      setLoadingBackups(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  useEffect(() => {
    if (activeTab === 'sauvegardes') {
      fetchBackups();
      fetchBackupSettings();
    }
  }, [activeTab, fetchBackups]);

  const fetchBackupSettings = useCallback(async () => {
    setLoadingBackupSettings(true);
    try {
      const res = await api.get('/pharmacy-settings/');
      setBackupSettings({
        backup_enabled: res.data.backup_enabled ?? true,
        backup_time: (res.data.backup_time || '02:00:00').substring(0, 5),
        backup_interval_minutes: res.data.backup_interval_minutes ?? 1440,
        backup_retention_count: res.data.backup_retention_count ?? 30,
        secondary_backup_path: res.data.secondary_backup_path || '',
        cloud_backup_enabled: res.data.cloud_backup_enabled ?? false,
        cloud_backup_endpoint: res.data.cloud_backup_endpoint || '',
        cloud_backup_bucket: res.data.cloud_backup_bucket || '',
        cloud_backup_access_key: res.data.cloud_backup_access_key || '',
        cloud_backup_secret_key: res.data.cloud_backup_secret_key || '',
        cloud_backup_region: res.data.cloud_backup_region || '',
        cloud_backup_path_prefix: res.data.cloud_backup_path_prefix || 'pharmacie-backups/',
      });
    } catch {
      setBackupSettings(null);
    } finally {
      setLoadingBackupSettings(false);
    }
  }, []);

  const saveBackupSettings = async () => {
    if (!backupSettings) return;
    setSavingBackupSettings(true);
    try {
      await api.put('/pharmacy-settings/', {
        backup_enabled: backupSettings.backup_enabled,
        backup_time: backupSettings.backup_time,
        backup_interval_minutes: backupSettings.backup_interval_minutes,
        backup_retention_count: backupSettings.backup_retention_count,
        secondary_backup_path: backupSettings.secondary_backup_path,
        cloud_backup_enabled: backupSettings.cloud_backup_enabled,
        cloud_backup_endpoint: backupSettings.cloud_backup_endpoint,
        cloud_backup_bucket: backupSettings.cloud_backup_bucket,
        cloud_backup_access_key: backupSettings.cloud_backup_access_key,
        cloud_backup_secret_key: backupSettings.cloud_backup_secret_key,
        cloud_backup_region: backupSettings.cloud_backup_region,
        cloud_backup_path_prefix: backupSettings.cloud_backup_path_prefix,
      });
      setBackupOutput(t('settings_saved'));
      fetchStatus();
    } catch (e: any) {
      setBackupError(e?.response?.data?.detail || t('settings_save_error'));
    } finally {
      setSavingBackupSettings(false);
    }
  };

  const handleRunBackup = async () => {
    setRunningBackup(true);
    setBackupOutput(null);
    setBackupError(null);
    try {
      const res = await api.post('/system-admin/run_backup/');
      setBackupOutput(res.data.output || res.data.message);
      if (!res.data.success) setBackupError(res.data.error || t('unknown_error'));
      fetchStatus();
      fetchBackups();
    } catch (e: any) {
      setBackupError(e?.response?.data?.detail || t('backup_error'));
    } finally {
      setRunningBackup(false);
    }
  };

  const handleBackupBeforeRestore = async () => {
    setRestoring(true);
    setRestoreOutput(null);
    setRestoreError(null);
    try {
      const res = await api.post('/system-admin/run_backup/');
      setRestoreOutput(t('security_backup_created') + (res.data.output || res.data.message));
      if (!res.data.success) {
        setRestoreError(res.data.error || t('security_backup_error'));
        setRestoring(false);
        return;
      }
      // Attendre un peu puis restaurer
      await new Promise(r => setTimeout(r, 1000));
      await handleRestore();
    } catch (e: any) {
      setRestoreError(e?.response?.data?.detail || t('security_backup_error'));
      setRestoring(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreTarget && !restoreFile) return;
    setRestoring(true);
    setRestoreOutput(null);
    setRestoreError(null);
    setShowRestoreConfirm(false);
    try {
      const formData = new FormData();
      if (restoreFile) {
        formData.append('file', restoreFile);
      } else if (restoreTarget) {
        formData.append('filename', restoreTarget);
      }
      const res = await api.post('/system-admin/restore/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setRestoreOutput(res.data.output || res.data.message);
      if (!res.data.success) setRestoreError(res.data.error || t('unknown_error'));
      else {
        setRestoreFile(null);
        setRestoreTarget(null);
      }
    } catch (e: any) {
      setRestoreError(e?.response?.data?.detail || t('restore_error'));
    } finally {
      setRestoring(false);
    }
  };

  const handleFixRestart = async () => {
    setFixingRestart(true);
    try {
      await api.post('/system-admin/fix_restart_policy/');
      fetchStatus();
    } catch {
    } finally {
      setFixingRestart(false);
    }
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'sante', label: t('tabs.health'), icon: <Server className="w-4 h-4" /> },
    { id: 'sauvegardes', label: t('tabs.backups'), icon: <HardDrive className="w-4 h-4" /> },
  ];

  const backupStatusColor = (status: string) => {
    if (status === 'ok') return 'text-emerald-600 bg-emerald-50';
    if (status === 'warning') return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  const backupStatusLabel = (status: string, hours: number) => {
    if (status === 'ok') return t('backup_status.recent', { hours });
    if (status === 'warning') return t('backup_status.old', { hours });
    return t('backup_status.very_old', { hours });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Server className="w-6 h-6 text-indigo-600" />
            {t('title')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('subtitle')}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white border border-gray-100 rounded-xl p-1 shadow-sm w-fit">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── ONGLET SANTÉ ── */}
        {activeTab === 'sante' && (
          <div className="space-y-4">

            {/* Refresh */}
            <div className="flex justify-end">
              <button
                onClick={fetchStatus}
                disabled={loadingStatus}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? 'animate-spin' : ''}`} />
                {t('refresh')}
              </button>
            </div>

            {loadingStatus ? (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center text-gray-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                {t('loading')}
              </div>
            ) : !systemStatus ? (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center text-red-500">
                <XCircle className="w-6 h-6 mx-auto mb-2" />
                {t('server_unreachable')}
              </div>
            ) : (
              <>
                {/* Docker Containers */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">{t('docker_containers')}</h2>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {systemStatus.docker.map(container => (
                      <div key={container.name} className="px-5 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {container.running
                            ? <Wifi className="w-4 h-4 text-emerald-500" />
                            : <WifiOff className="w-4 h-4 text-red-500" />
                          }
                          <div>
                            <p className="text-sm font-semibold text-gray-700">{container.name}</p>
                            {container.started_at && (
                              <p className="text-xs text-gray-400 mt-0.5">{t('started_at')} {container.started_at}</p>
                            )}
                            {container.error && (
                              <p className="text-xs text-red-400 mt-0.5">{container.error}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                            container.running ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                          }`}>
                            {container.running ? t('online') : t('offline')}
                          </span>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            {container.auto_restart
                              ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                              : <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                            }
                            <span className={container.auto_restart ? 'text-emerald-600' : 'text-amber-600'}>
                              {container.auto_restart ? t('auto_restart_ok') : t('no_auto_restart', { policy: container.restart_policy })}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Bouton fix restart policy si nécessaire */}
                  {systemStatus.docker.some(c => !c.auto_restart) && (
                    <div className="px-5 py-3 bg-amber-50 border-t border-amber-100 rounded-b-xl">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-amber-700">
                          <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                          {t('restart_warning')}
                        </p>
                        <button
                          onClick={handleFixRestart}
                          disabled={fixingRestart}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-all"
                        >
                          <RotateCcw className={`w-3 h-3 ${fixingRestart ? 'animate-spin' : ''}`} />
                          {t('fix')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Dernier Backup */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">{t('last_backup')}</h2>
                  </div>
                  <div className="px-5 py-4">
                    {!systemStatus.backup.last ? (
                      <div className="flex items-center gap-2 text-red-600">
                        <XCircle className="w-5 h-5" />
                        <span className="text-sm font-semibold">{t('no_backup')}</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Database className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="text-sm font-semibold text-gray-700">{systemStatus.backup.last.filename}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {systemStatus.backup.last.size_mb} MB
                              {systemStatus.backup.last.has_checksum && (
                                <span className="ml-2 text-emerald-500">• {t('checksum_md5')}</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${backupStatusColor(systemStatus.backup.last.status)}`}>
                            {backupStatusLabel(systemStatus.backup.last.status, systemStatus.backup.last.age_hours)}
                          </span>
                          <span className="text-xs text-gray-400">{t('backup_count', { count: systemStatus.backup.count })}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bouton backup rapide */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-700">{t('run_backup_now')}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{t('run_backup_desc')}</p>
                    </div>
                    <button
                      onClick={handleRunBackup}
                      disabled={runningBackup}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-60"
                    >
                      <Play className={`w-3.5 h-3.5 ${runningBackup ? 'animate-pulse' : ''}`} />
                      {runningBackup ? t('in_progress') : t('run_backup')}
                    </button>
                  </div>
                  {backupOutput && (
                    <pre className="mt-3 p-3 bg-gray-50 border border-gray-100 rounded-lg text-xs text-gray-600 overflow-auto max-h-40 whitespace-pre-wrap">
                      {backupOutput}
                    </pre>
                  )}
                  {backupError && (
                    <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" /> {backupError}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── ONGLET SAUVEGARDES ── */}
        {activeTab === 'sauvegardes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {backupList ? t('backups_available', { count: backupList.total }) : ''}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleRunBackup}
                  disabled={runningBackup}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-60"
                >
                  <Play className={`w-3.5 h-3.5 ${runningBackup ? 'animate-pulse' : ''}`} />
                  {runningBackup ? t('in_progress') : t('new_backup')}
                </button>
                <button
                  onClick={fetchBackups}
                  disabled={loadingBackups}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingBackups ? 'animate-spin' : ''}`} />
                  {t('refresh')}
                </button>
              </div>
            </div>

            {backupOutput && (
              <div className={`rounded-xl border px-4 py-3 text-sm ${backupError ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
                <div className="flex items-center gap-2 font-semibold mb-1">
                  {backupError ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  {backupError ? t('backup_error') : t('backup_success')}
                </div>
                {backupError && <p className="text-xs">{backupError}</p>}
              </div>
            )}

            {/* Configuration des sauvegardes */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                  <HardDrive className="w-4 h-4" />
                  {t('backup_settings')}
                </h3>
                {loadingBackupSettings && <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />}
              </div>

              {backupSettings ? (
                <div className="space-y-4">
                  {/* Activer backup auto */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-700">{t('auto_backup')}</p>
                      <p className="text-xs text-gray-400">{t('auto_backup_desc')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={backupSettings.backup_enabled}
                        onChange={(e) => setBackupSettings({ ...backupSettings, backup_enabled: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Heure de backup */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">{t('trigger_time')}</label>
                      <input
                        type="time"
                        value={backupSettings.backup_time}
                        onChange={(e) => setBackupSettings({ ...backupSettings, backup_time: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>

                    {/* Intervalle */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">{t('interval')}</label>
                      <select
                        value={backupSettings.backup_interval_minutes}
                        onChange={(e) => setBackupSettings({ ...backupSettings, backup_interval_minutes: Number(e.target.value) })}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                      >
                        <option value={60}>{t('interval_options.hourly')}</option>
                        <option value={360}>{t('interval_options.6h')}</option>
                        <option value={720}>{t('interval_options.12h')}</option>
                        <option value={1440}>{t('interval_options.daily')}</option>
                        <option value={10080}>{t('interval_options.weekly')}</option>
                      </select>
                    </div>

                    {/* Rétention */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">{t('retention')}</label>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={backupSettings.backup_retention_count}
                        onChange={(e) => setBackupSettings({ ...backupSettings, backup_retention_count: Math.max(1, Number(e.target.value)) })}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Chemin secondaire */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">{t('secondary_path')}</label>
                    <input
                      type="text"
                      placeholder={t('secondary_path_placeholder')}
                      value={backupSettings.secondary_backup_path}
                      onChange={(e) => setBackupSettings({ ...backupSettings, secondary_backup_path: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  {/* --- Cloud Backup S3 --- */}
                  <div className="border-t border-gray-100 pt-4 mt-2">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-700">{t('cloud_backup')}</p>
                        <p className="text-xs text-gray-400">{t('cloud_backup_desc')}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={backupSettings.cloud_backup_enabled}
                          onChange={(e) => setBackupSettings({ ...backupSettings, cloud_backup_enabled: e.target.checked })}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>

                    {backupSettings.cloud_backup_enabled && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">{t('endpoint')}</label>
                            <input
                              type="text"
                              placeholder={t('endpoint_placeholder')}
                              value={backupSettings.cloud_backup_endpoint}
                              onChange={(e) => setBackupSettings({ ...backupSettings, cloud_backup_endpoint: e.target.value })}
                              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">{t('bucket')}</label>
                            <input
                              type="text"
                              placeholder={t('bucket_placeholder')}
                              value={backupSettings.cloud_backup_bucket}
                              onChange={(e) => setBackupSettings({ ...backupSettings, cloud_backup_bucket: e.target.value })}
                              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">{t('access_key')}</label>
                            <input
                              type="text"
                              placeholder={t('access_key_placeholder')}
                              value={backupSettings.cloud_backup_access_key}
                              onChange={(e) => setBackupSettings({ ...backupSettings, cloud_backup_access_key: e.target.value })}
                              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">{t('secret_key')}</label>
                            <input
                              type="password"
                              placeholder="••••••••••••••••"
                              value={backupSettings.cloud_backup_secret_key}
                              onChange={(e) => setBackupSettings({ ...backupSettings, cloud_backup_secret_key: e.target.value })}
                              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">{t('region')}</label>
                            <input
                              type="text"
                              placeholder={t('region_placeholder')}
                              value={backupSettings.cloud_backup_region}
                              onChange={(e) => setBackupSettings({ ...backupSettings, cloud_backup_region: e.target.value })}
                              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">{t('folder_prefix')}</label>
                            <input
                              type="text"
                              placeholder={t('folder_prefix_placeholder')}
                              value={backupSettings.cloud_backup_path_prefix}
                              onChange={(e) => setBackupSettings({ ...backupSettings, cloud_backup_path_prefix: e.target.value })}
                              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                          </div>
                        </div>

                        <p className="text-xs text-gray-400">
                          {t('cloud_compatible')}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={saveBackupSettings}
                      disabled={savingBackupSettings}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-60"
                    >
                      {savingBackupSettings ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      {savingBackupSettings ? t('saving') : t('save')}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">{t('loading_settings')}</p>
              )}
            </div>

            {/* Restauration depuis upload */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Upload className="w-4 h-4 text-indigo-600" />
                    {t('restore_title')}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{t('restore_desc')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept=".sql.gz,.sql"
                  onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                  className="text-xs text-gray-600 flex-1"
                />
                <button
                  onClick={() => { if (restoreFile) { setRestoreTarget(null); setShowRestoreConfirm(true); } }}
                  disabled={restoring || !restoreFile}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all disabled:opacity-60"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${restoring ? 'animate-spin' : ''}`} />
                  {restoring ? t('restoring') : t('restore')}
                </button>
              </div>
            </div>

            {/* Restauration depuis backup existant */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">{t('restore_file_list')}</h2>
              </div>

              {loadingBackups ? (
                <div className="p-8 text-center text-gray-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                  {t('loading')}
                </div>
              ) : !backupList || backupList.backups.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <HardDrive className="w-6 h-6 mx-auto mb-2" />
                  {t('no_backup_available')}
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {backupList.backups.map((backup, i) => (
                    <div key={backup.filename} className={`px-5 py-4 flex items-center justify-between ${i === 0 ? 'bg-emerald-50/30' : ''}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <Database className={`w-4 h-4 shrink-0 ${i === 0 ? 'text-emerald-500' : 'text-gray-300'}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-700 truncate">
                            {backup.filename}
                            {i === 0 && <span className="ml-2 text-xs text-emerald-600 font-normal">• {t('most_recent')}</span>}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {backup.created_at}
                            </span>
                            <span className="text-xs text-gray-400">
                              {backup.size_mb} MB
                            </span>
                            {backup.has_checksum ? (
                              <span className="text-xs text-emerald-500 flex items-center gap-0.5">
                                <CheckCircle2 className="w-3 h-3" /> {t('md5_verified')}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400 flex items-center gap-0.5">
                                <AlertTriangle className="w-3 h-3" /> {t('no_checksum')}
                              </span>
                            )}
                          </div>
                          {backup.checksum && (
                            <p className="text-[10px] text-gray-300 font-mono mt-0.5 truncate max-w-xs">{backup.checksum}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          backup.age_hours < 2 ? 'bg-emerald-50 text-emerald-600'
                          : backup.age_hours < 24 ? 'bg-amber-50 text-amber-600'
                          : 'bg-red-50 text-red-600'
                        }`}>
                          {backup.age_hours < 1 ? '< 1h' : `${backup.age_hours}h`}
                        </span>
                        <button
                          onClick={() => { setRestoreFile(null); setRestoreTarget(backup.filename); setShowRestoreConfirm(true); }}
                          disabled={restoring}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all border border-red-200"
                          title={t('restore')}
                        >
                          <RotateCcw className="w-3 h-3" />
                          {t('restore')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Résultat de restauration */}
            {(restoreOutput || restoreError) && (
              <div className={`rounded-xl border px-4 py-3 text-sm ${restoreError ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
                <div className="flex items-center gap-2 font-semibold mb-1">
                  {restoreError ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  {restoreError ? t('restore_error') : t('restore_success')}
                </div>
                {restoreError && <p className="text-xs">{restoreError}</p>}
                {restoreOutput && (
                  <pre className="mt-2 p-2 bg-gray-100 rounded text-[11px] overflow-auto max-h-40 whitespace-pre-wrap">{restoreOutput}</pre>
                )}
              </div>
            )}

            {/* Modal de confirmation */}
            {showRestoreConfirm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-lg mx-4 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="w-6 h-6 text-red-500" />
                    <h3 className="text-lg font-bold text-gray-900">{t('confirm_restore')}</h3>
                  </div>

                  {/* Warning explicite */}
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-red-700 font-semibold mb-1">
                      {t('restore_warning')}
                    </p>
                    <p className="text-xs text-red-600">
                      {t('restore_warning_desc')}
                    </p>
                  </div>

                  <p className="text-sm text-gray-600 mb-2">
                    {t('selected_file')}
                  </p>
                  <p className="text-sm font-mono font-semibold text-red-600 bg-red-50 p-2 rounded mb-2">
                    {restoreFile ? restoreFile.name : restoreTarget}
                  </p>

                  {/* Date du backup si fichier existant */}
                  {restoreTarget && backupList?.backups && (
                    (() => {
                      const b = backupList.backups.find(bk => bk.filename === restoreTarget);
                      if (b) {
                        const date = new Date(b.created_at);
                        const now = new Date();
                        const diffMs = now.getTime() - date.getTime();
                        const diffH = Math.round(diffMs / (1000 * 60 * 60));
                        return (
                          <p className="text-xs text-amber-600 mb-4 font-medium">
                            {t('backup_date', { date: date.toLocaleDateString('fr-FR'), time: date.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}) })}
                            {diffH > 0 ? t('data_lost_hours', { hours: diffH }) : t('no_data_lost')}
                          </p>
                        );
                      }
                      return null;
                    })()
                  )}

                  {restoreFile && (
                    <p className="text-xs text-amber-600 mb-4 font-medium">
                      {t('external_file_warning')}
                    </p>
                  )}

                  {/* Option backup de sécurité */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                    <p className="text-xs text-amber-700 mb-2">
                      {t('safety_tip')}
                    </p>
                  </div>

                  <div className="flex gap-3 justify-end flex-wrap">
                    <button
                      onClick={() => setShowRestoreConfirm(false)}
                      className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      onClick={handleBackupBeforeRestore}
                      disabled={restoring}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-60"
                    >
                      <Database className="w-3.5 h-3.5" />
                      {restoring ? t('in_progress') : t('backup_then_restore')}
                    </button>
                    <button
                      onClick={handleRestore}
                      disabled={restoring}
                      className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
                    >
                      {restoring ? t('restoring') : t('restore_without_backup')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Info cron */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">{t('scheduling.title')}</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span dangerouslySetInnerHTML={{ __html: t('scheduling.hourly') }} />
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span dangerouslySetInnerHTML={{ __html: t('scheduling.daily') }} />
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span dangerouslySetInnerHTML={{ __html: t('scheduling.check') }} />
                </div>
                <p className="text-xs text-gray-400 mt-2" dangerouslySetInnerHTML={{ __html: t('scheduling.logs') }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
