/**
 * Configuration globale d'Axios avec intercepteurs
 * Gère automatiquement les erreurs 401 (token expiré/invalide)
 */
import axios from 'axios';
import { toast } from 'react-hot-toast';

// Track si on a déjà montré le toast de session expirée
let hasShownExpiredToast = false;

// Intercepteur de réponse pour gérer les erreurs globalement
axios.interceptors.response.use(
    // Succès - on laisse passer
    (response) => response,

    // Erreur
    (error) => {
        const status = error.response?.status;

        // 401 Unauthorized - Token expiré ou invalide
        if (status === 401) {
            // Éviter de montrer plusieurs toasts
            if (!hasShownExpiredToast) {
                hasShownExpiredToast = true;
                toast.error('Session expirée. Veuillez vous reconnecter.', {
                    duration: 5000,
                    id: 'session-expired'
                });

                // Nettoyer la session
                sessionStorage.clear();
                delete axios.defaults.headers.common['Authorization'];

                // Rediriger vers login après un délai, UNIQUEMENT si on n'y est pas déjà
                setTimeout(() => {
                    if (!window.location.pathname.includes('/login')) {
                        window.location.href = '/login';
                    }
                }, 1500);
            }
        }

        // 403 Forbidden - Permissions insuffisantes
        else if (status === 403) {
            // Ne pas afficher de toast pour l'endpoint verify-password (géré localement)
            if (!error.config?.url?.includes('verify-password')) {
                toast.error('Accès refusé : permissions insuffisantes', {
                    id: 'access-denied'
                });
            }
        }

        // 500 Server Error
        else if (status >= 500) {
            toast.error('Erreur serveur. Réessayez plus tard.', {
                id: 'server-error'
            });
        }

        return Promise.reject(error);
    }
);

// Reset le flag quand on se reconnecte
export const resetExpiredFlag = () => {
    hasShownExpiredToast = false;
};

export default axios;
