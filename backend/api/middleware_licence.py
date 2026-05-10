from django.http import JsonResponse
from django.db import transaction, DatabaseError
from django.core.cache import cache
from api.utils_licence import valider_licence_systeme, CLE_PUBLIQUE
import logging
import jwt

logger = logging.getLogger(__name__)

# Cache TTL: 1 heure (3600 secondes) pour réduire la charge DB
LICENCE_CACHE_TTL = 3600
LICENCE_CACHE_KEY = "system_licence_validation"


class LicenceMiddleware:
    """
    Vigile de la licence système - Version optimisée.
    
    Optimisations:
    - Cache étendu à 1h (au lieu de 5min) pour réduire les requêtes DB
    - Vérification JWT légère (sans DB) si cache présent
    - Vérification complète avec DB uniquement toutes les heures
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def _verifier_licence_rapide(self):
        """
        Vérification rapide sans DB - utilise uniquement le cache et JWT.
        Retourne: (est_valide, message, payload) ou (None, None, None) si re-vérification DB nécessaire
        """
        cached_result = cache.get(LICENCE_CACHE_KEY)
        
        if cached_result is None:
            # Cache vide - re-vérification DB nécessaire
            return None, None, None
        
        # Cache présent - vérification JWT légère (sans DB)
        try:
            payload = cached_result.get('payload')
            if payload and payload.get('exp'):
                # Vérifier si le JWT est toujours valide (non expiré)
                # C'est une vérification locale sans DB
                exp_timestamp = payload.get('exp')
                from time import time
                if exp_timestamp < time():
                    # Licence expirée depuis le cache - invalider le cache
                    cache.delete(LICENCE_CACHE_KEY)
                    return None, None, None
            
            # Cache valide et JWT non expiré
            return cached_result.get('est_valide'), cached_result.get('message'), payload
            
        except Exception as e:
            logger.warning(f"[LICENCE] Erreur vérification rapide: {str(e)}")
            # En cas d'erreur, forcer re-vérification DB
            cache.delete(LICENCE_CACHE_KEY)
            return None, None, None

    def __call__(self, request):
        path = request.path_info

        # On autorise tout en mode TEST pour ne pas casser l'intégration continue
        import sys
        if 'test' in sys.argv:
            return self.get_response(request)

        # 1. On exclut les URL critiques (connexion, admin, et l'API de licence elle-même)
        # Sinon le client ne pourra même pas soumettre sa nouvelle clé !
        if (
            path.startswith('/api/licence/') or
            path.startswith('/api/users/login/') or
            path.startswith('/admin/')
        ):
            return self.get_response(request)

        # 2. Pour tout le reste de l'API, on vérifie la licence
        if path.startswith('/api/'):
            # ESSAI 1: Vérification rapide sans DB (lecture cache uniquement)
            est_valide, message, payload = self._verifier_licence_rapide()
            
            # Si le cache est vide ou invalide, faire la vérification complète avec DB
            if est_valide is None:
                try:
                    # Utiliser une transaction séparée pour isoler les erreurs DB
                    with transaction.atomic():
                        est_valide, message, payload = valider_licence_systeme()
                        
                    # Mettre en cache le résultat pour 1 heure
                    if est_valide:
                        result_dict = {
                            'est_valide': est_valide, 
                            'message': message, 
                            'payload': payload
                        }
                        cache.set(LICENCE_CACHE_KEY, result_dict, timeout=LICENCE_CACHE_TTL)
                        
                except DatabaseError as e:
                    logger.error(f"[LICENCE] Erreur DB lors de la validation: {str(e)}", exc_info=True)
                    # En cas d'erreur DB, on utilise le cache si disponible (même expiré)
                    cached_fallback = cache.get(LICENCE_CACHE_KEY)
                    if cached_fallback:
                        logger.warning("[LICENCE] Utilisation du cache fallback après erreur DB")
                        est_valide = cached_fallback.get('est_valide', False)
                        message = cached_fallback.get('message', 'Erreur DB - Cache fallback')
                        payload = cached_fallback.get('payload')
                    else:
                        # Pas de cache fallback - autoriser temporairement (fail-open)
                        logger.error("[LICENCE] Pas de cache fallback - autorisation temporaire")
                        return self.get_response(request)

            if not est_valide:
                return JsonResponse({
                    "detail": message,
                    "code_erreur": "LICENCE_INVALIDE"
                }, status=403)

            # 3. Attacher les infos de la licence à la requête
            request.licence_payload = payload

        return self.get_response(request)
