#!/usr/bin/env python3
"""
Test de CHAOS NETWORK - Simulation de problèmes réseau/lenteurs

Teste la résilience du système face à:
- Latences élevées (réseau lent)
- Perte de connexion intermittente
- Timeouts fréquents
- Réponses partielles
- Déconnexion brutale

Usage: python network_chaos_test.py --chaos-level medium --duration 120
"""

import requests
import threading
import random
import time
import argparse
from enum import Enum
from typing import Dict, Optional
import statistics
from dataclasses import dataclass, field
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8000/api"
DEFAULT_USERNAME = "admin"
DEFAULT_PASSWORD = "admin123"


class ChaosLevel(Enum):
    NONE = "none"           # Pas de chaos (test normal)
    LOW = "low"             # 10% de requêtes affectées
    MEDIUM = "medium"       # 30% de requêtes affectées
    HIGH = "high"           # 60% de requêtes affectées
    EXTREME = "extreme"     # 90% de requêtes affectées


@dataclass
class ChaosEvent:
    """Événement de chaos réseau"""
    name: str
    description: str
    probability: float  # 0.0 - 1.0
    min_delay: float    # secondes
    max_delay: float    # secondes


# Types de chaos disponibles
CHAOS_EVENTS = {
    "latency": ChaosEvent(
        name="Latence élevée",
        description="Ajoute un délai artificiel avant la requête",
        probability=0.4,
        min_delay=0.5,
        max_delay=3.0
    ),
    "timeout": ChaosEvent(
        name="Timeout simulé",
        description="Force un timeout en attendant trop longtemps",
        probability=0.2,
        min_delay=0,
        max_delay=0
    ),
    "connection_error": ChaosEvent(
        name="Erreur connexion",
        description="Simule une déconnexion réseau",
        probability=0.15,
        min_delay=0,
        max_delay=0
    ),
    "partial_response": ChaosEvent(
        name="Réponse partielle",
        description="Réponse tronquée/incomplète",
        probability=0.15,
        min_delay=0.1,
        max_delay=0.5
    ),
    "jitter": ChaosEvent(
        name="Jitter réseau",
        description="Variations de latence aléatoires",
        probability=0.3,
        min_delay=0.1,
        max_delay=1.0
    ),
}


class ResilienceTestResult:
    """Résultats du test de résilience"""
    def __init__(self):
        self.total_requests = 0
        self.successful_requests = 0
        self.failed_requests = 0
        self.retried_requests = 0
        self.chaos_events_triggered = 0
        
        self.response_times: list = []
        self.errors_by_type: Dict[str, int] = {}
        self.recovery_times: list = []
        
        self.start_time: float = 0
        self.end_time: float = 0
        
        self._lock = threading.Lock()
    
    def add_result(self, success: bool, response_time: float, error_type: str = "",
                   retried: bool = False, chaos_triggered: bool = False):
        with self._lock:
            self.total_requests += 1
            if success:
                self.successful_requests += 1
                self.response_times.append(response_time)
            else:
                self.failed_requests += 1
                if error_type:
                    self.errors_by_type[error_type] = self.errors_by_type.get(error_type, 0) + 1
            
            if retried:
                self.retried_requests += 1
            if chaos_triggered:
                self.chaos_events_triggered += 1
    
    def add_recovery_time(self, recovery_time: float):
        with self._lock:
            self.recovery_times.append(recovery_time)
    
    @property
    def duration(self) -> float:
        return self.end_time - self.start_time
    
    @property
    def success_rate(self) -> float:
        return (self.successful_requests / max(self.total_requests, 1)) * 100
    
    @property
    def avg_response_time(self) -> float:
        with self._lock:
            return statistics.mean(self.response_times) if self.response_times else 0
    
    def print_report(self):
        print("\n" + "="*80)
        print("🌪️  RAPPORT TEST DE CHAOS RÉSEAU")
        print("="*80)
        print(f"Durée: {self.duration:.2f}s | Requêtes: {self.total_requests}")
        print(f"\n📊 Résilience:")
        print(f"   ✅ Succès: {self.successful_requests} ({self.success_rate:.1f}%)")
        print(f"   ❌ Échecs: {self.failed_requests} ({100-self.success_rate:.1f}%)")
        print(f"   🔄 Retry: {self.retried_requests}")
        print(f"   ⚡ Chaos déclenché: {self.chaos_events_triggered}x")
        
        if self.response_times:
            sorted_times = sorted(self.response_times)
            print(f"\n⏱️  Temps de réponse (sans chaos):")
            print(f"   Moyenne: {statistics.mean(sorted_times)*1000:.0f}ms")
            print(f"   P50: {sorted_times[len(sorted_times)//2]*1000:.0f}ms")
            print(f"   P95: {sorted_times[int(len(sorted_times)*0.95)]*1000:.0f}ms")
            print(f"   Max: {max(sorted_times)*1000:.0f}ms")
        
        if self.errors_by_type:
            print(f"\n⚠️  Erreurs par type:")
            for error, count in sorted(self.errors_by_type.items(), key=lambda x: -x[1]):
                print(f"   - {error}: {count}x")
        
        # Évaluation résilience
        print("\n" + "="*80)
        if self.success_rate > 95:
            print("🟢 EXCELLENT - Système très résilient")
            print("   Le backend gère parfaitement les problèmes réseau")
        elif self.success_rate > 80:
            print("🟢 BON - Système résilient")
            print("   Quelques échecs mais récupération efficace")
        elif self.success_rate > 60:
            print("🟡 MOYEN - Résilience limitée")
            print("   Problèmes de récupération, à améliorer")
        else:
            print("🔴 FAIBLE - Système fragile")
            print("   Les erreurs réseau causent beaucoup d'échecs")
        print("="*80)


