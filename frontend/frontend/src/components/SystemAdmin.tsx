import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { gooeyToast } from 'goey-toast';
import { Server, HardDrive, DownloadCloud, Store } from 'lucide-react';
import CashForceClosePanel from './caisse/CashForceClosePanel';
import type {
  TabId, SystemStatus, BackupListData, WalStatus, BackupSettings, UpdateStatus,
} from './systemadmin/types';
import { RestoreOverlay } from './systemadmin/RestoreOverlay';
import { SystemHealthTab } from './systemadmin/SystemHealthTab';
import { BackupsTab } from './systemadmin/BackupsTab';
import { UpdateTab } from './systemadmin/UpdateTab';

export default function SystemAdmin() {
  const { t, i18n } = useTranslation('system_admin');
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
  const [restoreProgress, setRestoreProgress] = useState<string[]>([]);

  // WAL / PITR state
  const [walStatus, setWalStatus] = useState<WalStatus | null>(null);
  const [loadingWal, setLoadingWal] = useState(false);
  const [runningBaseBackup, setRunningBaseBackup] = useState(false);
  const [pitrTargetTime, setPitrTargetTime] = useState('');
  const [pitrOutput, setPitrOutput] = useState<string | null>(null);
  const [pitrError, setPitrError] = useState<string | null>(null);
  const [runningPitr, setRunningPitr] = useState(false);

  // Backup settings configuration
  const [backupSettings, setBackupSettings] = useState<BackupSettings | null>(null);
  const [loadingBackupSettings, setLoadingBackupSettings] = useState(false);
  const [savingBackupSettings, setSavingBackupSettings] = useState(false);

  // Mise à jour système
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [runningUpdate, setRunningUpdate] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateStep, setUpdateStep] = useState('');
  const [updateDone, setUpdateDone] = useState(false);

  // Planification mise à jour
  const [updateTime, setUpdateTime] = useState('02:00');
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

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
        external_backup_path_1: res.data.external_backup_path_1 || '',
        external_backup_path_2: res.data.external_backup_path_2 || '',
        external_backup_path_3: res.data.external_backup_path_3 || '',
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

  const fetchWalStatus = useCallback(async () => {
    setLoadingWal(true);
    try {
      const res = await api.get('/system-admin/wal_status/');
      setWalStatus(res.data);
    } catch {
      setWalStatus(null);
    } finally {
      setLoadingWal(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  useEffect(() => {
    if (activeTab === 'sauvegardes') {
      fetchBackups();
      fetchBackupSettings();
      fetchWalStatus();
    }
  }, [activeTab, fetchBackups, fetchBackupSettings, fetchWalStatus]);

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
        external_backup_path_1: backupSettings.external_backup_path_1,
        external_backup_path_2: backupSettings.external_backup_path_2,
        external_backup_path_3: backupSettings.external_backup_path_3,
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
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setBackupError(err?.response?.data?.detail || t('settings_save_error'));
    } finally {
      setSavingBackupSettings(false);
    }
  };

  const handleBaseBackup = async () => {
    setRunningBaseBackup(true);
    setPitrOutput(null);
    setPitrError(null);
    try {
      const res = await api.post('/system-admin/base_backup/');
      setPitrOutput(res.data.output || res.data.message);
      if (!res.data.success) setPitrError(res.data.error || t('error_generic'));
      fetchWalStatus();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string; error?: string; message?: string } } };
      setPitrError(err?.response?.data?.error || err?.response?.data?.detail || err?.response?.data?.message || t('error_base_backup'));
    } finally {
      setRunningBaseBackup(false);
    }
  };

  const handlePitrRestore = async () => {
    setRunningPitr(true);
    setPitrOutput(null);
    setPitrError(null);
    try {
      const res = await api.post('/system-admin/pitr_restore/', {
        target_time: pitrTargetTime || undefined,
      }, { timeout: 180000 });
      setPitrOutput(res.data.output || res.data.message);
      if (!res.data.success) setPitrError(res.data.error || t('error_generic'));
    } catch (e: unknown) {
      setPitrError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || t('error_pitr_restore'));
    } finally {
      setRunningPitr(false);
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
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string; error?: string; message?: string } } };
      setBackupError(err?.response?.data?.detail || err?.response?.data?.error || err?.response?.data?.message || t('backup_error'));
    } finally {
      setRunningBackup(false);
    }
  };

  const handleBackupBeforeRestore = async () => {
    setRestoring(true);
    setRestoreOutput(null);
    setRestoreError(null);
    setRestoreProgress([t('restore_progress.safety_backup')]);
    setShowRestoreConfirm(false);
    try {
      const res = await api.post('/system-admin/run_backup/');
      if (!res.data.success) {
        setRestoreProgress(p => [...p, t('restore_progress.safety_failed')]);
        setRestoreError(res.data.error || t('security_backup_error'));
        setRestoring(false);
        return;
      }
      setRestoreProgress(p => [...p, t('restore_progress.safety_ok')]);
      await new Promise(r => setTimeout(r, 1000));
      await handleRestore();
    } catch (e: unknown) {
      setRestoreProgress(p => [...p, t('restore_progress.safety_failed')]);
      const err = e as { response?: { data?: { detail?: string } } };
      setRestoreError(err?.response?.data?.detail || t('security_backup_error'));
      setRestoring(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreTarget && !restoreFile) return;
    setRestoring(true);
    setRestoreOutput(null);
    setRestoreError(null);
    setRestoreProgress([t('restore_progress.connecting')]);
    setShowRestoreConfirm(false);
    try {
      const formData = new FormData();
      if (restoreFile) {
        formData.append('file', restoreFile);
        setRestoreProgress(p => [...p, t('restore_progress.uploading', { name: restoreFile.name })]);
      } else if (restoreTarget) {
        formData.append('filename', restoreTarget);
        setRestoreProgress(p => [...p, t('restore_progress.using_file', { name: restoreTarget })]);
      }
      setRestoreProgress(p => [...p, t('restore_progress.running')]);
      const res = await api.post('/system-admin/restore/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      setRestoreProgress(p => [...p, t('restore_progress.done')]);
      setRestoreOutput(res.data.output || res.data.message);
      if (!res.data.success) setRestoreError(res.data.error || t('unknown_error'));
      else {
        setRestoreFile(null);
        setRestoreTarget(null);
      }
    } catch (e: unknown) {
      setRestoreProgress(p => [...p, t('restore_progress.failed')]);
      const err = e as { response?: { data?: { detail?: string } } };
      setRestoreError(err?.response?.data?.detail || t('restore_error'));
    } finally {
      setRestoring(false);
    }
  };

  const handleFixRestart = async () => {
    setFixingRestart(true);
    try {
      await api.post('/system-admin/fix_restart_policy/');
      fetchStatus();
    } catch { /* ignore */ } finally {
      setFixingRestart(false);
    }
  };

  const handleCheckUpdate = useCallback(async () => {
    setCheckingUpdate(true);
    setUpdateError(null);
    setUpdateMessage(null);
    try {
      const res = await api.post('/system-admin/check_update/');
      setUpdateStatus(res.data);
      setUpdateMessage(res.data.message);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string; message?: string } } };
      setUpdateError(err?.response?.data?.detail || err?.response?.data?.message || t('update_check_error'));
    } finally {
      setCheckingUpdate(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRunUpdate = async () => {
    setRunningUpdate(true);
    setUpdateError(null);
    setUpdateMessage(null);
    setShowUpdateConfirm(false);
    setUpdateProgress(0);
    setUpdateStep(t('update_step_starting'));
    setUpdateDone(false);
    setUpdateStatus(null);
    try {
      await api.post('/system-admin/run_update/');
      setUpdateMessage(t('update_started'));
      let pollCount = 0;
      const maxPolls = 450; // ~15 min à 2s d'intervalle (hot deploy ~30s, rebuild ~10-15 min)
      const pollInterval = setInterval(async () => {
        pollCount++;
        if (pollCount > maxPolls) {
          clearInterval(pollInterval);
          setUpdateError(t('update_failed'));
          setRunningUpdate(false);
          return;
        }
        try {
          const statusRes = await api.get('/system-admin/update_status/');
          const s = statusRes.data;
          if (s.status === 'running') {
            setUpdateProgress((prev) => Math.min(prev + 8, 90));
            setUpdateStep(s.step || t('update_step_running'));
          } else if (s.status === 'done') {
            setUpdateProgress(100);
            setUpdateStep(t('update_step_done'));
            setUpdateDone(true);
            setUpdateMessage(t('update_success'));
            setUpdateStatus(null);
            setRunningUpdate(false);
            clearInterval(pollInterval);
            // Toast de succès
            gooeyToast.success(t('update_success_title'), {
              description: t('update_success_desc'),
              duration: 4000,
            });
            // Ctrl+F5 auto après 2s (laisse le temps au toast de s'afficher)
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          } else if (s.status === 'failed') {
            setUpdateError(t('update_failed') + (s.error ? ': ' + s.error : ''));
            setRunningUpdate(false);
            clearInterval(pollInterval);
            gooeyToast.error(t('update_failed'));
          } else if (s.status === 'idle') {
            // Backend a redémarré et perdu le statut — probablement terminé
            setUpdateProgress(100);
            setUpdateStep(t('update_step_done'));
            setUpdateDone(true);
            setUpdateMessage(t('update_success'));
            setUpdateStatus(null);
            setRunningUpdate(false);
            clearInterval(pollInterval);
            gooeyToast.success(t('update_success_title'), {
              description: t('update_success_desc'),
              duration: 4000,
            });
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          }
        } catch {
          // Le backend redémarre pendant la mise à jour, c'est normal
          setUpdateProgress((prev) => Math.min(prev + 5, 95));
          setUpdateStep(t('update_step_restarting'));
        }
      }, 2000);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string; message?: string } } };
      setUpdateError(err?.response?.data?.detail || err?.response?.data?.message || t('update_run_error'));
      setRunningUpdate(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'mise_a_jour' && !updateStatus && !checkingUpdate && !runningUpdate && !updateDone && !updateError) {
      handleCheckUpdate();
    }
  }, [activeTab, updateStatus, checkingUpdate, runningUpdate, updateDone, updateError, handleCheckUpdate]);

  const fetchSchedule = useCallback(async () => {
    setLoadingSchedule(true);
    try {
      const res = await api.get('/system-admin/update_schedule/');
      setUpdateTime(res.data.update_time || '02:00');
      setAutoUpdateEnabled(res.data.auto_update_enabled !== false);
    } catch {
      // valeurs par défaut
    } finally {
      setLoadingSchedule(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'mise_a_jour') {
      fetchSchedule();
    }
  }, [activeTab, fetchSchedule]);

  const handleSaveSchedule = async () => {
    setSavingSchedule(true);
    setScheduleMessage(null);
    setScheduleError(null);
    try {
      const res = await api.post('/system-admin/set_update_schedule/', {
        update_time: updateTime,
        auto_update_enabled: autoUpdateEnabled,
      });
      setScheduleMessage(res.data.message);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string; message?: string } } };
      setScheduleError(err?.response?.data?.detail || err?.response?.data?.message || t('update_schedule_save_error'));
    } finally {
      setSavingSchedule(false);
    }
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'sante', label: t('tabs.health'), icon: <Server className="w-4 h-4" /> },
    { id: 'sauvegardes', label: t('tabs.backups'), icon: <HardDrive className="w-4 h-4" /> },
    { id: 'mise_a_jour', label: t('tabs.update'), icon: <DownloadCloud className="w-4 h-4" /> },
    { id: 'caisse', label: t('tabs.cash'), icon: <Store className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6 overflow-y-auto">

      {/* ── OVERLAY RESTAURATION ── */}
      <RestoreOverlay restoring={restoring} restoreProgress={restoreProgress} t={t} />

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
          <SystemHealthTab
            systemStatus={systemStatus}
            loadingStatus={loadingStatus}
            fixingRestart={fixingRestart}
            runningBackup={runningBackup}
            backupOutput={backupOutput}
            backupError={backupError}
            onRefreshStatus={fetchStatus}
            onFixRestart={handleFixRestart}
            onRunBackup={handleRunBackup}
            t={t}
          />
        )}

        {/* ── ONGLET SAUVEGARDES ── */}
        {activeTab === 'sauvegardes' && (
          <BackupsTab
            backupList={backupList}
            loadingBackups={loadingBackups}
            runningBackup={runningBackup}
            backupOutput={backupOutput}
            backupError={backupError}
            backupSettings={backupSettings}
            loadingBackupSettings={loadingBackupSettings}
            savingBackupSettings={savingBackupSettings}
            restoreFile={restoreFile}
            restoreTarget={restoreTarget}
            showRestoreConfirm={showRestoreConfirm}
            restoring={restoring}
            restoreOutput={restoreOutput}
            restoreError={restoreError}
            restoreProgress={restoreProgress}
            walStatus={walStatus}
            loadingWal={loadingWal}
            runningBaseBackup={runningBaseBackup}
            pitrTargetTime={pitrTargetTime}
            pitrOutput={pitrOutput}
            pitrError={pitrError}
            runningPitr={runningPitr}
            onRunBackup={handleRunBackup}
            onRefreshBackups={fetchBackups}
            onSaveBackupSettings={saveBackupSettings}
            setBackupSettings={setBackupSettings}
            setRestoreFile={setRestoreFile}
            setRestoreTarget={setRestoreTarget}
            setShowRestoreConfirm={setShowRestoreConfirm}
            onBackupBeforeRestore={handleBackupBeforeRestore}
            onRestore={handleRestore}
            onRefreshWal={fetchWalStatus}
            onBaseBackup={handleBaseBackup}
            setPitrTargetTime={setPitrTargetTime}
            onPitrRestore={handlePitrRestore}
            t={t}
            i18n={i18n}
          />
        )}

        {/* ── ONGLET FERMETURE DE CAISSE ── */}
        {activeTab === 'caisse' && (
          <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
            <CashForceClosePanel t={t} />
          </div>
        )}

        {/* ── ONGLET MISE À JOUR ── */}
        {activeTab === 'mise_a_jour' && (
          <UpdateTab
            updateStatus={updateStatus}
            checkingUpdate={checkingUpdate}
            runningUpdate={runningUpdate}
            updateError={updateError}
            updateMessage={updateMessage}
            showUpdateConfirm={showUpdateConfirm}
            updateProgress={updateProgress}
            updateStep={updateStep}
            updateDone={updateDone}
            updateTime={updateTime}
            autoUpdateEnabled={autoUpdateEnabled}
            loadingSchedule={loadingSchedule}
            savingSchedule={savingSchedule}
            scheduleMessage={scheduleMessage}
            scheduleError={scheduleError}
            onCheckUpdate={handleCheckUpdate}
            onRunUpdate={handleRunUpdate}
            setShowUpdateConfirm={setShowUpdateConfirm}
            setUpdateDone={setUpdateDone}
            setUpdateStatus={setUpdateStatus}
            setAutoUpdateEnabled={setAutoUpdateEnabled}
            setUpdateTime={setUpdateTime}
            onSaveSchedule={handleSaveSchedule}
            t={t}
          />
        )}
      </div>
    </div>
  );
}
