import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { gooeyToast } from 'goey-toast';
import api from '../../services/api';
import { getApiErrorDetail } from '../../utils/errorHandling';

/**
 * Mise à jour manuelle : changelog, statut de l'update, polling de progression
 * et lancement avec mot de passe admin.
 */
export function useManualUpdate() {
  const { t } = useTranslation(['maintenance', 'common']);
  const [changelog, setChangelog] = useState<string>('');
  const [updateRunning, setUpdateRunning] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateStep, setUpdateStep] = useState('');
  const [updateLog, setUpdateLog] = useState<string[]>([]);
  const [updatePassword, setUpdatePassword] = useState('');
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false);
  const [updateError, setUpdateError] = useState('');

  useEffect(() => {
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
    let pollCount = 0;
    const maxPolls = 150; // ~5 min à 2s d'intervalle
    const poll = setInterval(async () => {
      pollCount++;
      if (pollCount > maxPolls) {
        clearInterval(poll);
        setUpdateRunning(false);
        setUpdateError(t('toasts.update_timeout'));
        return;
      }
      try {
        const res = await api.get('maintenance/update_status/');
        const d = res.data;
        setUpdateProgress(d.progress || 0);
        setUpdateStep(d.step || '');
        setUpdateLog(d.log || []);
        if (d.status !== 'running') {
          setUpdateRunning(false);
          clearInterval(poll);
          if (d.status === 'done') {
            gooeyToast.success(t('toasts.update_success'));
          } else if (d.status === 'error') {
            gooeyToast.error(t('toasts.update_error', { error: d.step || t('common:messages.error_generic') }));
            setUpdateError(d.step || t('common:messages.error_generic'));
          }
        }
      } catch {
        // Backend redémarre pendant la mise à jour — continuer à poller
        setUpdateProgress((prev) => Math.min(prev + 2, 95));
        setUpdateStep(t('toasts.backend_restarting'));
      }
    }, 2000);
    return () => clearInterval(poll);
  }, [updateRunning, t]);

  const handleRunUpdate = async () => {
    if (!updatePassword) { gooeyToast.error(t('toasts.password_required')); return; }
    setUpdateRunning(true);
    setUpdateProgress(0);
    setUpdateStep(t('toasts.starting'));
    setUpdateLog([]);
    setUpdateError('');
    try {
      const res = await api.post('maintenance/run_update/', { password: updatePassword });
      setUpdatePassword('');
      setShowUpdateConfirm(false);
      gooeyToast.success(res.data.message || t('toasts.update_started'));
    } catch (err) {
      setUpdateRunning(false);
      gooeyToast.error(getApiErrorDetail(err, t('toasts.update_launch_error')));
    }
  };

  const openUpdateConfirm = () => {
    setUpdateError('');
    setShowUpdateConfirm(true);
  };

  const closeUpdateConfirm = () => {
    setShowUpdateConfirm(false);
    setUpdatePassword('');
  };

  return {
    changelog,
    updateRunning,
    updateProgress,
    updateStep,
    updateLog,
    updatePassword,
    showUpdateConfirm,
    updateError,
    setUpdatePassword,
    handleRunUpdate,
    openUpdateConfirm,
    closeUpdateConfirm,
  };
}

export type UseManualUpdateReturn = ReturnType<typeof useManualUpdate>;
