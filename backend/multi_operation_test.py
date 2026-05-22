#!/usr/bin/env python3
"""
Test de charge MULTI-OPERATIONS - Simulation parallèle de différentes activités

Teste simultanément:
- Ventes caisse (factures)
- Recherches omnisearch
- Mises à jour stock
- Consultations rapports
- Créations clients
- etc.

Usage: python multi_operation_test.py --scenario mixed --clients 20 --duration 120
"""

import requests
import threading
import random
import time
import argparse
from enum import Enum
from typing import List, Dict, Callable
import statistics
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8000/api"
CONCURRENT_CLIENTS = 20
TEST_DURATION = 120

# Credentials pour authentification (à adapter selon ton système)
DEFAULT_USERNAME = "admin"
DEFAULT_PASSWORD = "admin123"

class OperationType(Enum):
    SALE = "sale"                    # Création facture
    SEARCH = "search"                # Recherche omnisearch
    STOCK_UPDATE = "stock"           # Mise à jour stock
    CLIENT_CREATE = "client"         # Création client
    REPORT_VIEW = "report"           # Consultation rapport
    PRODUCT_VIEW = "product"         # Vue produit détail

class LoadTestResult:
    def __init__(self):
        self.by_operation: Dict[str, Dict] = {
            op.value: {
                "total": 0,
                "success": 0,
                "failed": 0,
                "times": [],
                "errors": []
            }
            for op in OperationType
        }
        self.total_requests = 0
        self._lock = threading.Lock()
        self.start_time: float = 0
        self.end_time: float = 0
    
    def add_result(self, op_type: str, success: bool, response_time: float, error: str = ""):
        with self._lock:
            self.total_requests += 1
            self.by_operation[op_type]["total"] += 1
            if success:
                self.by_operation[op_type]["success"] += 1
                self.by_operation[op_type]["times"].append(response_time)
            else:
                self.by_operation[op_type]["failed"] += 1
                if error:
                    self.by_operation[op_type]["errors"].append(error)
    
    def print_report(self):
        duration = self.end_time - self.start_time
        print("\n" + "="*80)
        print("📊 RAPPORT TEST MULTI-OPERATIONS")
        print("="*80)
        print(f"Durée: {duration:.2f}s | Clients: {CONCURRENT_CLIENTS} | Requêtes totales: {self.total_requests}")
        print(f"RPS Global: {self.total_requests/duration:.2f}")
        
        print("\n📋 Détail par type d'opération:")
        print("-"*80)
        print(f"{'Opération':<20} {'Total':>8} {'Succès':>8} {'%OK':>8} {'Échecs':>8} {'Tps moy':>10} {'Tps P95':>10}")
        print("-"*80)
        
        for op_type, data in self.by_operation.items():
            if data["total"] == 0:
                continue
                
            success_rate = data["success"] / data["total"] * 100
            times = sorted(data["times"])
            avg_time = statistics.mean(times) * 1000 if times else 0
            p95_time = times[int(len(times)*0.95)] * 1000 if times else 0
            
            status = "🟢" if success_rate > 95 and avg_time < 500 else "🟡" if success_rate > 90 else "🔴"
            
            print(f"{status} {op_type:<18} {data['total']:>8} {data['success']:>8} {success_rate:>7.1f}% {data['failed']:>8} {avg_time:>9.1f}ms {p95_time:>9.1f}ms")
        
        print("-"*80)
        
        # Erreurs fréquentes
        all_errors = []
        for data in self.by_operation.values():
            all_errors.extend(data["errors"])
        
        if all_errors:
            print("\n⚠️  Erreurs fréquentes:")
            error_counts = {}
            for err in all_errors[:20]:  # Limiter l'affichage
                error_counts[err] = error_counts.get(err, 0) + 1
            for err, count in sorted(error_counts.items(), key=lambda x: -x[1])[:5]:
                print(f"   - {err}: {count}x")
        
        # Évaluation globale
        print("\n" + "="*80)
        total_success = sum(d["success"] for d in self.by_operation.values())
        total_ops = sum(d["total"] for d in self.by_operation.values())
        global_rate = total_success / total_ops * 100 if total_ops > 0 else 0
        
        if global_rate > 98:
            print("🟢 EXCELLENT - Toutes les opérations sont stables")
        elif global_rate > 95:
            print("🟢 BON - Performances acceptables pour la production")
        elif global_rate > 90:
            print("🟡 MOYEN - Quelques problèmes à surveiller")
        else:
            print("🔴 CRITIQUE - Instabilité majeure détectée")
        print("="*80)

