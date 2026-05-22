#!/usr/bin/env python3
"""
Script de test de charge - Simulation multi-postes caisse
Teste les limites du serveur avec envois simultanés

Usage: python load_test.py --clients 15 --duration 60 --ramp-up 10
"""

import asyncio
import aiohttp
import random
import string
import time
import argparse
from datetime import datetime
from typing import List, Dict
import statistics

# Configuration
BASE_URL = "http://localhost:8000/api"
CONCURRENT_CLIENTS = 15  # Simuler 15 postes caisse
TEST_DURATION = 60  # secondes
RAMP_UP_TIME = 10  # secondes pour monter progressivement

class LoadTestResult:
    def __init__(self):
        self.total_requests = 0
        self.successful_requests = 0
        self.failed_requests = 0
        self.response_times: List[float] = []
        self.errors: List[str] = []
        self.start_time: float = 0
        self.end_time: float = 0
    
    @property
    def duration(self) -> float:
        return self.end_time - self.start_time
    
    @property
    def requests_per_second(self) -> float:
        return self.total_requests / self.duration if self.duration > 0 else 0
    
    @property
    def avg_response_time(self) -> float:
        return statistics.mean(self.response_times) if self.response_times else 0
    
    @property
    def p95_response_time(self) -> float:
        if not self.response_times:
            return 0
        sorted_times = sorted(self.response_times)
        idx = int(len(sorted_times) * 0.95)
        return sorted_times[idx]
    
    def print_report(self):
        print("\n" + "="*70)
        print("📊 RAPPORT DE TEST DE CHARGE")
        print("="*70)
        print(f"Durée totale: {self.duration:.2f}s")
        print(f"Clients simultanés: {CONCURRENT_CLIENTS}")
        print(f"\nRequêtes totales: {self.total_requests}")
        print(f"✅ Succès: {self.successful_requests} ({self.successful_requests/self.total_requests*100:.1f}%)")
        print(f"❌ Échecs: {self.failed_requests} ({self.failed_requests/self.total_requests*100:.1f}%)")
        print(f"\n⚡ Performance:")
        print(f"   Requêtes/sec: {self.requests_per_second:.2f}")
        print(f"   Temps moyen: {self.avg_response_time*1000:.2f}ms")
        print(f"   Temps P95: {self.p95_response_time*1000:.2f}ms")
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


async def simulate_cashier(client_id: int, session: aiohttp.ClientSession, 
                          result: LoadTestResult, stop_event: asyncio.Event):
    """Simule un poste de caisse"""
    # Attendre le ramp-up pour éviter le thundering herd
    await asyncio.sleep(random.uniform(0, RAMP_UP_TIME))
    
    while not stop_event.is_set():
        try:
            # Créer une vente
            sale_data = generate_random_sale()
            
            start_time = time.time()
            
            async with session.post(
                f"{BASE_URL}/factures/",
                json=sale_data,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                
                elapsed = time.time() - start_time
                result.response_times.append(elapsed)
                result.total_requests += 1
                
                if response.status in [200, 201]:
                    result.successful_requests += 1
                else:
                    result.failed_requests += 1
                    result.errors.append(f"HTTP {response.status}")
                    
        except asyncio.TimeoutError:
            result.total_requests += 1
            result.failed_requests += 1
            result.errors.append("Timeout")
            
        except Exception as e:
            result.total_requests += 1
            result.failed_requests += 1
            result.errors.append(str(type(e).__name__))
        
        # Délai aléatoire entre 2 et 8 secondes (simulation réelle)
        await asyncio.sleep(random.uniform(2, 8))


async def health_check(session: aiohttp.ClientSession) -> bool:
    """Vérifie que le serveur est accessible"""
    try:
        async with session.get(f"{BASE_URL}/health/", timeout=5) as response:
            return response.status == 200
    except:
        return False


async def run_load_test():
    """Lance le test de charge complet"""
    result = LoadTestResult()
    stop_event = asyncio.Event()
    
    print("🚀 Démarrage du test de charge...")
    print(f"   URL: {BASE_URL}")
    print(f"   Clients simultanés: {CONCURRENT_CLIENTS}")
    print(f"   Durée: {TEST_DURATION}s")
    print(f"   Ramp-up: {RAMP_UP_TIME}s")
    
    async with aiohttp.ClientSession() as session:
        # Vérifier que le serveur est up
        print("\n🔍 Vérification du serveur...")
        if not await health_check(session):
            print("❌ Serveur non accessible !")
            return
        print("✅ Serveur accessible")
        
        # Lancer les clients
        print(f"\n📡 Lancement de {CONCURRENT_CLIENTS} caisses simultanées...")
        result.start_time = time.time()
        
        tasks = [
            simulate_cashier(i, session, result, stop_event)
            for i in range(CONCURRENT_CLIENTS)
        ]
        
        # Attendre la durée du test
        timer_task = asyncio.create_task(asyncio.sleep(TEST_DURATION))
        
        async def stop_after_timeout():
            await timer_task
            stop_event.set()
        
        await asyncio.gather(
            *tasks,
            stop_after_timeout()
        )
        
        result.end_time = time.time()
    
    # Afficher le rapport
    result.print_report()
    
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test de charge multi-caisses")
    parser.add_argument("--clients", type=int, default=15, help="Nombre de clients simultanés")
    parser.add_argument("--duration", type=int, default=60, help="Durée du test en secondes")
    parser.add_argument("--ramp-up", type=int, default=10, help="Temps de montée en charge")
    parser.add_argument("--url", type=str, default="http://localhost:8000/api", help="URL de l'API")
    
    args = parser.parse_args()
    
    CONCURRENT_CLIENTS = args.clients
    TEST_DURATION = args.duration
    RAMP_UP_TIME = args.ramp_up
    BASE_URL = args.url
    
    # Lancer le test
    asyncio.run(run_load_test())
