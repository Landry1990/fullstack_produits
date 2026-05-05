"""
Middleware pour autoriser automatiquement les requêtes depuis les IPs privées (réseau local).
Cela évite d'avoir à configurer ALLOWED_HOSTS pour chaque IP du réseau.
"""

import ipaddress
import os
from django.conf import settings


def is_private_ip(ip_str):
    """Vérifie si une IP est privée (réseau local)"""
    try:
        ip = ipaddress.ip_address(ip_str.split(':')[0])  # Enlever le port si présent
        return ip.is_private
    except ValueError:
        return False


class AllowPrivateIPsMiddleware:
    """
    Autorise les requêtes depuis les IPs privées sans vérification stricte.
    Utile pour le réseau local (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
        # Initialiser la liste dynamique une seule fois
        if not hasattr(settings, '_DYNAMIC_ALLOWED_HOSTS'):
            settings._DYNAMIC_ALLOWED_HOSTS = set(settings.ALLOWED_HOSTS)
    
    def __call__(self, request):
        # Récupérer le host directement depuis les headers (sans validation)
        http_host = request.META.get('HTTP_HOST', '')
        if http_host:
            host = http_host.split(':')[0]  # Enlever le port
            
            # Ajouter automatiquement aux ALLOWED_HOSTS si c'est une IP privée
            if is_private_ip(host):
                if host not in settings._DYNAMIC_ALLOWED_HOSTS:
                    settings._DYNAMIC_ALLOWED_HOSTS.add(host)
                    # Mettre à jour ALLOWED_HOSTS
                    settings.ALLOWED_HOSTS = list(settings._DYNAMIC_ALLOWED_HOSTS)
        
        response = self.get_response(request)
        return response
