#!/usr/bin/env python3
"""
Profile le endpoint /api/factures/finaliser/ : nombre de requêtes SQL et temps.
"""

import time
from collections import Counter

import requests


BASE_URL = "http://localhost:8000"
AUTH_URL = f"{BASE_URL}/api-token-auth/"
PRODUITS_URL = f"{BASE_URL}/api/produits/"
FINALISER_URL = f"{BASE_URL}/api/factures/finaliser/"


def get_token(username, password):
    r = requests.post(AUTH_URL, json={"username": username, "password": password}, timeout=10)
    r.raise_for_status()
    return r.json()["token"]


def main():
    username = "loadtest"
    password = "loadtestpass123"

    token = get_token(username, password)
    headers = {"Authorization": f"Token {token}", "Content-Type": "application/json"}

    # Récupère quelques produits
    r = requests.get(PRODUITS_URL, params={"page_size": 5}, headers=headers, timeout=10)
    r.raise_for_status()
    products = r.json().get("results", [])
    product_ids = [p["id"] for p in products]
    if not product_ids:
        print("Aucun produit")
        return

    # Construit payload
    lignes = [
        {"produit": pid, "quantity": 1, "selling_price": 1000, "discount": 0, "tva": 0}
        for pid in product_ids[:3]
    ]
    payload = {
        "client": None,
        "produits": lignes,
        "mode_paiement": "especes",
        "remise": 0,
        "centralized_cash_register": True,
    }

    # Utilise execute_wrappers pour compter les requêtes
    import os
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
    import django
    django.setup()
    from django.db import connection

    queries = []

    def wrapper(execute, sql, params, many, context):
        start = time.time()
        try:
            return execute(sql, params, many, context)
        finally:
            elapsed = time.time() - start
            queries.append((elapsed, sql))

    with connection.execute_wrapper(wrapper):
        start = time.time()
        r = requests.post(FINALISER_URL, json=payload, headers=headers, timeout=30)
        total = time.time() - start

    print(f"Status: {r.status_code}")
    print(f"Temps total: {total*1000:.1f} ms")
    print(f"Nombre de requêtes SQL: {len(queries)}")

    if queries:
        queries.sort(reverse=True)
        print("\nTop 10 requêtes les plus lentes:")
        for elapsed, sql in queries[:10]:
            print(f"  {elapsed*1000:>8.2f} ms | {sql[:120]}")

        # Compte par type
        counters = Counter()
        for _, sql in queries:
            first = sql.strip().split()[0].upper()
            counters[first] += 1
        print(f"\nRépartition: {dict(counters)}")


if __name__ == "__main__":
    main()
