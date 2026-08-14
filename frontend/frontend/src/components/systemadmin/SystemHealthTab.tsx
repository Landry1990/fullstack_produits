import {
  RefreshCw, Play, ShieldCheck, ShieldAlert,
  Database, XCircle, AlertTriangle, RotateCcw, Wifi, WifiOff,
} from 'lucide-react';
import type { TFunction } from 'i18next';
import type { SystemStatus } from './types';
import { backupStatusColor } from './types';

interface SystemHealthTabProps {
  systemStatus: SystemStatus | null;
  loadingStatus: boolean;
  fixingRestart: boolean;
  runningBackup: boolean;
  backupOutput: string | null;
  backupError: string | null;
  onRefreshStatus: () => void;
  onFixRestart: () => void;
  onRunBackup: () => void;
  t: TFunction;
}

export function SystemHealthTab({
  systemStatus,
  loadingStatus,
  fixingRestart,
  runningBackup,
  backupOutput,
  backupError,
  onRefreshStatus,
  onFixRestart,
  onRunBackup,
  t,
}: SystemHealthTabProps) {
  const backupStatusLabel = (status: string, hours: number) => {
    if (status === 'ok') return t('backup_status.recent', { hours });
    if (status === 'warning') return t('backup_status.old', { hours });
    return t('backup_status.very_old', { hours });
  };

  return (
    <div className="space-y-4">

      {/* Refresh */}
      <div className="flex justify-end">
        <button
          onClick={onRefreshStatus}
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
                    onClick={onFixRestart}
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
                onClick={onRunBackup}
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
  );
}
