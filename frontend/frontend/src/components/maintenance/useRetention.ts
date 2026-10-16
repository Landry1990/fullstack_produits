import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { gooeyToast } from 'goey-toast';
import api from '../../services/api';
import { getApiErrorDetail } from '../../utils/errorHandling';
import { logger } from '../../utils/logger';
import { RETENTION_DAY_FIELDS } from './types';
import type { PharmacySettings, RetentionPreview } from './types';
import type { UsePharmacySettingsReturn } from './usePharmacySettings';

/**
 * Rétention automatique : aperçu des données expirées, durées de conservation,
 * exécution manuelle de la purge.
 */
export function useRetention({ pharmacySettings, setPharmacySettings }: UsePharmacySettingsReturn) {
  const { t } = useTranslation(['maintenance', 'common']);
  const [retentionPreview, setRetentionPreview] = useState<RetentionPreview | null>(null);
  const [retentionPreviewLoading, setRetentionPreviewLoading] = useState(false);
  const [savingRetention, setSavingRetention] = useState(false);
  const [showRetentionModal, setShowRetentionModal] = useState(false);
  const [retentionPassword, setRetentionPassword] = useState('');
  const [retentionRunning, setRetentionRunning] = useState(false);
  const [retentionOutput, setRetentionOutput] = useState<string | null>(null);

  const fetchRetentionPreview = async (silent = false) => {
    setRetentionPreviewLoading(true);
    try {
      const res = await api.get('maintenance/retention_preview/');
      setRetentionPreview(res.data);
    } catch (err) {
      if (silent) {
        logger.error('Error loading retention preview:', err);
      } else {
        gooeyToast.error(getApiErrorDetail(err, t('retention.toasts.preview_error')));
      }
    } finally {
      setRetentionPreviewLoading(false);
    }
  };

  useEffect(() => {
    fetchRetentionPreview(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patchRetentionSettings = async (patch: Partial<PharmacySettings>) => {
    setSavingRetention(true);
    try {
      const res = await api.put('pharmacy-settings/', patch);
      setPharmacySettings(prev => ({ ...prev, ...res.data }));
      gooeyToast.success(t('retention.toasts.saved'));
    } catch {
      gooeyToast.error(t('retention.toasts.save_error'));
    } finally {
      setSavingRetention(false);
    }
  };

  const handleRetentionToggle = (checked: boolean) => {
    setPharmacySettings(prev => ({ ...prev, retention_enabled: checked }));
    patchRetentionSettings({ retention_enabled: checked });
  };

  const saveRetentionDays = () => {
    if (!pharmacySettings) return;
    const patch: Partial<PharmacySettings> = {};
    RETENTION_DAY_FIELDS.forEach(field => {
      const value = pharmacySettings[field];
      if (typeof value === 'number') patch[field] = value;
    });
    patchRetentionSettings(patch);
  };

  const handleRetentionRun = async () => {
    if (!retentionPassword) {
      gooeyToast.error(t('toasts.password_required'));
      return;
    }
    setRetentionRunning(true);
    try {
      const res = await api.post('maintenance/retention_run/', { password: retentionPassword });
      setRetentionOutput(res.data.output || '');
      setShowRetentionModal(false);
      setRetentionPassword('');
      gooeyToast.success(t('retention.toasts.run_success'));
      fetchRetentionPreview(true);
    } catch (err) {
      gooeyToast.error(getApiErrorDetail(err, t('retention.toasts.run_error')));
    } finally {
      setRetentionRunning(false);
    }
  };

  const openRetentionModal = () => {
    setRetentionOutput(null);
    setShowRetentionModal(true);
  };

  const closeRetentionModal = () => {
    setShowRetentionModal(false);
    setRetentionPassword('');
  };

  return {
    retentionPreview,
    retentionPreviewLoading,
    savingRetention,
    showRetentionModal,
    retentionPassword,
    retentionRunning,
    retentionOutput,
    pharmacySettings,
    setPharmacySettings,
    setRetentionPassword,
    fetchRetentionPreview,
    handleRetentionToggle,
    saveRetentionDays,
    handleRetentionRun,
    openRetentionModal,
    closeRetentionModal,
  };
}

export type UseRetentionReturn = ReturnType<typeof useRetention>;
