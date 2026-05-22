#!/usr/bin/env python3
"""
Script de test de charge SIMPLIFIÉ - Simulation multi-postes caisse
Utilise requests (synchrone) - Pas besoin de aiohttp

Installation: pip install requests
Usage: python load_test_simple.py --clients 15 --duration 60
"""

import requests
import threading
import random
import time
import argparse
from datetime import datetime
from typing import List, Dict
import statistics

# Configuration
BASE_URL = "http://localhost:8000/api"
CONCURRENT_CLIENTS = 15
TEST_DURATION = 60

# Thread-safe result storage
results_lock = threading.Lock()

class LoadTestResult:
    def __init__(self):
        self.total_requests = 0
        self.successful_requests = 0
        self.failed_requests = 0
        self.response_times: List[float] = []
        self.errors: List[str] = []
        self.start_time: float = 0
        self.end_time: float = 0
        self._lock = threading.Lock()
    
    def add_result(self, success: bool, response_time: float, error: str = ""):
        with self._lock:
            self.total_requests += 1
            if success:
                self.successful_requests += 1
                self.response_times.append(response_time)
            else:
                self.failed_requests += 1
                if error:
                    self.errors.append(error)
    
    @property
    def duration(self) -> float:
        return self.end_time - self.start_time
    
    @property
    def requests_per_second(self) -> float:
        return self.total_requests / self.duration if self.duration > 0 else 0
    
    @property
    def avg_response_time(self) -> float:
        with self._lock:
            return statistics.mean(self.response_times) if self.response_times else 0
    
    @property
    def p95_response_time(self) -> float:
        with self._lock:
            if not self.response_times:
                return 0
            sorted_times = sorted(self.response_times)
            idx = int(len(sorted_times) * 0.95)
            return sorted_times[min(idx, len(sorted_times)-1)]
    
    def print_report(self):
        print("\n" + "="*70)
        print("📊 RAPPORT DE TEST DE CHARGE (Synchrone)")
        print("="*70)
        print(f"Durée totale: {self.duration:.2f}s")
        print(f"Clients simultanés: {CONCURRENT_CLIENTS}")
        print(f"\nRequêtes totales: {self.total_requests}")
        
        success_rate = self.successful_requests/max(self.total_requests, 1)*100
        print(f"✅ Succès: {self.successful_requests} ({success_rate:.1f}%)")
        print(f"❌ Échecs: {self.failed_requests} ({100-success_rate:.1f}%)")
        
        print(f"\n⚡ Performance:")
        print(f"   Requêtes/sec: {self.requests_per_second:.2f}")
        print(f"   Temps moyen: {self.avg_response_time*1000:.2f}ms")
        print(f"   Temps P95: {self.p95_response_time*1000:.2f}ms")
        
        if self.response_times:
            print(f"   Temps min: {min(self.response_times)*1000:.2f}ms")
            print(f"   Temps max: {max(self.response_times)*1000:.2f}ms")
        
        if self.errors:
            print(f"\n⚠️  Erreurs fréquentes:")
            error_counts = {}
            for err in self.errors:
                error_counts[err] = error_counts.get(err, 0) + 1
            for err, count in sorted(error_counts.items(), key=lambda x: -x[1])[:5]:
                print(f"   - {err}: {count}x")
        
        # Évaluation
        print("\n" + "="*70)
        if self.failed_requests / max(self.total_requests, 1) < 0.01 and self.avg_response_time < 0.5:
            print("🟢 EXCELLENT - Serveur très performant")
        elif self.failed_requests / max(self.total_requests, 1) < 0.05 and self.avg_response_time < 1.0:
            print("🟢 BON - Serveur stable sous charge")
        elif self.failed_requests / max(self.total_requests, 1) < 0.10 and self.avg_response_time < 2.0:
            print("🟡 ACCEPTABLE - Quelques ralentissements")
        else:
            print("🔴 CRITIQUE - Problèmes de performance détectés")
        print("="*70)


