import { useState } from 'react';
import {
  RefreshCw, Play, HardDrive, Clock, CheckCircle2, XCircle,
  AlertTriangle, Upload, RotateCcw, Database, Archive, Zap,
  FolderOpen,
} from 'lucide-react';
import type { TFunction } from 'i18next';
import type { BackupListData, BackupSettings, WalStatus } from './types';
import { Button } from '../shadcn/button';
import { BackupPathBrowser } from './BackupPathBrowser';

interface BackupsTabProps {
  backupList: BackupListData | null;
  loadingBackups: boolean;
  runningBackup: boolean;
  backupOutput: string | null;
  backupError: string | null;
  backupSettings: BackupSettings | null;
  loadingBackupSettings: boolean;
  savingBackupSettings: boolean;
  restoreFile: File | null;
  restoreTarget: string | null;
  showRestoreConfirm: boolean;
  restoring: boolean;
  restoreOutput: string | null;
  restoreError: string | null;
  restoreProgress: string[];
  walStatus: WalStatus | null;
  loadingWal: boolean;
  runningBaseBackup: boolean;
  pitrTargetTime: string;
  pitrOutput: string | null;
  pitrError: string | null;
  runningPitr: boolean;
  onRunBackup: () => void;
  onRefreshBackups: () => void;
  onSaveBackupSettings: () => void;
  setBackupSettings: React.Dispatch<React.SetStateAction<BackupSettings | null>>;
  setRestoreFile: React.Dispatch<React.SetStateAction<File | null>>;
  setRestoreTarget: React.Dispatch<React.SetStateAction<string | null>>;
  setShowRestoreConfirm: React.Dispatch<React.SetStateAction<boolean>>;
  onBackupBeforeRestore: () => void;
  onRestore: () => void;
  onRefreshWal: () => void;
  onBaseBackup: () => void;
  setPitrTargetTime: React.Dispatch<React.SetStateAction<string>>;
  onPitrRestore: () => void;
  t: TFunction;
  i18n: { language: string };
}

