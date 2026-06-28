#!/usr/bin/env python3
"""
Profile le endpoint finaliser avec DEBUG=True pour capturer les requêtes SQL.
"""
import json
import time
from collections import Counter

from django.core.management.base import BaseCommand
from django.test import Client
from django.contrib.auth.models import User
from django.conf import settings
from django.db import connection
from django.utils import timezone

from api.models import PosteCaisse, SessionCaisse, Produit


class Command(BaseCommand):
    help = "Profile le endpoint /api/factures/finaliser/"

    def add_arguments(self, parser):
        parser.add_argument("--username", default="loadtest")
        parser.add_argument("--products", type=int, default=3)

    def handle(self, *args, **options):
        settings.DEBUG = True
        connection.queries_log.clear()

        username = options["username"]
        user = User.objects.get(username=username)
        if not SessionCaisse.objects.filter(est_active=True).exists():
            poste, _ = PosteCaisse.objects.get_or_create(nom="TEST-CAISSE", code="TEST01")
            SessionCaisse.objects.get_or_create(poste=poste, ouvert_par=user, est_active=True, defaults={"fond_de_caisse": 0})

        produits = list(Produit.objects.all()[:options["products"]])
        if not produits:
            self.stdout.write(self.style.ERROR("Aucun produit en base"))
            return

        lignes = [
            {
                "produit": p.id,
                "quantity": 1,
                "selling_price": 1000,
                "discount": 0,
                "tva": 0,
            }
            for p in produits
        ]
        payload = {
            "client": None,
            "produits": lignes,
            "mode_paiement": "especes",
            "remise": 0,
            "centralized_cash_register": True,
        }

        client = Client()
        client.force_login(user)

        start = time.time()
        response = client.post(
            "/api/factures/finaliser/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        total = time.time() - start

        queries = connection.queries
        self.stdout.write(f"Status: {response.status_code}")
        self.stdout.write(f"Temps total: {total*1000:.1f} ms")
        self.stdout.write(f"Nombre de requêtes SQL: {len(queries)}")

        if queries:
            by_time = sorted(queries, key=lambda q: float(q["time"]), reverse=True)
            self.stdout.write("\nTop 10 requêtes les plus lentes:")
            for q in by_time[:10]:
                self.stdout.write(f"  {float(q['time'])*1000:>8.2f} ms | {q['sql'][:120]}")

            counters = Counter(q["sql"].strip().split()[0].upper() for q in queries)
            self.stdout.write(f"\nRépartition: {dict(counters)}")
