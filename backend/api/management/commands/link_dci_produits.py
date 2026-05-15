"""
Lie automatiquement les produits de CETTE pharmacie aux DCI déjà importées.
À relancer si de nouveaux produits ont été créés dans la pharmacie.

Usage:
    python manage.py link_dci_produits
    python manage.py link_dci_produits --dry-run
"""
import unicodedata
import re
from django.core.management.base import BaseCommand
from api.models import Produit, Substance, MedicamentReference


def normalize(text):
    if not text:
        return ""
    text = "".join(c for c in unicodedata.normalize('NFKD', text) if not unicodedata.combining(c))
    text = text.upper()
    text = re.sub(r'(\d+)\s*(MG|G|ML|UI|UG)', r'\1 \2', text)
    text = re.sub(r'[,\.;:/!|_]', ' ', text)
    text = " ".join(text.split())
    return text


class Command(BaseCommand):
    help = "Auto-link les produits de la pharmacie vers les DCI déjà importées"

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Simulation sans modification')

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        action = "🔍 SIMULATION" if dry_run else "🔗 Lancement"
        self.stdout.write(self.style.HTTP_INFO(f"{action} de l'auto-link DCI..."))

        produits = Produit.objects.filter(dci_reference__isnull=True)
        total = produits.count()
        if total == 0:
            self.stdout.write(self.style.SUCCESS("   Tous les produits sont déjà liés — rien à faire"))
            return

        substances_map = {normalize(s.nom): s for s in Substance.objects.all()}
        linked = 0

        for i, p in enumerate(produits):
            if i % 100 == 0:
                self.stdout.write(f"   {i}/{total} (liés: {linked})")

            p_keywords = [t for t in normalize(p.name).split() if len(t) > 2]
            if not p_keywords:
                continue

            # Stratégie 1: match via MedicamentReference
            ref = MedicamentReference.objects.filter(nom__icontains=p.name).first()
            if not ref and len(p_keywords) >= 2:
                prefix = f"{p_keywords[0]} {p_keywords[1]}"
                ref = MedicamentReference.objects.filter(nom__istartswith=prefix).first()

            was_linked = False

            if ref and ref.substances:
                for s_name in [s.strip() for s in ref.substances.split(';') if s.strip()]:
                    s_norm = normalize(s_name)
                    substance = substances_map.get(s_norm)
                    if not substance:
                        continue
                    if not dry_run:
                        p.substances.add(substance)
                        if not p.dci_reference:
                            p.dci_reference = substance
                    was_linked = True

            # Stratégie 2: mot-clé est une DCI connue
            if not was_linked:
                for kw in p_keywords:
                    if len(kw) > 4:
                        substance = substances_map.get(kw)
                        if substance:
                            if not dry_run:
                                p.substances.add(substance)
                                if not p.dci_reference:
                                    p.dci_reference = substance
                            was_linked = True
                            break

            if was_linked and not dry_run:
                p.is_generic = True
                p.save()
                linked += 1
            elif was_linked and dry_run:
                linked += 1

        if dry_run:
            self.stdout.write(self.style.WARNING(f"   {linked}/{total} produits auraient été liés"))
        else:
            self.stdout.write(self.style.SUCCESS(f"   {linked}/{total} produits liés"))
