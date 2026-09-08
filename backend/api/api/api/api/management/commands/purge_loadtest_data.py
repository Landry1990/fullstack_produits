"""
Supprime les données générées par un test de charge.

Les objets de test sont identifiés par le préfixe littéral « [TEST] » dans leur
nom. Ce préfixe est volontairement strict : un filtre sur « %test% » détruirait
de vrais produits du catalogue (BB TEST GROSSESSE, ETHYLOTEST, LEVO TEST
GROSSESSE, ...).

L'ordre de suppression respecte les contraintes on_delete=PROTECT :
    Facture.client, RelevePaiement.client et StockAllocation.stock_lot.

Usage :
    python manage.py purge_loadtest_data --dry-run
    python manage.py purge_loadtest_data --confirm
    python manage.py purge_loadtest_data --confirm --purge-user
"""
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import ProtectedError

from api.models import Client, Facture, Produit

TEST_PREFIX = '[TEST]'
LOADTEST_USERNAME = 'loadtest'
BATCH_SIZE = 500


class Command(BaseCommand):
    help = "Supprime les produits, clients et factures préfixés « [TEST] »."

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            help="Exécute réellement la suppression.",
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help="Affiche le périmètre sans rien supprimer (défaut).",
        )
        parser.add_argument(
            '--purge-user',
            action='store_true',
            help=(
                "Supprime aussi les factures créées par le compte "
                f"« {LOADTEST_USERNAME} » ainsi que le compte lui-même."
            ),
        )

    def handle(self, *args, **options):
        if not options['confirm'] and not options['dry_run']:
            raise CommandError(
                "Précisez --dry-run pour un aperçu ou --confirm pour exécuter."
            )

        produits = Produit.objects.filter(name__startswith=TEST_PREFIX)
        clients = Client.objects.filter(name__startswith=TEST_PREFIX)
        factures = Facture.objects.filter(client__name__startswith=TEST_PREFIX)

        nb_produits = produits.count()
        nb_clients = clients.count()
        nb_factures = factures.count()

        self.stdout.write("Périmètre détecté :")
        self.stdout.write(f"  Factures : {nb_factures}")
        self.stdout.write(f"  Clients  : {nb_clients}")
        self.stdout.write(f"  Produits : {nb_produits}")

        # Garde-fou : vérifier qu'aucune facture réelle n'utilise un produit de test.
        orphelines = (
            Facture.objects
            .filter(produits__produit__name__startswith=TEST_PREFIX)
            .exclude(client__name__startswith=TEST_PREFIX)
            .distinct()
            .count()
        )
        if orphelines:
            raise CommandError(
                f"{orphelines} facture(s) hors périmètre référencent un produit "
                "« [TEST] ». Suppression interrompue pour éviter une perte de "
                "données réelles."
            )

        if options['dry_run'] and not options['confirm']:
            self.stdout.write(self.style.WARNING("Dry-run : aucune suppression."))
            return

        self._delete_in_batches(factures, "factures")
        self._delete_in_batches(clients, "clients")
        self._delete_in_batches(produits, "produits")

        if options['purge_user']:
            self._purge_loadtest_user()

        self.stdout.write(self.style.SUCCESS("Purge terminée."))
        self.stdout.write(f"  Produits restants : {Produit.objects.count()}")
        self.stdout.write(f"  Clients restants  : {Client.objects.count()}")
        self.stdout.write(f"  Factures restantes: {Facture.objects.count()}")

    def _purge_loadtest_user(self):
        """Supprime les documents du compte de test de charge, puis le compte."""
        user = User.objects.filter(username=LOADTEST_USERNAME).first()
        if user is None:
            self.stdout.write(f"  Compte « {LOADTEST_USERNAME} » absent.")
            return

        self._delete_in_batches(
            Facture.objects.filter(created_by=user),
            f"factures de {LOADTEST_USERNAME}",
        )
        try:
            user.delete()
        except ProtectedError as exc:
            raise CommandError(
                f"Suppression du compte « {LOADTEST_USERNAME} » bloquée par une "
                f"contrainte PROTECT : {exc}"
            ) from exc
        self.stdout.write(f"  Compte « {LOADTEST_USERNAME} » supprimé.")

    def _delete_in_batches(self, queryset, label):
        """Supprime par lots pour éviter de charger tout le graphe en mémoire."""
        model = queryset.model
        total = 0
        while True:
            ids = list(queryset.values_list('pk', flat=True)[:BATCH_SIZE])
            if not ids:
                break
            try:
                with transaction.atomic():
                    model.objects.filter(pk__in=ids).delete()
            except ProtectedError as exc:
                raise CommandError(
                    f"Suppression de {label} bloquée par une contrainte "
                    f"PROTECT : {exc}"
                ) from exc
            total += len(ids)
            self.stdout.write(f"  {label} supprimés : {total}", ending='\r')
            self.stdout.flush()
        self.stdout.write(f"  {label} supprimés : {total}")
