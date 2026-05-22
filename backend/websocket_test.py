#!/usr/bin/env python3
"""
Test de charge WebSocket - Simulation multi-caisses temps réel
Teste les communications WebSocket pour le multi-caisse

Installation: pip install websockets
Usage: python websocket_test.py --clients 10 --duration 60
"""

import asyncio
import websockets
import json
import random
import time
import argparse
from typing import List, Dict
import statistics

# Configuration
WS_URL = "ws://localhost:8000/ws/cashier/"
CONCURRENT_CLIENTS = 10
TEST_DURATION = 60

class WebSocketTestResult:
    def __init__(self):
        self.total_messages = 0
        self.messages_received = 0
        self.connection_errors = 0
        self.latencies: List[float] = []
        self.start_time: float = 0
        self.end_time: float = 0
    
    @property
    def duration(self) -> float:
        return self.end_time - self.start_time
    
    @property
    def messages_per_second(self) -> float:
        return self.total_messages / self.duration if self.duration > 0 else 0
    
    @property
    def avg_latency(self) -> float:
        return statistics.mean(self.latencies) if self.latencies else 0
    
    def print_report(self):
        print("\n" + "="*70)
        print("📡 RAPPORT TEST WEBSOCKET MULTI-CAISSE")
        print("="*70)
        print(f"Durée: {self.duration:.2f}s")
        print(f"Clients WebSocket: {CONCURRENT_CLIENTS}")
        print(f"\nMessages envoyés: {self.total_messages}")
        print(f"Messages reçus: {self.messages_received}")
        print(f"Taux de réception: {self.messages_received/max(self.total_messages, 1)*100:.1f}%")
        print(f"Erreurs connexion: {self.connection_errors}")
        print(f"\n⚡ Performance:")
        print(f"   Messages/sec: {self.messages_per_second:.2f}")
        print(f"   Latence moyenne: {self.avg_latency*1000:.2f}ms")
        if self.latencies:
            print(f"   Latence min: {min(self.latencies)*1000:.2f}ms")
            print(f"   Latence max: {max(self.latencies)*1000:.2f}ms")
        
        print("\n" + "="*70)
        if self.connection_errors == 0 and self.avg_latency < 0.1:
            print("🟢 WebSocket excellent - Temps réel parfait")
        elif self.connection_errors < 3 and self.avg_latency < 0.5:
            print("🟢 WebSocket bon - Performances acceptable")
        elif self.connection_errors < 10:
            print("🟡 WebSocket acceptable - Quelques pertes")
        else:
            print("🔴 WebSocket critique - Problèmes de connexion")
        print("="*70)


async def simulate_websocket_client(client_id: int, result: 'WebSocketTestResult', 
                                   stop_event: asyncio.Event):
    """Simule un poste de caisse avec WebSocket"""
    
    uri = f"{WS_URL}?client_id=caisse_{client_id}"
    
    try:
        async with websockets.connect(uri) as websocket:
            print(f"✅ Client {client_id} connecté")
            
            while not stop_event.is_set():
                try:
                    # Simuler un événement de caisse
                    event = {
                        "type": "sale_item",
                        "item": {
                            "product_id": random.randint(1, 100),
                            "name": f"Produit {random.randint(1, 100)}",
                            "price": random.randint(1000, 50000),
                            "quantity": random.randint(1, 5)
                        },
                        "timestamp": time.time()
                    }
                    
                    start_time = time.time()
                    
                    # Envoyer le message
                    await websocket.send(json.dumps(event))
                    result.total_messages += 1
                    
                    # Attendre la confirmation (timeout 5s)
                    try:
                        response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                        latency = time.time() - start_time
                        result.latencies.append(latency)
                        result.messages_received += 1
                        
                        # Parse response
                        data = json.loads(response)
                        if data.get("status") == "ok":
                            pass  # Message bien reçu
                        
                    except asyncio.TimeoutError:
                        pass  # Pas de réponse, mais pas forcément une erreur
                    
                except websockets.exceptions.ConnectionClosed:
                    result.connection_errors += 1
                    break
                except Exception as e:
                    result.connection_errors += 1
                    print(f"❌ Client {client_id} erreur: {e}")
                    break
                
                # Délai entre messages (1-3 secondes)
                await asyncio.sleep(random.uniform(1, 3))
                
    except Exception as e:
        result.connection_errors += 1
        print(f"❌ Client {client_id} connexion échouée: {e}")


async def run_websocket_test():
    """Lance le test WebSocket"""
    result = WebSocketTestResult()
    stop_event = asyncio.Event()
    
    print("🚀 Test de charge WebSocket - Multi-Caisse")
    print(f"   URL: {WS_URL}")
    print(f"   Clients: {CONCURRENT_CLIENTS}")
    print(f"   Durée: {TEST_DURATION}s")
    
    result.start_time = time.time()
    
    # Lancer les clients WebSocket
    tasks = [
        simulate_websocket_client(i, result, stop_event)
        for i in range(CONCURRENT_CLIENTS)
    ]
    
    # Timer pour arrêter le test
    async def stop_after_duration():
        await asyncio.sleep(TEST_DURATION)
        stop_event.set()
        print("\n⏹️  Test terminé, fermeture des connexions...")
    
    # Exécuter tous les clients + le timer
    await asyncio.gather(
        *tasks,
        stop_after_duration(),
        return_exceptions=True
    )
    
    result.end_time = time.time()
    
    # Afficher le rapport
    result.print_report()
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test de charge WebSocket multi-caisses")
    parser.add_argument("--clients", type=int, default=10, help="Nombre de clients WebSocket")
    parser.add_argument("--duration", type=int, default=60, help="Durée du test en secondes")
    parser.add_argument("--url", type=str, default="ws://localhost:8000/ws/cashier/", 
                       help="URL WebSocket")
    
    args = parser.parse_args()
    
    CONCURRENT_CLIENTS = args.clients
    TEST_DURATION = args.duration
    WS_URL = args.url
    
    # Lancer le test
    try:
        asyncio.run(run_websocket_test())
    except KeyboardInterrupt:
        print("\n\n⚠️ Test interrompu par l'utilisateur")
