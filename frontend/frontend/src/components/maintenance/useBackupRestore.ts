import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gooeyToast } from 'goey-toast';
import api from '../../services/api';
import { getApiErrorDetail } from '../../utils/errorHandling';
import type { UsePharmacySettingsReturn } from './usePharmacySettings';

/**
 * Sauvegarde BDD (manuelle + planifiée) et restauration (.sql.gz) avec
 * progression simulée côté client.
 */
export function useBackupRestore({ pharmacySettings, setPharmacySettings }: UsePharmacySettingsReturn) {
  const { t } = useTranslation(['maintenance', 'common']);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [backupStep, setBackupStep] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePassword, setRestorePassword] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restoreStep, setRestoreStep] = useState('');
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  const handleManualBackup = async () => {
    setBackupLoading(true);
    setBackupProgress(0);
    setBackupStep(t('backup_steps.init'));

    // Simulation logic
    const progressInterval = setInterval(() => {
      setBackupProgress(prev => {
        if (prev >= 95) return prev;
        const inc = Math.random() * (prev < 50 ? 15 : prev < 80 ? 5 : 1);
        return Math.min(prev + inc, 95);
      });
    }, 400);

    const steps = [
      { p: 10, s: t('backup_steps.analyze') },
      { p: 30, s: t('backup_steps.extract') },
      { p: 60, s: t('backup_steps.generate') },
      { p: 85, s: t('backup_steps.compress') },
    ];

    steps.forEach((step, idx) => {
      setTimeout(() => setBackupStep(step.s), (idx + 1) * 1500);
    });

    try {
      const res = await api.post('maintenance/backup/');
      clearInterval(progressInterval);
      setBackupProgress(100);
      gooeyToast.success(t('toasts.backup_success'));
      gooeyToast.success(res.data.message || t('toasts.backup_finished'));

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
      gooeyToast.error(getApiErrorDetail(err, t('toasts.backup_error')));
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
      gooeyToast.success(t('toasts.settings_saved'));
    } catch {
      gooeyToast.error(t('toasts.save_error'));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreFile || !restorePassword) {
      gooeyToast.error(t('toasts.restore_input_required'));
      return;
    }

    setRestoring(true);
    setRestoreProgress(0);
    setRestoreStep(t('restore_steps.init'));

    // Simulation de progression
    const progressInterval = setInterval(() => {
      setRestoreProgress(prev => {
        if (prev >= 98) return prev;
        const inc = Math.random() * (prev < 30 ? 20 : prev < 70 ? 5 : 1);
        return Math.min(prev + inc, 98);
      });
    }, 500);

    const steps = [
      { p: 15, s: t('restore_steps.verify') },
      { p: 40, s: t('restore_steps.decompress') },
      { p: 70, s: t('restore_steps.restore') },
      { p: 90, s: t('restore_steps.sequences') },
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
      setRestoreStep(t('restore_steps.done'));
      gooeyToast.success(t('toasts.restore_success'));
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
      gooeyToast.error(getApiErrorDetail(err, t('toasts.restore_error')));
    }
  };

  const openRestoreConfirm = () => {
    if (restoreFile) setShowRestoreConfirm(true);
    else gooeyToast.error(t('common:select_file'));
  };

  const closeRestoreConfirm = () => {
    setShowRestoreConfirm(false);
    setRestorePassword('');
  };

  return {
    backupLoading,
    backupProgress,
    backupStep,
    savingSettings,
    restoreFile,
    restorePassword,
    restoring,
    restoreProgress,
    restoreStep,
    showRestoreConfirm,
    pharmacySettings,
    setPharmacySettings,
    setRestoreFile,
    setRestorePassword,
    handleManualBackup,
    saveBackupSettings,
    handleRestore,
    openRestoreConfirm,
    closeRestoreConfirm,
  };
}

export type UseBackupRestoreReturn = ReturnType<typeof useBackupRestore>;
