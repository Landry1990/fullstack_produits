"""Mesure le nombre de requêtes SQL par endpoint gourmand (exécuté dans le conteneur)."""
import os
import time

import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

user = get_user_model().objects.get(username='sysadmin')
client = APIClient()
client.force_authenticate(user=user)

ENDPOINTS = [
    # Dashboard
    '/api/dashboard/stats/',
    '/api/dashboard/stats_heavy/',
    '/api/dashboard/manager_stats/',
    '/api/dashboard/revenue_chart/',
    # Finance stats
    '/api/finance-stats/kpis/',
    '/api/finance-stats/top_products/',
    '/api/finance-stats/analyse_categories/',
    '/api/finance-stats/evolution_categories/',
    '/api/finance-stats/repartition_ca/',
    '/api/finance-stats/repartition_ca/?by=fournisseur',
    '/api/finance-stats/marge_par_produit/',
    '/api/finance-stats/impact_promotions/',
    '/api/finance-stats/marges_evolution/',
    '/api/finance-stats/margin_variance_analysis/',
    '/api/finance-stats/analyse_marges/',
    '/api/finance-stats/marges_evolution/',
    # Rapports
    '/api/rapports/rapport_mensuel/?mois=2026-10',
    '/api/rapports/rapport_general_excel/',
]

from django.core.cache import cache
cache.clear()

for url in ENDPOINTS:
    try:
        with CaptureQueriesContext(connection) as ctx:
            t0 = time.perf_counter()
            resp = client.get(url)
            dt = time.perf_counter() - t0
        status = resp.status_code
        ctype = resp.get('Content-Type', '')[:40]
        print(f"{len(ctx):>4} req  {dt*1000:>7.0f} ms  [{status}] {url}  ({ctype})")
    except Exception as e:
        print(f"ERR  {url}: {type(e).__name__}: {e}")
