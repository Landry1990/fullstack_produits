import { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { licenceService, type LicenceNotification } from '../services/licenceService';
import { AlertTriangle, Info, XCircle, X } from 'lucide-react';

/**
 * Composant qui affiche les notifications d'alerte de licence
 * sous forme de modals/toasts persistants pour tous les utilisateurs.
 *
 * À placer dans le layout principal (ex: App.tsx)
 */
export function LicenceNotifications() {
  const [notifications, setNotifications] = useState<LicenceNotification[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Charger les notifications au montage
  useEffect(() => {
    loadNotifications();

    // Recharger toutes les 5 minutes
    const interval = setInterval(loadNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    try {
      setIsLoading(true);
      const data = await licenceService.getNotifications();
      setNotifications(data.notifications);
    } catch (error) {
      console.error('Erreur chargement notifications licence:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Ignorer une notification
  const handleDismiss = useCallback(async (notification: LicenceNotification) => {
    try {
      await licenceService.dismissNotification(notification.id);
      setDismissedIds(prev => new Set(prev).add(notification.id));
      toast.success('Notification ignorée');
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  }, []);

  // Afficher les notifications actives non ignorées
  useEffect(() => {
    if (isLoading) return;

    const activeNotifications = notifications.filter(
      n => !dismissedIds.has(n.id)
    );

    activeNotifications.forEach(notification => {
      // Afficher comme toast persistant selon la sévérité
      switch (notification.severity) {
        case 'CRITICAL':
          toast.error(
            (t) => <LicenceToastContent notification={notification} onDismiss={() => {
              toast.dismiss(t.id);
              handleDismiss(notification);
            }} />,
            {
              duration: Infinity,
              position: 'top-center',
              style: {
                background: '#dc2626',
                color: 'white',
                padding: '16px',
                borderRadius: '8px',
                maxWidth: '500px',
              },
            }
          );
          break;

        case 'WARNING':
          toast.error(
            (t) => <LicenceToastContent notification={notification} onDismiss={() => {
              toast.dismiss(t.id);
              handleDismiss(notification);
            }} />,
            {
              duration: 30000, // 30 secondes
              position: 'top-center',
              style: {
                background: '#f59e0b',
                color: 'white',
                padding: '16px',
                borderRadius: '8px',
                maxWidth: '500px',
              },
            }
          );
          break;

        case 'INFO':
          toast.success(
            (t) => <LicenceToastContent notification={notification} onDismiss={() => {
              toast.dismiss(t.id);
              handleDismiss(notification);
            }} />,
            {
              duration: 10000, // 10 secondes
              position: 'top-center',
              style: {
                background: '#3b82f6',
                color: 'white',
                padding: '16px',
                borderRadius: '8px',
                maxWidth: '500px',
              },
            }
          );
          break;
      }
    });
  }, [notifications, dismissedIds, isLoading, handleDismiss]);

  return null; // Pas de rendu visuel, les toasts gèrent l'affichage
}

/**
 * Contenu d'un toast de notification de licence
 */
interface LicenceToastContentProps {
  notification: LicenceNotification;
  onDismiss: () => void;
}

function LicenceToastContent({ notification, onDismiss }: LicenceToastContentProps) {
  const getIcon = () => {
    switch (notification.severity) {
      case 'CRITICAL':
        return <XCircle className="w-6 h-6 mr-2" />;
      case 'WARNING':
        return <AlertTriangle className="w-6 h-6 mr-2" />;
      default:
        return <Info className="w-6 h-6 mr-2" />;
    }
  };

  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
      <div className="flex-1">
        <div className="font-bold text-lg mb-1">{notification.title}</div>
        <div className="text-sm opacity-90 leading-relaxed">
          {notification.message}
        </div>
        {notification.days_remaining !== null && (
          <div className="mt-2 text-xs font-semibold opacity-80">
            {notification.days_remaining === 0
              ? 'Expire aujourd\'hui'
              : notification.days_remaining === 1
              ? 'Expire demain'
              : `Expire dans ${notification.days_remaining} jours`}
          </div>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 p-1 hover:bg-white/20 rounded-full transition-colors"
        title="Ignorer cette alerte"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

/**
 * Hook pour vérifier le statut de la licence
 */
export function useLicenceStatus() {
  const [status, setStatus] = useState<{
    isValid: boolean;
    isLifetime: boolean;
    daysRemaining: number | null;
    pharmacieNom: string | null;
    plan: string | null;
  } | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const data = await licenceService.getNotifications();
        setStatus({
          isValid: data.licence_status.is_valid,
          isLifetime: data.licence_status.is_lifetime,
          daysRemaining: data.licence_status.days_remaining,
          pharmacieNom: data.licence_status.pharmacie_nom,
          plan: data.licence_status.plan,
        });
      } catch (error) {
        console.error('Erreur vérification statut licence:', error);
      }
    };

    checkStatus();
  }, []);

  return status;
}