# =============================================================================
# SCÉNARIOS DE TEST
# =============================================================================

def login(session: requests.Session, username: str, password: str) -> bool:
    """Authentification et récupération du token DRF avec retry"""
    max_retries = 3
    for attempt in range(max_retries):
        try:
            print(f"   🔐 Login tentative {attempt + 1}/{max_retries}...")
            resp = session.post(
                f"{BASE_URL}/auth/token/",
                json={"username": username, "password": password},
                timeout=30  # Timeout augmenté car backend lent
            )
            if resp.status_code == 200:
                data = resp.json()
                token = data.get("token")
                if token:
                    session.headers.update({"Authorization": f"Token {token}"})
                    print(f"   ✅ Connecté en tant que {username}")
                    return True
                else:
                    print(f"   ⚠️  Pas de token: {list(data.keys())}")
                    return False
            else:
                print(f"   ❌ HTTP {resp.status_code}")
                try:
                    err = resp.json()
                    print(f"      {err}")
                except:
                    pass
                if resp.status_code == 400:
                    return False  # Mauvais credentials, ne pas retry
        except requests.exceptions.Timeout:
            print(f"   ⏱️  Timeout (tentative {attempt + 1})")
            if attempt < max_retries - 1:
                time.sleep(2)
        except Exception as e:
            print(f"   ❌ Erreur: {e}")
            if attempt < max_retries - 1:
                time.sleep(1)
    return False


def make_sale(session: requests.Session, result: LoadTestResult):
    """Créer une vente aléatoire"""
    products = [
        {"id": 1, "price": 2500}, {"id": 2, "price": 3000},
        {"id": 3, "price": 8500}, {"id": 4, "price": 4200},
        {"id": 5, "price": 1800}, {"id": 6, "price": 5600},
    ]
    
    num_items = random.randint(1, 4)
    items = random.sample(products, num_items)
    
    lignes = []
    total = 0
    for item in items:
        qty = random.randint(1, 3)
        lignes.append({
            "produit_id": item["id"],
            "quantite": qty,
            "prix_vente": item["price"],
            "remise": 0,
            "total": item["price"] * qty
        })
        total += item["price"] * qty
    
    data = {
        "client_id": random.randint(1, 50) if random.random() > 0.3 else None,
        "mode_paiement": random.choice(["especes", "carte", "om", "momo"]),
        "lignes": lignes,
        "total_ttc": total,
        "statut": "completee"
    }
    
    start = time.time()
    try:
        resp = session.post(f"{BASE_URL}/factures/", json=data, timeout=10)
        elapsed = time.time() - start
        result.add_result(OperationType.SALE.value, resp.status_code in [200, 201], elapsed,
                         f"HTTP {resp.status_code}" if resp.status_code not in [200, 201] else "")
    except Exception as e:
        result.add_result(OperationType.SALE.value, False, 0, str(type(e).__name__))


def make_search(session: requests.Session, result: LoadTestResult):
    """Recherche omnisearch"""
    queries = ["para", "vita", "amoxi", "client", "2024", "aspirine", "ibu", "omepra"]
    query = random.choice(queries)
    
    start = time.time()
    try:
        resp = session.get(f"{BASE_URL}/omnisearch/", params={"q": query, "limit": 5}, timeout=5)
        elapsed = time.time() - start
        result.add_result(OperationType.SEARCH.value, resp.status_code == 200, elapsed,
                         f"HTTP {resp.status_code}" if resp.status_code != 200 else "")
    except Exception as e:
        result.add_result(OperationType.SEARCH.value, False, 0, str(type(e).__name__))


def update_stock(session: requests.Session, result: LoadTestResult):
    """Mise à jour stock produit"""
    product_id = random.randint(1, 50)
    new_stock = random.randint(5, 100)
    
    start = time.time()
    try:
        resp = session.patch(f"{BASE_URL}/produits/{product_id}/", 
                            json={"stock": new_stock}, timeout=5)
        elapsed = time.time() - start
        result.add_result(OperationType.STOCK_UPDATE.value, resp.status_code in [200, 204], elapsed,
                         f"HTTP {resp.status_code}" if resp.status_code not in [200, 204] else "")
    except Exception as e:
        result.add_result(OperationType.STOCK_UPDATE.value, False, 0, str(type(e).__name__))


