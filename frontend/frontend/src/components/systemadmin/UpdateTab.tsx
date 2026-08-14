import {
  RefreshCw, DownloadCloud, CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react';
import type { TFunction } from 'i18next';
import type { UpdateStatus } from './types';

interface UpdateTabProps {
  updateStatus: UpdateStatus | null;
  checkingUpdate: boolean;
  runningUpdate: boolean;
  updateError: string | null;
  updateMessage: string | null;
  showUpdateConfirm: boolean;
  updateProgress: number;
  updateStep: string;
  updateDone: boolean;
  updateTime: string;
  autoUpdateEnabled: boolean;
  loadingSchedule: boolean;
  savingSchedule: boolean;
  scheduleMessage: string | null;
  scheduleError: string | null;
  onCheckUpdate: () => void;
  onRunUpdate: () => void;
  setShowUpdateConfirm: React.Dispatch<React.SetStateAction<boolean>>;
  setUpdateDone: React.Dispatch<React.SetStateAction<boolean>>;
  setUpdateStatus: React.Dispatch<React.SetStateAction<UpdateStatus | null>>;
  setAutoUpdateEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  setUpdateTime: React.Dispatch<React.SetStateAction<string>>;
  onSaveSchedule: () => void;
  t: TFunction;
}

export function UpdateTab({
  updateStatus,
  checkingUpdate,
  runningUpdate,
  updateError,
  updateMessage,
  showUpdateConfirm,
  updateProgress,
  updateStep,
  updateDone,
  updateTime,
  autoUpdateEnabled,
  loadingSchedule,
  savingSchedule,
  scheduleMessage,
  scheduleError,
  onCheckUpdate,
  onRunUpdate,
  setShowUpdateConfirm,
  setUpdateDone,
  setUpdateStatus,
  setAutoUpdateEnabled,
  setUpdateTime,
  onSaveSchedule,
  t,
}: UpdateTabProps) {
  return (
    <div className="space-y-4">

      {/* Carte principale */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-indigo-50 rounded-lg">
            <DownloadCloud className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t('update_title')}</h2>
            <p className="text-xs text-gray-500">{t('update_subtitle')}</p>
          </div>
        </div>

        {/* Bouton vérifier */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={onCheckUpdate}
            disabled={checkingUpdate}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${checkingUpdate ? 'animate-spin' : ''}`} />
            {checkingUpdate ? t('update_checking') : t('update_check')}
          </button>
        </div>

        {/* Résultat de la vérification */}
        {checkingUpdate && (
          <div className="text-center py-4 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
            {t('update_checking_github')}
          </div>
        )}

        {updateStatus && !checkingUpdate && (
          <div className={`p-4 rounded-lg border ${
            updateStatus.update_available
              ? 'bg-amber-50 border-amber-200'
              : 'bg-emerald-50 border-emerald-200'
          }`}>
            <div className="flex items-start gap-3">
              {updateStatus.update_available ? (
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {updateStatus.message}
                </p>
                {updateStatus.current_version && (
                  <p className="text-xs text-gray-500 mt-1">
                    {t('update_current_version')} : <code className="px-1 py-0.5 bg-gray-100 rounded text-gray-700">{updateStatus.current_version}</code>
                    {updateStatus.latest_version && (
                      <> → {t('update_latest_version')} : <code className="px-1 py-0.5 bg-gray-100 rounded text-gray-700">{updateStatus.latest_version}</code></>
                    )}
                  </p>
                )}
                {updateStatus.error && (
                  <p className="text-xs text-red-600 mt-1">{updateStatus.error}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bouton mettre à jour */}
        {updateStatus?.update_available && !showUpdateConfirm && !runningUpdate && (
          <div className="mt-4">
            <button
              onClick={() => setShowUpdateConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-all"
            >
              <DownloadCloud className="w-4 h-4" />
              {t('update_now')}
            </button>
          </div>
        )}

        {/* Barre de progression */}
        {runningUpdate && (
          <div className="mt-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
              <span className="text-sm font-medium text-indigo-900">{updateStep}</span>
            </div>
            <div className="w-full bg-indigo-100 rounded-full h-3 overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${updateProgress}%` }}
              />
            </div>
            <p className="text-xs text-indigo-500 mt-1 text-right">{updateProgress}%</p>
          </div>
        )}

        {/* Notification de succès */}
        {updateDone && !runningUpdate && (
          <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span className="text-sm font-bold text-emerald-900">{t('update_success_title')}</span>
            </div>
            <p className="text-sm text-emerald-700">{t('update_success_desc')}</p>
            <button
              onClick={() => { setUpdateDone(false); setUpdateStatus(null); onCheckUpdate(); }}
              className="mt-3 flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              {t('update_ok')}
            </button>
          </div>
        )}

        {/* Confirmation */}
        {showUpdateConfirm && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3 mb-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-900">{t('update_warning_title')}</p>
                <ul className="text-xs text-red-700 mt-2 space-y-1 list-disc list-inside">
                  <li>{t('update_warning_1')}</li>
                  <li>{t('update_warning_2')}</li>
                  <li>{t('update_warning_3')}</li>
                  <li>{t('update_warning_4')}</li>
                </ul>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onRunUpdate}
                disabled={runningUpdate}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-all disabled:opacity-50"
              >
                {runningUpdate ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> {t('update_running')}</>
                ) : (
                  <><DownloadCloud className="w-4 h-4" /> {t('update_confirm')}</>
                )}
              </button>
              <button
                onClick={() => setShowUpdateConfirm(false)}
                disabled={runningUpdate}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-all disabled:opacity-50"
              >
                {t('update_cancel')}
              </button>
            </div>
          </div>
        )}

        {/* Message de succès/erreur */}
        {updateMessage && !showUpdateConfirm && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="text-sm text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {updateMessage}
            </p>
          </div>
        )}
        {updateError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-600" />
              {updateError}
            </p>
          </div>
        )}

        {/* Configuration de l'heure de mise à jour */}
        <div className="mt-6 pt-4 border-t border-gray-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">{t('update_schedule_title')}</h3>

          {loadingSchedule ? (
            <div className="text-sm text-gray-400 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> {t('update_schedule_loading')}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Activer/désactiver */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoUpdateEnabled}
                  onChange={(e) => setAutoUpdateEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">{t('update_auto_enabled')}</span>
              </label>

              {/* Heure */}
              {autoUpdateEnabled && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-700">{t('update_time_label')}</label>
                  <input
                    type="time"
                    value={updateTime}
                    onChange={(e) => setUpdateTime(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                  <span className="text-xs text-gray-400">{t('update_time_hint')}</span>
                </div>
              )}

              {/* Bouton sauvegarder */}
              <div className="flex items-center gap-3">
                <button
                  onClick={onSaveSchedule}
                  disabled={savingSchedule}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  {savingSchedule ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {savingSchedule ? t('update_saving') : t('update_save')}
                </button>
              </div>

              {scheduleMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <p className="text-sm text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {scheduleMessage}
                  </p>
                </div>
              )}
              {scheduleError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800 flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-600" /> {scheduleError}
                  </p>
                </div>
              )}

              {/* Infos */}
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{t('update_info_1')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{t('update_info_2')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{t('update_info_3')}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
