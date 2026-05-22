#!/usr/bin/env python3
"""
Analyseur de requêtes Django
Détecte les N+1 queries et suggère des optimisations
"""

import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.db import connection, reset_queries
from django.db.models import Prefetch, Count, Sum, Avg
from api.models import Facture, Produit, Client
from api.models.billing import FactureProduit
import time


class QueryAnalyzer:
    """Analyse les performances des requêtes"""
    
    def __init__(self):
        self.results = []
    
    def profile_query(self, name, queryset_func):
        """Profile une requête"""
        reset_queries()
        start = time.time()
        
        result = queryset_func()
        list(result)  # Force evaluation
        
        duration = time.time() - start
        num_queries = len(connection.queries)
        
        self.results.append({
            'name': name,
            'duration_ms': duration * 1000,
            'num_queries': num_queries,
            'sql': [q['sql'] for q in connection.queries[:3]]  # First 3 queries
        })
        
        return duration, num_queries
    
    def analyze_factures(self):
        """Analyse les requêtes factures"""
        print("\n📊 Analyse Factures")
        print("="*70)
        
        # Test 1: Requête simple (naïve)
        print("\n1️⃣ Requête NAÏVE (N+1 problem):")
        def naive_query():
            return Facture.objects.all()[:50]
        
        dur, nq = self.profile_query("factures_naive", naive_query)
        print(f"   ⏱️  {dur:.1f}ms | {nq} requêtes")
        
        # Test 2: Avec select_related
        print("\n2️⃣ Requête avec SELECT_RELATED:")
        def optimized_query():
            return Facture.objects.select_related('client', 'created_by').all()[:50]
        
        dur, nq = self.profile_query("factures_select_related", optimized_query)
        print(f"   ⏱️  {dur:.1f}ms | {nq} requêtes")
        
        # Test 3: Avec prefetch_related pour lignes
        print("\n3️⃣ Requête avec PREFETCH_RELATED (lignes):")
        def prefetch_query():
            return Facture.objects.prefetch_related('produits').all()[:50]
        
        dur, nq = self.profile_query("factures_prefetch", prefetch_query)
        print(f"   ⏱️  {dur:.1f}ms | {nq} requêtes")
        
        # Test 4: Complet
        print("\n4️⃣ Requête COMPLÈTE (select + prefetch):")
        def complete_query():
            return Facture.objects.select_related('client').prefetch_related(
                Prefetch('produits', queryset=FactureProduit.objects.select_related('produit'))
            ).all()[:50]
        
        dur, nq = self.profile_query("factures_complete", complete_query)
        print(f"   ⏱️  {dur:.1f}ms | {nq} requêtes")
    
    def analyze_omnisearch(self):
        """Analyse la recherche omnisearch"""
        print("\n\n🔍 Analyse Omnisearch")
        print("="*70)
        
        # Test recherche produits
        print("\n1️⃣ Recherche produits:")
        def search_products():
            return Produit.objects.filter(name__icontains='para')[:10]
        
        dur, nq = self.profile_query("search_products", search_products)
        print(f"   ⏱️  {dur:.1f}ms | {nq} requêtes")
        
        # Avec index trigram (si configuré)
        print("\n2️⃣ Recherche avec annotation:")
        def search_with_stats():
            return Produit.objects.filter(
                name__icontains='vitamine'
            ).annotate(
                ventes_count=Count('factureproduit'),
                ventes_total=Sum('factureproduit__selling_price')
            )[:10]
        
        dur, nq = self.profile_query("search_with_stats", search_with_stats)
        print(f"   ⏱️  {dur:.1f}ms | {nq} requêtes")
    
    def print_recommendations(self):
        """Affiche les recommandations"""
        print("\n\n💡 RECOMMANDATIONS D'OPTIMISATION")
        print("="*70)
        
        recs = [
            ("Factures", "Utiliser select_related('client', 'created_by')"),
            ("Lignes factures", "Utiliser prefetch_related('lignes__produit')"),
            ("Produits", "Créer un index GIN sur name pour la recherche"),
            ("Stats", "Utiliser des valeurs() ou only() pour réduire les colonnes"),
            ("Cache", "Mettre en cache les résultats de recherche fréquents"),
        ]
        
        for i, (category, rec) in enumerate(recs, 1):
            print(f"{i}. [{category}] {rec}")
        
        print("\n\n🚀 Actions prioritaires:")
        print("1. Ajouter select_related dans les views API factures")
        print("2. Créer index PostgreSQL sur produits.name")
        print("3. Implémenter cache Redis pour omnisearch")
        print("4. Utiliser defer() pour exclure les champs lourds (image, description)")
    
    def run(self):
        """Lance l'analyse complète"""
        print("🚀 ANALYSE DES PERFORMANCES DJANGO")
        print("="*70)
        
        self.analyze_factures()
        self.analyze_omnisearch()
        self.print_recommendations()
        
        # Summary
        print("\n\n📈 RÉSUMÉ")
        print("="*70)
        for r in self.results:
            status = "🟢" if r['num_queries'] <= 2 else "🟡" if r['num_queries'] <= 5 else "🔴"
            print(f"{status} {r['name']}: {r['duration_ms']:.1f}ms, {r['num_queries']} queries")


if __name__ == "__main__":
    analyzer = QueryAnalyzer()
    analyzer.run()
