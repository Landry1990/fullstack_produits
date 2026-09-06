from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = 'Supprime toutes les données transactionnelles mais conserve les données de référence'

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Confirmer la suppression',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if not options['confirm']:
            self.stdout.write(self.style.ERROR('⚠️  ATTENTION: Opération IRRÉVERSIBLE !'))
            self.stdout.write('\nCette commande va supprimer :')
            self.stdout.write('  ❌ Toutes les factures')
            self.stdout.write('  ❌ Toutes les commandes')
            self.stdout.write('  ❌ Tous les lots de stock')
            self.stdout.write('  ❌ Toutes les autres données transactionnelles')
            self.stdout.write('\n✅ Les produits, clients et fournisseurs seront conservés')
            self.stdout.write('✅ Le stock des produits sera remis à 0\n')
            self.stdout.write(self.style.WARNING('Pour confirmer: --confirm'))
            return

        self.stdout.write('🗑️  Suppression en cours...\n')
        
        # Import ici pour éviter problèmes au démarrage
        from api import models
        
        counts = {}
        
       # Delete in order of dependencies
        try:
            # FactureProduitAllocation depends on FactureProduit
            if hasattr(models, 'FactureProduitAllocation'):
                c = models.FactureProduitAllocation.objects.all().count()
                models.FactureProduitAllocation.objects.all().delete()
                counts['Allocations FIFO'] = c
        except Exception as e:
            self.stdout.write(f'FactureProduitAllocation: {e}')
        
        try:
            # FactureProduit depends on Facture
            if hasattr(models, 'FactureProduit'):
                c = models.FactureProduit.objects.all().count()
                models.FactureProduit.objects.all().delete()
                counts['Lignes facture'] = c
        except Exception as e:
            self.stdout.write(f'FactureProduit: {e}')
        
        try:
            # Factures
            if hasattr(models, 'Facture'):
                c = models.Facture.objects.all().count()
                models.Facture.objects.all().delete()
                counts['Factures'] = c
        except Exception as e:
            self.stdout.write(f'Facture: {e}')
        
        try:
            # StockLot
            if hasattr(models, 'StockLot'):
                c = models.StockLot.objects.all().count()
                models.StockLot.objects.all().delete()
                counts['Lots de stock'] = c
        except Exception as e:
            self.stdout.write(f'StockLot: {e}')
        
        try:
            # CommandeProduit depends on Commande
            if hasattr(models, 'CommandeProduit'):
                c = models.CommandeProduit.objects.all().count()
                models.CommandeProduit.objects.all().delete()
                counts['Lignes commande'] = c
        except Exception as e:
            self.stdout.write(f'CommandeProduit: {e}')
        
        try:
            # Commandes
            if hasattr(models, 'Commande'):
                c = models.Commande.objects.all().count()
                models.Commande.objects.all().delete()
                counts['Commandes'] = c
        except Exception as e:
            self.stdout.write(f'Commande: {e}')
        
        try:
            if hasattr(models, 'Promis'):
                c = models.Promis.objects.all().count()
                models.Promis.objects.all().delete()
                counts['Promis'] = c
        except Exception as e:
            self.stdout.write(f'Promis: {e}')
        
        try:
            if hasattr(models, 'Avoir'):
                c = models.Avoir.objects.all().count()
                models.Avoir.objects.all().delete()
                counts['Avoirs'] = c
        except Exception as e:
            self.stdout.write(f'Avoir: {e}')
        
        try:
            if hasattr(models, 'Creance'):
                c = models.Creance.objects.all().count()
                models.Creance.objects.all().delete()
                counts['Créances'] = c
        except Exception as e:
            self.stdout.write(f'Creance: {e}')
        
        try:
            if hasattr(models, 'HistoriqueTransformation'):
                c = models.HistoriqueTransformation.objects.all().count()
                models.HistoriqueTransformation.objects.all().delete()
                counts['Transformations'] = c
        except Exception as e:
            self.stdout.write(f'HistoriqueTransformation: {e}')
        
        # Reset stock to 0
        try:
            c = models.Produit.objects.all().count()
            models.Produit.objects.all().update(stock=0, pmp=0)
            counts['Produits (stock→0)'] = c
        except Exception as e:
            self.stdout.write(f'Reset stock: {e}')
        
        # Summary
        self.stdout.write('\n' + self.style.SUCCESS('✅ Suppression terminée !'))
        self.stdout.write('\nRésumé :')
        for name, count in counts.items():
            if count > 0:
                self.stdout.write(f'  • {name}: {count}')
        
        self.stdout.write('\n' + self.style.SUCCESS('Données conservées :'))
        self.stdout.write(f'  ✅ Produits: {models.Produit.objects.count()}')
        self.stdout.write(f'  ✅ Clients: {models.Client.objects.count()}')
        self.stdout.write(f'  ✅ Fournisseurs: {models.Fournisseur.objects.count()}')
        self.stdout.write(f'  ✅ Rayons: {models.Rayon.objects.count()}')
