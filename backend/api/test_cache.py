"""
Script de test pour vérifier le fonctionnement du système de cache.

Usage:
    python manage.py shell < test_cache.py
    
Ou dans le shell Django:
    from api.test_cache import run_cache_tests
    run_cache_tests()
"""
from django.core.cache import cache
from api.cache_utils import SearchCache
from api.models import Produit
from django.db import connection
from django.test.utils import CaptureQueriesContext
import time


def test_cache_backend():
    """Teste que le backend de cache fonctionne."""
    print("\n" + "="*60)
    print("TEST 1: Backend de cache")
    print("="*60)
    
    # Test simple
    cache.set('test_key', 'test_value', 60)
    result = cache.get('test_key')
    
    if result == 'test_value':
        print("✅ Cache backend fonctionne correctement")
        print(f"   Backend: {cache.__class__.__name__}")
    else:
        print("❌ Cache backend ne fonctionne pas")
        return False
    
    # Afficher les stats
    stats = SearchCache.get_cache_stats()
    print(f"   Stats: {stats}")
    
    return True


def test_search_cache():
    """Teste le cache de recherche de produits."""
    print("\n" + "="*60)
    print("TEST 2: Cache de recherche")
    print("="*60)
    
    # Créer un produit de test
    test_product = Produit.objects.first()
    if not test_product:
        print("⚠️  Aucun produit en base, création d'un produit de test...")
        test_product = Produit.objects.create(
            name="Test Cache Product",
            stock=10,
            pmp=1000,
            selling_price=1500
        )
    
    search_query = test_product.name[:5]  # Premiers caractères
    
    # Vider le cache
    SearchCache.invalidate_all_products()
    
    # Premier appel (devrait être un MISS)
    print(f"\n1. Recherche '{search_query}' (devrait être un MISS)...")
    with CaptureQueriesContext(connection) as ctx:
        result1 = SearchCache.get_search_results(search_query)
        if result1 is None:
            # Simuler une requête
            products = list(Produit.objects.filter(name__icontains=search_query).values('id', 'name')[:10])
            SearchCache.set_search_results(search_query, products)
            result1 = products
            queries_count_1 = len(ctx)
    
    print(f"   ✅ MISS - {queries_count_1} requête(s) SQL")
    print(f"   Résultats: {len(result1)} produit(s)")
    
    # Deuxième appel (devrait être un HIT)
    print(f"\n2. Recherche '{search_query}' (devrait être un HIT)...")
    with CaptureQueriesContext(connection) as ctx:
        result2 = SearchCache.get_search_results(search_query)
        queries_count_2 = len(ctx)
    
    if result2 is not None and queries_count_2 == 0:
        print(f"   ✅ HIT - 0 requête SQL (100% depuis le cache)")
        print(f"   Résultats: {len(result2)} produit(s)")
    else:
        print(f"   ❌ Échec - {queries_count_2} requête(s) SQL")
        return False
    
    return True


def test_cache_invalidation():
    """Teste l'invalidation du cache."""
    print("\n" + "="*60)
    print("TEST 3: Invalidation du cache")
    print("="*60)
    
    # Créer un produit
    test_product = Produit.objects.first()
    if not test_product:
        test_product = Produit.objects.create(
            name="Test Invalidation Product",
            stock=10,
            pmp=1000,
            selling_price=1500
        )
    
    # Mettre en cache
    product_data = {'id': test_product.id, 'name': test_product.name}
    SearchCache.set_product_detail(test_product.id, product_data)
    
    # Vérifier que c'est en cache
    cached = SearchCache.get_product_detail(test_product.id)
    if cached is None:
        print("❌ Produit non mis en cache")
        return False
    
    print(f"✅ Produit #{test_product.id} mis en cache")
    
    # Invalider
    SearchCache.invalidate_product(test_product.id)
    
    # Vérifier que le cache est invalidé
    cached_after = SearchCache.get_product_detail(test_product.id)
    if cached_after is None:
        print(f"✅ Cache invalidé avec succès")
    else:
        print(f"❌ Cache non invalidé")
        return False
    
    return True


def test_performance():
    """Teste les performances du cache."""
    print("\n" + "="*60)
    print("TEST 4: Performance")
    print("="*60)
    
    search_query = "test"
    
    # Vider le cache
    SearchCache.invalidate_all_products()
    
    # Mesurer sans cache
    print("\n1. Sans cache (requête DB)...")
    start = time.time()
    with CaptureQueriesContext(connection) as ctx:
        products = list(Produit.objects.filter(name__icontains=search_query).values('id', 'name')[:50])
        queries_no_cache = len(ctx)
    time_no_cache = (time.time() - start) * 1000  # en ms
    
    print(f"   Temps: {time_no_cache:.2f}ms")
    print(f"   Requêtes SQL: {queries_no_cache}")
    
    # Mettre en cache
    SearchCache.set_search_results(search_query, products)
    
    # Mesurer avec cache
    print("\n2. Avec cache...")
    start = time.time()
    with CaptureQueriesContext(connection) as ctx:
        cached_products = SearchCache.get_search_results(search_query)
        queries_cache = len(ctx)
    time_cache = (time.time() - start) * 1000  # en ms
    
    print(f"   Temps: {time_cache:.2f}ms")
    print(f"   Requêtes SQL: {queries_cache}")
    
    # Calculer l'amélioration
    if time_no_cache > 0:
        improvement = ((time_no_cache - time_cache) / time_no_cache) * 100
        print(f"\n   📊 Amélioration: {improvement:.1f}%")
        print(f"   ⚡ Gain: {time_no_cache - time_cache:.2f}ms")
        
        if improvement > 50:
            print(f"   ✅ Performance excellente!")
        elif improvement > 20:
            print(f"   ✅ Performance bonne")
        else:
            print(f"   ⚠️  Performance faible (cache peut-être pas optimal)")
    
    return True


def run_cache_tests():
    """Exécute tous les tests de cache."""
    print("\n" + "="*60)
    print("🧪 TESTS DU SYSTÈME DE CACHE")
    print("="*60)
    
    results = {
        'Backend': test_cache_backend(),
        'Recherche': test_search_cache(),
        'Invalidation': test_cache_invalidation(),
        'Performance': test_performance()
    }
    
    print("\n" + "="*60)
    print("📊 RÉSUMÉ DES TESTS")
    print("="*60)
    
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"   {test_name}: {status}")
    
    total = len(results)
    passed = sum(results.values())
    print(f"\n   Total: {passed}/{total} tests réussis")
    
    if passed == total:
        print("\n   🎉 Tous les tests sont passés!")
        print("   Le système de cache fonctionne correctement.")
    else:
        print("\n   ⚠️  Certains tests ont échoué.")
        print("   Vérifiez la configuration du cache dans settings.py")
    
    return results


if __name__ == '__main__':
    # Si exécuté directement dans le shell Django
    run_cache_tests()
