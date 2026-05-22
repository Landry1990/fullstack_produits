#!/usr/bin/env python3
"""
Patterns de résilience pour le backend
À intégrer dans les hooks/services frontend
"""

import time
import random
from functools import wraps
from typing import Callable, Any, Optional
import requests

# =============================================================================
# 1. CIRCUIT BREAKER - Éviter les appels à un service en panne
# =============================================================================

class CircuitBreaker:
    """Circuit breaker pattern"""
    def __init__(self, failure_threshold=5, recovery_timeout=30):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time = None
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN
    
    def call(self, func: Callable, *args, **kwargs) -> Any:
        if self.state == "OPEN":
            if self.last_failure_time and (time.time() - self.last_failure_time > self.recovery_timeout):
                self.state = "HALF_OPEN"
            else:
                raise Exception("Circuit breaker is OPEN")
        
        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise e
    
    def _on_success(self):
        self.failure_count = 0
        self.state = "CLOSED"
    
    def _on_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"


# =============================================================================
# 2. RETRY AVEC EXPONENTIAL BACKOFF
# =============================================================================

def retry_with_backoff(max_retries=3, base_delay=1, max_delay=10, 
                       exceptions=(requests.exceptions.RequestException,)):
    """Décorateur retry avec backoff exponentiel et jitter"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    if attempt == max_retries - 1:
                        raise
                    
                    # Exponential backoff with jitter
                    delay = min(base_delay * (2 ** attempt), max_delay)
                    delay = delay * (0.5 + random.random())  # Jitter ±50%
                    
                    print(f"   ⏳ Retry {attempt + 1}/{max_retries} dans {delay:.1f}s...")
                    time.sleep(delay)
            
            return None  # Should never reach here
        return wrapper
    return decorator


# =============================================================================
# 3. TIMEOUT ADAPTATIF
# =============================================================================

class AdaptiveTimeout:
    """Timeout qui s'adapte selon les performances"""
    def __init__(self, min_timeout=5, max_timeout=60, target_percentile=0.95):
        self.min_timeout = min_timeout
        self.max_timeout = max_timeout
        self.target_percentile = target_percentile
        self.response_times = []
        self.current_timeout = min_timeout
    
    def record_response_time(self, duration: float):
        self.response_times.append(duration)
        if len(self.response_times) > 100:
            self.response_times = self.response_times[-50:]  # Keep last 50
        
        # Recalculate timeout every 10 requests
        if len(self.response_times) % 10 == 0:
            self._update_timeout()
    
    def _update_timeout(self):
        if len(self.response_times) < 10:
            return
        
        sorted_times = sorted(self.response_times)
        p95_idx = int(len(sorted_times) * self.target_percentile)
        p95 = sorted_times[min(p95_idx, len(sorted_times) - 1)]
        
        # Timeout = P95 * 2, but within bounds
        new_timeout = max(self.min_timeout, min(p95 * 2, self.max_timeout))
        self.current_timeout = new_timeout
    
    def get_timeout(self) -> float:
        return self.current_timeout


# =============================================================================
# 4. GESTION DE TOKEN AVEC REFRESH
# =============================================================================

class TokenManager:
    """Gestion automatique des tokens JWT/DRF"""
    def __init__(self, base_url: str, username: str, password: str):
        self.base_url = base_url
        self.username = username
        self.password = password
        self.token = None
        self.token_expiry = None
        self.refresh_threshold = 300  # Refresh 5 min before expiry
    
    def get_token(self) -> str:
        """Récupère un token valide, refresh si nécessaire"""
        if self.token and not self._is_token_expired():
            return self.token
        
        self._refresh_token()
        if self.token is None:
            raise Exception("Impossible d'obtenir un token")
        return self.token
    
    def _is_token_expired(self) -> bool:
        if not self.token_expiry:
            return True
        return time.time() > (self.token_expiry - self.refresh_threshold)
    
    def _refresh_token(self):
        """Récupère un nouveau token"""
        try:
            resp = requests.post(
                f"{self.base_url}/auth/token/",
                json={"username": self.username, "password": self.password},
                timeout=30
            )
            
            if resp.status_code == 200:
                data = resp.json()
                self.token = data.get("token")
                # DRF tokens don't expire, but we set a session duration
                self.token_expiry = time.time() + 3600  # 1 hour session
                print("   🔑 Token rafraîchi")
            else:
                raise Exception(f"Auth failed: {resp.status_code}")
                
        except Exception as e:
            print(f"   ❌ Erreur refresh token: {e}")
            raise


# =============================================================================
# 5. BULKHEAD - Isoler les ressources
# =============================================================================

class Bulkhead:
    """Limite le nombre de requêtes concurrentes par type"""
    def __init__(self, max_concurrent=10):
        self.max_concurrent = max_concurrent
        self.current = 0
        self.waiting = []
    
    def acquire(self, timeout: float = 30) -> bool:
        """Acquiert un slot, attend si nécessaire"""
        start = time.time()
        while self.current >= self.max_concurrent:
            if time.time() - start > timeout:
                return False
            time.sleep(0.1)
        
        self.current += 1
        return True
    
    def release(self):
        """Libère un slot"""
        self.current = max(0, self.current - 1)


