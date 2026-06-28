#!/usr/bin/env python3
"""
Test de charge ciblé du backend.
Scénario: authentification + recherche produits + liste factures + finalisation de vente.
"""

import argparse
import random
import statistics
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import List

import requests


BASE_URL = "http://localhost:8000"
AUTH_URL = f"{BASE_URL}/api-token-auth/"
PRODUITS_URL = f"{BASE_URL}/api/produits/"
FACTURES_URL = f"{BASE_URL}/api/factures/"
FINALISER_URL = f"{BASE_URL}/api/factures/finaliser/"


class LoadTestResult:
    def __init__(self):
        self.total = 0
        self.success = 0
        self.failed = 0
        self.times: List[float] = []
        self.errors: List[str] = []
        self._lock = threading.Lock()

    def record(self, ok: bool, elapsed: float, error: str = ""):
        with self._lock:
            self.total += 1
            if ok:
                self.success += 1
                self.times.append(elapsed)
            else:
                self.failed += 1
                if error:
                    self.errors.append(error)

    def summary(self, label: str):
        with self._lock:
            count = len(self.times)
            avg = statistics.mean(self.times) * 1000 if count else 0
            p95 = sorted(self.times)[int(count * 0.95)] * 1000 if count else 0
            print(f"\n--- {label} ---")
            print(f"  Requêtes: {self.total} | Succès: {self.success} | Échecs: {self.failed}")
            if count:
                print(f"  Temps moyen: {avg:.1f} ms | P95: {p95:.1f} ms | min: {min(self.times)*1000:.1f} ms | max: {max(self.times)*1000:.1f} ms")
            if self.errors:
                top = sorted({e: self.errors.count(e) for e in set(self.errors)}.items(), key=lambda x: -x[1])[:5]
                print(f"  Erreurs: {top}")


def get_token(username: str, password: str) -> str:
    resp = requests.post(AUTH_URL, json={"username": username, "password": password}, timeout=10)
    resp.raise_for_status()
    return resp.json()["token"]