class ChaosInjector:
    """Injecteur de chaos réseau"""
    def __init__(self, level: ChaosLevel):
        self.level = level
        self.chaos_probability = {
            ChaosLevel.NONE: 0.0,
            ChaosLevel.LOW: 0.1,
            ChaosLevel.MEDIUM: 0.3,
            ChaosLevel.HIGH: 0.6,
            ChaosLevel.EXTREME: 0.9,
        }[level]
    
    def should_trigger_chaos(self) -> bool:
        return random.random() < self.chaos_probability
    
    def inject_chaos(self, event_name: str) -> Optional[ChaosEvent]:
        """Injecte un événement de chaos si le niveau le permet"""
        if not self.should_trigger_chaos():
            return None
        
        event = CHAOS_EVENTS.get(event_name)
        if not event or random.random() > event.probability:
            return None
        
        return event
    
    def apply_latency(self, event: ChaosEvent):
        """Applique une latence artificielle"""
        delay = random.uniform(event.min_delay, event.max_delay)
        print(f"   🐌 Latence simulée: {delay:.2f}s")
        time.sleep(delay)
        return delay


def login_with_retry(session: requests.Session, username: str, password: str,
                     chaos: ChaosInjector, result: ResilienceTestResult) -> bool:
    """Login avec gestion du chaos et retry"""
    max_retries = 3
    
    for attempt in range(max_retries):
        try:
            # Vérifier si on injecte du chaos
            chaos_event = chaos.inject_chaos("latency")
            if chaos_event:
                chaos.apply_latency(chaos_event)
                result.chaos_events_triggered += 1
            
            # Tentative de connexion
            start = time.time()
            resp = session.post(
                f"{BASE_URL}/auth/token/",
                json={"username": username, "password": password},
                timeout=30
            )
            elapsed = time.time() - start
            
            if resp.status_code == 200:
                data = resp.json()
                token = data.get("token")
                if token:
                    session.headers.update({"Authorization": f"Token {token}"})
                    print(f"   ✅ Connecté (tentative {attempt + 1})")
                    result.add_result(True, elapsed, retried=(attempt > 0))
                    return True
            
            # Échec HTTP
            if resp.status_code in [400, 401]:
                print(f"   ❌ Credentials invalides")
                return False
                
        except requests.exceptions.Timeout:
            print(f"   ⏱️  Timeout (tentative {attempt + 1})")
            result.add_result(False, 30, "timeout", retried=(attempt > 0), chaos_triggered=True)
            
        except requests.exceptions.ConnectionError:
            print(f"   🔌 Connexion perdue (tentative {attempt + 1})")
            result.add_result(False, 0, "connection_error", retried=(attempt > 0), chaos_triggered=True)
            
        except Exception as e:
            print(f"   ❌ Erreur: {type(e).__name__}")
            result.add_result(False, 0, type(e).__name__, retried=(attempt > 0))
        
        # Attendre avant retry
        if attempt < max_retries - 1:
            wait_time = min(2 ** attempt, 10)  # Exponential backoff
            print(f"   ⏳ Retry dans {wait_time}s...")
            time.sleep(wait_time)
    
    return False