def generate_random_sale() -> Dict:
    """Génère une vente aléatoire réaliste"""
    products = [
        {"id": 1, "name": "Paracétamol 500mg", "price": 2500},
        {"id": 2, "name": "Ibuprofène 400mg", "price": 3000},
        {"id": 3, "name": "Amoxicilline 1g", "price": 8500},
        {"id": 4, "name": "Omeprazole 20mg", "price": 4200},
        {"id": 5, "name": "Vitamine C 500mg", "price": 1800},
    ]
    
    num_items = random.randint(1, 5)
    items = random.sample(products, num_items)
    
    lignes = []
    total = 0
    for item in items:
        qty = random.randint(1, 3)
        price = item["price"]
        lignes.append({
            "produit_id": item["id"],
            "quantite": qty,
            "prix_vente": price,
            "remise": 0,
            "total": price * qty
        })
        total += price * qty
    
    return {
        "client_id": random.randint(1, 50) if random.random() > 0.3 else None,
        "mode_paiement": random.choice(["especes", "carte", "cheque", "om", "momo"]),
        "lignes": lignes,
        "total_ttc": total,
        "remise_globale": 0,
        "statut": "completee"
    }


def simulate_cashier(client_id: int, result: LoadTestResult, stop_flag: threading.Event):
    """Simule un poste de caisse (thread)"""
    session = requests.Session()
    
    # Attendre un délai aléatoire pour étaler les connexions
    time.sleep(random.uniform(0, 5))
    
    print(f"✅ Caisse {client_id} démarrée")
    
    while not stop_flag.is_set():
        try:
            # Créer une vente
            sale_data = generate_random_sale()
            
            start_time = time.time()
            
            response = session.post(
                f"{BASE_URL}/factures/",
                json=sale_data,
                timeout=10
            )
            
            elapsed = time.time() - start_time
            
            if response.status_code in [200, 201]:
                result.add_result(True, elapsed)
            else:
                result.add_result(False, elapsed, f"HTTP {response.status_code}")
                
        except requests.exceptions.Timeout:
            result.add_result(False, 10.0, "Timeout")
            
        except Exception as e:
            result.add_result(False, 0.0, str(type(e).__name__))
        
        # Délai aléatoire entre 2 et 8 secondes
        time.sleep(random.uniform(2, 8))
    
    print(f"⏹️  Caisse {client_id} arrêtée")


def health_check() -> bool:
    """Vérifie que le serveur est accessible"""
    try:
        response = requests.get(f"{BASE_URL}/health/", timeout=5)
        return response.status_code == 200
    except:
        return False


def run_load_test():
    """Lance le test de charge complet"""
    result = LoadTestResult()
    stop_flag = threading.Event()
    
    print("🚀 Démarrage du test de charge SYNCHRONE...")
    print(f"   URL: {BASE_URL}")
    print(f"   Clients simultanés: {CONCURRENT_CLIENTS}")
    print(f"   Durée: {TEST_DURATION}s")
    
    # Vérifier que le serveur est up
    print("\n🔍 Vérification du serveur...")
    if not health_check():
        print("❌ Serveur non accessible !")
        print(f"   Vérifiez que le backend tourne sur {BASE_URL}")
        return
    print("✅ Serveur accessible")
    
    # Lancer les threads caisse
    print(f"\n📡 Lancement de {CONCURRENT_CLIENTS} caisses simultanées...")
    result.start_time = time.time()
    
    threads = []
    for i in range(CONCURRENT_CLIENTS):
        t = threading.Thread(
            target=simulate_cashier,
            args=(i+1, result, stop_flag)
        )
        t.daemon = True
        threads.append(t)
        t.start()
    
    # Attendre la durée du test
    print(f"⏱️  Test en cours ({TEST_DURATION}s)...")
    time.sleep(TEST_DURATION)
    
    # Arrêter les threads
    stop_flag.set()
    print("\n🛑 Arrêt des caisses...")
    
    for t in threads:
        t.join(timeout=5)
    
    result.end_time = time.time()
    
    # Afficher le rapport
    result.print_report()
    
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test de charge multi-caisses (synchrone)")
    parser.add_argument("--clients", type=int, default=15, help="Nombre de clients simultanés")
    parser.add_argument("--duration", type=int, default=60, help="Durée du test en secondes")
    parser.add_argument("--url", type=str, default="http://localhost:8000/api", 
                       help="URL de l'API (ex: http://192.168.1.100:8000/api)")
    
    args = parser.parse_args()
    
    CONCURRENT_CLIENTS = args.clients
    TEST_DURATION = args.duration
    BASE_URL = args.url
    
    try:
        run_load_test()
    except KeyboardInterrupt:
        print("\n\n⚠️ Test interrompu par l'utilisateur")
        print("Appuyez sur Ctrl+C à nouveau pour quitter immédiatement")
        time.sleep(2)
