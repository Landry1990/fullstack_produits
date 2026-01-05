from django.core.management.base import BaseCommand
from api.models import Client


class Command(BaseCommand):
    help = 'Vérifie la configuration des clients professionnels'

    def handle(self, *args, **options):
        self.stdout.write("=" * 60)
        self.stdout.write("DIAGNOSTIC: Clients Professionnels")
        self.stdout.write("=" * 60)

        clients_pro = Client.objects.filter(client_type='PROFESSIONNEL')

        if not clients_pro.exists():
            self.stdout.write(self.style.WARNING("\n⚠️  AUCUN CLIENT PROFESSIONNEL TROUVÉ"))
            self.stdout.write("\nCréez un client professionnel avec:")
            self.stdout.write("- Type: PROFESSIONNEL")
            self.stdout.write("- Taux de couverture: 70 (pour 70%)")
            return

        self.stdout.write(self.style.SUCCESS(f"\n✅ {clients_pro.count()} client(s) professionnel(s):\n"))
        
        has_valid_client = False
        
        for client in clients_pro:
            self.stdout.write(f"\n📋 {client.name} (ID: {client.id})")
            self.stdout.write(f"   Type: {client.client_type}")
            self.stdout.write(f"   Taux couverture: {client.taux_couverture}")
            self.stdout.write(f"   Plafond: {client.plafond} F")
            
            if client.taux_couverture is None:
                self.stdout.write(self.style.ERROR("   ❌ taux_couverture est NULL - À CORRIGER!"))
            elif float(client.taux_couverture) == 0:
                self.stdout.write(self.style.WARNING("   ⚠️  taux_couverture = 0 (pas de tiers payant)"))
            else:
                taux = float(client.taux_couverture)
                self.stdout.write(self.style.SUCCESS(f"   ✅ Tiers payant: Patient={100-taux}%, Assurance={taux}%"))
                has_valid_client = True
            
            ayants = client.ayants_droit.count()
            if ayants > 0:
                self.stdout.write(f"   👥 {ayants} ayant(s) droit")
            else:
                self.stdout.write(self.style.WARNING("   ⚠️  Aucun ayant droit"))

        self.stdout.write("\n" + "=" * 60)
        if not has_valid_client:
            self.stdout.write(self.style.ERROR("\n❌ PROBLÈME IDENTIFIÉ:"))
            self.stdout.write("Aucun client n'a de taux_couverture valide (> 0)\n")
            self.stdout.write("SOLUTION:")
            self.stdout.write("1. Allez dans Clients")
            self.stdout.write("2. Éditez un client professionnel")
            self.stdout.write("3. Définissez 'Taux couverture' = 70 (pour 70%)")
        else:
            self.stdout.write(self.style.SUCCESS("\n✅ Configuration OK"))
