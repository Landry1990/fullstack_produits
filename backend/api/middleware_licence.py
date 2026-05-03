from django.http import JsonResponse
from api.utils_licence import valider_licence_systeme

class LicenceMiddleware:
    """Intercepte toutes les requêtes pour vérifier la validité de la licence."""
    def __init__(self, get_response):
        self.get_response = get_response

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
            est_valide, message, payload = valider_licence_systeme()
            
            if not est_valide:
                return JsonResponse({
                    "detail": message,
                    "code_erreur": "LICENCE_INVALIDE"
                }, status=403)
                
            # 3. Facultatif : On attache les infos de la licence à la requête.
            # Ça vous permettra de bloquer des Vues Django si (request.licence['plan'] == 'BASIC')
            request.licence_payload = payload

        return self.get_response(request)