# =============================================================================
# 6. FALLBACK / DEGRADATION GRACIEUSE
# =============================================================================

def with_fallback(fallback_value: Any):
    """Décorateur qui retourne une valeur par défaut en cas d'erreur"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                print(f"   ⚠️  Fallback utilisé: {e}")
                return fallback_value
        return wrapper
    return decorator


# =============================================================================
# 7. IDEMPOTENCE - Éviter les doublons
# =============================================================================

import uuid

class IdempotencyKey:
    """Génère des clés d'idempotence pour éviter les doublons"""
    def __init__(self):
        self.used_keys = set()
    
    def generate(self) -> str:
        """Génère une nouvelle clé unique"""
        key = str(uuid.uuid4())
        self.used_keys.add(key)
        return key
    
    def is_used(self, key: str) -> bool:
        return key in self.used_keys


# =============================================================================
# EXEMPLE D'UTILISATION COMPLETE
# =============================================================================

class ResilientAPIClient:
    """Client API avec tous les patterns de résilience"""
    
    def __init__(self, base_url: str, username: str, password: str):
        self.base_url = base_url
        self.token_manager = TokenManager(base_url, username, password)
        self.circuit_breaker = CircuitBreaker(failure_threshold=5)
        self.timeout_manager = AdaptiveTimeout(min_timeout=5, max_timeout=60)
        self.bulkhead = Bulkhead(max_concurrent=5)
        self.idempotency = IdempotencyKey()
        
        self.session = requests.Session()
    
    def _make_request(self, method: str, endpoint: str, **kwargs) -> dict:
        """Requête avec tous les patterns de résilience"""
        
        # 1. Circuit breaker
        if self.circuit_breaker.state == "OPEN":
            raise Exception("Service temporairement indisponible")
        
        # 2. Acquérir slot bulkhead
        if not self.bulkhead.acquire(timeout=10):
            raise Exception("Trop de requêtes en cours")
        
        try:
            # 3. Préparer la requête
            url = f"{self.base_url}{endpoint}"
            token = self.token_manager.get_token()
            
            headers = kwargs.pop('headers', {})
            headers['Authorization'] = f'Token {token}'
            headers['X-Idempotency-Key'] = self.idempotency.generate()
            
            timeout = self.timeout_manager.get_timeout()
            
            # 4. Exécuter avec retry
            @retry_with_backoff(max_retries=3, base_delay=1)
            def do_request():
                resp = requests.request(
                    method, url, 
                    headers=headers, 
                    timeout=timeout,
                    **kwargs
                )
                
                # Gérer 401 - Token expiré
                if resp.status_code == 401:
                    self.token_manager._refresh_token()
                    headers['Authorization'] = f'Token {self.token_manager.token}'
                    raise requests.exceptions.RequestException("Token refreshed, retry needed")
                
                resp.raise_for_status()
                return resp.json()
            
            result = do_request()
            
            # 5. Mettre à jour timeout adaptatif
            self.timeout_manager.record_response_time(timeout)
            
            # 6. Succès = circuit breaker OK
            self.circuit_breaker._on_success()
            
            return result
            
        except requests.exceptions.RequestException as e:
            # Échec = circuit breaker compte
            self.circuit_breaker._on_failure()
            raise
            
        finally:
            self.bulkhead.release()
    
    # Méthodes API
    def create_sale(self, data: dict) -> dict:
        return self._make_request("POST", "/factures/", json=data)
    
    def search(self, query: str) -> dict:
        return self._make_request("GET", f"/omnisearch/?q={query}&limit=5")
    
    @with_fallback(fallback_value={"stock": 0})
    def get_stock(self, product_id: int) -> dict:
        """Avec fallback si l'API stock est down"""
        return self._make_request("GET", f"/produits/{product_id}/")


# =============================================================================
# EXEMPLE D'UTILISATION
# =============================================================================

if __name__ == "__main__":
    print("🔧 Patterns de résilience prêts à l'emploi")
    print("\nExemple d'utilisation:")
    print("""
from resilience_patterns import ResilientAPIClient

# Créer un client résilient
client = ResilientAPIClient(
    base_url="http://localhost:8000/api",
    username="admin",
    password="admin123"
)

# Créer une vente (avec retry, circuit breaker, etc.)
try:
    sale = client.create_sale({
        "mode_paiement": "especes",
        "lignes": [{"produit_id": 1, "quantite": 1, "prix_vente": 2500}],
        "total_ttc": 2500
    })
    print(f"✅ Vente créée: {sale}")
except Exception as e:
    print(f"❌ Échec définitif: {e}")

# Recherche avec fallback
results = client.search("para")
print(f"🔍 {len(results)} résultats")

# Stock avec fallback (retourne 0 si API down)
stock = client.get_stock(1)
print(f"📦 Stock: {stock.get('stock', 0)}")
    """)
