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
        self.times: list[float] = []
        self.errors: list[str] = []
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


def fetch_product_ids(token: str, limit: int = 20, query: str = "") -> list[int]:
    headers = {"Authorization": f"Token {token}"}
    params = {"page_size": limit}
    if query:
        params["search"] = query
    resp = requests.get(PRODUITS_URL, params=params, headers=headers, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    results = data.get("results", data)
    return [p["id"] for p in results if "id" in p][:limit]


def fetch_clients(token: str, limit: int = 10, query: str = "") -> list[int]:
    headers = {"Authorization": f"Token {token}"}
    params = {"page_size": limit}
    if query:
        params["search"] = query
    resp = requests.get(f"{BASE_URL}/api/clients/", params=params, headers=headers, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    results = data.get("results", data)
    return [c["id"] for c in results if "id" in c][:limit]


def worker_search(token: str, duration: int, result: LoadTestResult):
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
        time.sleep(random.uniform(0.5, 1.5))


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
        time.sleep(random.uniform(0.8, 2.0))


def worker_finalize(token: str, product_ids: list[int], client_ids: list[int], duration: int, result: LoadTestResult, sale_price: float):
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
                    "selling_price": sale_price,
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


def run_phase(tokens: list[str], product_ids: list[int], client_ids: list[int], clients: int, duration: int, finalize_ratio: float = 0.3, sale_price: float = 1000):
    search_result = LoadTestResult()
    list_result = LoadTestResult()
    finalize_result = LoadTestResult()

    print(f"\n🔥 Phase {clients} clients / {duration}s (finalize_ratio={finalize_ratio:.0%})")
    print(f"   Produits disponibles: {len(product_ids)} | Clients: {len(client_ids)} | Tokens: {len(tokens)}")

    start = time.time()
    with ThreadPoolExecutor(max_workers=clients) as pool:
        for i in range(clients):
            token = tokens[i % len(tokens)]
            r = random.random()
            if r < finalize_ratio:
                pool.submit(worker_finalize, token, product_ids, client_ids, duration, finalize_result, sale_price)
            elif r < 0.7:
                pool.submit(worker_search, token, duration, search_result)
            else:
                pool.submit(worker_list_factures, token, duration, list_result)

    elapsed = time.time() - start
    search_result.summary("Recherche produits")
    list_result.summary("Liste factures")
    finalize_result.summary("Finaliser vente")
    total = search_result.total + list_result.total + finalize_result.total
    print(f"\n⏱️  Durée effective: {elapsed:.1f}s | RPS total: {total/elapsed:.2f}")


def run_stress_test(
    tokens: list[str],
    product_ids: list[int],
    client_ids: list[int],
    start_clients: int,
    step: int,
    max_clients: int,
    phase_duration: int,
    finalize_ratio: float,
    error_threshold: float,
    latency_threshold_ms: float,
    cooldown: int,
    sale_price: float,
):
    """
    Augmente progressivement le nombre de clients simultanés jusqu'à ce que
    le taux d'erreur ou la latence P95 dépasse un seuil critique.
    Rapporte le dernier palier "sain" et le palier de rupture.
    """
    print("\n" + "=" * 60)
    print("🧪 TEST DE VOLUMÉTRIE / MONTÉE EN CHARGE PROGRESSIVE")
    print("=" * 60)
    print(f"   Départ: {start_clients} clients | Pas: +{step} | Max: {max_clients}")
    print(f"   Durée par palier: {phase_duration}s | Refroidissement: {cooldown}s")
    print(f"   Seuils de rupture: erreurs > {error_threshold:.0%} OU P95 > {latency_threshold_ms:.0f} ms")

    last_healthy = None
    clients = start_clients

    while clients <= max_clients:
        search_result = LoadTestResult()
        list_result = LoadTestResult()
        finalize_result = LoadTestResult()

        print(f"\n🔥 Palier: {clients} clients simultanés / {phase_duration}s")
        start = time.time()
        with ThreadPoolExecutor(max_workers=clients) as pool:
            for i in range(clients):
                token = tokens[i % len(tokens)]
                r = random.random()
                if r < finalize_ratio:
                    pool.submit(worker_finalize, token, product_ids, client_ids, phase_duration, finalize_result, sale_price)
                elif r < 0.7:
                    pool.submit(worker_search, token, phase_duration, search_result)
                else:
                    pool.submit(worker_list_factures, token, phase_duration, list_result)
        elapsed = time.time() - start

        search_result.summary("Recherche produits")
        list_result.summary("Liste factures")
        finalize_result.summary("Finaliser vente")

        all_times = search_result.times + list_result.times + finalize_result.times
        total = search_result.total + list_result.total + finalize_result.total
        total_failed = search_result.failed + list_result.failed + finalize_result.failed
        error_rate = (total_failed / total) if total else 0
        p95 = sorted(all_times)[int(len(all_times) * 0.95)] * 1000 if all_times else 0

        print(f"⏱️  Palier {clients} clients: RPS={total/elapsed:.2f} | erreurs={error_rate:.1%} | P95={p95:.0f} ms")

        if error_rate > error_threshold or p95 > latency_threshold_ms:
            print("\n" + "=" * 60)
            print(f"🛑 SEUIL CRITIQUE ATTEINT à {clients} clients simultanés")
            print(f"   Taux d'erreur: {error_rate:.1%} (seuil: {error_threshold:.0%})")
            print(f"   P95: {p95:.0f} ms (seuil: {latency_threshold_ms:.0f} ms)")
            if last_healthy is not None:
                print(f"✅ Dernier palier sain: {last_healthy} clients simultanés")
            print("=" * 60)
            return

        last_healthy = clients
        clients += step
        if clients <= max_clients:
            print(f"   Refroidissement {cooldown}s avant palier suivant...")
            time.sleep(cooldown)

    print("\n" + "=" * 60)
    print(f"✅ Aucune rupture détectée jusqu'à {max_clients} clients simultanés.")
    print("   Augmentez --max-clients pour continuer à chercher le seuil critique.")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--username", default="loadtest")
    parser.add_argument("--password", default="loadtestpass123")
    parser.add_argument("--tokens-file", default=None, help="Fichier contenant des tokens (1/ligne) — un par worker round-robin, bypass le login")
    parser.add_argument("--product-query", default="", help="Filtre ?search= pour la récup des produits (ex: '[TEST]')")
    parser.add_argument("--client-query", default="", help="Filtre ?search= pour la récup des clients (ex: '[TEST]')")
    parser.add_argument("--sale-price", type=float, default=1000, help="Prix de vente envoyé dans les lignes (doit matcher selling_price du produit)")
    parser.add_argument("--clients", type=int, default=10)
    parser.add_argument("--duration", type=int, default=60)
    parser.add_argument("--finalize-ratio", type=float, default=0.3)
    parser.add_argument("--url", default="http://localhost:8000")
    parser.add_argument("--stress", action="store_true", help="Active le mode montée en charge progressive jusqu'au seuil critique")
    parser.add_argument("--start-clients", type=int, default=5, help="[stress] Nombre de clients au premier palier")
    parser.add_argument("--step", type=int, default=10, help="[stress] Incrément de clients à chaque palier")
    parser.add_argument("--max-clients", type=int, default=200, help="[stress] Nombre maximal de clients à tester")
    parser.add_argument("--phase-duration", type=int, default=30, help="[stress] Durée de chaque palier en secondes")
    parser.add_argument("--error-threshold", type=float, default=0.05, help="[stress] Taux d'erreur déclenchant la rupture (ex: 0.05 = 5%%)")
    parser.add_argument("--latency-threshold-ms", type=float, default=3000, help="[stress] Latence P95 (ms) déclenchant la rupture")
    parser.add_argument("--cooldown", type=int, default=5, help="[stress] Pause en secondes entre paliers")
    args = parser.parse_args()

    global BASE_URL, AUTH_URL, PRODUITS_URL, FACTURES_URL, FINALISER_URL
    BASE_URL = args.url
    AUTH_URL = f"{BASE_URL}/api-token-auth/"
    PRODUITS_URL = f"{BASE_URL}/api/produits/"
    FACTURES_URL = f"{BASE_URL}/api/factures/"
    FINALISER_URL = f"{BASE_URL}/api/factures/finaliser/"

    print("🚀 Test de charge backend")
    print(f"   URL: {BASE_URL}")
    if args.tokens_file:
        with open(args.tokens_file, encoding="utf-8") as f:
            tokens = [line.strip() for line in f if line.strip()]
        print(f"🔑 {len(tokens)} tokens chargés depuis {args.tokens_file}")
    else:
        print("🔑 Authentification...")
        try:
            tokens = [get_token(args.username, args.password)]
            print("   Authentifié.")
        except Exception as e:
            print(f"   Échec auth: {e}")
            sys.exit(1)

    token = tokens[0]
    print("📦 Récupération des produits et clients...")
    product_ids = fetch_product_ids(token, query=args.product_query)
    client_ids = fetch_clients(token, query=args.client_query)
    if not product_ids:
        print("   Aucun produit trouvé.")
        sys.exit(1)
    print(f"   {len(product_ids)} produits, {len(client_ids)} clients.")

    if args.stress:
        run_stress_test(
            tokens, product_ids, client_ids,
            start_clients=args.start_clients,
            step=args.step,
            max_clients=args.max_clients,
            phase_duration=args.phase_duration,
            finalize_ratio=args.finalize_ratio,
            error_threshold=args.error_threshold,
            latency_threshold_ms=args.latency_threshold_ms,
            cooldown=args.cooldown,
            sale_price=args.sale_price,
        )
    else:
        run_phase(tokens, product_ids, client_ids, args.clients, args.duration, args.finalize_ratio, args.sale_price)


if __name__ == "__main__":
    main()
