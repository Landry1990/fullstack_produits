#!/usr/bin/env python3
"""
Script pour nettoyer les données Silk et éviter les deadlocks.
À exécuter manuellement ou via cron.
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
django.setup()

from silk.models import Request, Response
from django.db import connection


def cleanup_silk_data():
    """Nettoie les anciennes données Silk pour éviter les deadlocks."""
    print("Nettoyage des données Silk...")
    
    # Compter avant
    request_count_before = Request.objects.count()
    response_count_before = Response.objects.count()
    print(f"Avant: {request_count_before} requests, {response_count_before} responses")
    
    # Garder seulement les 500 dernières requêtes
    keep_limit = 500
    
    # Supprimer les anciennes réponses d'abord (pour éviter les FK constraints)
    old_requests = Request.objects.order_by('-id')[keep_limit:]
    old_request_ids = list(old_requests.values_list('id', flat=True))
    
    if old_request_ids:
        # Supprimer d'abord les réponses associées
        deleted_responses = Response.objects.filter(request_id__in=old_request_ids).delete()
        print(f"Supprimé {deleted_responses[0]} réponses")
        
        # Puis supprimer les requêtes
        deleted_requests = Request.objects.filter(id__in=old_request_ids).delete()
        print(f"Supprimé {deleted_requests[0]} requêtes")
    
    # Compter après
    request_count_after = Request.objects.count()
    response_count_after = Response.objects.count()
    print(f"Après: {request_count_after} requests, {response_count_after} responses")
    
    # VACUUM ANALYZE pour optimiser la table
    print("Optimisation des tables...")
    with connection.cursor() as cursor:
        cursor.execute("VACUUM ANALYZE silk_request;")
        cursor.execute("VACUUM ANALYZE silk_response;")
    
    print("Nettoyage terminé !")


if __name__ == '__main__':
    cleanup_silk_data()
