import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

/**
 * Vérifie les permissions métier (can_*) de l'utilisateur courant.
 *
 * Le contexte auth ne stocke qu'un sous-ensemble des flags en localStorage ;
 * les permissions non persistées (can_manage_perimes, can_cancel_invoice…)
 * sont récupérées via users/me/ (profil complet, caché 5 min).
 * Les superusers ont toujours tous les droits.
 */
export function usePermissions() {
  const { user } = useAuth();

  const { data } = useQuery({
    // Clé par utilisateur : sinon un second login (sans rechargement)
    // hérite des permissions du précédent pendant la durée du staleTime.
    queryKey: ['me-permissions', user?.id],
    queryFn: async () => (await api.get('users/me/')).data,
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const remoteProfile = (data?.profile ?? {}) as Record<string, unknown>;
  const localUser = (user ?? {}) as Record<string, unknown>;
  const localProfile = (user?.profile ?? {}) as Record<string, unknown>;

  const hasPerm = (key: string): boolean =>
    !!user?.is_superuser ||
    localUser[key] === true ||
    localProfile[key] === true ||
    remoteProfile[key] === true;

  return { hasPerm };
}
