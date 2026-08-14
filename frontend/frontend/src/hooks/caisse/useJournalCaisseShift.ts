import { useState, useCallback } from 'react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import { logger } from '../../utils/logger';
import { useTranslation } from 'react-i18next';

interface DetectedShift {
  start: Date;
  end: Date;
  active: boolean;
  posteCaisseId?: number | null;
  posteCaisseNom?: string | null;
  hasActiveSession?: boolean;
}

interface UseJournalCaisseShiftParams {
  getServerDate: () => Date;
  onShiftDetected: (start: Date, end: Date) => void;
  onNoShift: (todayStart: Date, todayEnd: Date) => void;
}

/**
 * Gère la détection du shift (poste de vente actif) d'un caissier.
 * Appelle caisse/get_user_shift/ et notifie le parent via callbacks.
 */
export function useJournalCaisseShift({
  getServerDate,
  onShiftDetected,
  onNoShift,
}: UseJournalCaisseShiftParams) {
  const { t } = useTranslation(['cash_journal', 'common']);
  const [detectedShift, setDetectedShift] = useState<DetectedShift | null>(null);
  const [isDetectingShift, setIsDetectingShift] = useState(false);

  const handleUserShiftDetection = useCallback(async (userId: string) => {
    setIsDetectingShift(true);
    try {
      const response = await api.get('caisse/get_user_shift/', {
        params: { user_id: userId }
      });
      const { start_date, end_date, has_activity, has_active_session, poste_caisse_id, poste_caisse_nom } = response.data;

      if (has_activity && start_date) {
        const start = new Date(start_date);
        const end = end_date ? new Date(end_date) : new Date();

        setDetectedShift({
          start,
          end,
          active: true,
          hasActiveSession: has_active_session,
          posteCaisseId: poste_caisse_id,
          posteCaisseNom: poste_caisse_nom,
        });
        onShiftDetected(start, end);
        toast.success(t('messages.shift_detected'));
      } else {
        setDetectedShift(null);
        const today = getServerDate();
        today.setHours(0, 0, 0, 0);
        const endToday = getServerDate();
        endToday.setHours(23, 59, 59, 999);
        onNoShift(today, endToday);
        toast(t('messages.no_shift_found', { defaultValue: 'Aucune activité pour ce caissier...' }), { icon: 'ℹ️' });
      }
    } catch (err) {
      logger.error("Erreur détection shift:", err);
      setDetectedShift(null);
      toast.error(t('messages.shift_error', { defaultValue: 'Erreur lors de la détection du shift' }));
    } finally {
      setIsDetectingShift(false);
    }
  }, [getServerDate, onShiftDetected, onNoShift, t]);

  const resetShift = useCallback(() => {
    setDetectedShift(null);
  }, []);

  return {
    detectedShift,
    setDetectedShift,
    isDetectingShift,
    setIsDetectingShift,
    handleUserShiftDetection,
    resetShift,
  };
}