def make_request_with_chaos(session: requests.Session, method: str, url: str,
                              chaos: ChaosInjector, result: ResilienceTestResult,
                              json_data: Optional[dict] = None, timeout: int = 30) -> Optional[requests.Response]:
    """Effectue une requête avec injection de chaos potentielle"""
    
    # 1. Vérifier si on injecte de la latence avant la requête
    chaos_event = chaos.inject_chaos("latency") or chaos.inject_chaos("jitter")
    if chaos_event:
        chaos.apply_latency(chaos_event)
        chaos_triggered = True
    else:
        chaos_triggered = False
    
    # 2. Vérifier si on simule une erreur de connexion
    if chaos.inject_chaos("connection_error"):
        print(f"   🔌 Simulation perte connexion")
        result.add_result(False, 0, "simulated_connection_error", chaos_triggered=True)
        return None
    
    # 3. Vérifier si on simule un timeout
    if chaos.inject_chaos("timeout"):
        print(f"   ⏱️  Simulation timeout")
        time.sleep(timeout + 0.5)  # Force le timeout
        result.add_result(False, timeout, "simulated_timeout", chaos_triggered=True)
        return None
    
    # Effectuer la requête réelle
    start = time.time()
    try:
        if method == "GET":
            resp = session.get(url, timeout=timeout)
        elif method == "POST":
            resp = session.post(url, json=json_data, timeout=timeout)
        elif method == "PATCH":
            resp = session.patch(url, json=json_data, timeout=timeout)
        else:
            resp = session.get(url, timeout=timeout)
        
        elapsed = time.time() - start
        
        # Simuler une réponse partielle
        if chaos.inject_chaos("partial_response") and random.random() < 0.5:
            print(f"   📄 Réponse partielle simulée")
            result.add_result(False, elapsed, "partial_response", chaos_triggered=True)
            return None
        
        # Succès
        success = resp.status_code in [200, 201, 204]
        error_type = "" if success else f"http_{resp.status_code}"
        result.add_result(success, elapsed, error_type, chaos_triggered=chaos_triggered)
        
        return resp if success else None
        
    except requests.exceptions.Timeout:
        result.add_result(False, timeout, "timeout", chaos_triggered=chaos_triggered)
        return None
    except requests.exceptions.ConnectionError:
        result.add_result(False, 0, "connection_error", chaos_triggered=chaos_triggered)
        return None
    except Exception as e:
        result.add_result(False, 0, type(e).__name__, chaos_triggered=chaos_triggered)
        return None


def simulate_chaos_user(user_id: int, scenario: str, chaos: ChaosInjector,
                       result: ResilienceTestResult, stop_flag: threading.Event,
                       username: str, password: str):
    """Simule un utilisateur avec injection de chaos"""
    session = requests.Session()
    
    print(f"🧪 Utilisateur {user_id} - Niveau chaos: {chaos.level.value}")
    
    # Connexion avec retry et chaos
    if not login_with_retry(session, username, password, chaos, result):
        print(f"❌ Utilisateur {user_id}: Abandon après échec login")
        return
    
    operations_count = 0
    while not stop_flag.is_set():
        operations_count += 1
        
        # Choisir une opération aléatoire
        op = random.choice(["sale", "search", "product", "client"])
        
        try:
            if op == "sale":
                url = f"{BASE_URL}/factures/"
                data = {
                    "mode_paiement": random.choice(["especes", "carte"]),
                    "lignes": [{"produit_id": 1, "quantite": 1, "prix_vente": 2500, "total": 2500}],
                    "total_ttc": 2500,
                    "statut": "completee"
                }
                make_request_with_chaos(session, "POST", url, chaos, result, data)
                
            elif op == "search":
                url = f"{BASE_URL}/omnisearch/?q=para&limit=5"
                make_request_with_chaos(session, "GET", url, chaos, result)
                
            elif op == "product":
                product_id = random.randint(1, 50)
                url = f"{BASE_URL}/produits/{product_id}/"
                make_request_with_chaos(session, "GET", url, chaos, result)
                
            elif op == "client":
                url = f"{BASE_URL}/clients/"
                data = {
                    "name": f"Test {random.randint(1000, 9999)}",
                    "phone": f"77{random.randint(100000, 999999)}"
                }
                make_request_with_chaos(session, "POST", url, chaos, result, data)
        
        except Exception as e:
            print(f"   💥 Exception non gérée: {e}")
        
        # Délai entre opérations
        time.sleep(random.uniform(1, 3))
    
    print(f"⏹️  Utilisateur {user_id} terminé ({operations_count} opérations)")


