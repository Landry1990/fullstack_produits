import { useEffect, useRef } from 'react';
import { gooeyToast } from 'goey-toast';
import { useExpirationAlerts, type ExpirationAlert } from '../hooks/useExpirationAlerts';

/**
 * Composant qui affiche automatiquement les toasts d'alerte péremption
 * au chargement de l'application (après login).
 *
 * À placer dans le layout principal (ex: App.tsx ou Dashboard)
 */
export function ExpirationAlertToasts() {
  const hasShownRef = useRef(false);

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

    const { alerts, stats } = data;

    if (alerts.length === 0) {
      hasShownRef.current = true;
      return () => {
        timers.forEach(clearTimeout);
      };
    }

    // Grouper par niveau
    const critical = alerts.filter((a: ExpirationAlert) => a.level === 'critical');
    const warning = alerts.filter((a: ExpirationAlert) => a.level === 'warning');
    const others = alerts.filter((a: ExpirationAlert) => a.level === 'notice' || a.level === 'info');

    // Toast critique - persistant avec son
    if (critical.length > 0) {
      gooeyToast.error('🚨 Alerte péremption critique', {
        description: `${critical.length} produit(s) expirent dans ≤ 7 jours`,
        duration: Infinity,
      });

      // Son d'alerte (optionnel)
      try {
        const audio = new Audio('/sounds/alert-critical.mp3');
        audio.volume = 0.4;
        audio.play().catch(() => {});
      } catch {
        // Ignorer les erreurs audio
      }
    }

    // Toast warning (10s)
    if (warning.length > 0) {
      timers.push(
        setTimeout(() => {
          gooeyToast.warning('⚠️ Péremption imminente', {
            description: `${warning.length} produit(s) expirent dans 8-14 jours`,
            duration: 10000,
          });
        }, critical.length > 0 ? 500 : 0)
      );
    }

    // Toast info (5s)
    if (others.length > 0 && (critical.length > 0 || warning.length > 0)) {
      timers.push(
        setTimeout(() => {
          gooeyToast.success(
            `📦 ${others.length} autre(s) produit(s) en surveillance péremption`,
            {
              duration: 5000,
            }
          );
        }, (critical.length > 0 ? 500 : 0) + (warning.length > 0 ? 500 : 0))
      );
    }

    // Toast récapitulatif si beaucoup d'alertes sans critiques
    if (critical.length === 0 && warning.length === 0 && others.length > 5) {
      gooeyToast.info(
        `📦 ${stats.total_alerts} produits en péremption imminente (valeur: ${stats.total_valeur.toFixed(2)} F)`,
        {
          duration: 8000,
        }
      );
    }

    hasShownRef.current = true;

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [isSuccess, data]);

  // Ce composant ne rend rien visuellement
  return null;
}
