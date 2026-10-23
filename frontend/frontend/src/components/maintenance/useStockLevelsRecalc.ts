import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { gooeyToast } from 'goey-toast';
import api from '../../services/api';
import { getApiErrorDetail } from '../../utils/errorHandling';
import { logger } from '../../utils/logger';

interface StockLevelsJobState {
  status: 'idle' | 'running' | 'done' | 'error';
  step?: string;
  progress?: number;
  current?: number;
  total?: number;
  updated?: number;
}

/**
 * Recalcul manuel des seuils de stock (min/max) + rotations.
 * Lance le job backend en arrière-plan et polle sa progression.
 */
export function useStockLevelsRecalc() {
  const { t } = useTranslation(['maintenance', 'common']);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState('');
  const [updated, setUpdated] = useState<number | null>(null);

  // Reprendre le polling si un recalcul tourne déjà (autre onglet/reload)
  useEffect(() => {
    api.get('maintenance/stock_levels_status/')
      .then(res => {
        const d = res.data as StockLevelsJobState;
        if (d.status === 'running') {
          setRunning(true);
          setProgress(d.progress || 0);
          setStep(d.step || '');
        }
      })
      .catch(() => {});
  }, []);

  // Polling de progression pendant le job
  useEffect(() => {
    if (!running) return;
    let pollCount = 0;
    const maxPolls = 300; // ~10 min à 2 s d'intervalle
    const poll = setInterval(async () => {
      pollCount++;
      if (pollCount > maxPolls) {
        clearInterval(poll);
        setRunning(false);
        gooeyToast.error(t('stock_levels.toasts.timeout'));
        return;
      }
      try {
        const res = await api.get('maintenance/stock_levels_status/');
        const d = res.data as StockLevelsJobState;
        setProgress(d.progress || 0);
        setStep(d.step || '');
        if (d.status !== 'running') {
          setRunning(false);
          clearInterval(poll);
          if (d.status === 'done') {
            setUpdated(d.updated ?? 0);
            gooeyToast.success(t('stock_levels.toasts.done', { count: d.updated ?? 0 }));
          } else if (d.status === 'error') {
            gooeyToast.error(t('stock_levels.toasts.error'));
          }
        }
      } catch (err) {
        // Coupure ponctuelle : on continue à poller, mais on log pour le debug
        logger.error('Error polling stock levels status:', err);
      }
    }, 2000);
    return () => clearInterval(poll);
  }, [running, t]);

  const start = async () => {
    setRunning(true);
    setProgress(0);
    setStep(t('toasts.starting'));
    setUpdated(null);
    try {
      await api.post('maintenance/stock_levels_recalc/');
      gooeyToast.success(t('stock_levels.toasts.started'));
    } catch (err) {
      setRunning(false);
      gooeyToast.error(getApiErrorDetail(err, t('stock_levels.toasts.error')));
    }
  };

  return { running, progress, step, updated, start };
}

export type UseStockLevelsRecalcReturn = ReturnType<typeof useStockLevelsRecalc>;