def fetch_product_ids(token: str, limit: int = 20) -> List[int]:
    headers = {"Authorization": f"Token {token}"}
    resp = requests.get(PRODUITS_URL, params={"page_size": limit}, headers=headers, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    results = data.get("results", data)
    return [p["id"] for p in results if "id" in p][:limit]


def fetch_clients(token: str, limit: int = 10) -> List[int]:
    headers = {"Authorization": f"Token {token}"}
    resp = requests.get(f"{BASE_URL}/api/clients/", params={"page_size": limit}, headers=headers, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    results = data.get("results", data)
    return [c["id"] for c in results if "id" in c][:limit]


def worker_search(token: str, product_ids: List[int], duration: int, result: LoadTestResult):
    headers = {"Authorization": f"Token {token}"}
    terms = ["doli", "para", "amoxi", "vita", "500", "sirop", "comprime"]
    end = time.time() + duration
    while time.time() < end:
        try:
            start = time.time()
            term = random.choice(terms)
            resp = requests.get(PRODUITS_URL, params={"search": term}, headers=headers, timeout=10)
            elapsed = time.time() - start
            result.record(resp.status_code == 200, elapsed, f"search HTTP {resp.status_code}")
        except Exception as e:
            result.record(False, 0, str(e))


def worker_list_factures(token: str, duration: int, result: LoadTestResult):
    headers = {"Authorization": f"Token {token}"}
    end = time.time() + duration
    while time.time() < end:
        try:
            start = time.time()
            resp = requests.get(FACTURES_URL, params={"page_size": 20}, headers=headers, timeout=10)
            elapsed = time.time() - start
            result.record(resp.status_code == 200, elapsed, f"list HTTP {resp.status_code}")
        except Exception as e:
            result.record(False, 0, str(e))


def worker_finalize(token: str, product_ids: List[int], client_ids: List[int], duration: int, result: LoadTestResult):
    headers = {"Authorization": f"Token {token}", "Content-Type": "application/json"}
    end = time.time() + duration
    while time.time() < end:
        try:
            items = random.sample(product_ids, k=min(random.randint(1, 3), len(product_ids)))
            lignes = []
            for pid in items:
                lignes.append({
                    "produit": pid,
                    "quantity": random.randint(1, 3),
                    "selling_price": random.choice([500, 1000, 2500, 5000]),
                    "discount": 0,
                    "tva": 0,
                })
            payload = {
                "client": random.choice(client_ids) if client_ids else None,
                "produits": lignes,
                "mode_paiement": "especes",
                "remise": 0,
                "centralized_cash_register": True,
            }
            start = time.time()
            resp = requests.post(FINALISER_URL, json=payload, headers=headers, timeout=30)
            elapsed = time.time() - start
            result.record(resp.status_code in (200, 201), elapsed, f"finalize HTTP {resp.status_code}: {resp.text[:120]}")
        except Exception as e:
            result.record(False, 0, str(e))
        time.sleep(random.uniform(0.5, 2.0))


def run_phase(token: str, product_ids: List[int], client_ids: List[int], clients: int, duration: int, finalize_ratio: float = 0.3):
    search_result = LoadTestResult()
    list_result = LoadTestResult()
    finalize_result = LoadTestResult()

    print(f"\n🔥 Phase {clients} clients / {duration}s (finalize_ratio={finalize_ratio:.0%})")
    print(f"   Produits disponibles: {len(product_ids)} | Clients: {len(client_ids)}")

    start = time.time()
    with ThreadPoolExecutor(max_workers=clients) as pool:
        for i in range(clients):
            r = random.random()
            if r < finalize_ratio:
                pool.submit(worker_finalize, token, product_ids, client_ids, duration, finalize_result)
            elif r < 0.7:
                pool.submit(worker_search, token, product_ids, duration, search_result)
            else:
                pool.submit(worker_list_factures, token, duration, list_result)

    elapsed = time.time() - start
    search_result.summary("Recherche produits")
    list_result.summary("Liste factures")
    finalize_result.summary("Finaliser vente")
    total = search_result.total + list_result.total + finalize_result.total
    print(f"\n⏱️  Durée effective: {elapsed:.1f}s | RPS total: {total/elapsed:.2f}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--username", default="loadtest")
    parser.add_argument("--password", default="loadtestpass123")
    parser.add_argument("--clients", type=int, default=10)
    parser.add_argument("--duration", type=int, default=60)
    parser.add_argument("--finalize-ratio", type=float, default=0.3)
    parser.add_argument("--url", default="http://localhost:8000")
    args = parser.parse_args()

    global BASE_URL, AUTH_URL, PRODUITS_URL, FACTURES_URL, FINALISER_URL
    BASE_URL = args.url
    AUTH_URL = f"{BASE_URL}/api-token-auth/"
    PRODUITS_URL = f"{BASE_URL}/api/produits/"
    FACTURES_URL = f"{BASE_URL}/api/factures/"
    FINALISER_URL = f"{BASE_URL}/api/factures/finaliser/"

    print("🚀 Test de charge backend")
    print(f"   URL: {BASE_URL}")
    print("🔑 Authentification...")
    try:
        token = get_token(args.username, args.password)
        print("   Authentifié.")
    except Exception as e:
        print(f"   Échec auth: {e}")
        sys.exit(1)

    print("📦 Récupération des produits et clients...")
    product_ids = fetch_product_ids(token)
    client_ids = fetch_clients(token)
    if not product_ids:
        print("   Aucun produit trouvé.")
        sys.exit(1)
    print(f"   {len(product_ids)} produits, {len(client_ids)} clients.")

    run_phase(token, product_ids, client_ids, args.clients, args.duration, args.finalize_ratio)


if __name__ == "__main__":
    main()