def create_client(session: requests.Session, result: LoadTestResult):
    """Création client"""
    first_names = ["Jean", "Marie", "Paul", "Sophie", "Pierre", "Fatima", "Ahmed", "Aïcha"]
    last_names = ["Martin", "Dubois", "Bernard", "Petit", "Diallo", "Ndiaye", "Sy", "Fall"]
    
    name = f"{random.choice(first_names)} {random.choice(last_names)}"
    phone = f"77{random.randint(100000, 999999)}"
    
    data = {
        "name": name,
        "phone": phone,
        "email": f"{name.replace(' ', '.').lower()}@test.com",
        "client_type": random.choice(["PARTICULIER", "PROFESSIONNEL"])
    }
    
    start = time.time()
    try:
        resp = session.post(f"{BASE_URL}/clients/", json=data, timeout=5)
        elapsed = time.time() - start
        result.add_result(OperationType.CLIENT_CREATE.value, resp.status_code in [201, 200], elapsed,
                         f"HTTP {resp.status_code}" if resp.status_code not in [201, 200] else "")
    except Exception as e:
        result.add_result(OperationType.CLIENT_CREATE.value, False, 0, str(type(e).__name__))


def view_report(session: requests.Session, result: LoadTestResult):
    """Consultation rapport"""
    endpoints = [
        f"{BASE_URL}/caisse/get_totals/?date_debut=2024-01-01&date_fin=2024-12-31",
        f"{BASE_URL}/rapport/ventes/",
        f"{BASE_URL}/statistiques/stock/",
    ]
    
    start = time.time()
    try:
        resp = session.get(random.choice(endpoints), timeout=10)
        elapsed = time.time() - start
        result.add_result(OperationType.REPORT_VIEW.value, resp.status_code == 200, elapsed,
                         f"HTTP {resp.status_code}" if resp.status_code != 200 else "")
    except Exception as e:
        result.add_result(OperationType.REPORT_VIEW.value, False, 0, str(type(e).__name__))


def view_product(session: requests.Session, result: LoadTestResult):
    """Vue détail produit"""
    product_id = random.randint(1, 100)
    
    start = time.time()
    try:
        resp = session.get(f"{BASE_URL}/produits/{product_id}/", timeout=5)
        elapsed = time.time() - start
        result.add_result(OperationType.PRODUCT_VIEW.value, resp.status_code == 200, elapsed,
                         f"HTTP {resp.status_code}" if resp.status_code != 200 else "")
    except Exception as e:
        result.add_result(OperationType.PRODUCT_VIEW.value, False, 0, str(type(e).__name__))


# =============================================================================
# SCÉNARIOS
# =============================================================================

SCENARIOS = {
    "mixed": {  # Réaliste - mélange d'opérations
        OperationType.SALE: 0.40,           # 40% ventes
        OperationType.SEARCH: 0.20,         # 20% recherches
        OperationType.PRODUCT_VIEW: 0.15,   # 15% consultation produits
        OperationType.STOCK_UPDATE: 0.10,   # 10% updates stock
        OperationType.REPORT_VIEW: 0.10,    # 10% rapports
        OperationType.CLIENT_CREATE: 0.05,  # 5% nouveaux clients
    },
    
    "sales_peak": {  # Pic de ventes (Black Friday)
        OperationType.SALE: 0.80,
        OperationType.SEARCH: 0.15,
        OperationType.PRODUCT_VIEW: 0.05,
    },
    
    "inventory_day": {  # Jour d'inventaire
        OperationType.STOCK_UPDATE: 0.50,
        OperationType.PRODUCT_VIEW: 0.30,
        OperationType.SEARCH: 0.15,
        OperationType.SALE: 0.05,
    },
    
    "reports_heavy": {  # Reporting intensif
        OperationType.REPORT_VIEW: 0.60,
        OperationType.SEARCH: 0.25,
        OperationType.SALE: 0.15,
    },
    
    "balanced": {  # Équilibré
        OperationType.SALE: 0.25,
        OperationType.SEARCH: 0.20,
        OperationType.PRODUCT_VIEW: 0.20,
        OperationType.STOCK_UPDATE: 0.15,
        OperationType.REPORT_VIEW: 0.15,
        OperationType.CLIENT_CREATE: 0.05,
    }
}


def choose_operation(scenario: Dict) -> Callable:
    """Choisit une opération selon le scénario"""
    operations = list(scenario.keys())
    weights = list(scenario.values())
    
    chosen = random.choices(operations, weights=weights, k=1)[0]
    
    op_map = {
        OperationType.SALE: make_sale,
        OperationType.SEARCH: make_search,
        OperationType.STOCK_UPDATE: update_stock,
        OperationType.CLIENT_CREATE: create_client,
        OperationType.REPORT_VIEW: view_report,
        OperationType.PRODUCT_VIEW: view_product,
    }
    
    return op_map[chosen]