def run_chaos_test(chaos_level: ChaosLevel, duration: int, clients: int):
    """Lance le test de chaos"""
    chaos = ChaosInjector(chaos_level)
    result = ResilienceTestResult()
    stop_flag = threading.Event()
    
    print("🌪️  TEST DE CHAOS RÉSEAU")
    print("="*80)
    print(f"Niveau de chaos: {chaos_level.value.upper()}")
    print(f"Probabilité d'intervention: {chaos.chaos_probability * 100:.0f}%")
    print(f"Utilisateurs: {clients} | Durée: {duration}s")
    print("="*80)
    
    # Afficher les types de chaos actifs
    print("\n🎲 Types de chaos injectés:")
    for name, event in CHAOS_EVENTS.items():
        print(f"   • {event.name}: {event.probability * 100:.0f}% de chances")
    
    # Vérification serveur
    print("\n🔍 Vérification serveur (sans chaos)...")
    try:
        test_session = requests.Session()
        resp = test_session.post(
            f"{BASE_URL}/auth/token/",
            json={"username": DEFAULT_USERNAME, "password": DEFAULT_PASSWORD},
            timeout=30
        )
        if resp.status_code == 200:
            print("✅ Serveur accessible et authentification OK")
        else:
            print(f"⚠️  Serveur accessible mais auth retourne {resp.status_code}")
    except Exception as e:
        print(f"❌ Serveur non accessible: {e}")
        print("   Impossible de lancer le test.")
        return
    
    # Lancement du test
    print(f"\n📡 Lancement de {clients} utilisateurs avec chaos...")
    print("="*80)
    result.start_time = time.time()
    
    threads = []
    for i in range(clients):
        t = threading.Thread(
            target=simulate_chaos_user,
            args=(i+1, "mixed", chaos, result, stop_flag, DEFAULT_USERNAME, DEFAULT_PASSWORD)
        )
        t.daemon = True
        threads.append(t)
        t.start()
        time.sleep(0.5)  # Décaler légèrement les démarrages
    
    # Attente
    print(f"⏱️  Test en cours ({duration}s)...")
    time.sleep(duration)
    
    # Arrêt
    stop_flag.set()
    print("\n🛑 Arrêt des utilisateurs...")
    
    for t in threads:
        t.join(timeout=5)
    
    result.end_time = time.time()
    
    # Rapport
    print("\n" + "="*80)
    result.print_report()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Test de résilience réseau (Chaos Engineering)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Niveaux de chaos:
  none     - Pas de chaos (test de référence)
  low      - 10%% des requêtes affectées (tests basiques)
  medium   - 30%% des requêtes affectés (simulation réaliste)
  high     - 60%% des requêtes affectés (stress test)
  extreme  - 90%% des requêtes affectés (test destruction)

Exemples:
  # Test basique
  python network_chaos_test.py --chaos-level medium --duration 60
  
  # Test extrême pour tester les limites
  python network_chaos_test.py --chaos-level extreme --clients 5 --duration 120
  
  # Test sans chaos (baseline)
  python network_chaos_test.py --chaos-level none --duration 30
        """
    )
    
    parser.add_argument("--chaos-level", type=str, default="medium",
                       choices=["none", "low", "medium", "high", "extreme"],
                       help="Niveau d'intervention du chaos")
    parser.add_argument("--clients", type=int, default=3,
                       help="Nombre d'utilisateurs simultanés")
    parser.add_argument("--duration", type=int, default=60,
                       help="Durée du test en secondes")
    parser.add_argument("--url", type=str, default="http://localhost:8000/api",
                       help="URL de l'API")
    parser.add_argument("--username", type=str, default="admin",
                       help="Nom d'utilisateur")
    parser.add_argument("--password", type=str, default="admin123",
                       help="Mot de passe")
    
    args = parser.parse_args()
    
    # Configuration
    BASE_URL = args.url
    DEFAULT_USERNAME = args.username
    DEFAULT_PASSWORD = args.password
    
    chaos_level = ChaosLevel(args.chaos_level)
    
    try:
        run_chaos_test(chaos_level, args.duration, args.clients)
    except KeyboardInterrupt:
        print("\n\n⚠️ Test interrompu par l'utilisateur")
