import random
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from faker import Faker
from datetime import timedelta

from api.models.products import Produit, Rayon, Forme, Groupe
from api.models.clients import Client, Fournisseur
from api.models.billing import Facture, FactureProduit

class Command(BaseCommand):
    help = 'Génère un gros volume de données aléatoires pour tester les performances de la base de données.'

    def add_arguments(self, parser):
        parser.add_argument('--products', type=int, default=10000, help='Nombre de produits à créer (défaut: 10000)')
        parser.add_argument('--clients', type=int, default=1000, help='Nombre de clients à créer (défaut: 1000)')
        parser.add_argument('--factures', type=int, default=5000, help='Nombre de factures à créer (défaut: 5000)')
        parser.add_argument('--cleanup', action='store_true', help='Supprime UNIQUEMENT les données générées par ce script')

    def handle(self, *args, **options):
        self.faker = Faker('fr_FR')
        cleanup = options['cleanup']

        if cleanup:
            self.cleanup_fake_data()
            return

        num_products = options['products']
        num_clients = options['clients']
        num_factures = options['factures']

        self.stdout.write(self.style.WARNING(f"Début de la génération de données : {num_products} produits, {num_clients} clients, {num_factures} factures..."))

        self.generate_references()
        self.generate_clients(num_clients)
        self.generate_products(num_products)
        self.generate_factures(num_factures)

        self.stdout.write(self.style.SUCCESS("Génération terminée avec succès !"))

    @transaction.atomic
    def cleanup_fake_data(self):
        """
        Supprime uniquement les données générées par le script.
        On utilise un marqueur distinctif : par exemple, tous les produits générés ont un nom commençant par '[TEST]'.
        """
        self.stdout.write(self.style.WARNING("Début du nettoyage des données de test..."))
        
        # 1. Supprimer les lignes de facture et factures
        factures_deleted, _ = Facture.objects.filter(notes__startswith='[TEST]').delete()
        self.stdout.write(f"Suppression de {factures_deleted} factures de test.")
        
        # 2. Supprimer les produits
        produits_deleted, _ = Produit.objects.filter(name__startswith='[TEST] ').delete()
        self.stdout.write(f"Suppression de {produits_deleted} produits de test.")
        
        # 3. Supprimer les clients
        clients_deleted, _ = Client.objects.filter(name__startswith='[TEST] ').delete()
        self.stdout.write(f"Suppression de {clients_deleted} clients de test.")
        
        self.stdout.write(self.style.SUCCESS("Nettoyage terminé !"))

    def generate_references(self):
        self.stdout.write("Génération des références (Rayons, Formes, Groupes)...")
        if not Rayon.objects.exists():
            for i in range(10):
                Rayon.objects.create(name=f"Rayon {self.faker.word().capitalize()}")
        
        if not Forme.objects.exists():
            for i in range(10):
                Forme.objects.create(nom=f"Forme {self.faker.word().capitalize()}")
                
        if not Groupe.objects.exists():
            for i in range(10):
                Groupe.objects.create(nom=f"Groupe {self.faker.word().capitalize()}")
                
        if not Fournisseur.objects.exists():
            for i in range(10):
                Fournisseur.objects.create(
                    name=self.faker.company(),
                    phone=f"+{self.faker.random_number(digits=10, fix_len=True)}",
                    email=self.faker.email()
                )

    def generate_clients(self, count):
        self.stdout.write(f"Génération de {count} clients...")
        batch = []
        for _ in range(count):
            client = Client(
                name=f"[TEST] {self.faker.name()}",
                address=self.faker.address(),
                phone=f"+{self.faker.random_number(digits=12, fix_len=True)}",
                email=f"test_{self.faker.uuid4()}@example.com",
            )
            batch.append(client)
            if len(batch) >= 2000:
                Client.objects.bulk_create(batch)
                batch = []
        if batch:
            Client.objects.bulk_create(batch)

    def generate_products(self, count):
        self.stdout.write(f"Génération de {count} produits...")
        rayons = list(Rayon.objects.all())
        formes = list(Forme.objects.all())
        groupes = list(Groupe.objects.all())
        fournisseurs = list(Fournisseur.objects.all())

        batch = []
        for _ in range(count):
            cost_price = Decimal(random.uniform(500, 5000)).quantize(Decimal('0.01'))
            selling_price = cost_price * Decimal(random.uniform(1.2, 2.0)).quantize(Decimal('0.01'))
            
            produit = Produit(
                name=f"[TEST] {self.faker.catch_phrase()[:80]}",
                rayon=random.choice(rayons) if rayons else None,
                forme=random.choice(formes) if formes else None,
                groupe=random.choice(groupes) if groupes else None,
                fournisseur=random.choice(fournisseurs) if fournisseurs else None,
                stock=random.randint(0, 500),
                cost_price=cost_price,
                selling_price=selling_price,
                cip1=self.faker.ean13(),
                tva=Decimal('19.25'),
            )
            batch.append(produit)
            if len(batch) >= 5000:
                Produit.objects.bulk_create(batch)
                self.stdout.write(f"  ... {Produit.objects.filter(name__startswith='[TEST]').count()} insérés")
                batch = []
        if batch:
            Produit.objects.bulk_create(batch)

    def generate_factures(self, count):
        self.stdout.write(f"Génération de {count} factures et lignes (étape la plus longue)...")
        clients = list(Client.objects.filter(name__startswith='[TEST]'))
        if not clients:
            clients = list(Client.objects.all()[:100])
            
        produits = list(Produit.objects.filter(name__startswith='[TEST]'))
        if not produits:
            produits = list(Produit.objects.all()[:1000])

        if not produits:
            self.stdout.write(self.style.ERROR("Aucun produit disponible pour créer des factures."))
            return

        batch_factures = []
        for i in range(count):
            facture = Facture(
                client=random.choice(clients) if clients else None,
                numero_facture=f"F-TEST-{self.faker.random_number(digits=8, fix_len=True)}",
                status=Facture.Status.VALIDEE,
                notes='[TEST] Facture générée automatiquement',
                total_ht=Decimal('0.00'), # Seront recalculés à la fin
                total_tva=Decimal('0.00'),
                total_ttc=Decimal('0.00')
            )
            # Simuler des dates dans le passé pour de belles courbes stats
            facture.date = timezone.now() - timedelta(days=random.randint(0, 365))
            batch_factures.append(facture)

            if len(batch_factures) >= 2000:
                Facture.objects.bulk_create(batch_factures)
                self._generate_lignes_for_factures(batch_factures, produits)
                self.stdout.write(f"  ... Factures créées.")
                batch_factures = []

        if batch_factures:
            Facture.objects.bulk_create(batch_factures)
            self._generate_lignes_for_factures(batch_factures, produits)

    def _generate_lignes_for_factures(self, factures_batch, produits_dispos):
        # Pour insérer les lignes de facture on a besoin de recupérer les objets Facture avec leur ID depuis la DB.
        numeros = [f.numero_facture for f in factures_batch]
        factures_in_db = Facture.objects.filter(numero_facture__in=numeros)
        
        batch_lignes = []
        for facture in factures_in_db:
            num_lignes = random.randint(1, 5)
            produits_choisis = random.sample(produits_dispos, min(num_lignes, len(produits_dispos)))
            
            total_ttc = Decimal('0.00')
            
            for produit in produits_choisis:
                qty = random.randint(1, 5)
                prix_vente = produit.selling_price
                
                ligne = FactureProduit(
                    facture=facture,
                    produit=produit,
                    produit_nom=produit.name,
                    quantity=qty,
                    selling_price=prix_vente,
                    tva=produit.tva
                )
                batch_lignes.append(ligne)
                total_ttc += qty * prix_vente
            
            # Mise à jour rapide des totaux de la facture pour faire plus réaliste
            facture.total_ttc = total_ttc
            
        FactureProduit.objects.bulk_create(batch_lignes)
        Facture.objects.bulk_update(factures_in_db, ['total_ttc'])