def simulate_user(user_id: int, scenario: Dict, result: LoadTestResult, stop_flag: threading.Event, 
                  username: str, password: str):
    """Simule un utilisateur effectuant des opérations variées"""
    session = requests.Session()
    
    # Login
    if not login(session, username, password):
        print(f"❌ Utilisateur {user_id}: Échec authentification")
        return
    
    print(f"✅ Utilisateur {user_id} connecté")
    
    while not stop_flag.is_set():
        # Choisir et exécuter une opération
        operation = choose_operation(scenario)
        operation(session, result)
        
        # Délai entre opérations (utilisateur réel)
        time.sleep(random.uniform(1, 4))
    
    print(f"⏹️  Utilisateur {user_id} déconnecté")


def run_test(scenario_name: str):
    """Lance le test avec un scénario"""
    if scenario_name not in SCENARIOS:
        print(f"Scénario inconnu. Disponibles: {', '.join(SCENARIOS.keys())}")
        return
    
    scenario = SCENARIOS[scenario_name]
    result = LoadTestResult()
    stop_flag = threading.Event()
    
    print("🚀 Test de charge MULTI-OPERATIONS")
    print(f"   Scénario: {scenario_name}")
    print(f"   URL: {BASE_URL}")
    print(f"   Utilisateurs: {CONCURRENT_CLIENTS}")
    print(f"   Durée: {TEST_DURATION}s")
    print(f"\n   Distribution:")
    for op, pct in scenario.items():
        print(f"      - {op.value}: {pct*100:.0f}%")
    
    # Vérification serveur
    print("\n🔍 Vérification serveur...")
    try:
        resp = requests.get(f"{BASE_URL}/health/", timeout=15)
        if resp.status_code != 200:
            print("❌ Serveur non accessible!")
            return
    except Exception as e:
        print(f"❌ Erreur connexion: {e}")
        return
    print("✅ Serveur OK")
    
    # Lancement
    print(f"\n📡 Lancement de {CONCURRENT_CLIENTS} utilisateurs...")
    result.start_time = time.time()
    
    # Créer des utilisateurs avec des credentials variés si besoin
    threads = []
    for i in range(CONCURRENT_CLIENTS):
        # Tu peux adapter pour avoir plusieurs comptes différents
        username = f"{DEFAULT_USERNAME}"
        password = DEFAULT_PASSWORD
        
        t = threading.Thread(
            target=simulate_user,
            args=(i+1, scenario, result, stop_flag, username, password)
        )
        t.daemon = True
        threads.append(t)
        t.start()
    
    # Attente
    print(f"⏱️  Test en cours ({TEST_DURATION}s)...")
    time.sleep(TEST_DURATION)
    
    # Arrêt
    stop_flag.set()
    print("\n🛑 Arrêt des utilisateurs...")
    
    for t in threads:
        t.join(timeout=5)
    
    result.end_time = time.time()
    
    # Rapport
    result.print_report()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Test de charge multi-opérations",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=f"""
Scénarios disponibles:
  mixed          - Mix réaliste (ventes 40%, recherches 20%, etc.)
  sales_peak     - Pic de ventes (80% ventes)
  inventory_day  - Jour inventaire (50% updates stock)
  reports_heavy  - Reporting intensif (60% rapports)
  balanced       - Réparti équitablement

Exemples:
  python multi_operation_test.py --scenario mixed --clients 20 --duration 120
  python multi_operation_test.py --scenario sales_peak --clients 30 --duration 60
  python multi_operation_test.py --url http://192.168.1.100:8000/api --scenario balanced
        """
    )
    
    parser.add_argument("--scenario", type=str, default="mixed",
                       choices=list(SCENARIOS.keys()),
                       help="Scénario de test")
    parser.add_argument("--clients", type=int, default=20,
                       help="Nombre d'utilisateurs simultanés")
    parser.add_argument("--duration", type=int, default=120,
                       help="Durée du test en secondes")
    parser.add_argument("--url", type=str, default="http://localhost:8000/api",
                       help="URL de l'API")
    parser.add_argument("--username", type=str, default="admin",
                       help="Nom d'utilisateur pour authentification")
    parser.add_argument("--password", type=str, default="admin123",
                       help="Mot de passe pour authentification")
    
    args = parser.parse_args()
    
    CONCURRENT_CLIENTS = args.clients
    TEST_DURATION = args.duration
    BASE_URL = args.url
    DEFAULT_USERNAME = args.username
    DEFAULT_PASSWORD = args.password
    
    try:
        run_test(args.scenario)
    except KeyboardInterrupt:
        print("\n\n⚠️ Test interrompu")
