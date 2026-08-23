import { useEffect, useRef } from 'react';
import { gooeyToast } from 'goey-toast';
import { useTranslation } from 'react-i18next';
import { useExpirationAlerts, type ExpirationAlert } from '../hooks/useExpirationAlerts';

const LEVEL_PRIORITY: Record<string, number> = {
  critical: 3,
  warning: 2,
  notice: 1,
  info: 0,
};

function getHighestLevel(items: ExpirationAlert[]): ExpirationAlert['level'] {
  let highest: ExpirationAlert['level'] = 'info';
  for (const item of items) {
    if (LEVEL_PRIORITY[item.level] > LEVEL_PRIORITY[highest]) {
      highest = item.level;
    }
  }
  return highest;
}

/**
 * Composant qui affiche automatiquement les toasts d'alerte péremption
 * au chargement de l'application (après login).
 *
 * À placer dans le layout principal (ex: App.tsx ou Dashboard)
 */
export function ExpirationAlertToasts() {
  const hasShownRef = useRef(false);
  const { t } = useTranslation('stock');

  const { data, isSuccess } = useExpirationAlerts({
    days: 30,
    enabled: true,
  });

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Ne montrer qu'une seule fois au chargement
    if (hasShownRef.current || !isSuccess || !data) {
      return () => {
        timers.forEach(clearTimeout);
      };
    }

    const { alerts } = data;

    if (alerts.length === 0) {
      hasShownRef.current = true;
      return () => {
        timers.forEach(clearTimeout);
      };
    }

    // Grouper par bucket mensuel (30 jours) pour afficher les alertes en mois
    const buckets = new Map<number, ExpirationAlert[]>();
    for (const alert of alerts) {
      const monthBucket = Math.floor(alert.days_until / 30);
      const existing = buckets.get(monthBucket) || [];
      existing.push(alert);
      buckets.set(monthBucket, existing);
    }

    const sortedBuckets = Array.from(buckets.entries()).sort(([a], [b]) => a - b);

    sortedBuckets.forEach(([monthBucket, items], index) => {
      const level = getHighestLevel(items);
      const count = items.length;
      const message =
        monthBucket === 0
          ? t('perimes.toasts.this_month', { count })
          : t('perimes.toasts.months', { count, months: monthBucket });

      const showToast = () => {
        if (level === 'critical') {
          gooeyToast.error(message, { duration: Infinity });
          try {
            const audio = new Audio('/sounds/alert-critical.mp3');
            audio.volume = 0.4;
            audio.play().catch(() => {});
          } catch {
            // Ignorer les erreurs audio
          }
        } else if (level === 'warning') {
          gooeyToast.warning(message, { duration: 10000 });
        } else {
          gooeyToast.info(message, { duration: 5000 });
        }
      };

      if (index === 0) {
        showToast();
      } else {
        timers.push(setTimeout(showToast, index * 500));
      }
    });

    hasShownRef.current = true;

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [isSuccess, data, t]);

  // Ce composant ne rend rien visuellement
  return null;
}