export function BackupsTab({
  backupList,
  loadingBackups,
  runningBackup,
  backupOutput,
  backupError,
  backupSettings,
  loadingBackupSettings,
  savingBackupSettings,
  restoreFile,
  restoreTarget,
  showRestoreConfirm,
  restoring,
  restoreOutput,
  restoreError,
  restoreProgress: _restoreProgress,
  walStatus,
  loadingWal,
  runningBaseBackup,
  pitrTargetTime,
  pitrOutput,
  pitrError,
  runningPitr,
  onRunBackup,
  onRefreshBackups,
  onSaveBackupSettings,
  setBackupSettings,
  setRestoreFile,
  setRestoreTarget,
  setShowRestoreConfirm,
  onBackupBeforeRestore,
  onRestore,
  onRefreshWal,
  onBaseBackup,
  setPitrTargetTime,
  onPitrRestore,
  t,
  i18n,
}: BackupsTabProps) {
  const [browserOpen, setBrowserOpen] = useState(false);
  const [browserField, setBrowserField] = useState<keyof BackupSettings | null>(null);

  const openBrowser = (field: keyof BackupSettings) => {
    setBrowserField(field);
    setBrowserOpen(true);
  };

  const handleSelectPath = (path: string) => {
    if (browserField && backupSettings) {
      setBackupSettings({ ...backupSettings, [browserField]: path });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {backupList ? t('backups_available', { count: backupList.total }) : ''}
        </p>
        <div className="flex gap-2">
          <button
            onClick={onRunBackup}
            disabled={runningBackup}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-60"
          >
            <Play className={`w-3.5 h-3.5 ${runningBackup ? 'animate-pulse' : ''}`} />
            {runningBackup ? t('in_progress') : t('new_backup')}
          </button>
          <button
            onClick={onRefreshBackups}
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
          <div className="flex items-center gap-2">
            {loadingBackupSettings && <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />}
            {backupSettings && (
              <button
                onClick={onSaveBackupSettings}
                disabled={savingBackupSettings}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-60"
              >
                {savingBackupSettings ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {savingBackupSettings ? t('saving') : t('save')}
              </button>
            )}
          </div>
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
                  <option value={30}>{t('interval_options.30min')}</option>
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
                  onChange={(e) => {
                    const parsed = e.target.value ? Number(e.target.value) : undefined;
                    setBackupSettings({ ...backupSettings, backup_retention_count: parsed && !Number.isNaN(parsed) ? Math.max(1, parsed) : undefined });
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Chemin secondaire */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">{t('secondary_path')}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={t('secondary_path_placeholder')}
                  value={backupSettings.secondary_backup_path}
                  onChange={(e) => setBackupSettings({ ...backupSettings, secondary_backup_path: e.target.value })}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => openBrowser('secondary_backup_path')}
                  className="gap-2"
                >
                  <FolderOpen className="size-4" />
                  {t('backup.browse.browse')}
                </Button>
              </div>
            </div>

            {/* Destinations externes (USB, disque dur, réseau) */}
            <div className="border-t border-gray-100 pt-4 mt-2">
              <p className="text-sm font-semibold text-gray-700 mb-1">{t('external_destinations')}</p>
              <p className="text-xs text-gray-400 mb-3">{t('external_destinations_desc')}</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">{t('external_destination_1')}</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={t('external_destination_1_placeholder')}
                      value={backupSettings.external_backup_path_1}
                      onChange={(e) => setBackupSettings({ ...backupSettings, external_backup_path_1: e.target.value })}
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <Button type="button" size="sm" variant="outline" onClick={() => openBrowser('external_backup_path_1')} className="gap-2">
                      <FolderOpen className="size-4" />
                      {t('backup.browse.browse')}
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">{t('external_destination_2')}</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={t('external_destination_2_placeholder')}
                      value={backupSettings.external_backup_path_2}
                      onChange={(e) => setBackupSettings({ ...backupSettings, external_backup_path_2: e.target.value })}
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <Button type="button" size="sm" variant="outline" onClick={() => openBrowser('external_backup_path_2')} className="gap-2">
                      <FolderOpen className="size-4" />
                      {t('backup.browse.browse')}
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">{t('external_destination_3')}</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={t('external_destination_3_placeholder')}
                      value={backupSettings.external_backup_path_3}
                      onChange={(e) => setBackupSettings({ ...backupSettings, external_backup_path_3: e.target.value })}
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <Button type="button" size="sm" variant="outline" onClick={() => openBrowser('external_backup_path_3')} className="gap-2">
                      <FolderOpen className="size-4" />
                      {t('backup.browse.browse')}
                    </Button>
                  </div>
                </div>
              </div>
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
                onClick={onSaveBackupSettings}
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
                      {t('backup_date', { date: date.toLocaleDateString(i18n.language), time: date.toLocaleTimeString(i18n.language, {hour:'2-digit', minute:'2-digit'}) })}
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
                onClick={onBackupBeforeRestore}
                disabled={restoring}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-60"
              >
                <Database className="w-3.5 h-3.5" />
                {restoring ? t('in_progress') : t('backup_then_restore')}
              </button>
              <button
                onClick={onRestore}
                disabled={restoring}
                className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
              >
                {restoring ? t('restoring') : t('restore_without_backup')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Section WAL / PITR ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
            <Archive className="w-4 h-4" />
            {t('wal_title')}
          </h3>
          <button
            onClick={onRefreshWal}
            disabled={loadingWal}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
          >
            <RefreshCw className={`w-3 h-3 ${loadingWal ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </button>
        </div>

        {walStatus ? (
          <div className="space-y-4">
            {/* Statut archivage */}
            <div className="flex items-center gap-3">
              {walStatus.archive_active ? (
                <span className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" /> {t('wal_archive_active')}
                </span>
              ) : (
                <span className="flex items-center gap-2 text-sm font-semibold text-red-600">
                  <XCircle className="w-4 h-4" /> {t('wal_archive_inactive')}
                </span>
              )}
            </div>

            {/* Stats WAL */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400">{t('wal_files')}</p>
                <p className="text-lg font-bold text-gray-700">{walStatus.wal_count}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400">{t('wal_size')}</p>
                <p className="text-lg font-bold text-gray-700">{walStatus.wal_size_mb} MB</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400">{t('wal_oldest')}</p>
                <p className="text-xs font-semibold text-gray-700">{walStatus.oldest_wal || '—'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400">{t('wal_newest')}</p>
                <p className="text-xs font-semibold text-gray-700">{walStatus.newest_wal || '—'}</p>
              </div>
            </div>

            {/* Base backups */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-700">
                  {t('wal_base_backups')}: {walStatus.base_backups_count}
                </p>
                <button
                  onClick={onBaseBackup}
                  disabled={runningBaseBackup}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-60"
                >
                  <Zap className={`w-3.5 h-3.5 ${runningBaseBackup ? 'animate-pulse' : ''}`} />
                  {runningBaseBackup ? t('in_progress') : t('wal_create_base_backup')}
                </button>
              </div>
              {walStatus.base_backups.length > 0 && (
                <div className="space-y-1">
                  {walStatus.base_backups.map((bb) => (
                    <div key={bb.name} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Archive className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="text-xs font-mono text-gray-700">{bb.name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>{bb.size_mb} MB</span>
                        <span>{bb.created_at}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* PITR Restore */}
            <div className="border-t border-gray-100 pt-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                <p className="text-xs text-amber-700">
                  <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                  {t('pitr_description')}
                </p>
              </div>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    {t('pitr_target_time')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('pitr_target_placeholder')}
                    value={pitrTargetTime}
                    onChange={(e) => setPitrTargetTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
                  />
                </div>
                <button
                  onClick={onPitrRestore}
                  disabled={runningPitr || walStatus.base_backups_count === 0}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all disabled:opacity-60"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${runningPitr ? 'animate-spin' : ''}`} />
                  {runningPitr ? t('pitr_restoring') : t('pitr_restore')}
                </button>
              </div>
              {pitrOutput && (
                <pre className="mt-3 p-3 bg-gray-50 border border-gray-100 rounded-lg text-xs text-gray-600 overflow-auto max-h-40 whitespace-pre-wrap">
                  {pitrOutput}
                </pre>
              )}
              {pitrError && (
                <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" /> {pitrError}
                </p>
              )}
            </div>
          </div>
        ) : loadingWal ? (
          <div className="text-center py-4 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
            {t('wal_loading')}
          </div>
        ) : (
          <div className="text-center py-4 text-red-500">
            <XCircle className="w-5 h-5 mx-auto mb-2" />
            {t('wal_load_error')}
          </div>
        )}
      </div>

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

      <BackupPathBrowser
        open={browserOpen}
        onOpenChange={setBrowserOpen}
        onSelect={handleSelectPath}
        t={t}
      />
    </div>
  );
}
