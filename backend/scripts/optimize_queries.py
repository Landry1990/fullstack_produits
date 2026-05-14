#!/usr/bin/env python3
"""
Script d'optimisation des requêtes SQL Django
Détecte et propose des optimisations pour les requêtes N+1 et lourdes
Usage: python manage.py optimize_queries --check
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
django.setup()

from django.db import connection, reset_queries
from django.test.utils import override_settings
from api.models import Facture, Produit, Commande


class QueryOptimizer:
    """Analyse et optimise les requêtes SQL Django"""
    
    def __init__(self):
        self.issues = []
        self.optimizations = []
    
    def check_n_plus_one(self, queryset, description=""):
        """Vérifie si un queryset cause des requêtes N+1"""
        reset_queries()
        
        # Force l'exécution et matérialise les objets
        list(queryset[:10])  # Test sur 10 objets
        
        query_count = len(connection.queries)
        
        if query_count > 2:  # 1 pour la liste, 1 max pour les relations
            self.issues.append({
                'type': 'N+1',
                'description': description,
                'query_count': query_count,
                'severity': 'CRITICAL' if query_count > 10 else 'WARNING'
            })
        
        return query_count
    
    def analyze_factures_list(self):
        """Analyse la liste des factures"""
        print("\n🔍 Analyse FactureViewSet.list()...")
        
        from api.views.ventes.factures import FactureViewSet
        from rest_framework.test import APIRequestFactory
        
        factory = APIRequestFactory()
        request = factory.get('/api/factures/')
        
        viewset = FactureViewSet()
        viewset.request = request
        viewset.action = 'list'
        
        queryset = viewset.get_queryset()[:10]
        count = self.check_n_plus_one(queryset, "Facture.list sans prefetch produits")
        
        if count > 2:
            print(f"  ❌ {count} requêtes détectées (devrait être 1-2)")
            print("  💡 Solution: Ajouter .prefetch_related('produits', 'paiements')")
        else:
            print(f"  ✅ {count} requêtes - OK")
    
    def analyze_produits_list(self):
        """Analyse la liste des produits"""
        print("\n🔍 Analyse ProduitViewSet...")
        
        reset_queries()
        
        # Simule ce que fait le serializer - version simplifiée pour éviter les erreurs
        produits = Produit.objects.all()[:10]
        for p in produits:
            # Simule l'accès à valeur_stock comme le ferait le serializer
            # En réalité, cette valeur vient de l'annotation SQL dans la vue
            _ = p.stock * p.cost_price if p.stock and p.cost_price else 0
            _ = list(p.stock_lots.all()) if p.use_lot_management else []
        
        count = len(connection.queries)
        
        if count > 2:
            self.issues.append({
                'type': 'N+1',
                'description': 'ProduitSerializer avec stock_lots',
                'query_count': count,
                'severity': 'CRITICAL'
            })
            print(f"  ❌ {count} requêtes (N+1 détecté!)")
            print("  💡 Solution: Produit.objects.prefetch_related('stock_lots')")
        else:
            print(f"  ✅ {count} requêtes - OK")
    
    def analyze_caisse_totals(self):
        """Analyse get_totals dans caisse"""
        print("\n🔍 Analyse CaisseViewSet.get_totals()...")
        
        reset_queries()
        
        from api.models import Caisse, MouvementCaisse
        from django.db.models import Sum, Q
        
        # Simule les requêtes faites par get_totals
        paiements = Caisse.objects.filter(statut='completee')
        
        # 1. Requêtes séparées (AVANT)
        total_ventes = paiements.exclude(
            mode_paiement__in=['en_compte', 'depot']
        ).aggregate(Sum('montant'))
        
        total_recouvrement = paiements.filter(
            Q(mode_paiement='recouvrement')
        ).aggregate(Sum('montant'))
        
        modes_globaux = paiements.exclude(
            mode_paiement__in=['en_compte', 'depot']
        ).values('mode_paiement').annotate(total=Sum('montant'))
        
        mouvements = MouvementCaisse.objects.aggregate(
            entrees=Sum('montant', filter=Q(type='ENTREE')),
            sorties=Sum('montant', filter=Q(type='SORTIE'))
        )
        
        count = len(connection.queries)
        
        if count > 3:
            self.issues.append({
                'type': 'MULTI_QUERY',
                'description': f'Caisse.get_totals fait {count} requêtes',
                'query_count': count,
                'severity': 'WARNING'
            })
            print(f"  ⚠️  {count} requêtes (peut être réduit à 2)")
            print("  💡 Solution: Regrouper en un seul .aggregate()")
        else:
            print(f"  ✅ {count} requêtes - OK")
    
    def generate_report(self):
        """Génère le rapport final"""
        print("\n" + "="*60)
        print("📊 RAPPORT D'OPTIMISATION SQL")
        print("="*60)
        
        if not self.issues:
            print("\n✅ Aucun problème majeur détecté!")
            return
        
        critical = [i for i in self.issues if i['severity'] == 'CRITICAL']
        warnings = [i for i in self.issues if i['severity'] == 'WARNING']
        
        print(f"\n🔴 Problèmes CRITIQUES ({len(critical)}):")
        for issue in critical:
            print(f"  • {issue['description']}: {issue['query_count']} requêtes")
        
        print(f"\n⚠️  Avertissements ({len(warnings)}):")
        for issue in warnings:
            print(f"  • {issue['description']}: {issue['query_count']} requêtes")
        
        print("\n💡 Recommandations:")
        print("  1. Utiliser select_related() pour les FK (OneToOne, ForeignKey)")
        print("  2. Utiliser prefetch_related() pour les ManyToMany, reverse FK")
        print("  3. Utiliser annotate() pour les calculs d'agrégation")
        print("  4. Éviter les SerializerMethodField qui font des requêtes")
        print("  5. Utiliser values() / values_list() pour les exports CSV")
        print("  6. Activer le cache Redis pour les données fréquemment accédées")


def main():
    """Point d'entrée principal"""
    print("🚀 Début de l'analyse des requêtes SQL...")
    
    optimizer = QueryOptimizer()
    
    # Exécute les analyses
    optimizer.analyze_factures_list()
    optimizer.analyze_produits_list()
    optimizer.analyze_caisse_totals()
    
    # Génère le rapport
    optimizer.generate_report()
    
    # Sauvegarde les résultats
    import json
    from datetime import datetime
    
    report_file = os.path.join(
        os.path.dirname(__file__), 
        f'query_optimization_report_{datetime.now():%Y%m%d_%H%M%S}.json'
    )
    
    with open(report_file, 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'issues': optimizer.issues
        }, f, indent=2)
    
    print(f"\n📁 Rapport sauvegardé: {report_file}")


if __name__ == '__main__':
    # Active le mode debug pour compter les requêtes
    with override_settings(DEBUG=True):
        main()
