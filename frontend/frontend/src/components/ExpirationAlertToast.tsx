import { useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
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
    days: 14,
    enabled: true,
    showToasts: false,
  });

  useEffect(() => {
    // Ne montrer qu'une seule fois au chargement
    if (hasShownRef.current || !isSuccess || !data) return;

    const { alerts, stats } = data;

    if (alerts.length === 0) {
      hasShownRef.current = true;
      return;
    }

    // Grouper par niveau
    const critical = alerts.filter((a: ExpirationAlert) => a.level === 'critical');
    const warning = alerts.filter((a: ExpirationAlert) => a.level === 'warning');
    const others = alerts.filter((a: ExpirationAlert) => a.level === 'notice' || a.level === 'info');

    // Toast critique - persistant avec son
    if (critical.length > 0) {
      toast.error(
        (t) => (
          <div
            onClick={() => toast.dismiss(t.id)}
            style={{ cursor: 'pointer' }}
          >
            <strong style={{ fontSize: '1.1em' }}>🚨 ALERTE PÉREMPTION CRITIQUE</strong>
            <br />
            <span>{critical.length} produit(s) expirent dans ≤ 7 jours</span>
            <br />
            <small style={{ opacity: 0.8 }}>Cliquez pour fermer</small>
          </div>
        ),
        {
          duration: Infinity,
          id: 'expiration-critical-login',
          style: {
            border: '3px solid #dc2626',
            background: '#fef2f2',
            color: '#991b1b',
            fontWeight: 'bold',
            minWidth: '350px',
          },
        }
      );

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
      setTimeout(() => {
        toast(
          (t) => (
            <div onClick={() => toast.dismiss(t.id)} style={{ cursor: 'pointer' }}>
              <strong>⚠️ Péremption imminente</strong>
              <br />
              <span>{warning.length} produit(s) expirent dans 8-14 jours</span>
            </div>
          ),
          {
            duration: 10000,
            id: 'expiration-warning-login',
            style: {
              border: '2px solid #f97316',
              background: '#fff7ed',
              color: '#c2410c',
              minWidth: '300px',
            },
          }
        );
      }, critical.length > 0 ? 500 : 0);
    }

    // Toast info (5s)
    if (others.length > 0 && (critical.length > 0 || warning.length > 0)) {
      setTimeout(() => {
        toast.success(
          `📦 ${others.length} autre(s) produit(s) en surveillance péremption`,
          {
            duration: 5000,
            id: 'expiration-others-login',
          }
        );
      }, (critical.length > 0 ? 500 : 0) + (warning.length > 0 ? 500 : 0));
    }

    // Toast récapitulatif si beaucoup d'alertes sans critiques
    if (critical.length === 0 && warning.length === 0 && others.length > 5) {
      toast(
        `📦 ${stats.total_alerts} produits en péremption imminente (valeur: ${stats.total_valeur.toFixed(2)} F)`,
        {
          duration: 8000,
          id: 'expiration-summary-login',
          icon: '📦',
          style: {
            border: '1px solid #f97316',
            background: '#ffedd5',
          },
        }
      );
    }

    hasShownRef.current = true;
  }, [isSuccess, data]);

  // Ce composant ne rend rien visuellement
  return null;
}

/**
 * Hook simple pour afficher les alertes manuellement
 */
export function useShowExpirationAlerts() {
  const { data, isSuccess, refetch } = useExpirationAlerts({
    days: 14,
    enabled: false, // Ne pas charger automatiquement
    showToasts: false,
  });

  const showAlerts = () => {
    if (!isSuccess || !data) {
      refetch().then((result) => {
        if (result.data) {
          showAlertToasts(result.data.alerts, result.data.stats);
        }
      });
      return;
    }
    showAlertToasts(data.alerts, data.stats);
  };

  return { showAlerts, data, stats: data?.stats };
}

function showAlertToasts(alerts: ExpirationAlert[], stats: { total_valeur: number }) {
  const critical = alerts.filter((a) => a.level === 'critical');
  const warning = alerts.filter((a) => a.level === 'warning');
  const others = alerts.filter((a) => a.level === 'notice' || a.level === 'info');

  if (critical.length > 0) {
    toast.error(
      `🚨 ${critical.length} produit(s) critique(s) - expirent dans ≤ 7 jours`,
      {
        duration: 8000,
        id: 'expiration-critical-manual',
        style: { border: '2px solid #dc2626', background: '#fef2f2', fontWeight: 'bold' },
      }
    );
  }

  if (warning.length > 0) {
    toast(
      `⚠️ ${warning.length} produit(s) urgent(s) - expirent dans 8-14 jours`,
      {
        duration: 6000,
        id: 'expiration-warning-manual',
        icon: '⚠️',
        style: { border: '1px solid #f97316', background: '#fff7ed' },
      }
    );
  }

  if (others.length > 0) {
    toast(
      `📦 ${others.length} produit(s) en surveillance`,
      { duration: 4000, id: 'expiration-others-manual' }
    );
  }

  if (alerts.length > 0) {
    toast.success(
      `Valeur totale à risque: ${stats.total_valeur.toFixed(2)} F`,
      { duration: 5000, id: 'expiration-value-manual' }
    );
  }
}
